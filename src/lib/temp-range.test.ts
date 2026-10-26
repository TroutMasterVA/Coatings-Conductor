import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { formatTempRange } from "./temp-range.ts";
import { buildLaymanBullets } from "./layman-bullets.ts";
import { heuristicExtract } from "./heuristic-extract.ts";

function cardWith(air: [number | null, number | null], sub: [number | null, number | null]) {
  const c = heuristicExtract("Product data sheet. Epoxy coating.");
  c.environmentals.ambientTempMinF = air[0];
  c.environmentals.ambientTempMaxF = air[1];
  c.environmentals.substrateTempMinF = sub[0];
  c.environmentals.substrateTempMaxF = sub[1];
  return c;
}

describe("formatTempRange: never a dangling dash", () => {
  it("full range", () => assert.equal(formatTempRange(50, 120), "50–120°F"));
  it("min only -> at least", () => assert.equal(formatTempRange(50, null), "at least 50°F"));
  it("max only -> up to", () => assert.equal(formatTempRange(null, 120), "up to 120°F"));
  it("neither -> Not stated", () => {
    assert.equal(formatTempRange(null, null), "Not stated");
    assert.equal(formatTempRange(undefined, undefined), "Not stated");
  });
  it("zero is a real value", () => assert.equal(formatTempRange(0, 130), "0–130°F"));
});

describe("go-gate bullet uses it (Rust-Oleum 9100 shape: air 50–120, substrate max only)", () => {
  it("prints 'air 50–120°F; substrate up to 120°F' and no '—–'", () => {
    const gate = buildLaymanBullets(cardWith([50, 120], [null, 120])).find((b) =>
      b.startsWith("Go gates"),
    )!;
    assert.match(gate, /air 50–120°F/);
    assert.match(gate, /substrate up to 120°F/);
    assert.doesNotMatch(gate, /—–|–—|––|\d–°F/);
  });
  it("min only and nothing stated", () => {
    const gate = buildLaymanBullets(cardWith([50, null], [null, null])).find((b) =>
      b.startsWith("Go gates"),
    )!;
    assert.match(gate, /air at least 50°F/);
    assert.doesNotMatch(gate, /substrate/);
    assert.doesNotMatch(gate, /—–|––/);
  });
});
