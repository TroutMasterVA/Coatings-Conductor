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
import { createHmac, hkdfSync } from "node:crypto";
import type { Sql } from "../db";
import { secretMode } from "../auth/secret.server";

export type Rule = {
  max: number;
  windowSec: number;
  /** When set, reaching `max` locks the key for this long (no takes allowed until it ends). */
  lockSec?: number;
};

export type TakeResult = { allowed: boolean; count: number; retryAfterSec: number; locked: boolean };

/**
 * Stored keys are HMAC-SHA256(k, bucket NUL raw) with k = HKDF-SHA256(BETTER_AUTH_SECRET, fixed
 * label) (SEC, PR #52). Without the server secret, a leaked table can't be matched against a list of
 * emails or IPs. Rotating BETTER_AUTH_SECRET (or this change itself, versus the earlier plain sha256
 * keys) gives every limiter row a new key: a one-time reset of all counts and locks.
 * Without a server secret (local dev / tests, or a logins-off preview) a fixed dev-only key is used
 * so every instance still agrees.
 */
export const LIMITER_KEY_LABEL = "coatings-conductor/rate-limit-keys/v1";
const DEV_ONLY_LIMITER_SECRET = "coatings-conductor-dev-only-limiter-key (not a secret)";

export function deriveLimiterKey(secret: string): Buffer {
  return Buffer.from(hkdfSync("sha256", secret, "", LIMITER_KEY_LABEL, 32));
}

let cachedKey: { secret: string; key: Buffer } | null = null;
function limiterKey(): Buffer {
  const mode = secretMode();
  const secret = mode.kind === "secret" ? mode.secret : DEV_ONLY_LIMITER_SECRET;
  if (!cachedKey || cachedKey.secret !== secret) cachedKey = { secret, key: deriveLimiterKey(secret) };
  return cachedKey.key;
}

export function hashKeyWith(key: Buffer, bucket: string, raw: string): string {
  return createHmac("sha256", key).update(`${bucket}\u0000${raw}`).digest("hex");
}

export function hashKey(bucket: string, raw: string): string {
  return hashKeyWith(limiterKey(), bucket, raw);
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

// ---------------------------------------------------------------------------------------------
// Reservations (BUG-52-1). Used for the login lockout: an attempt is RESERVED before the password
// check and SETTLED afterwards. Columns: `count` = reservations in this window that were not given
// back (in-flight + finished), `pending` = reservations still in flight.
//
// reserve: allowed only when not locked and count < max, so at most `max` password checks run per
//          window however many arrive at once (Postgres row-locks the key; one statement).
//          A try refused because the cap is full starts the lock (sticky until it expires).
// settle:  'failure' -> pending-1; if count >= max the lock starts (sticky).
//          'refund'  -> count-1, pending-1 (no password was checked, or the bucket only counts
//                       failures); NEVER lifts a lock.
//          'success' -> pending-1; the row is reset only when this was the LAST reservation in
//                       flight and the key is not locked. Otherwise nothing is given back, so a
//                       success inside a burst never clears what other attempts pushed to the cap.
// A reservation whose settle never runs (crash) stays counted and in flight: the safe side.
// ---------------------------------------------------------------------------------------------

export type ReserveResult = TakeResult & { lockedUntil: string | null };

// $1 bucket, $2 key, $3 windowSec, $4 max, $5 lockSec (0 = no lock).
// Every `r.` column in the UPDATE is the row's value BEFORE this statement.
const RESERVE_SQL = `
insert into rate_limits as r (bucket, key, window_start, count, pending, locked_until, expires_at, allowed)
values ($1, $2, now(), 1, 1, null, now() + make_interval(secs => $3::int), 1 <= $4::int)
on conflict (bucket, key) do update set
  allowed = (coalesce(r.locked_until > now(), false) = false)
            and (r.expires_at <= now() or r.count < $4::int),
  count = case
    when coalesce(r.locked_until > now(), false) then r.count
    when r.expires_at <= now() then 1
    when r.count < $4::int then r.count + 1
    else r.count end,
  pending = case
    when coalesce(r.locked_until > now(), false) then r.pending
    when r.expires_at <= now() then 1
    when r.count < $4::int then r.pending + 1
    else r.pending end,
  window_start = case
    when coalesce(r.locked_until > now(), false) then r.window_start
    when r.expires_at <= now() then now()
    else r.window_start end,
  locked_until = case
    when coalesce(r.locked_until > now(), false) then r.locked_until
    when r.expires_at <= now() then null
    when r.count >= $4::int and $5::int > 0 then now() + make_interval(secs => $5::int)
    else null end,
  expires_at = case
    when coalesce(r.locked_until > now(), false) then r.expires_at
    when r.expires_at <= now() then now() + make_interval(secs => $3::int)
    when r.count >= $4::int and $5::int > 0 then greatest(r.expires_at, now() + make_interval(secs => $5::int))
    else r.expires_at end
returning
  allowed,
  count,
  coalesce(locked_until > now(), false) as locked,
  case when locked_until > now() then to_char(locked_until at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') end as locked_until_iso,
  greatest(1, ceil(extract(epoch from (coalesce(case when locked_until > now() then locked_until end, expires_at) - now()))))::int as retry_after_sec
`;

// $1 bucket, $2 key, $3 outcome ('failure' | 'refund' | 'success'), $4 max, $5 lockSec.
const SETTLE_SQL = `
update rate_limits as r set
  pending = case
    when $3::text = 'success' and r.pending <= 1 and coalesce(r.locked_until > now(), false) = false then 0
    else greatest(r.pending - 1, 0) end,
  count = case
    when $3::text = 'success' and r.pending <= 1 and coalesce(r.locked_until > now(), false) = false then 0
    when $3::text = 'refund' then greatest(r.count - 1, 0)
    else r.count end,
  locked_until = case
    when coalesce(r.locked_until > now(), false) then r.locked_until
    when $3::text = 'failure' and $5::int > 0 and r.count >= $4::int then now() + make_interval(secs => $5::int)
    else r.locked_until end,
  expires_at = case
    when $3::text = 'success' and r.pending <= 1 and coalesce(r.locked_until > now(), false) = false then now()
    when coalesce(r.locked_until > now(), false) = false and $3::text = 'failure' and $5::int > 0 and r.count >= $4::int
      then greatest(r.expires_at, now() + make_interval(secs => $5::int))
    else r.expires_at end
where r.bucket = $1 and r.key = $2 and r.expires_at > now()
`;

type ReserveRow = Row & { locked_until_iso: string | null };

export async function reserve(
  sql: Sql,
  bucket: string,
  rawKey: string,
  rule: Rule,
  opts: { random?: () => number } = {},
): Promise<ReserveResult> {
  const rows = await sql.query<ReserveRow>(RESERVE_SQL, [
    bucket,
    hashKey(bucket, rawKey),
    Math.max(1, Math.round(rule.windowSec)),
    Math.max(1, Math.round(rule.max)),
    Math.max(0, Math.round(rule.lockSec ?? 0)),
  ]);
  const row = rows[0];
  if (!row) throw new Error("rate limit reserve returned no row");
  const allowed = row.allowed === true;
  const result: ReserveResult = {
    allowed,
    count: Number(row.count),
    locked: row.locked === true,
    retryAfterSec: allowed ? 0 : Math.max(1, Number(row.retry_after_sec)),
    lockedUntil: row.locked_until_iso ?? null,
  };
  if ((opts.random ?? Math.random)() < CLEANUP_CHANCE) {
    try {
      await cleanupExpired(sql);
    } catch {
      // Best effort.
    }
  }
  return result;
}

export type SettleOutcome = "failure" | "refund" | "success";

export async function settle(
  sql: Sql,
  bucket: string,
  rawKey: string,
  outcome: SettleOutcome,
  rule: Pick<Rule, "max" | "lockSec">,
): Promise<void> {
  await sql.query(SETTLE_SQL, [
    bucket,
    hashKey(bucket, rawKey),
    outcome,
    Math.max(1, Math.round(rule.max)),
    Math.max(0, Math.round(rule.lockSec ?? 0)),
  ]);
}
