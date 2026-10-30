import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { bundleDays, scoreHour, TEMPS_UNVERIFIED_REASON, type RawHour } from "./score-windows.ts";
import { applySheetSurface, checkHour, withMaterialCheck, type WxHour } from "./noaa.ts";
import { hourLine } from "./hour-strip.ts";
import { todayVerdict, NO_TODAY_ROW } from "./today-verdict.ts";
import { SHEET_UNREADABLE_MESSAGE } from "./sheet-gate.ts";
import { heuristicExtract } from "./heuristic-extract.ts";
import { goGateChips, jobCardGateLine } from "../components/go-gate-chips.ts";
import { AIR_OUTSIDE_MATERIAL_LINE, MATERIAL_NOT_STATED, MEASURE_MATERIAL_LINE } from "./material-temp.ts";
import type { SiteContext } from "./mitigations.ts";
import type { Environmentals, ForecastBundle } from "./types.ts";

// Item 5 through the real scorers: day rows (and so today's line) and the hourly list read one rule.
const TZ = "America/New_York";
const NOW = new Date("2026-10-30T14:00:00Z"); // Fri Oct 30, 10:00 AM ET
const opts = { now: NOW };
const AT = "2026-10-30T13:40:00Z"; // reading taken 9:40 AM ET

const ENV: Environmentals = {
  ...heuristicExtract(" ").environmentals,
  ambientTempMinF: 30, ambientTempMaxF: 110, substrateTempMinF: 30, substrateTempMaxF: 200,
  relativeHumidityMax: 85, relativeHumidityMin: null, dewPointSpreadMinF: 5, windMaxMph: 25, precipitationAllowed: false,
};
const MAT: Environmentals = { ...ENV, materialTempMinF: 40, materialTempMaxF: 95 };
const site = (over: Partial<SiteContext> = {}): SiteContext => ({ substrate: "bare_steel", mitigations: [], ...over });
const withReading = (v: number, at = AT) => site({ measuredMaterialTempF: v, measuredMaterialAt: at });

/** Work hours 10:00–16:00 ET of one site date, overcast so the sun model adds little. */
function raws(date: string, over: Partial<RawHour> = {}): RawHour[] {
  return Array.from({ length: 7 }, (_, i) => ({
    startIso: new Date(`${date}T${String(14 + i).padStart(2, "0")}:00:00Z`).toISOString(),
    tempF: 65, rh: 50, dewpointF: 40, pop: 0, precipIn: 0, windMph: 4, shortForecast: "Cloudy", cloudCover: 100, ...over,
  }));
}
const META = { zip: "22201", city: "Arlington", state: "VA", lat: 38.88, lon: -77.1, timezone: TZ, source: "test", issuedAt: NOW.toISOString() };

function bundle(env: Environmentals, s: SiteContext, today: Partial<RawHour> = {}, tomorrow: Partial<RawHour> = {}): ForecastBundle {
  const raw = [...raws("2026-10-30", today), ...raws("2026-10-31", tomorrow)];
  const hours = raw.map((r) => scoreHour(r, env, TZ, s, opts));
  const b = bundleDays(hours, META, env, s, opts);
  const wx = (r: RawHour): WxHour => ({ startIso: r.startIso, tempF: r.tempF, rh: r.rh, dewpointF: r.dewpointF, windMph: r.windMph, gustMph: null, skyCover: 100, pop: 0, source: { kind: "open-meteo", fetchedAt: "", label: "t" } });
  const sheet = { source: wx(raw[0]!).source, timezone: TZ, backup: false, now: null, hours: raw.map((r) => checkHour(wx(r), env, null)) };
  return applySheetSurface({ ...b, rawHours: raw, sheet } as ForecastBundle, env, s, NOW);
}
const day = (b: ForecastBundle, date: string) => b.days.find((d) => d.date === date)!;
const today = (b: ForecastBundle, env: Environmentals = MAT) => todayVerdict({ forecast: b, gate: { ok: true }, env, now: NOW });
const sheetHours = (b: ForecastBundle, date: string) => b.sheet!.hours.filter((h) => h.startIso.startsWith(date));

describe("day rows and today's line", () => {
  it("no material limit on the sheet: verdicts as before (GO), flagged 'Not stated — check the sheet for material temp'", () => {
    const b = bundle(ENV, site());
    for (const d of b.days) {
      assert.equal(d.status, "go", d.date);
      assert.equal(d.materialLine, undefined);
      for (const h of d.hours) assert.ok(h.reasons.includes(MATERIAL_NOT_STATED));
    }
    const v = today(b, ENV);
    assert.ok(v.kind === "verdict" && v.status === "go" && v.notStated.includes(MATERIAL_NOT_STATED));
  });
  it("stated, no reading: today is CAUTION (the reason says why); tomorrow is GO with 'Measure material temp before mixing'", () => {
    const b = bundle(MAT, site());
    const t = day(b, "2026-10-30");
    assert.equal(t.status, "caution");
    assert.equal(t.limiting[0], "Material temp not measured today. Sheet: 40–95°F.");
    assert.equal(t.materialLine, MEASURE_MATERIAL_LINE);
    const f = day(b, "2026-10-31");
    assert.equal(f.status, "go");
    assert.equal(f.materialLine, MEASURE_MATERIAL_LINE);
    const v = today(b);
    assert.ok(v.kind === "verdict");
    assert.equal(v.status, "caution");
    assert.equal(v.day.limiting[0], "Material temp not measured today. Sheet: 40–95°F.");
    assert.equal(v.day.materialLine, MEASURE_MATERIAL_LINE);
    assert.ok(!v.notStated.includes(MATERIAL_NOT_STATED));
  });
  it("fresh reading inside the limit: today follows the weather rules (GO), no measure line today", () => {
    const b = bundle(MAT, withReading(62));
    const t = day(b, "2026-10-30");
    assert.equal(t.status, "go");
    assert.equal(t.materialLine, undefined);
    assert.ok(t.hours.every((h) => h.reasons.some((r) => /Material 62°F \(measured 9:40 AM\) within sheet 40–95°F/.test(r))));
    assert.equal(day(b, "2026-10-31").materialLine, MEASURE_MATERIAL_LINE, "the reading never counts for tomorrow");
    const v = today(b);
    assert.ok(v.kind === "verdict" && v.status === "go");
  });
  it("fresh reading below the min: today is NO-GO; tomorrow is untouched", () => {
    const b = bundle(MAT, withReading(35));
    assert.equal(day(b, "2026-10-30").status, "nogo");
    assert.match(day(b, "2026-10-30").limiting[0]!, /^Material 35°F \(measured 9:40 AM\) below sheet min 40°F/);
    assert.equal(day(b, "2026-10-31").status, "go");
    const v = today(b);
    assert.ok(v.kind === "verdict" && v.status === "nogo");
  });
  it("a reading older than 4 hours: today back to CAUTION", () => {
    const b = bundle(MAT, withReading(62, "2026-10-30T09:30:00Z")); // 5:30 AM ET
    assert.equal(day(b, "2026-10-30").status, "caution");
    assert.match(day(b, "2026-10-30").limiting[0]!, /^Material reading from 5:30 AM is no longer valid/);
  });
  it("forecast air outside the material range, no reading: CAUTION with the exact air line, never NO-GO", () => {
    const b = bundle(MAT, site(), {}, { tempF: 36, dewpointF: 20 }); // air 36 > air min 30, < material min 40
    const f = day(b, "2026-10-31");
    assert.equal(f.status, "caution");
    assert.equal(f.limiting[0], AIR_OUTSIDE_MATERIAL_LINE);
    assert.equal(f.materialLine, MEASURE_MATERIAL_LINE);
    assert.equal(f.nogoHours, 0);
  });
  it("surface and dew stay strict with a material limit and a good reading", () => {
    const cold = bundle({ ...MAT, substrateTempMinF: 70 }, withReading(62));
    assert.equal(day(cold, "2026-10-30").status, "nogo");
    const wet = bundle(MAT, withReading(62), { dewpointF: 63 });
    assert.equal(day(wet, "2026-10-30").status, "nogo");
    assert.match(day(wet, "2026-10-30").limiting[0]!, /condensation risk/);
  });
});

describe("no forecast, paused or unreadable sheet: never a verdict, whatever the material reading", () => {
  it("missing forecast / no row for today / paused / unreadable sheet", () => {
    assert.deepEqual(todayVerdict({ forecast: null, gate: { ok: true }, env: MAT, now: NOW }), { kind: "none", reason: NO_TODAY_ROW });
    const b = bundle(MAT, withReading(62));
    const tomorrowOnly = { ...b, days: b.days.filter((d) => d.date !== "2026-10-30") };
    assert.deepEqual(todayVerdict({ forecast: tomorrowOnly, gate: { ok: true }, env: MAT, now: NOW }), { kind: "none", reason: NO_TODAY_ROW });
    const raw = raws("2026-10-30");
    const paused = bundleDays(raw.map((r) => scoreHour(r, MAT, TZ, withReading(62), { ...opts, unverifiedTemps: true })), META, MAT, withReading(62), { ...opts, unverifiedTemps: true });
    assert.deepEqual(todayVerdict({ forecast: paused, gate: { ok: true }, env: MAT, now: NOW }), { kind: "none", reason: TEMPS_UNVERIFIED_REASON });
    const gate = { ok: false as const, reason: "unreadable" as const, message: SHEET_UNREADABLE_MESSAGE };
    assert.deepEqual(todayVerdict({ forecast: b, gate, env: MAT, now: NOW }), { kind: "none", reason: SHEET_UNREADABLE_MESSAGE });
  });
});

describe("hourly list agrees with the day rows", () => {
  it("today, no reading: GO · CAUTION with the material reason, plus the measure line", () => {
    const b = bundle(MAT, site());
    const dayHours = new Map(day(b, "2026-10-30").hours.map((h) => [new Date(h.startIso).toISOString(), h]));
    for (const h of sheetHours(b, "2026-10-30")) {
      assert.equal(h.verdict, "go");
      assert.ok(h.flags?.includes(MEASURE_MATERIAL_LINE));
      const line = hourLine(h, dayHours.get(h.startIso));
      assert.equal(line.text, "GO · CAUTION — Material temp not measured today. Sheet: 40–95°F.");
    }
  });
  it("fresh reading below the min: every hour today is NO-GO with a failed 'Material temp' check", () => {
    const b = bundle(MAT, withReading(35));
    for (const h of sheetHours(b, "2026-10-30")) {
      assert.equal(h.verdict, "nogo");
      assert.ok(h.checks.some((c) => c.name === "Material temp" && c.status === "fail"));
    }
    for (const h of sheetHours(b, "2026-10-31")) assert.equal(h.verdict, "go");
  });
  it("fresh reading inside: a passed check with the reading's time", () => {
    const b = bundle(MAT, withReading(62));
    for (const h of sheetHours(b, "2026-10-30")) {
      assert.equal(h.verdict, "go");
      assert.ok(h.checks.some((c) => c.name === "Material temp" && c.status === "pass" && /measured 9:40 AM/.test(c.reason)));
    }
  });
  it("no material limit: only the check-the-sheet flag; verdicts unchanged", () => {
    const b = bundle(ENV, site());
    for (const h of b.sheet!.hours) {
      assert.equal(h.verdict, "go");
      assert.ok(h.flags?.includes(MATERIAL_NOT_STATED));
      assert.ok(!h.checks.some((c) => c.name === "Material temp"));
    }
  });
  it("an hour outside the work window stays outside", () => {
    const wx: WxHour = { startIso: "2026-10-30T02:00:00.000Z", tempF: 65, rh: 50, dewpointF: 40, windMph: 4, gustMph: null, skyCover: 100, pop: 0, source: { kind: "open-meteo", fetchedAt: "", label: "t" } };
    const c = withMaterialCheck({ ...checkHour(wx, MAT, null), verdict: "outside" }, MAT, withReading(20), TZ, NOW);
    assert.equal(c.verdict, "outside");
  });
});

describe("job card chip", () => {
  it("a stated material limit adds a 'Material …' chip; none when not stated; the gates line flag count is unchanged", () => {
    const card = { ...heuristicExtract(" "), environmentals: MAT };
    assert.ok(goGateChips(card).includes("Material 40–95°F"));
    assert.ok(goGateChips({ ...card, environmentals: { ...ENV, materialTempMinF: 59 } }).includes("Material at least 59°F"));
    assert.ok(!goGateChips({ ...card, environmentals: ENV }).some((c) => /^Material/.test(c)));
    assert.ok(!jobCardGateLine({ ...card, environmentals: ENV }).includes(MATERIAL_NOT_STATED));
  });
});
