import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { accountRejectsGuestImport, guestMigrateResult } from "./guest-import.ts";

describe("guest import skip signal", () => {
  it("imports only into an empty account", () => {
    assert.equal(accountRejectsGuestImport(0, 0), false);
  });

  it("skips when the account already has jobs", () => {
    assert.equal(accountRejectsGuestImport(1, 0), true);
  });

  it("skips when the account already has a custom library", () => {
    assert.equal(accountRejectsGuestImport(0, 1), true);
  });

  it("returns skipped:true shape for a blocked account", () => {
    const skipped = accountRejectsGuestImport(2, 3);
    assert.deepEqual({ imported: skipped ? 0 : 1, skipped }, { imported: 0, skipped: true });
  });
});

describe("guest import is one-way", () => {
  it("does not clear this device when the account already has work", () => {
    const result = guestMigrateResult({ guestHasData: true, skipped: true });
    assert.equal(result.outcome, "skipped");
    assert.equal(result.clearGuest, false);
  });

  it("clears this device only after a successful lift into an empty account", () => {
    const result = guestMigrateResult({ guestHasData: true, skipped: false });
    assert.equal(result.outcome, "imported");
    assert.equal(result.clearGuest, true);
  });

  it("is a no-op when this device has no guest jobs", () => {
    const result = guestMigrateResult({ guestHasData: false, skipped: false });
    assert.equal(result.outcome, "empty");
    assert.equal(result.clearGuest, false);
  });
});
