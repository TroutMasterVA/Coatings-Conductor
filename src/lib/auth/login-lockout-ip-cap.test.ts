// BUG-52-2 and F-52-4 (PR #52), end to end through Better Auth's real handler. PGLite always; real
// Postgres too when TEST_DATABASE_URL is set.
// - Per-IP RATE is LOGIN_RATE_MAX (30) a minute: a shift start on one site Wi-Fi gets through.
// - Per-IP FAILED cap is LOGIN_IP_FAIL_MAX (100, proposed, SEC to confirm) per 15 min; past it the
//   whole network is paused with its own message, "Sign-in is paused on this network for up to 15
//   minutes.", not "wait a minute".
// - One person mistyping can't trip it for the crew: a locked account's further tries are given
//   back to the network, so one account adds at most LOGIN_FAIL_MAX.
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { betterAuth } from "better-auth";
import { loginLockout } from "./login-lockout.server";
import { LOGIN_FAIL_MAX, LOGIN_IP_FAIL_MAX, LOGIN_RATE_MAX, NETWORK_PAUSED, RATE_LIMITED } from "./login-lockout";
import { pgliteDialect } from "./pglite-dialect";
import type { ClientIpConfig } from "../rate-limit/client-ip";
import { TEST_DATABASE_URL, pgliteDb, postgresDb, type TestDb } from "../test-support/rate-limit-db";

const ORIGIN = "http://localhost:3000";
const PASSWORD = "correct-horse-battery-staple";
const PROD_HOPS_1: ClientIpConfig = { hops: 1, clientIpHeader: null, production: true };

function makeAuth(db: TestDb) {
  return betterAuth({
    baseURL: ORIGIN,
    secret: "test-only-secret-not-used-anywhere-0123456789",
    database: db.pool ?? { dialect: pgliteDialect(() => db.pglite!), type: "postgres" as const },
    trustedOrigins: [ORIGIN],
    emailAndPassword: { enabled: true },
    rateLimit: { enabled: false },
    plugins: [loginLockout({ getSql: async () => db.sql, peerIp: () => undefined, ipConfig: () => PROD_HOPS_1, log: () => {} })],
  });
}
type Auth = ReturnType<typeof makeAuth>;

function signIn(auth: Auth, email: string, password: string, ip: string) {
  return auth.handler(
    new Request(`${ORIGIN}/api/auth/sign-in/email`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: ORIGIN, "x-forwarded-for": ip },
      body: JSON.stringify({ email, password }),
    }),
  );
}
async function body(res: Response): Promise<{ code?: string; message?: string; retryAfterSec?: number }> {
  try {
    return (await res.clone().json()) as { code?: string; message?: string; retryAfterSec?: number };
  } catch {
    return {};
  }
}

const backends: [string, () => Promise<TestDb>][] = [["PGLite", () => pgliteDb()]];
if (TEST_DATABASE_URL) backends.push(["Postgres (TEST_DATABASE_URL)", () => postgresDb()]);

for (const [name, open] of backends) {
  describe(`per-IP sign-in limits on ${name}`, () => {
    let db: TestDb;
    before(async () => {
      db = await open();
    });
    after(async () => {
      await db.close();
    });
    let seq = 0;
    const mail = (tag: string) => `${tag}-${Date.now()}-${(seq += 1)}@example.com`;
    // Stand-in for "the next minute": forget only the per-minute rate rows (the 15-min caps stay).
    const nextMinute = () => db.sql.query("delete from rate_limits where bucket = 'login-ip'");

    it(`F-52-4: ${LOGIN_RATE_MAX} sign-ins a minute from one IP get through; the next ${10} get "wait a minute"`, async () => {
      assert.equal(LOGIN_RATE_MAX, 30);
      const auth = makeAuth(db);
      const ip = "198.51.100.31";
      const res = await Promise.all(Array.from({ length: LOGIN_RATE_MAX + 10 }, (_, i) => signIn(auth, mail(`shift${i}`), "wrong-pass", ip)));
      const limited = res.filter((r) => r.status === 429);
      assert.equal(limited.length, 10);
      assert.equal(res.filter((r) => r.status === 401).length, LOGIN_RATE_MAX);
      for (const r of limited) {
        const b = await body(r);
        assert.equal(b.code, RATE_LIMITED.code);
        assert.equal(b.message, RATE_LIMITED.message);
      }
    });

    it(`BUG-52-2: after ${LOGIN_IP_FAIL_MAX} failed sign-ins from one IP the network is paused, with the right message`, async () => {
      assert.equal(LOGIN_IP_FAIL_MAX, 100);
      const auth = makeAuth(db);
      const ip = "198.51.100.32";
      const crew = mail("crew");
      await auth.api.signUpEmail({ body: { email: crew, password: PASSWORD, name: "Crew" } });
      let failed = 0;
      while (failed < LOGIN_IP_FAIL_MAX) {
        await nextMinute();
        const batch = Math.min(25, LOGIN_IP_FAIL_MAX - failed);
        const res = await Promise.all(Array.from({ length: batch }, (_, i) => signIn(auth, mail(`spray${failed + i}`), "wrong-pass", ip)));
        assert.deepEqual(res.map((r) => r.status), Array(batch).fill(401));
        failed += batch;
      }
      await nextMinute();
      const paused = await signIn(auth, crew, PASSWORD, ip);
      assert.equal(paused.status, 429);
      const b = await body(paused);
      assert.equal(b.code, NETWORK_PAUSED.code);
      assert.equal(b.message, "Sign-in is paused on this network for up to 15 minutes.");
      const ra = Number(paused.headers.get("retry-after"));
      assert.ok(ra > 60 && ra <= 900, `retry-after ${ra}`);
      assert.equal(b.retryAfterSec, ra);
      // Another network is unaffected.
      assert.equal((await signIn(auth, crew, PASSWORD, "198.51.100.33")).status, 200);
    });

    it("one person hammering their own locked account adds only 5 to the network count; the crew still signs in", async () => {
      const auth = makeAuth(db);
      const ip = "198.51.100.34";
      const me = mail("mistyper");
      const crew = mail("crewmate");
      await auth.api.signUpEmail({ body: { email: me, password: PASSWORD, name: "Me" } });
      await auth.api.signUpEmail({ body: { email: crew, password: PASSWORD, name: "Crew" } });
      const statuses: number[] = [];
      for (let i = 0; i < 25; i += 1) statuses.push((await signIn(auth, me, `typo-${i}`, ip)).status);
      assert.deepEqual(statuses.slice(0, LOGIN_FAIL_MAX), Array(LOGIN_FAIL_MAX).fill(401));
      assert.ok(statuses.slice(LOGIN_FAIL_MAX).every((s) => s === 403));
      const rows = await db.sql.query<{ count: number }>(
        "select count from rate_limits where bucket = 'login-ip-fail' order by window_start desc limit 1",
      );
      assert.equal(Number(rows[0]!.count), LOGIN_FAIL_MAX);
      await nextMinute();
      assert.equal((await signIn(auth, crew, PASSWORD, ip)).status, 200);
    });

    it("the account lock sends retryAfterSec so the card can show the time; same for an unknown email", async () => {
      const auth = makeAuth(db);
      const real = mail("lock-real");
      const ghost = mail("lock-ghost");
      await auth.api.signUpEmail({ body: { email: real, password: PASSWORD, name: "R" } });
      for (const [email, ip] of [[real, "198.51.100.35"], [ghost, "198.51.100.36"]] as const) {
        await nextMinute();
        for (let i = 0; i < LOGIN_FAIL_MAX; i += 1) assert.equal((await signIn(auth, email, `bad-${i}`, ip)).status, 401);
      }
      const a = await signIn(auth, real, PASSWORD, "198.51.100.37");
      const g = await signIn(auth, ghost, PASSWORD, "198.51.100.38");
      assert.equal(a.status, 403);
      assert.equal(g.status, 403);
      const ba = await body(a);
      const bg = await body(g);
      assert.equal(ba.code, "ACCOUNT_LOCKED");
      assert.deepEqual(Object.keys(ba).sort(), Object.keys(bg).sort());
      assert.equal(ba.message, bg.message);
      assert.ok(Number(ba.retryAfterSec) > 800 && Number(ba.retryAfterSec) <= 900);
      assert.equal(String(ba.retryAfterSec), a.headers.get("retry-after"));
    });
  });
}
