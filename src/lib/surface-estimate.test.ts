import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { checkHour, type WxHour } from "./noaa.ts";
import { bundleDays, dayCountLabel, scoreHour, type RawHour } from "./score-windows.ts";
import { heuristicExtract } from "./heuristic-extract.ts";
import type { Environmentals } from "./types.ts";

const env = {
  ...heuristicExtract(" ").environmentals,
  ambientTempMinF: 0, ambientTempMaxF: 130, substrateTempMinF: 40, substrateTempMaxF: 120,
  relativeHumidityMax: null, dewPointSpreadMinF: null, windMaxMph: 25, precipitationAllowed: false,
} as Environmentals;
const wx = (tempF: number, dewpointF: number, rh = 60): WxHour =>
  ({ startIso: "2026-10-27T11:00:00Z", tempF, rh, dewpointF, windMph: 3, gustMph: 5, skyCover: 0, pop: 0, source: "nws" as never });
const raw = (tempF: number, dewpointF: number, hourUtc = 17, rh = 60): RawHour =>
  ({ startIso: `2026-08-28T${String(hourUtc).padStart(2, "0")}:00:00Z`, tempF, rh, dewpointF, pop: 0, precipIn: 0, windMph: 3, shortForecast: "Sunny", cloudCover: 0 });

describe("surface estimate can only make a verdict stricter", () => {
  it("QA false GO: 100% RH, 0°F air spread, warm 55°F surface estimate is never GO", () => {
    const c = checkHour(wx(43, 43, 100), env, { valueF: 55, kind: "estimate" });
    assert.equal(c.verdict, "nogo");
    const dew = c.checks.find((x) => x.name === "Dew-point spread")!;
    assert.equal(dew.spreadF, 0);
    assert.equal(dew.basis, "air");
    assert.match(dew.reason, /^condensation risk: surface within 0°F of dew point/);
    // Day scoring: sunny midday (estimate well above air) with air at the dew point.
    const h = scoreHour(raw(60, 60, 17, 100), env, "UTC");
    assert.equal(h.status, "nogo");
    assert.equal(h.spreadF, 0);
    assert.ok(h.reasons.some((r) => r.startsWith("condensation risk: surface within 0°F of dew point")), h.reasons.join(" | "));
  });

  it("a measured surface is used as-is", () => {
    const c = checkHour(wx(43, 43, 100), env, { valueF: 55, kind: "measured" });
    const dew = c.checks.find((x) => x.name === "Dew-point spread")!;
    assert.equal(dew.spreadF, 12);
    assert.equal(dew.basis, "measured surface");
    assert.equal(c.verdict, "go");
  });

  it("across conditions the estimate never turns a NO-GO into a GO (dew, surface min, surface max)", () => {
    let compared = 0;
    for (let air = 20; air <= 140; air += 5) {
      for (const dewGap of [-2, 0, 2, 4, 5, 8, 20]) {
        for (const off of [-30, -12, -5, 0, 5, 12, 30]) {
          const est = air + off;
          const base = checkHour(wx(air, air - dewGap), env, { valueF: air, kind: "measured" }); // surface = air
          const withEst = checkHour(wx(air, air - dewGap), env, { valueF: est, kind: "estimate" });
          for (const field of ["Dew-point spread", "Surface temp"]) {
            const b = base.checks.find((x) => x.name.startsWith(field))!;
            const e = withEst.checks.find((x) => x.name.startsWith(field))!;
            if (b.status === "fail") assert.equal(e.status, "fail", `${field} air ${air} gap ${dewGap} est ${est}`);
          }
          if (base.verdict === "nogo") assert.equal(withEst.verdict, "nogo", `air ${air} gap ${dewGap} est ${est}`);
          compared++;
        }
      }
    }
    assert.ok(compared > 1000);
    // Day scoring (estimate = air + sun): a GO hour always passes the same checks on air alone.
    for (let air = 20; air <= 140; air += 4) {
      for (const dewGap of [0, 3, 5, 10, 25]) {
        for (const hourUtc of [6, 9, 12, 15, 17, 19]) {
          const h = scoreHour(raw(air, air - dewGap, hourUtc), env, "UTC");
          if (h.status !== "go") continue;
          assert.ok(air >= env.substrateTempMinF! && air <= env.substrateTempMaxF!, `air ${air} h ${hourUtc}`);
          assert.ok(dewGap >= 5, `gap ${dewGap} air ${air} h ${hourUtc}`);
        }
      }
    }
  });
});

describe("day card counts come from the same hours as the day verdict", () => {
  it("counts are out of the scored work-window hours; NO-GO wording is not contradictory", () => {
    const hours = Array.from({ length: 24 }, (_, i) => scoreHour(raw(i >= 5 && i <= 7 ? 43 : 70, i >= 5 && i <= 7 ? 43 : 45, i), env, "UTC"));
    const day = bundleDays(hours, { zip: "00000", city: "X", state: "VA", source: "t", timezone: "UTC" } as never, env).days[0]!;
    assert.equal(day.status, "nogo");
    assert.equal(day.workHours, 16);
    const inWin = hours.filter((h) => h.hour >= 5 && h.hour <= 20);
    assert.equal(day.goHours, inWin.filter((h) => h.status === "go").length);
    assert.equal(day.nogoHours, inWin.filter((h) => h.status === "nogo").length);
    assert.ok(day.goHours + day.cautionHours + day.nogoHours <= day.workHours!);
    assert.equal(dayCountLabel(day), `NO-GO · ${day.goHours} of 16 work hours GO · ${day.cautionHours}h caution`);
  });
});
