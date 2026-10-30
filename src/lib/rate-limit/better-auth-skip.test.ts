// SEC (PR #52): Better Auth's own limiter is skipped for EXACTLY /sign-in/email and /sign-up/email.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { OWNED_BY_LOGIN_LOCKOUT, betterAuthRateLimit, ownedByLoginLockout } from "./better-auth-limit";

const down = async () => {
  throw new Error("db down");
};
const req = (path: string) =>
  new Request(`http://localhost:3000${path}`, { headers: { "x-forwarded-for": "198.51.100.7" } });
const rule = { window: 10, max: 3 };

describe("Better Auth limiter skip list", () => {
  it("is exactly the two email endpoints", () => {
    assert.deepEqual([...OWNED_BY_LOGIN_LOCKOUT].sort(), ["/sign-in/email", "/sign-up/email"]);
    assert.equal(ownedByLoginLockout("/api/auth/sign-in/email"), true);
    assert.equal(ownedByLoginLockout("/api/auth/sign-up/email"), true);
  });

  it("other sign-in / sign-up paths keep Better Auth's limiter", () => {
    const fn = betterAuthRateLimit({ getSql: down, production: true }).customRules["/**"];
    for (const p of [
      "/api/auth/sign-in/social",
      "/api/auth/sign-in/anonymous",
      "/api/auth/sign-in/magic-link",
      "/api/auth/sign-in/email-otp",
      "/api/auth/sign-in/email/extra",
      "/api/auth/sign-in/emailx",
      "/api/auth/sign-up/email/",
      "/api/auth/sign-in",
      "/api/auth/sign-up",
    ]) {
      assert.equal(ownedByLoginLockout(p), false, p);
      assert.deepEqual(fn(req(p), rule), rule, p);
    }
    assert.equal(fn(req("/api/auth/sign-in/email"), rule), false);
    assert.equal(fn(req("/api/auth/sign-up/email"), rule), false);
  });
});
