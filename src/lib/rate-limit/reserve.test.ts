// BUG-52-1 (PR #52): reservations for the login lockout. Always on PGLite; also on real Postgres when
// TEST_DATABASE_URL is set, where the parallel statements really overlap on separate connections.
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { clear, deriveLimiterKey, hashKey, hashKeyWith, reserve, settle, take, LIMITER_KEY_LABEL } from "./limiter";
import { TEST_DATABASE_URL, pgliteDb, postgresDb, type TestDb } from "../test-support/rate-limit-db";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const never = () => 1;
const RULE = { max: 5, windowSec: 60, lockSec: 60 };

const backends: [string, () => Promise<TestDb>][] = [["PGLite", () => pgliteDb()]];
if (TEST_DATABASE_URL) backends.push(["Postgres (TEST_DATABASE_URL)", () => postgresDb()]);

for (const [name, open] of backends) {
  describe(`login reservations on ${name}`, () => {
    let db: TestDb;
    before(async () => {
      db = await open();
    });
    after(async () => {
      await db.close();
    });
    let n = 0;
    const key = () => `k-${(n += 1)}`;
    const row = async (k: string) =>
      (
        await db.sql.query<{ count: number; pending: number; locked: boolean }>(
          "select count, pending, coalesce(locked_until > now(), false) as locked from rate_limits where bucket = 't-res' and key = $1",
          [hashKey("t-res", k)],
        )
      )[0];

    it("40 parallel reservations: exactly max allowed, all still in flight", async () => {
      const k = key();
      const rs = await Promise.all(Array.from({ length: 40 }, () => reserve(db.sql, "t-res", k, RULE, { random: never })));
      assert.equal(rs.filter((r) => r.allowed).length, 5);
      const r = await row(k);
      assert.equal(Number(r!.count), 5);
      assert.equal(Number(r!.pending), 5);
      // Refusals at a full cap start the lock.
      assert.equal(r!.locked, true);
    });

    it("root cause (old path): deleting the row on success drops a lock mid-burst and lets a 6th try in", async () => {
      // This is what the PR's earlier code did (take + clear on success). Kept as a record of why
      // QA saw 6 password checks: the success's clear() deleted the row, lock included.
      const k = key();
      const allowed: boolean[] = [];
      for (let i = 0; i < 5; i += 1) allowed.push((await take(db.sql, "t-old", k, RULE, { random: never })).allowed);
      assert.equal((await take(db.sql, "t-old", k, RULE, { random: never })).allowed, false); // locked
      await clear(db.sql, "t-old", k); // the in-burst success
      assert.equal((await take(db.sql, "t-old", k, RULE, { random: never })).allowed, true); // the 6th check
      assert.deepEqual(allowed, [true, true, true, true, true]);
    });

    it("a success while other tries are in flight gives nothing back (no reset mid-attack)", async () => {
      const k = key();
      for (let i = 0; i < 3; i += 1) assert.equal((await reserve(db.sql, "t-res", k, RULE, { random: never })).allowed, true);
      await settle(db.sql, "t-res", k, "success", RULE); // 2 others still in flight
      let r = await row(k);
      assert.equal(Number(r!.count), 3);
      assert.equal(Number(r!.pending), 2);
      // Only 2 more checks fit; then the cap refuses and locks.
      assert.equal((await reserve(db.sql, "t-res", k, RULE, { random: never })).allowed, true);
      assert.equal((await reserve(db.sql, "t-res", k, RULE, { random: never })).allowed, true);
      const refused = await reserve(db.sql, "t-res", k, RULE, { random: never });
      assert.equal(refused.allowed, false);
      assert.equal(refused.locked, true);
      assert.ok(refused.lockedUntil && !Number.isNaN(Date.parse(refused.lockedUntil)));
      for (let i = 0; i < 4; i += 1) await settle(db.sql, "t-res", k, "failure", RULE);
      r = await row(k);
      assert.equal(r!.locked, true);
    });

    it("once locked, even the last success in flight can't lift it (sticky until it expires)", async () => {
      const k = key();
      for (let i = 0; i < 5; i += 1) await reserve(db.sql, "t-res", k, RULE, { random: never });
      assert.equal((await reserve(db.sql, "t-res", k, RULE, { random: never })).allowed, false); // locks
      for (let i = 0; i < 4; i += 1) await settle(db.sql, "t-res", k, "failure", RULE);
      await settle(db.sql, "t-res", k, "success", RULE); // last one in flight
      assert.equal((await row(k))!.locked, true);
      assert.equal((await reserve(db.sql, "t-res", k, RULE, { random: never })).allowed, false);
    });

    it("the max-th settled failure locks; refund never lifts a lock", async () => {
      const k = key();
      for (let i = 0; i < 5; i += 1) {
        await reserve(db.sql, "t-res", k, RULE, { random: never });
        await settle(db.sql, "t-res", k, "failure", RULE);
      }
      assert.equal((await row(k))!.locked, true);
      await settle(db.sql, "t-res", k, "refund", RULE);
      await settle(db.sql, "t-res", k, "refund", RULE);
      assert.equal((await row(k))!.locked, true);
      assert.equal((await reserve(db.sql, "t-res", k, RULE, { random: never })).allowed, false);
    });

    it("sequential: 4 failures then a success with nothing else in flight resets the count", async () => {
      const k = key();
      for (let i = 0; i < 4; i += 1) {
        await reserve(db.sql, "t-res", k, RULE, { random: never });
        await settle(db.sql, "t-res", k, "failure", RULE);
      }
      assert.equal((await reserve(db.sql, "t-res", k, RULE, { random: never })).allowed, true);
      await settle(db.sql, "t-res", k, "success", RULE);
      for (let i = 0; i < 4; i += 1) {
        assert.equal((await reserve(db.sql, "t-res", k, RULE, { random: never })).allowed, true);
        await settle(db.sql, "t-res", k, "failure", RULE);
      }
      assert.equal((await row(k))!.locked, false);
    });

    it("refund gives a slot back when not locked", async () => {
      const k = key();
      for (let i = 0; i < 5; i += 1) await reserve(db.sql, "t-res", k, RULE, { random: never });
      await settle(db.sql, "t-res", k, "refund", RULE);
      assert.equal((await reserve(db.sql, "t-res", k, RULE, { random: never })).allowed, true);
    });

    it("the lock ends after lockSec and the next try starts a fresh window", async () => {
      const rule = { max: 2, windowSec: 1, lockSec: 2 };
      const k = key();
      await reserve(db.sql, "t-res", k, rule, { random: never });
      await reserve(db.sql, "t-res", k, rule, { random: never });
      const refused = await reserve(db.sql, "t-res", k, rule, { random: never });
      assert.equal(refused.allowed, false);
      assert.ok(refused.retryAfterSec >= 1 && refused.retryAfterSec <= 2);
      await sleep(1_200);
      assert.equal((await reserve(db.sql, "t-res", k, rule, { random: never })).allowed, false);
      await sleep(1_100);
      const fresh = await reserve(db.sql, "t-res", k, rule, { random: never });
      assert.equal(fresh.allowed, true);
      assert.equal(fresh.count, 1);
    });

    it("stored keys are HMAC'd, not a plain sha256 of the email", async () => {
      await reserve(db.sql, "login-email", "someone-hmac@example.com", RULE, { random: never });
      const plain = createHash("sha256").update("login-email\u0000someone-hmac@example.com").digest("hex");
      const rows = await db.sql.query<{ key: string }>("select key from rate_limits where bucket = 'login-email'");
      assert.ok(rows.some((r) => r.key === hashKey("login-email", "someone-hmac@example.com")));
      assert.ok(!rows.some((r) => r.key === plain));
    });
  });
}

describe("limiter key derivation (SEC: HMAC keyed from BETTER_AUTH_SECRET)", () => {
  it("depends on the secret, is stable for one secret, and differs from plain sha256", () => {
    const a = deriveLimiterKey("secret-a-0123456789-0123456789-0123");
    const a2 = deriveLimiterKey("secret-a-0123456789-0123456789-0123");
    const b = deriveLimiterKey("secret-b-0123456789-0123456789-0123");
    assert.equal(a.length, 32);
    assert.deepEqual(a, a2);
    assert.notDeepEqual(a, b);
    // The derived key is not the secret itself (fixed HKDF label).
    assert.notEqual(a.toString("utf8"), "secret-a-0123456789-0123456789-0123");
    assert.equal(LIMITER_KEY_LABEL, "coatings-conductor/rate-limit-keys/v1");
    assert.notEqual(hashKeyWith(a, "login-ip", "198.51.100.1"), hashKeyWith(b, "login-ip", "198.51.100.1"));
    assert.notEqual(hashKeyWith(a, "login-ip", "198.51.100.1"), hashKeyWith(a, "login-email", "198.51.100.1"));
    assert.match(hashKeyWith(a, "login-ip", "198.51.100.1"), /^[0-9a-f]{64}$/);
  });
});
