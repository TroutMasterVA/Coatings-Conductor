import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { checkHour, type WxHour } from "./noaa.ts";
import { bundleDays, scoreHour, workWindowCheck, type RawHour } from "./score-windows.ts";
import { heuristicExtract } from "./heuristic-extract.ts";
import { hourListLabel, hourReadings, hourText, inWorkWindow, OUTSIDE_WORK_WINDOW, stripHours, stripLabel } from "./hour-strip.ts";
import type { Environmentals } from "./types.ts";

const env = {
  ...heuristicExtract(" ").environmentals,
  ambientTempMinF: 40, ambientTempMaxF: 100, substrateTempMinF: 40, substrateTempMaxF: 120,
  relativeHumidityMax: 85, dewPointSpreadMinF: 5, windMaxMph: 25, precipitationAllowed: false,
} as Environmentals;
// Perfect weather at every hour of the day (UTC so local hour = ISO hour).
const perfect = (hour: number): RawHour => ({
  startIso: `2026-10-26T${String(hour).padStart(2, "0")}:00:00Z`, tempF: 70, rh: 40, dewpointF: 45, pop: 0, precipIn: 0, windMph: 3, shortForecast: "Clear",
});

describe("work window: out-of-window hours never get GO", () => {
  it("scoreHour: perfect weather outside 05–20 is 'Outside work window', no verdict, not counted", () => {
    for (let hour = 0; hour < 24; hour++) {
      const h = scoreHour(perfect(hour), env, "UTC");
      if (inWorkWindow(hour)) assert.equal(h.status, "go", `hour ${hour}`);
      else {
        assert.notEqual(h.status, "go", `hour ${hour}`);
        assert.notEqual(h.status, "nogo", `hour ${hour}`);
        assert.deepEqual(h.reasons, [OUTSIDE_WORK_WINDOW]);
        assert.equal(h.inShift, false);
      }
    }
    const hours = Array.from({ length: 24 }, (_, i) => scoreHour(perfect(i), env, "UTC"));
    const b = bundleDays(hours, { zip: "00000", city: "X", state: "VA", source: "t", timezone: "UTC" } as never, env);
    assert.equal(b.days[0]!.goHours, 16);
    assert.equal(b.days[0]!.status, "go");
  });
  it("sheet hourly checks: a perfect out-of-window hour is 'outside', never GO (day shift)", () => {
    const wx = (iso: string): WxHour => ({ startIso: iso, tempF: 70, rh: 40, dewpointF: 45, windMph: 3, gustMph: 5, skyCover: 0, pop: 0, source: "nws" as never });
    const early = workWindowCheck(checkHour(wx("2026-10-27T11:00:00Z"), env, 70), "America/New_York"); // Tue 07:00 EDT
    assert.equal(early.verdict, "go");
    const night = workWindowCheck(checkHour(wx("2026-10-27T06:00:00Z"), env, 70), "America/New_York"); // Tue 02:00 EDT
    assert.equal(night.verdict, "outside");
    const late = workWindowCheck(checkHour(wx("2026-10-27T01:00:00Z"), env, 70), "America/New_York"); // Mon 21:00 EDT
    assert.equal(late.verdict, "outside");
    assert.equal(workWindowCheck(checkHour(wx("2026-10-27T06:00:00Z"), env, 70), "America/New_York", true).verdict, "go");
  });
});

describe("hourly list label states the range actually shown", () => {
  it("first shown start to last shown end, from the same data", () => {
    const isos = Array.from({ length: 24 }, (_, i) => new Date(Date.parse("2026-10-26T12:00:00Z") + i * 3_600_000).toISOString());
    const label = hourListLabel(isos, "America/New_York");
    assert.equal(hourText(isos[0]!, "America/New_York"), "Mon 08:00");
    assert.equal(hourText(isos.at(-1)!, "America/New_York"), "Tue 07:00");
    assert.ok(label.startsWith("Showing Mon 08:00–Tue 08:00 (24 h)"), label);
    assert.ok(label.includes("05:00–21:00 local"), label);
    assert.ok(stripLabel().includes("05:00–21:00"));
    const shown = stripHours(Array.from({ length: 24 }, (_, hour) => ({ hour })));
    assert.equal(shown.length, 16);
  });
  it("each line carries the fetched RH %, air temp and dew spread", () => {
    assert.equal(hourReadings({ tempF: 62, rh: 71, dewpointF: 52.5 }), "Air 62°F · RH 71% · dew spread 9.5°F");
    assert.equal(hourReadings({ tempF: null, rh: null, dewpointF: 50 }), "Air —°F · RH —% · dew spread —°F");
  });
});
