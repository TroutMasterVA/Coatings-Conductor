/**
 * Table layouts (be-7): a column header's unit applies to every row, and two-column
 * label/value layouts are read line by line. General rules; silent stays Not stated.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { conditionTableLimits, heuristicExtract, mixRatioFromText } from "./heuristic-extract.ts";

const env = (t: string) => heuristicExtract(t).environmentals;

describe("condition tables: header columns + labelled rows", () => {
  const FLAT =
    "Application Conditions Condition Material Surface Ambient Humidity Normal 40°-95°F (4°-35°C) 40°-110°F (4°-43°C) 40°-95°F (4°-35°C) 40-90% Minimum 0°F (-18°C) 0°F (-18°C) 0°F (-18°C) 30% Maximum 130°F (54°C) 200°F (93°C) 130°F (54°C) 95%";
  // pdf.js lines: the vertically centred row label sits between a row's °F and °C lines.
  const LINES = [
    "Condition Material Surface Ambient Humidity",
    "40°-95°F 40°-110°F 40°-95°F",
    "Normal 40-90%",
    "(4°-35°C) (4°-43°C) (4°-35°C)",
    "0°F 0°F 0°F",
    "Minimum 30%",
    "(-18°C) (-18°C) (-18°C)",
    "130°F 200°F 130°F",
    "Maximum 95%",
    "(54°C) (93°C) (54°C)",
    "Curing Schedule",
  ].join("\n");

  for (const [name, text] of [
    ["flat text", FLAT],
    ["pdf.js lines", LINES],
  ] as const) {
    it(`Minimum/Maximum rows become limits per column (${name})`, () => {
      const e = env(text);
      assert.equal(e.ambientTempMinF, 0);
      assert.equal(e.ambientTempMaxF, 130);
      assert.equal(e.substrateTempMinF, 0);
      assert.equal(e.substrateTempMaxF, 200);
      assert.equal(e.relativeHumidityMax, 95);
      assert.equal(e.dewPointSpreadMinF, null, "the table states no dew margin");
    });
  }

  it("a header unit '(°F)' applies to unitless cells in every row", () => {
    const e = env("Air (°F) Surface (°F) RH (%)\nMinimum 50 55 10%\nMaximum 95 120 85%");
    assert.deepEqual(
      [
        e.ambientTempMinF,
        e.ambientTempMaxF,
        e.substrateTempMinF,
        e.substrateTempMaxF,
        e.relativeHumidityMax,
      ],
      [50, 95, 55, 120, 85],
    );
  });

  it("a header unit '(°C)' converts every row, both ends", () => {
    const e = env("Air Temperature (°C) Surface Temperature (°C)\nMin. 10 5\nMax. 40 50");
    assert.deepEqual(
      [e.ambientTempMinF, e.ambientTempMaxF, e.substrateTempMinF, e.substrateTempMaxF],
      [50, 104, 41, 122],
    );
  });

  it("a Normal row alone is used as a range when the table has no Min/Max rows", () => {
    const e = env("Material Surface Ambient\nNormal 60-90°F 50-100°F 50-90°F");
    assert.deepEqual(
      [e.ambientTempMinF, e.ambientTempMaxF, e.substrateTempMinF, e.substrateTempMaxF],
      [50, 90, 50, 100],
    );
  });

  it("unitless cells with no header unit are not temperatures", () => {
    const e = env("Air Surface\nMinimum 50 55\nMaximum 95 120");
    assert.deepEqual(
      [e.ambientTempMinF, e.ambientTempMaxF, e.substrateTempMinF, e.substrateTempMaxF],
      [null, null, null, null],
    );
  });

  it("a truncated or ragged table yields nothing (no guessing a column)", () => {
    assert.deepEqual(
      conditionTableLimits(
        "Condition Material Surface Ambient Humidity Normal 40°-95°F (4°-35°C) 40°-110°F",
      ).gates,
      [],
    );
    assert.deepEqual(
      conditionTableLimits("Air Surface Humidity\nMinimum 50°F 55°F\nMaximum 95°F 120°F 85%").gates,
      [],
    );
    assert.deepEqual(conditionTableLimits("Air Surface\n50°F 55°F 60°F\nMinimum").gates, []);
  });

  it("prose limits win; the table only fills what prose left open", () => {
    const e = env(
      "Air temperature: minimum 45°F.\nAir Surface\nMinimum 35°F 40°F\nMaximum 100°F 120°F",
    );
    assert.equal(e.ambientTempMinF, 45);
    assert.equal(e.ambientTempMaxF, 100);
    assert.equal(e.substrateTempMinF, 40);
  });

  it("a cure table ('Surface Temp. & 50% Relative Humidity') is not a conditions header", () => {
    const e = env(
      "Curing Schedule Surface Temp. & 50% Relative Humidity Dry to Handle Dry to Topcoat 50°F (10°C) 1 Hour 24 Hours",
    );
    assert.deepEqual(
      [e.substrateTempMinF, e.substrateTempMaxF, e.relativeHumidityMax],
      [null, null, null],
    );
  });

  it("a silent sheet stays Not stated", () => {
    const e = env("Product description. Two pack epoxy. Colours: grey, white. Packaging: 20 L.");
    assert.deepEqual(
      [
        e.ambientTempMinF,
        e.ambientTempMaxF,
        e.substrateTempMinF,
        e.substrateTempMaxF,
        e.relativeHumidityMax,
        e.dewPointSpreadMinF,
      ],
      [null, null, null, null, null, null],
    );
  });
});

describe("two-column label/value layouts: mix ratio", () => {
  it("label line, then component rows 'Comp A n part(s)' / 'Comp B n part(s)'", () => {
    const t = [
      "Product mixing ratio (by volume)",
      "STANDARD GRADE",
      "Jotamastic 87 Comp A 6 part(s)",
      "Jotamastic 87 Standard Comp B 1 part(s)",
      "WINTER GRADE",
    ].join("\n");
    assert.equal(mixRatioFromText(t), "6:1 by volume");
  });

  it("generic 'Part A … 4 parts' / 'Part B … 1 part' rows", () => {
    assert.equal(
      mixRatioFromText("Mix ratio\nPart A (base) 4 parts\nPart B (activator) 1 part"),
      "4:1",
    );
  });

  it("label with product codes, ratio alone at the start of the next line", () => {
    assert.equal(
      mixRatioFromText(
        "Mixing ratio: BASE 15579: CURING AGENT 95570\n3 : 1 by volume\nApplication method: Airless spray",
      ),
      "3 : 1 by volume",
    );
  });

  it("'6 part(s): 1part(s) by volume' on the label's own row", () => {
    assert.equal(
      mixRatioFromText("Mix Ratio 6 part(s): 1part(s) by volume"),
      "6 part(s): 1part(s) by volume",
    );
  });

  it("codes and big numbers are never a ratio; a lone component row is not enough", () => {
    assert.equal(mixRatioFromText("Mixing ratio: BASE 15579: CURING AGENT 95570\nSee label"), "");
    assert.equal(mixRatioFromText("Mixing ratio\nComp A 6 part(s)\nPot life 2 hours"), "");
    assert.equal(mixRatioFromText("Mix ratio\nComp A 60 part(s)\nComp B 1 part(s)"), "");
  });

  it("the next line needs 'by volume/weight' to count (a time like 3:1 alone is not taken)", () => {
    assert.equal(mixRatioFromText("Mixing ratio: see product label 15579\n3:1 hours"), "");
  });
});
