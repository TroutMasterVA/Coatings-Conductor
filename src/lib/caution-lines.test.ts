import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { checkHour, type WxHour } from "./noaa.ts";
import { bundleDays, scoreHour, workWindowCheck, type RawHour } from "./score-windows.ts";
import { heuristicExtract } from "./heuristic-extract.ts";
import { dayHourIndex, hourLine } from "./hour-strip.ts";
import { rowHeadingUnit, quoteBacksValue } from "./extract/provenance.ts";
import type { Environmentals } from "./types.ts";

const env = {
  ...heuristicExtract(" ").environmentals,
  ambientTempMinF: 50, ambientTempMaxF: 110, substrateTempMinF: 50, substrateTempMaxF: 110,
  relativeHumidityMax: 85, dewPointSpreadMinF: null, windMaxMph: 25, precipitationAllowed: false,
} as Environmentals;

describe("hour lines agree with the day card's caution classification", () => {
  it("every hour the card counts as caution reads 'GO · CAUTION — reason'; plain GO count equals the card's", () => {
    // A Monday with a mix of comfortable and marginal hours (UTC so local hour = ISO hour).
    const temps = [60, 62, 64, 66, 68, 70, 72, 74, 76, 78, 80, 82, 84, 86, 88, 90, 92, 95, 99, 104, 108, 109, 108, 100];
    const raws: RawHour[] = temps.map((tempF, i) => ({
      startIso: `2026-10-26T${String(i).padStart(2, "0")}:00:00Z`, tempF, rh: i % 3 === 0 ? 80 : 50, dewpointF: tempF - 14,
      pop: 0, precipIn: 0, windMph: 4, shortForecast: "Clear", cloudCover: 0,
    }));
    const hours = raws.map((r) => scoreHour(r, env, "UTC"));
    const day = bundleDays(hours, { zip: "00000", city: "X", state: "VA", source: "t", timezone: "UTC" } as never, env).days[0]!;
    assert.ok(day.cautionHours > 0, "fixture must contain caution hours");
    assert.ok(day.goHours > 0, "fixture must contain plain GO hours");

    const idx = dayHourIndex([day]);
    const lines = raws.map((r) => {
      const wx: WxHour = { startIso: r.startIso, tempF: r.tempF, rh: r.rh, dewpointF: r.dewpointF, windMph: 4, gustMph: null, skyCover: 0, pop: 0, source: "nws" as never };
      // Same surface the app feeds the list: the day card's estimated surface for that hour.
      const est = idx.get(new Date(r.startIso).toISOString())?.substrateF;
      const check = workWindowCheck(checkHour(wx, env, est != null ? { valueF: est, kind: "estimate" } : null), "UTC");
      return { check, line: hourLine(check, idx.get(new Date(r.startIso).toISOString())) };
    });
    const inWindow = lines.filter((l) => l.check.verdict !== "outside");
    const cautionLines = inWindow.filter((l) => l.line.text.startsWith("GO · CAUTION"));
    const plainGo = inWindow.filter((l) => l.line.text === "GO");
    // Line labels and card counts come from the same classification.
    assert.equal(cautionLines.length, day.cautionHours);
    assert.equal(plainGo.length, day.goHours);
    // No caution hour ever reads plain GO, and every caution line carries its reason.
    for (const h of hours.filter((x) => x.status === "caution" && day.hours.includes(x))) {
      const l = lines.find((x) => x.check.startIso === h.startIso)!;
      if (l.check.verdict === "outside") continue;
      assert.notEqual(l.line.text, "GO");
      assert.ok(l.line.text.includes(h.reasons[0]!), l.line.text);
      assert.equal(l.line.variant, "caution");
    }
  });

  it("a line with no caution classification is unchanged", () => {
    const wx: WxHour = { startIso: "2026-10-26T15:00:00Z", tempF: 70, rh: 50, dewpointF: 50, windMph: 3, gustMph: null, skyCover: 0, pop: 0, source: "nws" as never };
    const c = checkHour(wx, env, { valueF: 70, kind: "measured" });
    assert.equal(hourLine(c, undefined).text, "GO");
    assert.equal(hourLine({ ...c, verdict: "nogo" }, undefined).text, "NO-GO");
  });
});

// Generic fixtures: none of this text comes from a real datasheet.
describe("unit from the table row's own heading (generic fixtures)", () => {
  const potPath = "mixing.potLife";
  const recoatPath = "cure.recoatMin";
  const potVal = "3 hours at 95°F, 5 hours at 77°F, 8 hours at 59°F";
  it("accepts cells under a row heading that carries the unit (with column-header junk between)", () => {
    const q = "Widget data Pot life (hours) °F/°C 95/35 77/25 59/15 3 5 8 Cure time (minutes) 10 20 30";
    assert.equal(rowHeadingUnit(potPath, potVal, q), true);
    assert.equal(quoteBacksValue(potPath, potVal, q), true);
    const r = "Recoat times 95/35 77/25 59/15 minimum (hrs) 1 2 6 maximum Unlimited";
    assert.equal(quoteBacksValue(recoatPath, "1 hours at 95°F, 2 hours at 77°F, 6 hours at 59°F", r), true);
  });
  it("rejects a unit that comes from a column header, not the row", () => {
    // "(hours)" heads the column block; the Pot life row itself has no unit.
    assert.equal(quoteBacksValue(potPath, potVal, "Property (hours) 95/35 77/25 59/15 Pot life 3 5 8"), false);
    assert.equal(quoteBacksValue(potPath, potVal, "Time (hours) Pot life 3 5 8 Gel 1 2 3"), false);
  });
  it("rejects a unit that belongs to a different row", () => {
    assert.equal(quoteBacksValue(potPath, potVal, "Pot life 3 5 8 Dry time (hours) 3 5 8"), false);
    assert.equal(quoteBacksValue(potPath, potVal, "Dry time (hours) 3 5 8 Pot life 3 5 8"), false);
    assert.equal(quoteBacksValue(recoatPath, "2 hours, 4 hours, 12 hours", "Pot life (hours) 2 4 12 minimum 2 4 12"), false);
  });
  it("rejects '@' temperature header runs standing in for a unit", () => {
    assert.equal(quoteBacksValue(potPath, potVal, "@95°F @77°F @59°F Pot life 3 5 8"), false);
  });
  it("rejects numbers that are not cells of that row", () => {
    assert.equal(rowHeadingUnit(potPath, "9 hours, 7 hours", "Pot life (hours) 3 5 8 Dry time"), false);
  });
});
