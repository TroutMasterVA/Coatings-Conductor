// BUG-52-2 / BUG-52-3 (PR #52): the login card lines for the network pause and the timed account lock.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ACCOUNT_LOCKED, NETWORK_PAUSED, RATE_LIMITED, accountLockedMessage, loginCardMessage } from "./login-lockout";

// 8:57:35 AM ET (UTC-4) on Fri Oct 30, 2026, QA's lock time.
const NOW = Date.parse("2026-10-30T12:57:35Z");
const ET = { now: NOW, timeZone: "America/New_York", locale: "en-US" };

describe("network pause line (BUG-52-2)", () => {
  it("has the exact text and wins over the generic 429 line", () => {
    assert.equal(NETWORK_PAUSED.message, "Sign-in is paused on this network for up to 15 minutes.");
    assert.equal(NETWORK_PAUSED.status, 429);
    assert.equal(loginCardMessage({ code: "NETWORK_PAUSED", status: 429, retryAfterSec: 900 }), NETWORK_PAUSED.message);
    assert.equal(loginCardMessage({ message: NETWORK_PAUSED.message, status: 429 }), NETWORK_PAUSED.message);
    // The per-minute rate keeps its own line.
    assert.equal(loginCardMessage({ code: "RATE_LIMITED", status: 429, retryAfterSec: 60 }), RATE_LIMITED.message);
  });
});

describe("account lock line with the time (BUG-52-3)", () => {
  it("gives the length and the local time to try again, rounded up to the minute", () => {
    assert.equal(accountLockedMessage(900, ET), "Locked for 15 minutes. Try again after 9:13 AM.");
    assert.equal(accountLockedMessage(331, ET), "Locked for 15 minutes. Try again after 9:04 AM.");
    // Exactly on a minute stays on it.
    assert.equal(
      accountLockedMessage(60, { ...ET, now: Date.parse("2026-10-30T13:11:00Z") }),
      "Locked for 15 minutes. Try again after 9:12 AM.",
    );
  });

  it("the card uses it when the server sends retryAfterSec (number or string)", () => {
    assert.equal(
      loginCardMessage({ code: "ACCOUNT_LOCKED", status: 403, retryAfterSec: 900, message: ACCOUNT_LOCKED.message }, "Sign-in failed.", ET),
      "Locked for 15 minutes. Try again after 9:13 AM.",
    );
    assert.equal(
      loginCardMessage({ code: "ACCOUNT_LOCKED", retryAfterSec: "900" }, "Sign-in failed.", ET),
      "Locked for 15 minutes. Try again after 9:13 AM.",
    );
  });

  it("without a usable retryAfterSec it falls back to the plain lock line", () => {
    assert.equal(loginCardMessage({ code: "ACCOUNT_LOCKED", retryAfterSec: null }, "x", ET), ACCOUNT_LOCKED.message);
    assert.equal(loginCardMessage({ code: "ACCOUNT_LOCKED", retryAfterSec: "soon" }, "x", ET), ACCOUNT_LOCKED.message);
  });

  it("uses the user's own time zone", () => {
    assert.equal(
      accountLockedMessage(900, { now: NOW, timeZone: "America/Chicago", locale: "en-US" }),
      "Locked for 15 minutes. Try again after 8:13 AM.",
    );
  });
});
