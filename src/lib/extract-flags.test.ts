import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  DRAFT_BANNER,
  flagsForResult,
  flagsForSaved,
  NO_FLAGS,
  readExtractFlags,
  showWindows,
  WINDOWS_PAUSED,
  windowHeadline,
} from "./extract-flags.ts";

describe("draft / unverified-temps flags", () => {
  it("exact copy", () => {
    assert.equal(DRAFT_BANNER, "Draft — verify every number");
    assert.equal(
      WINDOWS_PAUSED,
      "Weather windows paused: temperature limits not verified on the sheet",
    );
  });
  it("reads the response's extract and top-level flags", () => {
    assert.deepEqual(
      readExtractFlags({ ok: true, extract: { draft: true, unverifiedTemps: false } }),
      {
        draft: true,
        unverifiedTemps: false,
      },
    );
    assert.deepEqual(readExtractFlags({ ok: true, draft: true, unverifiedTemps: true }), {
      draft: true,
      unverifiedTemps: true,
    });
  });
  it("reads a saved job's extract", () => {
    const job = {
      id: "j1",
      card: {},
      extract: { provider: "on-device", draft: true, unverifiedTemps: true },
    };
    assert.deepEqual(readExtractFlags(job), { draft: true, unverifiedTemps: true });
  });
  it("missing or malformed = false, never throws", () => {
    for (const v of [
      undefined,
      null,
      "x",
      3,
      [],
      {},
      { extract: null },
      { extract: { draft: "yes" } },
      { draft: 1 },
    ]) {
      assert.deepEqual(readExtractFlags(v), NO_FLAGS);
    }
  });
  it("draft only: banner on, windows still shown", () => {
    const f = readExtractFlags({ extract: { draft: true, unverifiedTemps: false } });
    assert.equal(f.draft, true);
    assert.equal(showWindows(true, f), true);
    assert.equal(windowHeadline("3 go-days this week", f), "3 go-days this week");
  });
  it("unverified temps: windows replaced by the paused line on screen, print, and PDF", () => {
    const f = readExtractFlags({ extract: { draft: true, unverifiedTemps: true } });
    assert.equal(showWindows(true, f), false);
    assert.equal(windowHeadline("3 go-days this week", f), WINDOWS_PAUSED);
    assert.equal(windowHeadline(undefined, f), WINDOWS_PAUSED);
  });
  it("Azure-verified read: no banner, windows on", () => {
    const f = readExtractFlags({
      extract: { provider: "azure", draft: false, unverifiedTemps: false },
    });
    assert.deepEqual(f, NO_FLAGS);
    assert.equal(showWindows(true, f), true);
    assert.equal(showWindows(false, f), false);
  });
  it("LEAD: anything not verified by Azure is a draft", () => {
    assert.deepEqual(flagsForResult({ provider: "on-device", unverifiedTemps: true }), {
      draft: true,
      unverifiedTemps: true,
    });
    assert.deepEqual(flagsForResult({ provider: "on-device" }), {
      draft: true,
      unverifiedTemps: false,
    });
    assert.deepEqual(flagsForResult({ provider: "azure" }), NO_FLAGS);
    assert.deepEqual(flagsForResult({ provider: "azure", draft: true }), {
      draft: true,
      unverifiedTemps: false,
    });
    assert.deepEqual(flagsForResult(null), { draft: true, unverifiedTemps: true });
  });
  it("reopen / recents: no extract → draft + unverified; non-Azure → draft; Azure → as saved", () => {
    assert.deepEqual(flagsForSaved({ card: {} }), { draft: true, unverifiedTemps: true });
    assert.deepEqual(flagsForSaved(null), { draft: true, unverifiedTemps: true });
    assert.deepEqual(
      flagsForSaved({ extract: { provider: "on-device", unverifiedTemps: false } }),
      {
        draft: true,
        unverifiedTemps: false,
      },
    );
    assert.deepEqual(
      flagsForSaved({ extract: { provider: "azure", draft: false, unverifiedTemps: false } }),
      NO_FLAGS,
    );
    assert.deepEqual(flagsForSaved({ extract: { provider: "azure", unverifiedTemps: true } }), {
      draft: false,
      unverifiedTemps: true,
    });
  });
});
