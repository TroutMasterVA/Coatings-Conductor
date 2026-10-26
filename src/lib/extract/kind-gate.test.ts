import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { gateNumbers, quoteBacksValue } from "./provenance.ts";
import { heuristicExtract } from "../heuristic-extract.ts";
import { scoreHour, type RawHour } from "../score-windows.ts";
import { stripHours, stripLabel } from "../hour-strip.ts";
import type { Environmentals } from "../types.ts";

// QA blocker on f8f6228: the quote must state the same KIND of value (synthetic text).
describe("quote gate matches the kind of value", () => {
  const row = "Application Conditions Condition Material Surface Ambient Humidity Normal 40 ° -95 ° F (4 ° -35 ° C) 40 ° -110 ° F 40 ° -95 ° F 40-90% Minimum 0 ° F 0 ° F 0 ° F 30% Maximum 130 ° F 200 ° F 130 ° F 95%";
  it("Carbozinc-style: a temperature quote never backs a % humidity limit; the field is Not stated", () => {
    assert.equal(quoteBacksValue("environmentals.relativeHumidityMax", 95, "Humidity Normal 40 ° -95 ° F (4 ° -35 ° C)"), false);
    assert.equal(quoteBacksValue("environmentals.relativeHumidityMax", 90, "Humidity 40-90%"), true);
    assert.equal(quoteBacksValue("environmentals.relativeHumidityMax", 85, "Relative humidity: 85 maximum"), true);
    const card = heuristicExtract(" ");
    card.environmentals.relativeHumidityMax = 95;
    const g = gateNumbers(card, { text: row.replace(" 95%", "") });
    assert.equal(g.card.environmentals.relativeHumidityMax, null);
    assert.equal(g.provenance["environmentals.relativeHumidityMax"], "not-stated");
    assert.ok(g.droppedPaths.includes("environmentals.relativeHumidityMax"));
  });
  it("header-only temperature runs are rejected ('@50°F @77°F @110°F'), a labelled row passes", () => {
    const hdr = "times are temperature, humidity, and film thickness dependent. @50°F @77°F @110°F To touch 1 hour 20 minutes 10 minutes";
    assert.equal(quoteBacksValue("environmentals.substrateTempMinF", 50, hdr), false);
    assert.equal(quoteBacksValue("environmentals.substrateTempMaxF", 110, hdr), false);
    assert.equal(quoteBacksValue("environmentals.substrateTempMaxF", 110, "Drying times. 50°F 77°F 110°F To touch 1 hour"), false);
    assert.equal(quoteBacksValue("environmentals.substrateTempMaxF", 200, "Surface Maximum 130 ° F 200 ° F 130 ° F"), true);
    const card = heuristicExtract(" ");
    card.environmentals.substrateTempMinF = 50;
    const g = gateNumbers(card, { text: hdr });
    assert.equal(g.card.environmentals.substrateTempMinF, null);
  });
  it("a duration needs a time unit next to its number", () => {
    assert.equal(quoteBacksValue("mixing.potLife", "4 hours", "Pot life 4 gallons kit, 77°F"), false);
    assert.equal(quoteBacksValue("mixing.potLife", "4 hours", "Pot Life: 4 hours at 77°F"), true);
    assert.equal(quoteBacksValue("cure.recoatMin", "2-4 hours", "Recoat 2-4 hrs"), true);
    assert.equal(quoteBacksValue("mixing.potLife", "1½ hours", "Pot Life 1½ hours at 75°F"), true);
  });
  it("weather: RH Not stated follows the middle path (flagged GO, not blocked)", () => {
    const env = { ...heuristicExtract(" ").environmentals, ambientTempMinF: 40, ambientTempMaxF: 100, substrateTempMinF: 40, substrateTempMaxF: 120,
      relativeHumidityMax: null, dewPointSpreadMinF: 5, windMaxMph: 25, precipitationAllowed: false } as Environmentals;
    const raw = { startIso: "2026-10-24T06:00:00Z", tempF: 70, rh: 40, dewpointF: 50, pop: 0, precipIn: 0, windMph: 3, shortForecast: "Clear" } as RawHour;
    const h = scoreHour(raw, env, "UTC");
    assert.equal(h.status, "go");
    assert.ok(h.reasons.includes("Not stated — check the sheet for max RH"));
  });
});

describe("hour strip label agrees with its hours", () => {
  it("day strip: cells start 05..20, so the label reads 05:00–21:00", () => {
    const hours = Array.from({ length: 24 }, (_, hour) => ({ hour }));
    const shown = stripHours(hours);
    assert.equal(shown[0]!.hour, 5);
    assert.equal(shown.at(-1)!.hour, 20);
    assert.equal(stripLabel(), `Strip is 05:00–${String(shown.at(-1)!.hour + 1).padStart(2, "0")}:00 local`);
    assert.equal(stripHours(hours, true).length, 24);
    assert.equal(stripLabel(true), "Strip is 00:00–24:00 (night shift)");
  });
});
