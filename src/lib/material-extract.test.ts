import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { heuristicExtract, materialTempFromText } from "./heuristic-extract.ts";
import { onDeviceProvider } from "./extract/on-device-provider.ts";
import { quoteBacksValue } from "./extract/provenance.ts";

// Item 5 (material temperature, Oct 30). Snippets are pdf.js flat text as the app reads it, from QA's
// sheet set (/workspace/cc-qa/pds). A material number needs a unit, a material label and its own quote.
const MACROPOXY =
  "APPLICATION CONDITIONS Temperature: Air: 35°F (1.7°C) minimum, 120°F (49°C) maximum Surface*: 35°F (1.7°C) minimum, 250°F (120°C) maximum Material: 40°F (4.5°C) minimum At least 5°F (2.8°C) above dew point Relative humidity: 85% maximum";
const HEMPEL =
  "Application conditions - To avoid condensation, apply on a clean and dry surface with a temperature that is at least 5°F [3°C] above the dew point. - Surface temperature must be above 50°F [10°C] during application and curing. - Temperature of product must be above 59°F [15°C] during application.";
const HEMPEL_POT_LIFE = "Cleaner Hempel's Tool Cleaner 99610 Pot life Product temperature 68°F [20°C] Pot life 60 min Application method Tool";
const HEMPEL_SPRAY = "Spray data are indicative and subject to adjustment. Pressure is for a material temperature of 68°F [20°C].";
const CARBOZINC =
  "Application Conditions Condition Material Surface Ambient Humidity Normal 40 ° -95 ° F (4 ° -35 ° C) 40 ° -110 ° F (4 ° -43 ° C) 40 ° -95 ° F (4 ° -35 ° C) 40-90% Minimum 0 ° F (-18 ° C) 0 ° F (-18 ° C) 0 ° F (-18 ° C) 30% Maximum 130 ° F (54 ° C) 200 ° F (93 ° C) 130 ° F (54 ° C) 95% This product simply requires the substrate temperature to be above the dew point.";
const PROINDUSTRIAL =
  "APPLICATION Temperature: minimum 50°F / 10°C maximum 110°F / 43°C air, surface and material At least 5°F above dew point Relative humidity: 85% maximum";
const NORMAL_ONLY_TABLE = "Application Conditions Condition Material Surface Ambient Normal 50 ° -90 ° F 50 ° -120 ° F 50 ° -90 ° F";

const m = (t: string) => materialTempFromText(t);

describe("material temp: read from the sheet", () => {
  it("SW Macropoxy 646 'Material: 40°F (4.5°C) minimum' → min 40", () => {
    assert.deepEqual(m(MACROPOXY), { minF: 40, maxF: null, normalMinF: null, normalMaxF: null });
  });
  it("Hempel 'Temperature of product must be above 59°F [15°C]' → min 59 (surface 50 stays surface)", () => {
    assert.equal(m(HEMPEL).minF, 59);
    const env = heuristicExtract(HEMPEL).environmentals;
    assert.equal(env.materialTempMinF, 59);
    assert.equal(env.substrateTempMinF, 50);
  });
  it("Carbozinc 11 table: absolute Minimum/Maximum rows are the limit; Normal is info only", () => {
    assert.deepEqual(m(CARBOZINC), { minF: 0, maxF: 130, normalMinF: 40, normalMaxF: 95 });
    const env = heuristicExtract(CARBOZINC).environmentals;
    assert.equal(env.materialTempMinF, 0);
    assert.equal(env.materialTempMaxF, 130);
    assert.equal(env.materialNormalTempMinF, 40);
    assert.equal(env.materialNormalTempMaxF, 95);
  });
  it("a table with only a Normal row: that row is the limit (same rule as surface)", () => {
    assert.deepEqual(m(NORMAL_ONLY_TABLE), { minF: 50, maxF: 90, normalMinF: null, normalMaxF: null });
  });
  it("'minimum 50°F … maximum 110°F … air, surface and material' sets material too", () => {
    assert.deepEqual(m(PROINDUSTRIAL), { minF: 50, maxF: 110, normalMinF: null, normalMaxF: null });
  });
  it("°C only converts to °F", () => {
    assert.equal(m("Material temperature: minimum 10°C").minF, 50);
  });
});

describe("material temp: not a limit → Not stated", () => {
  for (const [name, text] of [
    ["storage range", "Storage: Store material indoors at 40-90°F (4-32°C)."],
    ["conditioning advice", "Condition material to 65°F–75°F before mixing for best workability."],
    ["pot life at a material temperature", HEMPEL_POT_LIFE],
    ["spray-pressure note", HEMPEL_SPRAY],
    ["mix-quantity note", "Do not mix more material than will be used within 4 hours at 65-80°F (18-27°C)."],
    ["a condition, not a limit", "Do not apply the material if the temperature is expected to fall below 40°F in the first 24 hours of cure."],
    ["filler prep step", "Air, material, and surface temperatures must be at least 55°F (13°C) before filling."],
    ["'this product' is not the product's temperature", "However, this product should not be applied below 50°F."],
    ["no unit", "Material: minimum 40"],
  ] as const) {
    it(name, () => {
      const r = m(text);
      assert.equal(r.minF, null, `${name}: min`);
      assert.equal(r.maxF, null, `${name}: max`);
    });
  }
  it("a sheet with no material line has NO material keys (old card shape unchanged)", () => {
    for (const text of [" ", "Surface temperature minimum 40°F, maximum 120°F. Relative humidity 85% maximum."]) {
      const env = heuristicExtract(text).environmentals as Record<string, unknown>;
      assert.deepEqual(Object.keys(env).filter((k) => /^material/.test(k)), []);
    }
  });
});

describe("material temp: every kept number has its own verbatim quote", () => {
  for (const [name, text, want] of [
    ["Macropoxy", MACROPOXY, { materialTempMinF: 40 }],
    ["Hempel", HEMPEL, { materialTempMinF: 59 }],
    ["Carbozinc", CARBOZINC, { materialTempMinF: 0, materialTempMaxF: 130, materialNormalTempMinF: 40, materialNormalTempMaxF: 95 }],
  ] as const) {
    it(`${name}: on-device read keeps the value with a quote that states it`, async () => {
      const r = await onDeviceProvider.extract({ pages: [text] });
      for (const [k, v] of Object.entries(want)) {
        const path = `environmentals.${k}`;
        assert.equal((r.card.environmentals as Record<string, unknown>)[k], v, path);
        const p = r.provenance[path];
        assert.ok(p && p !== "not-stated" && p.quote.trim() !== "", `${path} has a quote`);
        if (p && typeof p === "object") {
          assert.ok(quoteBacksValue(path, v, p.quote), `${path}=${v} backed by "${p.quote}"`);
          assert.ok(text.replace(/\s+/g, " ").includes(p.quote.replace(/…$/, "").trim()), `${path} quote is on the sheet`);
        }
      }
      // Material values never pause scoring.
      assert.equal(r.unverifiedTemps, false);
    });
  }
  it("a material number with no line that states it is dropped to Not stated (never shown unquoted)", async () => {
    const card = heuristicExtract(MACROPOXY);
    card.environmentals.materialTempMaxF = 77; // not on the sheet (nor its °C form, 25)
    const { gateNumbers, sourceOf } = await import("./extract/provenance.ts");
    const g = gateNumbers(card, sourceOf({ pages: [MACROPOXY] }));
    assert.equal(g.card.environmentals.materialTempMaxF, null);
    assert.equal(g.provenance["environmentals.materialTempMaxF"], "not-stated");
    assert.ok(g.droppedPaths.includes("environmentals.materialTempMaxF"));
    assert.equal(g.card.environmentals.materialTempMinF, 40, "the quoted min is kept");
  });
  it("air and surface values are unchanged by the material reader", () => {
    const env = heuristicExtract(MACROPOXY).environmentals;
    assert.deepEqual(
      [env.ambientTempMinF, env.ambientTempMaxF, env.substrateTempMinF, env.substrateTempMaxF, env.dewPointSpreadMinF, env.relativeHumidityMax],
      [35, 120, 35, 250, 5, 85],
    );
    const cz = heuristicExtract(CARBOZINC).environmentals;
    assert.deepEqual([cz.ambientTempMinF, cz.ambientTempMaxF, cz.substrateTempMinF, cz.substrateTempMaxF], [0, 130, 0, 200]);
  });
});
