// Shared limiter SQL (item 3). Always runs on PGLite; also runs on real Postgres when
// TEST_DATABASE_URL is set (CI's postgres:16 service), where parallel takes really overlap.
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { cleanupExpired, clear, hashKey, refund, take } from "./limiter.ts";
import { TEST_DATABASE_URL, pgliteDb, postgresDb, type TestDb } from "../test-support/rate-limit-db.ts";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const never = () => 1; // never run opportunistic cleanup unless a test asks for it

const backends: [string, () => Promise<TestDb>][] = [["PGLite", () => pgliteDb()]];
if (TEST_DATABASE_URL) backends.push(["Postgres (TEST_DATABASE_URL)", () => postgresDb()]);

for (const [name, open] of backends) {
  describe(`shared limiter on ${name}`, () => {
    let db: TestDb;
    before(async () => {
      db = await open();
    });
    after(async () => {
      await db.close();
    });

    it("allows up to max in the window, then denies with a retry-after", async () => {
      for (let i = 1; i <= 3; i += 1) {
        const r = await take(db.sql, "t-rate", "k1", { max: 3, windowSec: 60 }, { random: never });
        assert.equal(r.allowed, true);
        assert.equal(r.count, i);
      }
      const denied = await take(db.sql, "t-rate", "k1", { max: 3, windowSec: 60 }, { random: never });
      assert.equal(denied.allowed, false);
      assert.ok(denied.retryAfterSec >= 1 && denied.retryAfterSec <= 60);
    });

    it("keys and buckets are separate (no shared bucket)", async () => {
      await take(db.sql, "t-sep", "a", { max: 1, windowSec: 60 }, { random: never });
      assert.equal((await take(db.sql, "t-sep", "a", { max: 1, windowSec: 60 }, { random: never })).allowed, false);
      assert.equal((await take(db.sql, "t-sep", "b", { max: 1, windowSec: 60 }, { random: never })).allowed, true);
      assert.equal((await take(db.sql, "t-sep2", "a", { max: 1, windowSec: 60 }, { random: never })).allowed, true);
    });

    it("a new window starts after the old one expires", async () => {
      const rule = { max: 1, windowSec: 1 };
      assert.equal((await take(db.sql, "t-exp", "k", rule, { random: never })).allowed, true);
      assert.equal((await take(db.sql, "t-exp", "k", rule, { random: never })).allowed, false);
      await sleep(1_150);
      const r = await take(db.sql, "t-exp", "k", rule, { random: never });
      assert.equal(r.allowed, true);
      assert.equal(r.count, 1);
    });

    it("lock: the max-th take is allowed and sets the lock; later takes are refused while it lasts", async () => {
      const rule = { max: 2, windowSec: 1, lockSec: 3 };
      assert.equal((await take(db.sql, "t-lock", "k", rule, { random: never })).allowed, true);
      const second = await take(db.sql, "t-lock", "k", rule, { random: never });
      assert.equal(second.allowed, true);
      assert.equal(second.locked, true);
      const third = await take(db.sql, "t-lock", "k", rule, { random: never });
      assert.equal(third.allowed, false);
      assert.equal(third.locked, true);
      // The 1 s window has passed, but the 3 s lock has not: still refused (the bug the plan flagged).
      await sleep(1_200);
      const stillLocked = await take(db.sql, "t-lock", "k", rule, { random: never });
      assert.equal(stillLocked.allowed, false);
      assert.equal(stillLocked.locked, true);
      assert.ok(stillLocked.retryAfterSec >= 1 && stillLocked.retryAfterSec <= 3);
      await sleep(2_000);
      const fresh = await take(db.sql, "t-lock", "k", rule, { random: never });
      assert.equal(fresh.allowed, true);
      assert.equal(fresh.count, 1);
    });

    it("refund gives one take back and lifts a lock once the real count is under max", async () => {
      const rule = { max: 2, windowSec: 60, lockSec: 60 };
      await take(db.sql, "t-ref", "k", rule, { random: never });
      const atMax = await take(db.sql, "t-ref", "k", rule, { random: never });
      assert.equal(atMax.locked, true);
      await refund(db.sql, "t-ref", "k", 2);
      const after = await take(db.sql, "t-ref", "k", rule, { random: never });
      assert.equal(after.allowed, true);
    });

    it("clear removes the row (a successful sign-in resets the email count)", async () => {
      const rule = { max: 1, windowSec: 60, lockSec: 60 };
      await take(db.sql, "t-clr", "k", rule, { random: never });
      assert.equal((await take(db.sql, "t-clr", "k", rule, { random: never })).allowed, false);
      await clear(db.sql, "t-clr", "k");
      assert.equal((await take(db.sql, "t-clr", "k", rule, { random: never })).allowed, true);
    });

    it("cleanup deletes only rows expired for over 5 minutes", async () => {
      await take(db.sql, "t-cln", "live", { max: 5, windowSec: 60 }, { random: never });
      await take(db.sql, "t-cln", "old", { max: 5, windowSec: 60 }, { random: never });
      await db.sql.query(
        "update rate_limits set expires_at = now() - interval '10 minutes' where bucket = 't-cln' and key = $1",
        [hashKey("t-cln", "old")],
      );
      await cleanupExpired(db.sql);
      const rows = await db.sql.query<{ key: string }>("select key from rate_limits where bucket = 't-cln'");
      assert.deepEqual(rows.map((r) => r.key), [hashKey("t-cln", "live")]);
    });

    it("opportunistic cleanup runs when the dice say so", async () => {
      await take(db.sql, "t-opp", "old", { max: 5, windowSec: 60 }, { random: never });
      await db.sql.query("update rate_limits set expires_at = now() - interval '10 minutes' where bucket = 't-opp'");
      await take(db.sql, "t-opp", "new", { max: 5, windowSec: 60 }, { random: () => 0 });
      const rows = await db.sql.query<{ key: string }>("select key from rate_limits where bucket = 't-opp'");
      assert.deepEqual(rows.map((r) => r.key), [hashKey("t-opp", "new")]);
    });

    it("stores no raw email or IP", async () => {
      await take(db.sql, "login-email", "someone@example.com", { max: 5, windowSec: 60 }, { random: never });
      await take(db.sql, "login-ip", "198.51.100.77", { max: 5, windowSec: 60 }, { random: never });
      const rows = await db.sql.query<Record<string, unknown>>("select * from rate_limits");
      const dump = JSON.stringify(rows);
      assert.doesNotMatch(dump, /someone@example\.com/);
      assert.doesNotMatch(dump, /198\.51\.100\.77/);
    });

    it("parallel takes on one key: exactly max are allowed", async () => {
      const rule = { max: 5, windowSec: 60, lockSec: 60 };
      const results = await Promise.all(
        Array.from({ length: 40 }, () => take(db.sql, "t-par", "k", rule, { random: never })),
      );
      assert.equal(results.filter((r) => r.allowed).length, 5);
      assert.equal(results.filter((r) => !r.allowed).length, 35);
    });
  });
}
