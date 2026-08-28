import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { heuristicExtract } from "./heuristic-extract.ts";
import { buildCardFromPds } from "./on-device-extract.ts";

const PITT_THERM = `PRODUCT DATA SHEET
January 15 2025 (Revision of January 15 2025)
PPG PITT-THERM® 1000 FX

DESCRIPTION
Two-component, 100% solids, flexible, high-build syntactic epoxy insulation coating.

PRINCIPAL CHARACTERISTICS
Operating Temperature Limits: -60°C (-76°F) to +125°C (+257°F) continuous

BASIC DATA AT 20°C (68°F)
VOC (Supplied) EPA Method 24: 0.0 g/l (0.0 lb/USgal)
Recommended dry film thickness 78.7 - 1181 mils (2000 - 30000 µm) depending on system
Shelf life Base: at least 12 months when stored cool and dry

Material should be stored in dry conditions at temperatures above 0°C (32°F) and below 35°C (95°F).

RECOMMENDED SUBSTRATE CONDITIONS AND TEMPERATURES
Substrate temperature and application conditions
Ambient temperature below 10°C (50°F) is acceptable; however curing to hardness takes longer, and it will cease curing below 5°C (41°F)
Substrate temperature during application and curing should be at least 3°C (5°F) above dew point
Relative humidity during application and curing should not exceed 85%

Mixing ratio
By volume: base to hardener 1:1
By weight: base to hardener 1.16:1

Airless spray: Plural component
After airless application, surface should be smoothed with trowel and/or roller

Pot life
23°C (73°F) 1 hour
30°C (86°F) 30 minutes
`;

describe("PITT-THERM 1000 FX parse", () => {
  it("names the product, not DATA SHEET", () => {
    const card = heuristicExtract(PITT_THERM);
    assert.match(card.product.name, /PITT-THERM/i);
    assert.doesNotMatch(card.product.name, /^DATA SHEET$/i);
    assert.match(card.product.manufacturer, /PPG/i);
  });

  it("treats 3°C (5°F) dew as a 5°F spread, not 37°F", () => {
    const card = heuristicExtract(PITT_THERM);
    assert.equal(card.environmentals.dewPointSpreadMinF, 5);
  });

  it("reads RH not exceed 85%", () => {
    const card = heuristicExtract(PITT_THERM);
    assert.equal(card.environmentals.relativeHumidityMax, 85);
  });

  it("does not allow rain and does not steal service -60/125 as apply window", () => {
    const card = heuristicExtract(PITT_THERM);
    assert.equal(card.environmentals.precipitationAllowed, false);
    assert.notEqual(card.environmentals.ambientTempMinF, -76);
    assert.notEqual(card.environmentals.ambientTempMaxF, 257);
  });

  it("captures mix 1:1 and DFT range", () => {
    const card = heuristicExtract(PITT_THERM);
    assert.match(card.product.mixRatio, /1\s*:\s*1/);
    assert.match(card.installation.filmThickness, /78\.7/);
  });

  it("buildCardFromPds accepts the sheet", () => {
    const card = buildCardFromPds(PITT_THERM);
    assert.equal(card.environmentals.dewPointSpreadMinF, 5);
    assert.equal(card.environmentals.relativeHumidityMax, 85);
  });
});

describe("dew delta units", () => {
  it("converts 3°C above dew (no paren) to 5°F", () => {
    const card = heuristicExtract(
      `Product data sheet epoxy mix 1:1 DFT 5 mils.\nSurface must be at least 3°C above the dew point.`,
    );
    assert.equal(card.environmentals.dewPointSpreadMinF, 5);
  });

  it("keeps 5°F (3°C) as 5°F", () => {
    const card = heuristicExtract(
      `Product data sheet epoxy mix 1:1 DFT 5 mils.\nSurface must be at least 5°F (3°C) above the dew point.`,
    );
    assert.equal(card.environmentals.dewPointSpreadMinF, 5);
  });
});
