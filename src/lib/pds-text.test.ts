import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { validatePdsText } from "./pds-text.ts";

const ok = "A".repeat(40);

describe("validatePdsText", () => {
  it("rejects text shorter than 40 characters", () => {
    assert.throws(() => validatePdsText({ text: "too short" }), {
      message: "PDS text is too short.",
    });
  });

  it("rejects text longer than 40,000 characters", () => {
    assert.throws(() => validatePdsText({ text: "A".repeat(40001) }), {
      message: "PDS text exceeds 40,000 characters.",
    });
  });

  it("accepts 40 characters", () => {
    assert.equal(validatePdsText({ text: ok }).text, ok);
  });

  it("trims leading and trailing whitespace before measuring", () => {
    assert.throws(() => validatePdsText({ text: "   short   " }), {
      message: "PDS text is too short.",
    });
    assert.equal(validatePdsText({ text: `  ${ok}  ` }).text, ok);
  });

  it("accepts 24,001–40,000 characters but truncates to 24,000", () => {
    const raw = "B".repeat(24001);
    assert.equal(validatePdsText({ text: raw }).text.length, 24000);
  });
});
