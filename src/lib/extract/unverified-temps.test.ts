import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { heuristicExtract } from "../heuristic-extract.ts";
import type { FieldCardData } from "../types.ts";
import { computeUnverifiedTemps, tempVerification, textStatesTemp } from "./unverified-temps.ts";
import type { Provenance } from "./provider.ts";

function card(env: Partial<FieldCardData["environmentals"]>): FieldCardData {
  const c = heuristicExtract("Product data sheet. Epoxy coating.");
  c.environmentals = { ...c.environmentals, ...env };
  return c;
}

describe("textStatesTemp", () => {
  it("°F stated verbatim", () =>
    assert.equal(textStatesTemp("Air: 35°F (1.7°C) minimum", 35, false), true));
  it("°C form of an absolute temperature", () => {
    assert.equal(textStatesTemp("Air temperature 10-40°C", 50, false), true);
    assert.equal(textStatesTemp("Air temperature 10-40°C", 104, false), true);
    assert.equal(textStatesTemp("Air: 1.7°C minimum", 35, false), true);
  });
  it("°C form of a dew margin is a difference (3°C ↔ 5°F)", () => {
    assert.equal(textStatesTemp("3°C above the dew point", 5, true), true);
    // A margin never quotes an absolute temperature (QA: Interthane air min 37°F from a 3°C margin).
    assert.equal(textStatesTemp("3°C above the dew point", 37, false), false);
    assert.equal(textStatesTemp("3°C above the dew point", 37, true), false);
  });
  it("glyph variants (˚, º, '° F')", () => {
    assert.equal(textStatesTemp("at least 5˚F (3˚C) above dew point", 5, true), true);
    assert.equal(textStatesTemp("must be at least 5°F (3°C) above the dew point", 5, true), true);
    assert.equal(textStatesTemp("less than 120ºF", 120, false), true);
    assert.equal(textStatesTemp("40 ° F (4 ° C)", 40, false), true);
  });
  it("a bare number or a spec code is not a temperature quote", () => {
    assert.equal(textStatesTemp("SSPC-SP2/3 ISO8501-1", 2, false), false);
    assert.equal(textStatesTemp("Nozzle tip 19-25", 25, false), false);
    assert.equal(textStatesTemp("Rz minimum 50 micron", 50, false), false);
  });
});

describe("computeUnverifiedTemps (source text)", () => {
  it("false when every temperature on the card is stated on the sheet", () => {
    const src =
      "Air: 35°F (1.7°C) minimum, 120°F (49°C) maximum. At least 5°F (2.8°C) above dew point.";
    const c = card({ ambientTempMinF: 35, ambientTempMaxF: 120, dewPointSpreadMinF: 5 });
    assert.equal(computeUnverifiedTemps(c, src), false);
  });
  it("true when one temperature has no quote (QA's '2°F from SSPC-SP2')", () => {
    const src = "Iron & Steel: Atmospheric: SSPC-SP2/3/ ISO8501-1:2007 St 2";
    const c = card({ substrateTempMinF: 2, substrateTempMaxF: 1 });
    assert.equal(computeUnverifiedTemps(c, src), true);
  });
  it("true for a dew margin converted with +32 (37°F from 3°C)", () => {
    const c = card({ dewPointSpreadMinF: 37 });
    assert.equal(computeUnverifiedTemps(c, "a minimum of 3°C (5°F) above dew point"), true);
  });
  it("empty temperature fields never count (Not stated needs no quote)", () => {
    const c = card({
      ambientTempMinF: null,
      ambientTempMaxF: null,
      substrateTempMinF: null,
      substrateTempMaxF: null,
      dewPointSpreadMinF: null,
    });
    assert.equal(computeUnverifiedTemps(c, ""), false);
  });
  it("reports per field", () => {
    const c = card({ ambientTempMinF: 50, ambientTempMaxF: 97, substrateTempMinF: null });
    const v = tempVerification(c, "Air temperature 50°F minimum. SERIES 90-97");
    assert.equal(v.ambientTempMinF, true);
    assert.equal(v.ambientTempMaxF, false);
    assert.equal(v.substrateTempMinF, null);
  });
  it("on-device output for #29's sheet line is verified", () => {
    const src = "Air and surface temperature 10-40°C during application.";
    const c = heuristicExtract(src);
    assert.equal(c.environmentals.ambientTempMinF, 50);
    assert.equal(computeUnverifiedTemps(c, src), false);
  });
});

describe("computeUnverifiedTemps (provenance)", () => {
  const c = card({ ambientTempMinF: 35, substrateTempMaxF: 250, dewPointSpreadMinF: null });
  it("false when each temperature's own quote states it", () => {
    const p: Provenance = {
      "environmentals.ambientTempMinF": { page: 2, quote: "Air: 35°F (1.7°C) minimum" },
      "environmentals.substrateTempMaxF": {
        page: 2,
        quote: "Surface*: 35°F (1.7°C) minimum, 250°F (120°C) maximum",
      },
    };
    assert.equal(computeUnverifiedTemps(c, p), false);
  });
  it("true when a quote is empty (ON_DEVICE_UNPINNED)", () => {
    const p: Provenance = {
      "environmentals.ambientTempMinF": { quote: "" },
      "environmentals.substrateTempMaxF": { quote: "250°F (120°C) maximum" },
    };
    assert.equal(computeUnverifiedTemps(c, p), true);
  });
  it("true when the quote is missing or does not contain the number", () => {
    assert.equal(computeUnverifiedTemps(c, {}), true);
    const p: Provenance = {
      "environmentals.ambientTempMinF": { quote: "Air temperature minimum" },
      "environmentals.substrateTempMaxF": { quote: "250°F maximum" },
    };
    assert.equal(computeUnverifiedTemps(c, p), true);
  });
  it("true when a set value is marked not-stated", () => {
    const p: Provenance = {
      "environmentals.ambientTempMinF": "not-stated",
      "environmentals.substrateTempMaxF": { quote: "250°F maximum" },
    };
    assert.equal(computeUnverifiedTemps(c, p), true);
  });
});
