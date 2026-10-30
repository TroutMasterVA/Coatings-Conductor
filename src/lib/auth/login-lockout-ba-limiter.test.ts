// SEC (PR #52): with #52's auth config in PRODUCTION mode, Better Auth's built-in limiter is ON
// (3 sign-ins / 10 s per IP by default) but skipped for /sign-in/email, so fast wrong passwords from
// one IP reach OUR lockout: 401 x5, then 403 ACCOUNT_LOCKED with retryAfterSec. A control with the
// skip removed proves the built-in limiter really is active here (it answers 429 on the 4th try).
// NODE_ENV must be set before better-auth loads (it reads it once at import), hence dynamic imports.
process.env.NODE_ENV = "production";
// Production refuses to run without a server secret (the limiter keys derive from it). Test-only literal.
process.env.BETTER_AUTH_SECRET = "test-only-secret-not-used-anywhere-0123456789";
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { TEST_DATABASE_URL, pgliteDb, postgresDb, type TestDb } from "../test-support/rate-limit-db";
import type { ClientIpConfig } from "../rate-limit/client-ip";

const { betterAuth } = await import("better-auth");
const { loginLockout } = await import("./login-lockout.server");
const { LOGIN_FAIL_MAX } = await import("./login-lockout");
const { pgliteDialect } = await import("./pglite-dialect");
const { betterAuthRateLimit } = await import("../rate-limit/better-auth-limit");

const ORIGIN = "http://localhost:3000";
const PASSWORD = "correct-horse-battery-staple";
const PROD_HOPS_1: ClientIpConfig = { hops: 1, clientIpHeader: null, production: true };

function makeAuth(db: TestDb, withSkip: boolean) {
  const rl = betterAuthRateLimit({ getSql: async () => db.sql, production: true });
  return betterAuth({
    baseURL: ORIGIN,
    secret: "test-only-secret-not-used-anywhere-0123456789",
    database: db.pool ?? { dialect: pgliteDialect(() => db.pglite!), type: "postgres" as const },
    trustedOrigins: [ORIGIN],
    emailAndPassword: { enabled: true },
    // #52's server.ts passes exactly this (no `enabled`, so it follows NODE_ENV=production).
    rateLimit: withSkip ? rl : { customStorage: rl.customStorage },
    plugins: [loginLockout({ getSql: async () => db.sql, peerIp: () => undefined, ipConfig: () => PROD_HOPS_1, log: () => {} })],
  });
}

async function signIn(auth: ReturnType<typeof makeAuth>, email: string, password: string, ip: string) {
  const res = await auth.handler(
    new Request(`${ORIGIN}/api/auth/sign-in/email`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: ORIGIN, "x-forwarded-for": ip },
      body: JSON.stringify({ email, password }),
    }),
  );
  let body: { code?: string; retryAfterSec?: number } = {};
  try {
    body = (await res.clone().json()) as typeof body;
  } catch {
    // not JSON
  }
  return { status: res.status, body };
}

const backends: [string, () => Promise<TestDb>][] = [["PGLite", () => pgliteDb()]];
if (TEST_DATABASE_URL) backends.push(["Postgres (TEST_DATABASE_URL)", () => postgresDb()]);

for (const [name, open] of backends) {
  describe(`Better Auth's built-in limiter in production on ${name}`, () => {
    let db: TestDb;
    before(async () => {
      db = await open();
    });
    after(async () => {
      await db.close();
    });

    it("fast wrong passwords from one IP get 401 (not 429) until our lock: 5 x 401, then 403 ACCOUNT_LOCKED with retryAfterSec", async () => {
      const auth = makeAuth(db, true);
      const email = `ba-prod-${Date.now()}@example.com`;
      await auth.api.signUpEmail({ body: { email, password: PASSWORD, name: "QA" } });
      const ip = "198.51.100.71";
      const statuses: number[] = [];
      for (let i = 0; i < LOGIN_FAIL_MAX; i += 1) statuses.push((await signIn(auth, email, `wrong-${i}`, ip)).status);
      assert.deepEqual(statuses, Array(LOGIN_FAIL_MAX).fill(401));
      const sixth = await signIn(auth, email, PASSWORD, ip);
      assert.equal(sixth.status, 403);
      assert.equal(sixth.body.code, "ACCOUNT_LOCKED");
      assert.ok(Number(sixth.body.retryAfterSec) > 0 && Number(sixth.body.retryAfterSec) <= 900);
    });

    it("control: without #52's skip the built-in limiter is active here and answers 429 on the 4th fast try", async () => {
      const auth = makeAuth(db, false);
      const email = `ba-prod-ctl-${Date.now()}@example.com`;
      await auth.api.signUpEmail({ body: { email, password: PASSWORD, name: "QA" } });
      const statuses: number[] = [];
      for (let i = 0; i < 4; i += 1) statuses.push((await signIn(auth, email, `wrong-${i}`, "198.51.100.72")).status);
      assert.deepEqual(statuses.slice(0, 3), [401, 401, 401]);
      assert.equal(statuses[3], 429);
    });
  });
}
