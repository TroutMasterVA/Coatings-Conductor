import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { heuristicExtract } from "./heuristic-extract.ts";
import { buildCardFromPds } from "./on-device-extract.ts";
import { SAMPLE_PDS_TEXT } from "./samples.ts";
import { scoreHour, type RawHour } from "./score-windows.ts";
import type { Environmentals } from "./types.ts";

function env(partial: Partial<Environmentals>): Environmentals {
  return {
    ambientTempMinF: 50,
    ambientTempMaxF: 90,
    substrateTempMinF: 50,
    substrateTempMaxF: 90,
    relativeHumidityMax: null,
    relativeHumidityMin: null,
    dewPointSpreadMinF: null,
    precipitationAllowed: false,
    windMaxMph: null,
    directSunNotes: "",
    notes: "",
    additional: [],
    ...partial,
  };
}

function hour(partial: Partial<RawHour>): RawHour {
  return {
    startIso: "2026-08-28T02:00:00Z",
    tempF: 70,
    rh: 45,
    dewpointF: 50,
    pop: 5,
    precipIn: 0,
    windMph: 5,
    shortForecast: "Clear",
    ...partial,
  };
}

const UNKNOWN_MAKER = `
Product data sheet
Epoxy coating for carbon steel
Mix ratio 2:1 by volume
Pot life 4 hours at 77F
DFT 4-6 mils
Ambient 50-90 F
Surface preparation SSPC-SP6
`;

const DEW_MENTION_NO_NUMBER = `
Product data sheet — unknown brand epoxy
Mix ratio 1:1 by volume. Pot life 3 hours.
DFT 5 mils. Ambient 50-90 F.
Dew point: substrate dry, no condensation.
`;

const STATED_DEW = `
Product data sheet — field epoxy
Mix ratio 1:1 by volume. Pot life 2 hours.
DFT 5-8 mils. Air and surface 40-100 F.
Surface must be at least 5°F above the dew point.
`;

const SILENT_RAIN = `
Product data sheet — zinc primer
Mix ratio 4:1 by volume. Pot life 6 hours.
DFT 3 mils. Ambient 50-90 F. Recoat 8 hours.
`;

const FORBID_RAIN = `
Product data sheet — urethane topcoat
Mix ratio 2:1 by volume. Pot life 2 hours.
DFT 2-4 mils. Ambient 50-90 F.
Do not apply if rain is imminent before the coating is water-resistant.
`;

const PROTECT_RAIN = `
Product data sheet — structural epoxy adhesive
Mix ratio 1:1 by volume. Pot life 45 minutes.
DFT paste. Ambient 40-95 F.
Moisture-tolerant. Protect from rain until tack-free.
`;

const ALLOW_RAIN = `
Product data sheet — moisture-cure primer
Mix ratio 1:1 by volume. Pot life 1 hour.
DFT 3 mils. Ambient 40-90 F.
This product may be applied in rain.
`;

const GARBAGE =
  "The quick brown fox jumps over the lazy dog. The quick brown fox jumps over the lazy dog. Not a sheet.";

describe("silent sheet extract", () => {
  it("does not invent 5F dew when dew is mentioned with no number", () => {
    const card = heuristicExtract(DEW_MENTION_NO_NUMBER);
    assert.equal(card.environmentals.dewPointSpreadMinF, null);
  });

  it("keeps a stated dew spread", () => {
    const card = heuristicExtract(STATED_DEW);
    assert.equal(card.environmentals.dewPointSpreadMinF, 5);
  });

  it("treats unstated rain as not allowed", () => {
    const card = heuristicExtract(SILENT_RAIN);
    assert.equal(card.environmentals.precipitationAllowed, false);
  });

  it("forbids rain when the sheet says do not apply or protect from rain", () => {
    assert.equal(heuristicExtract(FORBID_RAIN).environmentals.precipitationAllowed, false);
    assert.equal(heuristicExtract(PROTECT_RAIN).environmentals.precipitationAllowed, false);
  });

  it("allows rain only when the sheet says it may be applied in rain", () => {
    const card = heuristicExtract(ALLOW_RAIN);
    assert.equal(card.environmentals.precipitationAllowed, true);
  });

  it("extracts macropoxy sample without inventing rain or extra dew", () => {
    const card = heuristicExtract(SAMPLE_PDS_TEXT.macropoxy);
    assert.match(card.product.name, /Macropoxy/i);
    assert.match(card.product.manufacturer, /Sherwin/i);
    assert.equal(card.environmentals.dewPointSpreadMinF, 5);
    assert.equal(card.environmentals.precipitationAllowed, false);
  });

  it("builds a card for an unknown maker", () => {
    const card = buildCardFromPds(UNKNOWN_MAKER);
    assert.ok(card.product.name.length > 0);
    assert.equal(card.product.manufacturer, "");
  });

  it("throws Could not read this sheet for garbage paste", () => {
    assert.ok(GARBAGE.length >= 80);
    assert.throws(() => buildCardFromPds(GARBAGE), /Could not read this sheet/i);
  });
});

describe("silent sheet windows", () => {
  it("does not score go when dew is not stated", () => {
    const scored = scoreHour(hour({}), env({ dewPointSpreadMinF: null, precipitationAllowed: false }));
    assert.notEqual(scored.status, "go");
    assert.match(scored.reasons.join(" "), /Dew spread not stated/i);
  });

  it("scores wet hours nogo when rain is unstated", () => {
    const scored = scoreHour(
      hour({ shortForecast: "Rain showers", pop: 80, precipIn: 0.1 }),
      env({ dewPointSpreadMinF: null, precipitationAllowed: false }),
    );
    assert.equal(scored.status, "nogo");
  });

  it("scores go when dew is stated and the hour is dry and in range", () => {
    const scored = scoreHour(
      hour({}),
      env({ dewPointSpreadMinF: 5, precipitationAllowed: false }),
    );
    assert.equal(scored.status, "go");
  });
});
