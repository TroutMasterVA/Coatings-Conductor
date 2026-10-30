// BUG-52-1 (QA, PR #52): QA's exact scenario. 20 parallel sign-ins for ONE account, 5 ms apart, the
// correct password at #10, the rest wrong. Before the fix, 6 password checks ran (cap 5) and the
// correct password's success deleted the row mid-burst (lock included), so the account never locked.
//
// Rules proved here (on PGLite always, and on real Postgres when TEST_DATABASE_URL is set):
// - never more than LOGIN_FAIL_MAX password checks (401 + 200) per window, however the burst lands;
// - a success inside a burst never clears or lifts a count/lock that other attempts pushed to the cap;
// - after the burst the account is locked, for the correct password too, from any IP;
// - unknown emails behave exactly the same (no account-existence signal).
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { betterAuth } from "better-auth";
import { loginLockout } from "./login-lockout.server";
import { LOGIN_FAIL_MAX } from "./login-lockout";
import { pgliteDialect } from "./pglite-dialect";
import type { ClientIpConfig } from "../rate-limit/client-ip";
import { TEST_DATABASE_URL, pgliteDb, postgresDb, type TestDb } from "../test-support/rate-limit-db";

const ORIGIN = "http://localhost:3000";
const N = 20;
const RIGHT_AT = 10; // 1-based, as in QA's lock.mjs
const SPACING_MS = 5;
const PASSWORD = "correct-horse-battery-staple";
const PROD_HOPS_1: ClientIpConfig = { hops: 1, clientIpHeader: null, production: true };

function makeAuth(db: TestDb) {
  return betterAuth({
    baseURL: ORIGIN,
    // Test-only literal; not a real secret.
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

async function codeOf(res: Response): Promise<string> {
  try {
    return String(((await res.clone().json()) as { code?: string })?.code ?? "");
  } catch {
    return "";
  }
}

type Row = { i: number; right: boolean; status: number; code: string };

/** QA's burst: N requests, SPACING_MS apart, all in flight together; `ipOf(i)` picks the source IP. */
async function burst(auth: Auth, email: string, rightAt: number, ipOf: (i: number) => string): Promise<Row[]> {
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  return Promise.all(
    Array.from({ length: N }, async (_, k) => {
      const i = k + 1;
      await sleep(k * SPACING_MS);
      const right = i === rightAt;
      const res = await signIn(auth, email, right ? PASSWORD : `wrong-${i}`, ipOf(i));
      return { i, right, status: res.status, code: await codeOf(res) };
    }),
  );
}

function summary(rows: Row[]) {
  const s = { checks: 0, ok: 0, invalid: 0, locked: 0, other: [] as string[] };
  for (const r of rows) {
    if (r.status === 200) {
      s.ok += 1;
      s.checks += 1;
    } else if (r.status === 401) {
      s.invalid += 1;
      s.checks += 1;
    } else if (r.status === 403 && r.code === "ACCOUNT_LOCKED") s.locked += 1;
    else s.other.push(`#${r.i}:${r.status}:${r.code}`);
  }
  return s;
}

const backends: [string, () => Promise<TestDb>][] = [["PGLite", () => pgliteDb()]];
if (TEST_DATABASE_URL) backends.push(["Postgres (TEST_DATABASE_URL)", () => postgresDb()]);

for (const [name, open] of backends) {
  describe(`BUG-52-1 QA burst (${N} parallel, right password at #${RIGHT_AT}) on ${name}`, () => {
    let db: TestDb;
    before(async () => {
      db = await open();
    });
    after(async () => {
      await db.close();
    });
    let seq = 0;
    const fresh = (tag: string) => `${tag}-${Date.now()}-${(seq += 1)}@example.com`;

    async function assertLockedAfter(auth: Auth, email: string, label: string) {
      const res = await signIn(auth, email, PASSWORD, "203.0.113.250");
      assert.equal(res.status, 403, `${label}: correct password after the burst should be locked`);
      assert.equal(await codeOf(res), "ACCOUNT_LOCKED");
    }

    it("QA's exact scenario from ONE IP: at most 5 password checks, and the account is locked afterwards", async () => {
      const auth = makeAuth(db);
      const email = fresh("qa-burst");
      await auth.api.signUpEmail({ body: { email, password: PASSWORD, name: "QA" } });
      const rows = await burst(auth, email, RIGHT_AT, () => "198.51.100.60");
      const s = summary(rows);
      console.log(`[burst ${name}] 1 IP, right at #${RIGHT_AT}: checks=${s.checks} (200=${s.ok} 401=${s.invalid}) locked=${s.locked} other=${s.other.join(",") || "-"}`);
      assert.deepEqual(s.other, []);
      assert.ok(s.checks <= LOGIN_FAIL_MAX, `${s.checks} password checks > ${LOGIN_FAIL_MAX}`);
      assert.equal(s.checks + s.locked, N);
      await assertLockedAfter(auth, email, "1 IP");
    });

    it("same burst from 20 IPs: at most 5 password checks, locked afterwards", async () => {
      const auth = makeAuth(db);
      const email = fresh("qa-burst-ips");
      await auth.api.signUpEmail({ body: { email, password: PASSWORD, name: "QA" } });
      const rows = await burst(auth, email, RIGHT_AT, (i) => `198.51.100.${100 + i}`);
      const s = summary(rows);
      console.log(`[burst ${name}] 20 IPs, right at #${RIGHT_AT}: checks=${s.checks} (200=${s.ok} 401=${s.invalid}) locked=${s.locked}`);
      assert.deepEqual(s.other, []);
      assert.ok(s.checks <= LOGIN_FAIL_MAX);
      assert.equal(s.checks + s.locked, N);
      await assertLockedAfter(auth, email, "20 IPs");
    });

    for (const rightAt of [1, 3, 5]) {
      it(`the correct password lands inside the first ${LOGIN_FAIL_MAX} (at #${rightAt}): it may sign in, but it never resets the count mid-attack`, async () => {
        const auth = makeAuth(db);
        const email = fresh(`qa-burst-at${rightAt}`);
        await auth.api.signUpEmail({ body: { email, password: PASSWORD, name: "QA" } });
        const rows = await burst(auth, email, rightAt, (i) => `198.51.100.${150 + i}`);
        const s = summary(rows);
        console.log(`[burst ${name}] right at #${rightAt}: checks=${s.checks} (200=${s.ok} 401=${s.invalid}) locked=${s.locked}`);
        assert.deepEqual(s.other, []);
        assert.ok(s.checks <= LOGIN_FAIL_MAX, `${s.checks} password checks > ${LOGIN_FAIL_MAX}`);
        assert.ok(s.invalid <= LOGIN_FAIL_MAX - s.ok);
        await assertLockedAfter(auth, email, `right at #${rightAt}`);
      });
    }

    it("an unknown email gets the same answers as a real one (no account-existence signal)", async () => {
      const auth = makeAuth(db);
      const real = fresh("qa-real");
      await auth.api.signUpEmail({ body: { email: real, password: PASSWORD, name: "QA" } });
      const ghost = fresh("qa-ghost");
      const a = summary(await burst(auth, real, 0, (i) => `198.51.100.${200 + i}`));
      const b = summary(await burst(auth, ghost, 0, (i) => `198.51.100.${220 + i}`));
      assert.deepEqual({ checks: a.checks, locked: a.locked }, { checks: b.checks, locked: b.locked });
      const ra = await signIn(auth, real, PASSWORD, "203.0.113.251");
      const rb = await signIn(auth, ghost, PASSWORD, "203.0.113.252");
      assert.equal(ra.status, rb.status);
      assert.equal(await codeOf(ra), await codeOf(rb));
      const ja = (await ra.json()) as Record<string, unknown>;
      const jb = (await rb.json()) as Record<string, unknown>;
      assert.deepEqual(Object.keys(ja).sort(), Object.keys(jb).sort());
      assert.equal(ja.message, jb.message);
    });
  });
}
