// Extract / forecast shared limits and Better Auth's own limiter settings (item 3).
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  EXTRACT_UNAVAILABLE_MESSAGE,
  FORECAST_IP_MAX_PER_WINDOW,
  takeExtractSlotShared,
  takeForecastSlotShared,
  type ForecastFallback,
} from "./app-limits";
import { betterAuthRateLimit, isSharedPath, pathOfKey } from "./better-auth-limit";
import { resetNoClientIpWarning } from "./client-ip";
import { EXTRACT_RATE_MAX, runExtract, type RateStore } from "../extract/extract-core";
import { onDeviceProvider } from "../extract/on-device-provider";
import { pgliteDb, type TestDb } from "../test-support/rate-limit-db";
import type { Sql } from "../db";

const down = async (): Promise<Sql> => {
  throw new Error("db down");
};
const quiet = () => {};

describe("extract and forecast limits on the shared database", () => {
  let db: TestDb;
  before(async () => {
    db = await pgliteDb();
  });
  after(async () => {
    await db.close();
  });

  it("extract: EXTRACT_RATE_MAX per user per minute, separate per user", async () => {
    const get = async () => db.sql;
    for (let i = 0; i < EXTRACT_RATE_MAX; i += 1) assert.equal((await takeExtractSlotShared(get, "u1")).ok, true);
    const denied = await takeExtractSlotShared(get, "u1");
    assert.equal(denied.ok, false);
    assert.equal((await takeExtractSlotShared(get, "u2")).ok, true);
  });

  it("extract fails closed when the database is down", async () => {
    const r = await takeExtractSlotShared(down, "u3", quiet);
    assert.equal(r.ok, false);
    assert.ok(!r.ok && r.message === EXTRACT_UNAVAILABLE_MESSAGE && r.retryAfterSec > 0);
  });

  it("runExtract uses the injected shared limit and returns a coded RATE_LIMITED", async () => {
    const res = await runExtract({
      userId: "u4",
      input: { text: "Some sheet text" },
      azure: null,
      onDevice: onDeviceProvider,
      rate: new Map() as RateStore,
      limit: async () => ({ ok: false, retryAfterSec: 12, message: EXTRACT_UNAVAILABLE_MESSAGE }),
    });
    assert.equal(res.ok, false);
    assert.ok(!res.ok && res.error.code === "RATE_LIMITED" && res.error.retryAfterSec === 12);
    assert.ok(!res.ok && res.error.message === EXTRACT_UNAVAILABLE_MESSAGE);
  });

  it(`forecast: ${FORECAST_IP_MAX_PER_WINDOW} per IP per minute, keyed per IP only`, async () => {
    const get = async () => db.sql;
    const fb: ForecastFallback = new Map();
    for (let i = 0; i < FORECAST_IP_MAX_PER_WINDOW; i += 1) {
      assert.equal((await takeForecastSlotShared(get, "198.51.100.1", fb)).ok, true);
    }
    const denied = await takeForecastSlotShared(get, "198.51.100.1", fb);
    assert.deepEqual(denied, { ok: false, source: "db" });
    assert.equal((await takeForecastSlotShared(get, "198.51.100.2", fb)).ok, true);
  });

  it("forecast with no usable IP skips the per-IP limit (no shared bucket)", async () => {
    const get = async () => db.sql;
    const fb: ForecastFallback = new Map();
    for (let i = 0; i < FORECAST_IP_MAX_PER_WINDOW + 5; i += 1) {
      assert.deepEqual(await takeForecastSlotShared(get, null, fb), { ok: true, source: "skipped" });
    }
  });

  it("forecast fails open to the per-process limit when the database is down", async () => {
    const fb: ForecastFallback = new Map();
    const t = 1_000_000;
    for (let i = 0; i < FORECAST_IP_MAX_PER_WINDOW; i += 1) {
      assert.deepEqual(await takeForecastSlotShared(down, "198.51.100.3", fb, t + i, quiet), { ok: true, source: "memory" });
    }
    assert.deepEqual(await takeForecastSlotShared(down, "198.51.100.3", fb, t + 100, quiet), { ok: false, source: "memory" });
  });
});

describe("Better Auth's own limiter settings", () => {
  const prodReq = (path: string, xff?: string) =>
    new Request(`http://localhost:3000/api/auth${path}`, { headers: xff ? { "x-forwarded-for": xff } : {} });
  const rule = { window: 10, max: 3 };

  it("leaves sign-in and sign-up to our login lockout", () => {
    const ba = betterAuthRateLimit({ getSql: down, production: true });
    const fn = ba.customRules["/**"];
    assert.equal(fn(prodReq("/sign-in/email", "198.51.100.7"), rule), false);
    assert.equal(fn(prodReq("/sign-up/email", "198.51.100.7"), rule), false);
    assert.deepEqual(fn(prodReq("/get-session", "198.51.100.7"), rule), rule);
  });

  it("skips a request it would otherwise put in Better Auth's shared no-trusted-ip bucket", () => {
    resetNoClientIpWarning();
    const ba = betterAuthRateLimit({ getSql: down, production: true });
    const fn = ba.customRules["/**"];
    assert.equal(fn(prodReq("/change-password"), rule), false);
    assert.equal(fn(prodReq("/change-password", "1.1.1.1, 198.51.100.7"), rule), false);
    assert.deepEqual(fn(prodReq("/change-password", "198.51.100.7"), rule), rule);
    resetNoClientIpWarning();
  });

  it("password/email-changing paths count in the shared database; others stay in memory", async () => {
    assert.equal(pathOfKey("198.51.100.7|/change-password"), "/change-password");
    assert.equal(isSharedPath("/change-password"), true);
    assert.equal(isSharedPath("/get-session"), false);
    const db = await pgliteDb();
    try {
      const ba = betterAuthRateLimit({ getSql: async () => db.sql, production: true });
      for (let i = 0; i < 3; i += 1) {
        assert.equal((await ba.customStorage.consume("198.51.100.7|/change-password", rule)).allowed, true);
      }
      assert.equal((await ba.customStorage.consume("198.51.100.7|/change-password", rule)).allowed, false);
      const rows = await db.sql.query<{ n: number | string }>("select count(*) as n from rate_limits where bucket = 'ba'");
      assert.equal(Number(rows[0]!.n), 1);
      for (let i = 0; i < 3; i += 1) {
        assert.equal((await ba.customStorage.consume("198.51.100.7|/get-session", rule)).allowed, true);
      }
      assert.equal((await ba.customStorage.consume("198.51.100.7|/get-session", rule)).allowed, false);
      const after = await db.sql.query<{ n: number | string }>("select count(*) as n from rate_limits where bucket = 'ba'");
      assert.equal(Number(after[0]!.n), 1);
    } finally {
      await db.close();
    }
  });

  it("password/email-changing paths fail closed when the database is down", async () => {
    const ba = betterAuthRateLimit({ getSql: down, production: true });
    const r = await ba.customStorage.consume("198.51.100.7|/change-password", rule);
    assert.equal(r.allowed, false);
  });
});
