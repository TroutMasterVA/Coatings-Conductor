// End to end through Better Auth's real handler (item 3): N parallel wrong-password sign-ins must
// not get more than LOGIN_FAIL_MAX password checks, and the account stays locked afterwards.
// Runs on PGLite always (proves the reserve-before-check logic; PGLite runs queries one at a time)
// and on real Postgres when TEST_DATABASE_URL is set (CI's postgres:16), where they truly overlap.
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { betterAuth } from "better-auth";
import { loginLockout } from "./login-lockout.server";
import { LOGIN_FAIL_MAX, LOGIN_RATE_MAX } from "./login-lockout";
import { pgliteDialect } from "./pglite-dialect";
import type { ClientIpConfig } from "../rate-limit/client-ip";
import { TEST_DATABASE_URL, pgliteDb, postgresDb, type TestDb } from "../test-support/rate-limit-db";

const ORIGIN = "http://localhost:3000";
const N = 20;
const PASSWORD = "correct-horse-battery-staple";

function makeAuth(db: TestDb, ipConfig: ClientIpConfig, peer?: string) {
  return betterAuth({
    baseURL: ORIGIN,
    // Test-only literal; not a real secret.
    secret: "test-only-secret-not-used-anywhere-0123456789",
    database: db.pool ?? { dialect: pgliteDialect(() => db.pglite!), type: "postgres" as const },
    trustedOrigins: [ORIGIN],
    emailAndPassword: { enabled: true },
    rateLimit: { enabled: false },
    plugins: [
      loginLockout({
        getSql: async () => db.sql,
        peerIp: () => peer,
        ipConfig: () => ipConfig,
        log: () => {},
      }),
    ],
  });
}

function signIn(auth: ReturnType<typeof makeAuth>, email: string, password: string, xff?: string) {
  const headers: Record<string, string> = { "content-type": "application/json", origin: ORIGIN };
  if (xff) headers["x-forwarded-for"] = xff;
  return auth.handler(
    new Request(`${ORIGIN}/api/auth/sign-in/email`, {
      method: "POST",
      headers,
      body: JSON.stringify({ email, password }),
    }),
  );
}

async function codeOf(res: Response): Promise<string> {
  try {
    const body = (await res.clone().json()) as { code?: string };
    return String(body?.code ?? "");
  } catch {
    return "";
  }
}

async function tally(responses: Response[]) {
  const out = { invalid: 0, locked: 0, rateLimited: 0, other: [] as string[] };
  for (const r of responses) {
    const code = await codeOf(r);
    if (r.status === 401) out.invalid += 1;
    else if (r.status === 403 && code === "ACCOUNT_LOCKED") out.locked += 1;
    else if (r.status === 429) out.rateLimited += 1;
    else out.other.push(`${r.status}:${code}`);
  }
  return out;
}

const backends: [string, () => Promise<TestDb>][] = [["PGLite", () => pgliteDb()]];
if (TEST_DATABASE_URL) backends.push(["Postgres (TEST_DATABASE_URL)", () => postgresDb()]);

const PROD_HOPS_1: ClientIpConfig = { hops: 1, clientIpHeader: null, production: true };

for (const [name, open] of backends) {
  describe(`login lockout under parallel attempts on ${name}`, () => {
    let db: TestDb;
    before(async () => {
      db = await open();
    });
    after(async () => {
      await db.close();
    });

    async function signUp(auth: ReturnType<typeof makeAuth>, email: string) {
      await auth.api.signUpEmail({ body: { email, password: PASSWORD, name: "QA" } });
    }

    it(`${N} parallel wrong passwords from ${N} IPs: at most ${LOGIN_FAIL_MAX} reach the password check, then locked`, async () => {
      const auth = makeAuth(db, PROD_HOPS_1);
      const email = `par-${Date.now()}@example.com`;
      await signUp(auth, email);
      const responses = await Promise.all(
        Array.from({ length: N }, (_, i) => signIn(auth, email, `wrong-password-${i}`, `198.51.100.${i + 1}`)),
      );
      const t = await tally(responses);
      console.log(`[concurrency ${name}] ${N} parallel, ${N} IPs -> invalid=${t.invalid} locked=${t.locked} 429=${t.rateLimited} other=${t.other.length}`);
      assert.deepEqual(t.other, []);
      assert.ok(t.invalid <= LOGIN_FAIL_MAX, `invalid ${t.invalid} > ${LOGIN_FAIL_MAX}`);
      assert.equal(t.invalid, LOGIN_FAIL_MAX);
      assert.equal(t.locked, N - LOGIN_FAIL_MAX);
      // The correct password is refused while locked, from a fresh IP too.
      const right = await signIn(auth, email, PASSWORD, "203.0.113.200");
      assert.equal(right.status, 403);
      assert.equal(await codeOf(right), "ACCOUNT_LOCKED");
    });

    it(`${N} parallel wrong passwords from ONE IP: the IP cap and the lock both hold`, async () => {
      const auth = makeAuth(db, PROD_HOPS_1);
      const email = `one-ip-${Date.now()}@example.com`;
      await signUp(auth, email);
      const responses = await Promise.all(
        Array.from({ length: N }, (_, i) => signIn(auth, email, `wrong-${i}`, "198.51.100.250")),
      );
      const t = await tally(responses);
      console.log(`[concurrency ${name}] ${N} parallel, 1 IP -> invalid=${t.invalid} locked=${t.locked} 429=${t.rateLimited} other=${t.other.length}`);
      assert.deepEqual(t.other, []);
      assert.ok(t.invalid <= LOGIN_FAIL_MAX);
      assert.equal(t.rateLimited, Math.max(0, N - LOGIN_RATE_MAX));
      const right = await signIn(auth, email, PASSWORD, "203.0.113.201");
      assert.equal(right.status, 403);
    });

    it("a correct password before the lock signs in and resets the count", async () => {
      const auth = makeAuth(db, PROD_HOPS_1);
      const email = `reset-${Date.now()}@example.com`;
      await signUp(auth, email);
      for (let i = 0; i < LOGIN_FAIL_MAX - 1; i += 1) {
        assert.equal((await signIn(auth, email, `nope-${i}`, `192.0.2.${i + 1}`)).status, 401);
      }
      assert.equal((await signIn(auth, email, PASSWORD, "192.0.2.50")).status, 200);
      for (let i = 0; i < LOGIN_FAIL_MAX - 1; i += 1) {
        assert.equal((await signIn(auth, email, `nope-again-${i}`, `192.0.2.${i + 60}`)).status, 401);
      }
      assert.equal((await signIn(auth, email, PASSWORD, "192.0.2.99")).status, 200);
    });

    it("no usable client IP: per-IP limits are skipped (no shared bucket), the email lock still holds", async () => {
      // Production, no x-forwarded-for, no socket peer: every request has an unknown IP.
      const auth = makeAuth(db, PROD_HOPS_1, undefined);
      const users = Array.from({ length: LOGIN_RATE_MAX + 5 }, (_, i) => `noip-${Date.now()}-${i}@example.com`);
      for (const u of users) await signUp(auth, u);
      const before = await db.sql.query<{ n: number | string }>(
        "select count(*) as n from rate_limits where bucket in ('login-ip', 'login-ip-fail')",
      );
      // More users than the per-IP limit: if they shared one bucket, the last ones would get 429.
      const responses = await Promise.all(users.map((u) => signIn(auth, u, "wrong")));
      const t = await tally(responses);
      assert.equal(t.rateLimited, 0);
      assert.equal(t.invalid, users.length);
      const afterRows = await db.sql.query<{ n: number | string }>(
        "select count(*) as n from rate_limits where bucket in ('login-ip', 'login-ip-fail')",
      );
      assert.equal(Number(afterRows[0]!.n), Number(before[0]!.n));
      // The per-email lock still applies without an IP.
      const victim = users[0]!;
      for (let i = 0; i < LOGIN_FAIL_MAX; i += 1) await signIn(auth, victim, `x-${i}`);
      const locked = await signIn(auth, victim, PASSWORD);
      assert.equal(locked.status, 403);
      assert.equal(await codeOf(locked), "ACCOUNT_LOCKED");
    });

    it("the socket peer is used when headers give no IP", async () => {
      const auth = makeAuth(db, PROD_HOPS_1, "203.0.113.77");
      // Unknown emails count the same as real ones, so no sign-up is needed (it would use a slot).
      const email = `peer-${Date.now()}@example.com`;
      const responses = await Promise.all(
        Array.from({ length: LOGIN_RATE_MAX + 3 }, (_, i) => signIn(auth, `${i}-${email}`, "wrong")),
      );
      const t = await tally(responses);
      assert.equal(t.rateLimited, 3);
    });

    it("a forged left-most x-forwarded-for does not escape the per-IP limit", async () => {
      const auth = makeAuth(db, PROD_HOPS_1);
      const responses = await Promise.all(
        Array.from({ length: LOGIN_RATE_MAX + 4 }, (_, i) =>
          signIn(auth, `forge-${i}-${Date.now()}@example.com`, "wrong", `10.9.9.${i}, 198.51.100.240`),
        ),
      );
      const t = await tally(responses);
      assert.equal(t.rateLimited, 4);
    });

    it("database down: sign-in fails closed with 503 SIGNIN_UNAVAILABLE", async () => {
      const auth = betterAuth({
        baseURL: ORIGIN,
        secret: "test-only-secret-not-used-anywhere-0123456789",
        database: db.pool ?? { dialect: pgliteDialect(() => db.pglite!), type: "postgres" as const },
        trustedOrigins: [ORIGIN],
        emailAndPassword: { enabled: true },
        rateLimit: { enabled: false },
        plugins: [
          loginLockout({
            getSql: async () => {
              throw new Error("db down");
            },
            peerIp: () => undefined,
            ipConfig: () => PROD_HOPS_1,
            log: () => {},
          }),
        ],
      });
      const res = await signIn(auth, "anyone@example.com", "whatever", "198.51.100.9");
      assert.equal(res.status, 503);
      assert.equal(await codeOf(res), "SIGNIN_UNAVAILABLE");
    });
  });
}
