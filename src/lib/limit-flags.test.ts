import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { checkHour, type WxHour } from "./noaa.ts";
import { bundleDays, scoreHour, type RawHour } from "./score-windows.ts";
import { heuristicExtract } from "./heuristic-extract.ts";
import { countedRange, inWorkWindow } from "./hour-strip.ts";
import { LIMIT_KEYS, LIMIT_LABEL, notStatedFlag, unstatedLimitFlags, type LimitKey } from "./limit-fields.ts";
import { quoteBacksValue } from "./extract/provenance.ts";
import type { Environmentals } from "./types.ts";

const base = heuristicExtract(" ").environmentals;
// Every numeric limit on the card, enumerated from the real Environmentals object (not a hand list).
const numericKeys = (Object.keys(base) as (keyof Environmentals)[]).filter((k) => base[k] === null || typeof base[k] === "number");
const STATED: Record<string, number> = { ambientTempMinF: 40, ambientTempMaxF: 100, substrateTempMinF: 40, substrateTempMaxF: 120, relativeHumidityMax: 85, relativeHumidityMin: 20, dewPointSpreadMinF: 5, windMaxMph: 25 };
const envWith = (unstated?: string): Environmentals => {
  const e = { ...base, precipitationAllowed: false } as Record<string, unknown>;
  for (const k of numericKeys) e[k] = k === unstated ? null : (STATED[k] ?? 10);
  return e as unknown as Environmentals;
};
const raw: RawHour = { startIso: "2026-10-27T15:00:00Z", tempF: 70, rh: 50, dewpointF: 50, pop: 0, precipIn: 0, windMph: 3, shortForecast: "Clear", cloudCover: 0 };
const wx: WxHour = { startIso: raw.startIso, tempF: 70, rh: 50, dewpointF: 50, windMph: 3, gustMph: null, skyCover: 0, pop: 0, source: "nws" as never };

describe("every unstated limit field carries the check-the-sheet flag", () => {
  it("the label table covers every numeric limit key of the Environmentals object", () => {
    assert.ok(numericKeys.length >= 8, numericKeys.join(","));
    for (const k of numericKeys) assert.ok(k in LIMIT_LABEL, `no flag label for limit field ${k}`);
    assert.deepEqual([...LIMIT_KEYS].sort(), [...numericKeys].sort());
  });
  it("all stated: no flags anywhere", () => {
    assert.deepEqual(unstatedLimitFlags(envWith()), []);
  });
  for (const key of numericKeys) {
    it(`${key}: Not stated shows the flag on the card, the hourly list and the day scoring`, () => {
      const env = envWith(key);
      const flag = notStatedFlag(LIMIT_LABEL[key as LimitKey]);
      assert.deepEqual(unstatedLimitFlags(env), [flag]); // card + weather-panel limits
      const c = checkHour(wx, env, null); // hourly list line: a flagged check or a central flag
      const line = [...c.checks.filter((x) => x.status === "not-stated").map((x) => x.reason), ...(c.flags ?? [])].join(" | ");
      assert.match(line, /Not stated — check the sheet for/, `${key}: ${line}`);
      assert.ok(c.flags?.includes(flag) || c.checks.some((x) => x.status === "not-stated"), `${key}`);
      const h = scoreHour({ ...raw, startIso: "2026-10-27T15:00:00Z" }, env, "UTC"); // day card hour
      assert.ok(h.reasons.includes(flag), `${key}: ${h.reasons.join(" | ")}`);
    });
  }
  it("a one-sided pair still flags the missing side (air min unstated, air max stated)", () => {
    const c = checkHour(wx, envWith("ambientTempMinF"), null);
    assert.ok(c.flags?.includes(notStatedFlag("air min")));
  });
});

describe("day card label is the range of the hours it counts", () => {
  const meta = { zip: "00000", city: "X", state: "VA", source: "t", timezone: "UTC" } as never;
  const hoursFrom = (first: number) =>
    Array.from({ length: 24 - first }, (_, i) => scoreHour({ ...raw, startIso: `2026-10-27T${String(first + i).padStart(2, "0")}:00:00Z` }, envWith(), "UTC"));
  for (const first of [0, 8, 14]) {
    it(`day starting at ${String(first).padStart(2, "0")}:00 (earlier hours already past): range = min/max of counted hours`, () => {
      const hours = hoursFrom(first);
      const day = bundleDays(hours, meta, envWith()).days[0]!;
      const counted = hours.filter((h) => h.inShift !== false && inWorkWindow(h.hour));
      assert.equal(day.workHours, counted.length);
      const lo = Math.min(...counted.map((h) => h.hour));
      const hi = Math.max(...counted.map((h) => h.hour));
      const pad = (n: number) => `${String(n).padStart(2, "0")}:00`;
      assert.equal(day.workRange, `${pad(lo)}–${pad(hi + 1)}`);
    });
  }
  it("08:00 start counts 13 hours and the label says 08:00–21:00 (not 10:00–21:00)", () => {
    const day = bundleDays(hoursFrom(8), meta, envWith()).days[0]!;
    assert.equal(day.workHours, 13);
    assert.equal(day.workRange, "08:00–21:00");
  });
  it("countedRange wraps for a night shift and handles empty", () => {
    assert.equal(countedRange([19, 20, 21, 22, 23, 0, 1, 2, 3, 4, 5].map((hour) => ({ hour }))), "19:00–06:00");
    assert.equal(countedRange([]), null);
  });
});

describe("a cure or schedule temperature is never an application limit (generic text)", () => {
  const p = "environmentals.substrateTempMinF";
  it("rejects a cure-capability sentence", () => {
    assert.equal(quoteBacksValue(p, 5, "Low temperature cure down to 5 °F (-15 °C)"), false);
    assert.equal(quoteBacksValue(p, 5, "Cures at surface temperature 5 °F (-15 °C"), false);
  });
  it("rejects a temperature that is the row label of a cure-time table", () => {
    assert.equal(quoteBacksValue(p, 5, "Surface Temp. & 50% Relative Humidity Dry to Handle Dry to Recoat 5 ° F (-15 ° C) 4 Hours 7 Days 40 ° F (4 ° C) 1 Hour 48 Hours"), false);
  });
  it("still accepts a labelled limit", () => {
    assert.equal(quoteBacksValue(p, 5, "Surface temperature minimum 5 °F (-15 °C)"), true);
    assert.equal(quoteBacksValue(p, 40, "Surface Ambient Normal 40 ° -95 ° F Minimum 40 ° F 40 ° F"), true);
  });
});
