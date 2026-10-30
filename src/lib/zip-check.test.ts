import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { impossibleZip, ZIP_00000_MESSAGE } from "./zip-check.ts";
import { PUBLIC_MESSAGES } from "./errors/public-error.ts";

describe("ZIP 00000 is refused at project create (QA P3)", () => {
  it("00000 gets a clear message; real-looking ZIPs pass", () => {
    assert.equal(impossibleZip("00000"), ZIP_00000_MESSAGE);
    for (const z of ["22201", "00501", "60601", "99950"]) assert.equal(impossibleZip(z), null, z);
  });
  it("the message is on the public list, so it reaches the screen as written", () => {
    assert.ok(PUBLIC_MESSAGES.has(ZIP_00000_MESSAGE));
  });
});
