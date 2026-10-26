import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { coverageFromText, heuristicExtract, tableJunkOrValue, withThinnerId } from "./heuristic-extract.ts";

// 10-sheet regression on f8d9b0d: general rules, synthetic text only.
describe("regression rules (synthetic)", () => {
  it("(a) coverage keeps its unit tail", () => {
    const t = "Theoretical Coverage 11.40 m²/litre at 50 microns d.f.t and stated volume solids\n457 sq.ft/US gallon at 2 mils d.f.t and stated volume solids";
    assert.equal(coverageFromText(t), "457 sq.ft/US gallon at 2 mils d.f.t");
    assert.equal(coverageFromText("Coverage: 320 sq ft/gal @2 mils"), "320 sq ft/gal @2 mils");
    assert.equal(heuristicExtract("Practical Coverage Method of Application Drying Time\n").installation.coverage, "");
  });
  it("(b) thinner keeps its identifier token after the label", () => {
    const t = "Mixing & Thinning\nMixing Power mix base, then combine.\nThinning May be thinned up to 5 oz/gal (4%) with #26 for ambient surfaces.";
    assert.match(withThinnerId("Mixing Power mix base, then combine", t), /#26/);
    assert.equal(withThinnerId("Thinner #10", t), "Thinner #10");
  });
  it("(c) text across a line/page break is not cut off before a product code", () => {
    const t = "THINNING Thinning is normally not required, except for air-atomized spray. For air-atomized spray\n\nthin only up to 10% by volume with 160402 Thinner after mixing.";
    assert.match(withThinnerId("Thinning is normally not required, except for air-atomized spray", t), /160402 Thinner/);
  });
  it("surface prep never shows placeholder text", () => {
    assert.ok(!heuristicExtract("ACME 1 PRIMER\nApply by brush.").holdPoints.some((h) => /Prep per PDS/.test(h.criteria ?? "")));
  });
  it("table header text in touch-dry / coats drops to Not stated", () => {
    assert.equal(tableJunkOrValue("Dry Hard Dry Minimum Maximum", /^\d/), "");
    assert.equal(tableJunkOrValue("4-5 hours 2 hours Handle: 48 hours", /^\d/), "");
    assert.equal(tableJunkOrValue("2 hours", /^\d/), "2 hours");
  });
});
