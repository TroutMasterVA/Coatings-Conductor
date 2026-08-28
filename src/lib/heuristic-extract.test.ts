import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { heuristicExtract } from "./heuristic-extract.ts";
import type { FieldCardData } from "./types.ts";

const HOLD_NAMES = [
  "Material receipt",
  "Storage check",
  "Credentials",
  "Surface preparation",
  "Ambient / dew point",
  "Mix",
  "Application",
  "Cure / recoat",
  "Final inspection",
];

const FULL_PDS = [
  "Product Name: FieldCoat 500",
  "Manufacturer: Carboline",
  "Generic type: epoxy mastic",
  "Rev: 08/2024",
  "Date: 08/01/2024",
  "Service: immersion",
  "Mix ratio: 1:1 by volume",
  "Pot life: 2 hours",
  "Shelf life: 24 months",
  "VOC: 84 g/L",
  "DFT: 4-8 mils",
  "Anchor profile: 2-3 mils",
  "Recoat minimum: 4 hours",
  "Maximum recoat: 30 days",
  "Coverage: 200 sq ft/gal",
  "Induction: 15 minutes",
  "Thinning: not required",
  "SSPC-SP 10",
  "NACE No. 2",
  "Ambient temperature 50 F to 90 F",
  "Surface temperature 55 F to 120 F",
  "Relative humidity 85%",
  "5 F above dew point",
  "Do not apply if rain is expected",
  "Wind 20 mph",
  "Store at 40 F to 110 F",
  "Keep dry",
  "Protect from freeze",
  "NACE certified applicator",
  "Bare steel",
  "Cleanliness: SSPC-SP 10",
  "Surface must be dry",
  "Airless",
  "Brush",
  "Number of coats: 1-2",
  "Dry to touch: 2 hours",
  "Dry to handle: 8 hours",
  "Full cure: 7 days",
  "Respirator",
  "Gloves",
  "Ventilation: required in confined space",
  "Flammable",
  "Isocyanate",
].join("\n");

function assertCardShape(card: FieldCardData) {
  assert.equal(typeof card.id, "string");
  assert.ok(card.id.length > 0);
  assert.equal(typeof card.extractedAt, "string");
  assert.equal(card.confidence, "low");
  assert.ok(Array.isArray(card.extractionNotes));
  assert.equal(typeof card.product.name, "string");
  assert.ok(Array.isArray(card.holdPoints));
  assert.ok(Array.isArray(card.environmentals.additional));
}

describe("heuristicExtract", () => {
  it("returns a FieldCardData-shaped card with low confidence", () => {
    const card = heuristicExtract(FULL_PDS);
    assertCardShape(card);
    assert.match(card.extractionNotes[0] ?? "", /Heuristic extract/i);
  });

  it("pulls stated product, mix, prep, and safety fields", () => {
    const card = heuristicExtract(FULL_PDS);
    assert.match(card.product.name, /FieldCoat 500/);
    assert.match(card.product.manufacturer, /Carboline/);
    assert.match(card.product.mixRatio, /1\s*:\s*1/);
    assert.ok(card.surfacePrep.methods.some((m) => /SSPC-?SP\s?10/i.test(m)));
    assert.ok(card.safety.ppe.some((p) => /respirator/i.test(p)));
  });

  it("reads ambient, substrate, RH, wind, and stated dew-point spread", () => {
    const card = heuristicExtract(FULL_PDS);
    assert.equal(card.environmentals.ambientTempMinF, 50);
    assert.equal(card.environmentals.ambientTempMaxF, 90);
    assert.equal(card.environmentals.substrateTempMinF, 55);
    assert.equal(card.environmentals.substrateTempMaxF, 120);
    assert.equal(card.environmentals.relativeHumidityMax, 85);
    assert.equal(card.environmentals.windMaxMph, 20);
    assert.equal(card.environmentals.dewPointSpreadMinF, 5);
  });

  it("converts Celsius ambient limits to Fahrenheit", () => {
    const card = heuristicExtract(
      [
        "Product Name: TempCoat",
        "Ambient temperature 10 C to 32 C",
        "This filler keeps the sheet long enough to parse as a PDS.",
      ].join("\n"),
    );
    assert.equal(card.environmentals.ambientTempMinF, 50);
    assert.equal(card.environmentals.ambientTempMaxF, 90);
  });

  it("leaves numeric environmental limits null when the PDS states none", () => {
    const card = heuristicExtract(
      [
        "Product Name: BareCoat epoxy",
        "This product data sheet states no temperature, humidity, or wind limits at all.",
      ].join("\n"),
    );
    assert.equal(card.environmentals.ambientTempMinF, null);
    assert.equal(card.environmentals.ambientTempMaxF, null);
    assert.equal(card.environmentals.substrateTempMinF, null);
    assert.equal(card.environmentals.substrateTempMaxF, null);
    assert.equal(card.environmentals.relativeHumidityMax, null);
    assert.equal(card.environmentals.relativeHumidityMin, null);
    assert.equal(card.environmentals.dewPointSpreadMinF, null);
    assert.equal(card.environmentals.windMaxMph, null);
  });

  it("live heuristic defaults precipitationAllowed to true (AI prompt says the opposite)", () => {
    const card = heuristicExtract(
      [
        "Product Name: OpenCoat",
        "Application instructions mention weather only in passing and never forbid rain or wet substrate.",
      ].join("\n"),
    );
    assert.equal(card.environmentals.precipitationAllowed, true);
  });

  it("sets precipitationAllowed false when the PDS says not to apply in rain", () => {
    const card = heuristicExtract(FULL_PDS);
    assert.equal(card.environmentals.precipitationAllowed, false);
  });

  it("live heuristic invents a 5 F dew-point spread when dew point is named without a number", () => {
    const card = heuristicExtract(
      [
        "Product Name: DewCoat",
        "Watch the dew point before spraying. No spread is published on this sheet.",
      ].join("\n"),
    );
    assert.equal(card.environmentals.dewPointSpreadMinF, 5);
  });

  it("emits nine hold points in process order", () => {
    const card = heuristicExtract(FULL_PDS);
    assert.equal(card.holdPoints.length, 9);
    assert.deepEqual(
      card.holdPoints.map((h) => h.step),
      [1, 2, 3, 4, 5, 6, 7, 8, 9],
    );
    assert.deepEqual(
      card.holdPoints.map((h) => h.name),
      HOLD_NAMES,
    );
  });

  it("falls back to Unnamed product when there is no usable title line", () => {
    const card = heuristicExtract("   \n   \n");
    assert.equal(card.product.name, "Unnamed product");
  });
});
