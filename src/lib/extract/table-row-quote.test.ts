import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { gateNumbers, quoteBacksValue } from "./provenance.ts";
import { heuristicExtract } from "../heuristic-extract.ts";
import { scoreHour, type RawHour } from "../score-windows.ts";
import type { Environmentals } from "../types.ts";

// Table rows on the browser path: row label + that row's cell, spaced / tab / newline separated.
describe("quote gate: values read from a table row", () => {
  it("(1) a value from its own table row passes, with the row in the quote", () => {
    const card = heuristicExtract(" ");
    card.environmentals.ambientTempMinF = 20;
    card.environmentals.ambientTempMaxF = 120;
    card.installation.filmThickness = "2.4–4.0 mils";
    const text = "Environmental conditions\t˚F\t˚C\nair and surface temp\t20 to 120\t-7 to 49\nWet mils:   6.0-10.0\nDry mils:\n2.4-4.0\nCoverage: 160-267 sq. ft.";
    const g = gateNumbers(card, { text: text.replace(/\n/g, " ") });
    assert.equal(g.card.environmentals.ambientTempMinF, 20);
    assert.equal(g.card.environmentals.ambientTempMaxF, 120);
    assert.equal(g.card.installation.filmThickness, "2.4–4.0 mils");
    for (const k of ["environmentals.ambientTempMinF", "environmentals.ambientTempMaxF"]) {
      const p = g.provenance[k];
      assert.ok(p && p !== "not-stated" && /air and surface temp\s+20 to 120/.test(p.quote), k);
    }
    const dft = g.provenance["installation.filmThickness"];
    assert.ok(dft && dft !== "not-stated" && /Dry mils:\s*2\.4-4\.0/.test(dft.quote));
  });
  it("(2) a header-only quote is rejected, and a value not in the row still drops", () => {
    assert.equal(quoteBacksValue("environmentals.ambientTempMaxF", 120, "Environmental conditions ˚F ˚C air and surface temp"), false);
    assert.equal(quoteBacksValue("environmentals.ambientTempMaxF", 120, "˚F ˚C"), false);
    // Whole-number match stays strict: 12 is not in "120".
    assert.equal(quoteBacksValue("environmentals.ambientTempMaxF", 12, "˚F ˚C air and surface temp 20 to 120"), false);
    const card = heuristicExtract(" ");
    card.environmentals.ambientTempMaxF = 130;
    const g = gateNumbers(card, { text: "Environmental conditions ˚F ˚C air and surface temp 20 to 120 -7 to 49" });
    assert.equal(g.card.environmentals.ambientTempMaxF, null);
    assert.equal(g.provenance["environmentals.ambientTempMaxF"], "not-stated");
  });
});

describe("GO reason when the sheet states no dew margin", () => {
  it("(3) carries the labelled 5°F default", () => {
    const env = { ...heuristicExtract(" ").environmentals, ambientTempMinF: 40, ambientTempMaxF: 100, substrateTempMinF: 40, substrateTempMaxF: 120,
      relativeHumidityMax: 85, dewPointSpreadMinF: null, windMaxMph: 25, precipitationAllowed: false } as Environmentals;
    const raw: RawHour = { startIso: "2026-10-24T06:00:00Z", tempF: 70, rh: 40, dewpointF: 50, pop: 0, precipIn: 0, windMph: 3, shortForecast: "Clear" } as RawHour;
    const h = scoreHour(raw, env, "UTC");
    assert.equal(h.status, "go");
    assert.ok(h.reasons.some((r) => r.startsWith("Inside PDS window") && r.includes("industry default (SSPC), not from sheet")), h.reasons.join(" | "));
    const stated = scoreHour(raw, { ...env, dewPointSpreadMinF: 5 }, "UTC");
    assert.ok(!stated.reasons.join(" ").includes("industry default"));
  });
});
