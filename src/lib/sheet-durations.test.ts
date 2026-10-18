/**
 * Duration rule (pot life, recoat min/max) and the temperature-source rule. General fixtures plus
 * real lines from QA's sheets; prose only stays Not stated.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { heuristicExtract } from "./heuristic-extract.ts";
import { potLifeFromText, recoatFromText } from "./sheet-durations.ts";

describe("recoat window is a duration (or a table of durations)", () => {
  it("Macropoxy-style drying table: 'maximum: 1 year 1 year 1 year' -> 1 year, never the prose after it", () => {
    const t =
      "Average Drying Times @ 7.0 mils (175 microns) wet: 35 ° F (1.7 ° C) 77 ° F (25 ° C) 100 ° F (38 ° C) 50% RH 50% RH 50% RH Touch: 4-5 hours 2 hours 1.5 hours Handle: 48 hours 8 hours 4.5 hours Recoat: minimum: 48 hours 8 hours 4.5 hours maximum: 1 year 1 year 1 year Cure to service: atmospheric: 10 days 7 days 4 days If maximum recoat time is exceeded, abrade surface before recoating.";
    const r = recoatFromText(t);
    assert.equal(r.max, "1 year");
    assert.equal(r.min, "48 hours 8 hours 4.5 hours");
    const card = heuristicExtract(t);
    assert.equal(card.cure.recoatMax, "1 year");
    assert.doesNotMatch(card.cure.recoatMax, /abrade|exceeded/);
  });

  it("prose only -> Not stated", () => {
    const t =
      "If maximum recoat time is exceeded, abrade surface before recoating. Recoat interval, min: According to separate APPLICATION INSTRUCTIONS. Recoat interval, max: According to separate APPLICATION INSTRUCTIONS.";
    assert.deepEqual(recoatFromText(t), { min: "", max: "" });
    const card = heuristicExtract(t);
    assert.equal(card.cure.recoatMin, "");
    assert.equal(card.cure.recoatMax, "");
  });

  it("generic: 'Recoat times (°F/°C header) minimum (hours) 2 4 12 maximum Unlimited'", () => {
    const r = recoatFromText(
      "Recoat times F˚/C˚ 90/32 70/21 50/10 minimum (hours) 2 4 12 maximum Unlimited* *Surface must be dry.",
    );
    assert.equal(r.min, "2 hours at 90°F, 4 hours at 70°F, 12 hours at 50°F");
    assert.equal(r.max, "Unlimited");
  });

  it("generic: labelled 'Minimum recoat: 16 hours' / 'Maximum recoat: 30 days', and 'Recoat 16 hours to 1 year'", () => {
    assert.deepEqual(recoatFromText("Minimum recoat: 16 hours at 70°F. Maximum recoat: 30 days."), {
      min: "16 hours at 70°F",
      max: "30 days",
    });
    assert.deepEqual(recoatFromText("Recoat 16 hours to 1 year at 70°F (21°C)"), {
      min: "16 hours",
      max: "1 year",
    });
  });

  it("a table header or another label after 'maximum' is not a value", () => {
    assert.deepEqual(
      recoatFromText("Recoat: minimum: see note maximum: contact Technical Service."),
      { min: "", max: "" },
    );
  });
});

describe("pot life is a duration (or a table of durations)", () => {
  it("labelled row: 'POT LIFE 8 hours at 77°F (25°C) and 50% R.H.', not an earlier 'pot life limits' sentence", () => {
    const t =
      "Do not exceed pot life limits. THINNING For spray, thin up to 10% or 3/4 pint (380 mL) per gallon. POT LIFE 8 hours at 77°F (25°C) and 50% R.H. Caution: This product cures with moisture.";
    assert.equal(potLifeFromText(t), "8 hours at 77°F (25°C) and 50% R.H.");
  });

  it("unit header table: 'Pot life (hours) F˚/C˚ 90/32 70/21 50/10 2 4 6'", () => {
    assert.equal(
      potLifeFromText(
        "Pot life is shortened by higher temperatures. See pot life data. Pot life (hours) F˚/C˚ 90/32 70/21 50/10 2 4 6 Dry times",
      ),
      "2 hours at 90°F, 4 hours at 70°F, 6 hours at 50°F",
    );
  });

  it("prose only -> Not stated (mixing instructions, 'pot life specified', another label in between)", () => {
    for (const t of [
      "Mix and use within the working pot life specified. (1) Agitate Base (Part A) with a power agitator.",
      "Pot life: Nozzle orifice: 0.019 to 0.021 in. 2 hour(s) 20°C/68°F",
      "Pot life is shortened by higher temperatures.",
      "Pot Life Airless Spray Air Spray Brush Roller Thinner Cleaner",
    ]) {
      assert.equal(potLifeFromText(t), "", t);
      assert.equal(heuristicExtract(t).mixing.potLife, "", t);
    }
  });

  it("generic short forms: 'Pot life 60 min', 'Pot Life: 10 hours 4 hours 2 hours', 'Working pot life: 1½ hours'", () => {
    assert.equal(
      potLifeFromText("Product temperature 68°F Pot life 60 min Application method"),
      "60 min",
    );
    assert.equal(
      potLifeFromText("Pot Life: 10 hours 4 hours 2 hours Sweat-in-time: 30 minutes"),
      "10 hours 4 hours 2 hours",
    );
    assert.equal(potLifeFromText("Working pot life: 1½ hours at 77°F"), "1½ hours at 77°F");
  });
});

describe("temperature limits come from application conditions, not a substrate/filler/prep step", () => {
  it("Pro Industrial DTM-style: the block-filler 55°F is not the air/surface minimum", () => {
    const t = [
      "APPLICATION Temperature: minimum 50°F / 10°C maximum 110°F / 43°C air, surface and material At least 5°F above dew point",
      "Concrete Block - Surface should be thoroughly clean and dry. Air, material, and surface temperatures must be at least 55°F (13°C) before filling. Use Pro Industrial Heavy Duty Block Filler.",
    ].join("\n");
    const e = heuristicExtract(t).environmentals;
    assert.notEqual(e.ambientTempMinF, 55);
    assert.notEqual(e.substrateTempMinF, 55);
  });

  it("if the only temperature is in a prep/filler instruction, it is Not stated", () => {
    const e = heuristicExtract(
      "Concrete Block - Air, material, and surface temperatures must be at least 55°F (13°C) before filling.",
    ).environmentals;
    assert.deepEqual([e.ambientTempMinF, e.substrateTempMinF], [null, null]);
  });

  it("generic: a patching/priming step temperature is ignored; the application limit is kept", () => {
    const t = [
      "Masonry: apply patching compound when the surface temperature is at least 60°F prior to priming.",
      "Application conditions: Air temperature minimum 40°F. Surface temperature minimum 45°F.",
    ].join("\n");
    const e = heuristicExtract(t).environmentals;
    assert.equal(e.ambientTempMinF, 40);
    assert.equal(e.substrateTempMinF, 45);
  });
});
