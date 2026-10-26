import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { goGateChips } from "./go-gate-chips.ts";
import type { FieldCardData } from "../lib/types.ts";

function card(env: Record<string, unknown>): FieldCardData {
  return { environmentals: { dewPointSpreadMinF: 5, ...env } } as unknown as FieldCardData;
}
const temps = (env: Record<string, unknown>) =>
  goGateChips(card(env)).filter((c) => c.startsWith("Air") || c.startsWith("Substrate"));

describe("go-gate temperature chips", () => {
  it("both ends: a plain range", () => {
    assert.deepEqual(temps({ ambientTempMinF: 50, ambientTempMaxF: 120, substrateTempMinF: 35, substrateTempMaxF: 140 }), [
      "Air 50–120°F",
      "Substrate 35–140°F",
    ]);
  });
  it("min only: at least", () => {
    assert.deepEqual(temps({ ambientTempMinF: 50, ambientTempMaxF: null }), ["Air at least 50°F"]);
  });
  it("max only: up to", () => {
    assert.deepEqual(temps({ substrateTempMinF: null, substrateTempMaxF: 120 }), ["Substrate up to 120°F"]);
  });
  it("neither end: no chip, no dash pair", () => {
    assert.deepEqual(temps({ ambientTempMinF: null, ambientTempMaxF: null }), []);
    assert.deepEqual(temps({}), []);
  });
  it("Rust-Oleum 9100 shape (air min 50 / max null, substrate min null / max 120) never shows a dash pair", () => {
    const chips = goGateChips(
      card({ ambientTempMinF: 50, ambientTempMaxF: null, substrateTempMinF: null, substrateTempMaxF: 120 }),
    );
    assert.ok(chips.includes("Air at least 50°F"));
    assert.ok(chips.includes("Substrate up to 120°F"));
    for (const c of chips) assert.doesNotMatch(c, /—|––|–°F|\s–\d/);
  });
});
