/**
 * Shared-database limiter (item 3). Every decision is ONE SQL statement:
 * `INSERT ... ON CONFLICT DO UPDATE ... RETURNING`. Postgres locks the conflicting row, so
 * concurrent takes on one key run one after another and each sees the previous count. All times
 * come from the database clock (`now()`), so replicas agree.
 *
 * Fixed windows. A row's `expires_at` is the later of its window end and its lock end; a take on an
 * expired row starts a fresh window. Expired rows are cleaned opportunistically (no cron).
 *
 * The SQL client is passed in (`Sql` from ../db), so this file runs on Neon/pg, PGLite and in tests.
 */
import { createHash } from "node:crypto";
import type { Sql } from "../db";

export type Rule = {
  max: number;
  windowSec: number;
  /** When set, reaching `max` locks the key for this long (no takes allowed until it ends). */
  lockSec?: number;
};

export type TakeResult = { allowed: boolean; count: number; retryAfterSec: number; locked: boolean };

export function hashKey(bucket: string, raw: string): string {
  return createHash("sha256").update(`${bucket}\u0000${raw}`).digest("hex");
}

// $1 bucket, $2 key, $3 windowSec, $4 max, $5 lockSec (0 = no lock).
// In the UPDATE, every `r.` column is the row's value BEFORE this statement, so "was it still
// locked" and "had the window expired" are read in the same statement that writes the new state.
const TAKE_SQL = `
insert into rate_limits as r (bucket, key, window_start, count, locked_until, expires_at, allowed)
values (
  $1, $2, now(), 1,
  case when $5::int > 0 and 1 >= $4::int then now() + make_interval(secs => $5::int) end,
  greatest(now() + make_interval(secs => $3::int),
           case when $5::int > 0 and 1 >= $4::int then now() + make_interval(secs => $5::int) end),
  1 <= $4::int
)
on conflict (bucket, key) do update set
  allowed = (coalesce(r.locked_until > now(), false) = false)
            and (case when r.expires_at <= now() then 1 else r.count + 1 end) <= $4::int,
  count = case
    when coalesce(r.locked_until > now(), false) then r.count
    when r.expires_at <= now() then 1
    else r.count + 1 end,
  window_start = case
    when coalesce(r.locked_until > now(), false) then r.window_start
    when r.expires_at <= now() then now()
    else r.window_start end,
  locked_until = case
    when coalesce(r.locked_until > now(), false) then r.locked_until
    when $5::int > 0 and (case when r.expires_at <= now() then 1 else r.count + 1 end) >= $4::int
      then now() + make_interval(secs => $5::int)
    else null end,
  expires_at = case
    when coalesce(r.locked_until > now(), false) then r.expires_at
    when r.expires_at <= now() then greatest(
      now() + make_interval(secs => $3::int),
      case when $5::int > 0 and 1 >= $4::int then now() + make_interval(secs => $5::int) end)
    else greatest(
      r.expires_at,
      case when $5::int > 0 and r.count + 1 >= $4::int then now() + make_interval(secs => $5::int) end)
    end
returning
  allowed,
  count,
  coalesce(locked_until > now(), false) as locked,
  greatest(1, ceil(extract(epoch from (coalesce(locked_until, expires_at) - now()))))::int as retry_after_sec
`;

/** Give back one take (e.g. a sign-in that never checked a password, or that succeeded). */
// $1 bucket, $2 key, $3 max: a lock set only because in-flight takes reached max is lifted once the
// real count drops back under max.
const REFUND_SQL = `
update rate_limits set
  count = greatest(count - 1, 0),
  locked_until = case when greatest(count - 1, 0) < $3::int then null else locked_until end
where bucket = $1 and key = $2 and expires_at > now()
`;

const CLEAR_SQL = `delete from rate_limits where bucket = $1 and key = $2`;

const CLEANUP_SQL = `
delete from rate_limits where ctid in (
  select ctid from rate_limits where expires_at < now() - interval '5 minutes' limit 500
)`;

export const CLEANUP_CHANCE = 0.02;

type Row = { allowed: boolean; count: number | string; locked: boolean; retry_after_sec: number | string };

export async function take(
  sql: Sql,
  bucket: string,
  rawKey: string,
  rule: Rule,
  opts: { random?: () => number } = {},
): Promise<TakeResult> {
  const rows = await sql.query<Row>(TAKE_SQL, [
    bucket,
    hashKey(bucket, rawKey),
    Math.max(1, Math.round(rule.windowSec)),
    Math.max(1, Math.round(rule.max)),
    Math.max(0, Math.round(rule.lockSec ?? 0)),
  ]);
  const row = rows[0];
  if (!row) throw new Error("rate limit take returned no row");
  const result: TakeResult = {
    allowed: row.allowed === true,
    count: Number(row.count),
    locked: row.locked === true,
    retryAfterSec: row.allowed === true ? 0 : Math.max(1, Number(row.retry_after_sec)),
  };
  if ((opts.random ?? Math.random)() < CLEANUP_CHANCE) {
    try {
      await cleanupExpired(sql);
    } catch {
      // Cleanup is best effort; the decision above is already made.
    }
  }
  return result;
}

export async function refund(sql: Sql, bucket: string, rawKey: string, max: number): Promise<void> {
  await sql.query(REFUND_SQL, [bucket, hashKey(bucket, rawKey), max]);
}

export async function clear(sql: Sql, bucket: string, rawKey: string): Promise<void> {
  await sql.query(CLEAR_SQL, [bucket, hashKey(bucket, rawKey)]);
}

export async function cleanupExpired(sql: Sql): Promise<void> {
  await sql.query(CLEANUP_SQL, []);
}
