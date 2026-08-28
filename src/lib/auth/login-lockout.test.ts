import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  ACCOUNT_LOCKED,
  LOGIN_FAIL_MAX,
  LOGIN_RATE_MAX,
  RATE_LIMITED,
  clearLoginFailures,
  evaluateLock,
  loginCardMessage,
  normalizeLoginEmail,
  recordLoginFailure,
  takeLoginRateSlot,
} from "./login-lockout.ts";

describe("login lockout contract for the existing card", () => {
  it("exposes rate-limit as 429 RATE_LIMITED", () => {
    assert.equal(RATE_LIMITED.status, 429);
    assert.equal(RATE_LIMITED.code, "RATE_LIMITED");
    assert.equal(RATE_LIMITED.message, "Too many tries. Wait a minute and try again.");
  });

  it("exposes lockout as 403 ACCOUNT_LOCKED", () => {
    assert.equal(ACCOUNT_LOCKED.status, 403);
    assert.equal(ACCOUNT_LOCKED.code, "ACCOUNT_LOCKED");
    assert.equal(ACCOUNT_LOCKED.message, "This account is locked. Try again later.");
  });

  it("normalizes email keys", () => {
    assert.equal(normalizeLoginEmail("  Ada@Site.COM "), "ada@site.com");
  });
});

describe("login IP rate-limit", () => {
  it("refuses the next try after the window max", () => {
    let stamps: number[] = [];
    const start = 5_000_000;
    for (let i = 0; i < LOGIN_RATE_MAX; i += 1) {
      const slot = takeLoginRateSlot(start + i, stamps);
      assert.equal(slot.ok, true);
      stamps = slot.stamps;
    }
    assert.equal(takeLoginRateSlot(start + LOGIN_RATE_MAX, stamps).ok, false);
  });
});

describe("account lock after repeated failures", () => {
  it("locks on the Nth failure and stays locked until the window", () => {
    let state = clearLoginFailures();
    const start = 9_000_000;
    for (let i = 0; i < LOGIN_FAIL_MAX; i += 1) {
      state = recordLoginFailure(start + i, state);
    }
    assert.equal(evaluateLock(start + LOGIN_FAIL_MAX, state), "locked");
    assert.equal(evaluateLock(start + 14 * 60 * 1000, state), "locked");
    assert.equal(evaluateLock(start + 15 * 60 * 1000 + 1, clearLoginFailures()), "ok");
  });

  it("clears on a successful sign-in", () => {
    let state = recordLoginFailure(1, clearLoginFailures());
    state = clearLoginFailures();
    assert.equal(evaluateLock(2, state), "ok");
    assert.equal(state.failures.length, 0);
  });
});

describe("login card red line", () => {
  it("maps RATE_LIMITED by code, status, or message", () => {
    assert.equal(loginCardMessage({ code: "RATE_LIMITED" }), RATE_LIMITED.message);
    assert.equal(loginCardMessage({ status: 429, message: "Too many requests" }), RATE_LIMITED.message);
    assert.equal(loginCardMessage({ code: "TOO_MANY_REQUESTS" }), RATE_LIMITED.message);
    assert.equal(loginCardMessage({ message: RATE_LIMITED.message }), RATE_LIMITED.message);
  });

  it("maps ACCOUNT_LOCKED by code or message, not every 403", () => {
    assert.equal(loginCardMessage({ code: "ACCOUNT_LOCKED" }), ACCOUNT_LOCKED.message);
    assert.equal(
      loginCardMessage({ message: ACCOUNT_LOCKED.message, status: 403 }),
      ACCOUNT_LOCKED.message,
    );
    assert.equal(
      loginCardMessage({ status: 403, code: "FORBIDDEN", message: "Invalid origin" }),
      "Invalid origin",
    );
  });

  it("keeps ordinary sign-in failure on that same line", () => {
    assert.equal(loginCardMessage({ message: "Invalid email or password" }), "Invalid email or password");
    assert.equal(loginCardMessage(null, "Sign-in failed."), "Sign-in failed.");
  });
});
