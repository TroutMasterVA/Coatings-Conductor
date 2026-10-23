import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { BACKUP_LABEL, NWS_USER_AGENT, SSPC_DEW_LABEL, checkHour, durationHours, sheetWindow, type SheetWindow, type WxHour } from "./noaa.ts";
import { bundleDays, scoreHour } from "./score-windows.ts";
import type { Environmentals } from "./types.ts";

const fx = (n: string) => JSON.parse(readFileSync(new URL(`../../tests/fixtures/weather/${n}.json`, import.meta.url), "utf8"));
const NOW = () => new Date("2026-10-23T09:00:00Z");
const ENV: Environmentals = {
  ambientTempMinF: 50, ambientTempMaxF: 100, substrateTempMinF: 50, substrateTempMaxF: 120,
  relativeHumidityMax: 85, relativeHumidityMin: null, dewPointSpreadMinF: 5, precipitationAllowed: true,
  windMaxMph: 15, directSunNotes: "", notes: "", additional: [],
};
const json = (b: unknown) => new Response(JSON.stringify(b), { status: 200, headers: { "content-type": "application/json" } });
const uas: (string | undefined)[] = [];
/** Recorded NWS responses (KHOU / HGX 63,95, trimmed). */
const nwsFetch = async (url: string, init?: RequestInit) => {
  if (url.includes("api.weather.gov")) uas.push((init?.headers as Record<string, string>)?.["User-Agent"]);
  if (url.includes("/points/")) return json(fx("points"));
  if (url.endsWith("/stations")) return json(fx("stations"));
  if (url.includes("/observations/latest")) return json(fx("observation"));
  if (url.includes("/gridpoints/")) return json(fx("gridpoint"));
  throw new Error(`unexpected ${url}`);
};
const at = (w: SheetWindow, iso: string) => w.hours.find((h) => h.startIso === iso)!;

describe("NOAA gridpoint vs sheet limits", () => {
  it("expands ISO 8601 durations", () => {
    assert.equal(durationHours("PT1H"), 1);
    assert.equal(durationHours("PT3H"), 3);
    assert.equal(durationHours("P3DT9H"), 81);
  });

  it("a pass hour: every check passes -> GO, values sourced to the gridpoint; Now = station + time", async () => {
    const w = (await sheetWindow(29.7633, -95.3633, ENV, { fetch: nwsFetch, now: NOW }, 85))!;
    assert.equal(w.backup, false);
    assert.match(w.source.label, /NWS gridpoint HGX\/63,95, updated 2026-10-23T15:51:27/);
    assert.equal(w.now?.stationId, "KHOU");
    assert.equal(w.now?.observedAt, "2026-10-23T17:50:00+00:00");
    assert.ok(uas.length && uas.every((u) => u === NWS_USER_AGENT));
    const h = at(w, "2026-10-23T19:00:00.000Z");
    assert.equal(h.hour.tempF, 84); // 28.89 degC
    assert.equal(h.hour.windMph, 3.5); // 5.556 km/h
    assert.equal(h.verdict, "go", JSON.stringify(h.checks));
    // PT3H RH value was expanded to 10:00, 11:00 and 12:00
    assert.equal(at(w, "2026-10-23T11:00:00.000Z").hour.rh, 81);
  });

  it("fails on RH -> NO-GO with the reason", async () => {
    const w = (await sheetWindow(29.7633, -95.3633, { ...ENV, relativeHumidityMax: 75 }, { fetch: nwsFetch, now: NOW }, 70))!;
    const h = at(w, "2026-10-23T10:00:00.000Z");
    assert.equal(h.verdict, "nogo");
    assert.match(h.checks.find((c) => c.name === "RH")!.reason, /RH 81% above sheet max 75%/);
  });

  const hour = (o: Partial<WxHour>): WxHour => ({
    startIso: "2026-10-24T14:00:00.000Z", tempF: 60, rh: 70, dewpointF: 40, windMph: 4, gustMph: 8, skyCover: 20, pop: 0,
    source: { kind: "gridpoint", office: "X", x: 1, y: 1, updateTime: "t", label: "g" }, ...o,
  });

  it("dew spread fails against the labelled SSPC default when the sheet states none", () => {
    const c = checkHour(hour({ tempF: 60, dewpointF: 57 }), { ...ENV, dewPointSpreadMinF: null }, 60);
    const dew = c.checks.find((x) => x.name === "Dew-point spread")!;
    assert.equal(dew.status, "fail");
    assert.ok(dew.reason.includes(SSPC_DEW_LABEL));
    assert.equal(c.verdict, "nogo");
  });

  it("a missing wind limit is Not stated and the hour is not GO; unknown surface is not assumed", () => {
    const c = checkHour(hour({}), { ...ENV, windMaxMph: null }, 60);
    assert.equal(c.checks.find((x) => x.name === "Spray wind")!.status, "not-stated");
    assert.notEqual(c.verdict, "go");
    const s = checkHour(hour({}), ENV);
    assert.equal(s.checks.find((x) => x.name === "Surface temp")!.status, "unavailable");
    assert.notEqual(s.verdict, "go");
  });

  it("NWS timeout -> labelled Open-Meteo backup; both down -> unavailable", async () => {
    const hang = (_u: string, init?: RequestInit) =>
      new Promise<Response>((_, rej) => {
        const keep = setTimeout(() => {}, 5000);
        init?.signal?.addEventListener("abort", () => (clearTimeout(keep), rej(init.signal!.reason)));
      });
    const meteo = { timezone: "America/Chicago", utc_offset_seconds: -18000, hourly: {
      time: ["2026-10-23T04:00", "2026-10-23T05:00"], temperature_2m: [62, 63], relative_humidity_2m: [70, 71],
      dew_point_2m: [50, 50], wind_speed_10m: [3, 3], wind_gusts_10m: [6, 6], cloud_cover: [10, 10], precipitation_probability: [0, 0] } };
    const f = (u: string, i?: RequestInit) => (u.includes("open-meteo") ? Promise.resolve(json(meteo)) : hang(u, i));
    const w = (await sheetWindow(1, 1, ENV, { fetch: f, timeoutMs: 20, now: NOW }, 70))!;
    assert.equal(w.backup, true);
    assert.ok(w.source.label.startsWith(BACKUP_LABEL));
    assert.equal(w.hours[0]!.startIso, "2026-10-23T09:00:00.000Z");
    assert.equal(await sheetWindow(1, 1, ENV, { fetch: hang, timeoutMs: 20, now: NOW }), null);
  });
});

describe("strict GO rule in the existing window scoring (QA critical)", () => {
  const raw = (iso: string, dewpointF: number) => ({
    startIso: iso, tempF: 70, rh: 40, dewpointF, pop: 0, precipIn: 0, windMph: 3, shortForecast: "Sky cover 10%", cloudCover: 10,
  });
  it("a dew-spread-fail hour is NO-GO", () => {
    // 05:00 (no sun yet): surface ~ air 70°F, dew point 69°F -> spread ~1°F < sheet 5°F
    const h = scoreHour(raw("2026-10-24T05:00:00Z", 69), ENV, "UTC");
    assert.equal(h.status, "nogo");
    assert.ok(h.reasons.some((r) => /Dew spread/.test(r)));
  });
  it("one failed scored hour makes the day not GO", () => {
    const hrs = ["2026-10-24T05:00:00Z", "2026-10-24T06:00:00Z", "2026-10-24T07:00:00Z"].map((iso, i) =>
      scoreHour(raw(iso, i === 0 ? 69 : 40), ENV, "UTC"),
    );
    assert.deepEqual(hrs.map((h) => h.status), ["nogo", "go", "go"]);
    const meta = { zip: "00000", city: "", state: "", lat: 0, lon: 0, timezone: "UTC", source: "t", issuedAt: "t" };
    const day = bundleDays(hrs, meta, ENV).days[0]!;
    assert.notEqual(day.status, "go");
    assert.equal(day.status, "nogo");
    const good = bundleDays([hrs[1]!, hrs[2]!], meta, ENV).days[0]!;
    assert.equal(good.status, "go");
  });
});
