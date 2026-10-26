/**
 * NOAA / NWS hourly weather vs the job card's sheet limits. No key, no AI.
 *
 * Primary: api.weather.gov (User-Agent with contact, as NWS requires)
 *   /points/{lat},{lon} -> forecastGridData (raw gridpoint layers, NOT the forecast text)
 *   -> hourly temperature, relativeHumidity, dewpoint, windSpeed, windGust, skyCover,
 *      probabilityOfPrecipitation (ISO 8601 validTime durations expanded to hours; degC->F, km/h->mph).
 *   "Now" = /points -> observationStations -> first station -> /observations/latest.
 * Backup: Open-Meteo, only when NWS fails or times out, always labelled "Backup source: Open-Meteo".
 * Every value carries its source and time. Missing data / timeout = unavailable, never GO.
 */
import { fetchWithTimeout, type FetchLike, WEATHER_TIMEOUT_MS } from "./forecast-sources.ts";
import type { Environmentals, ForecastBundle } from "./types";
import type { SiteContext } from "./mitigations";
import { NOT_STATED_LIMIT_BLOCKS_GO, WIND_ADVISORY, notStatedFlag, workWindowCheck, condensationRisk, type ScoreOptions } from "./score-windows.ts";

/** Surface temperature for the checks: a gauge reading, or the sun-model estimate (always labelled). */
export type SurfaceInput = { valueF: number; kind: "measured" | "estimate" };
export const SURFACE_LABEL: Record<SurfaceInput["kind"], string> = {
  measured: "measured",
  estimate: "estimate, verify with gauge",
};

export const NWS_USER_AGENT = "CoatingsConductor (practice; lead-bot@users.noreply.github.com)";
export const BACKUP_LABEL = "Backup source: Open-Meteo";
export { DEW_SPREAD_DEFAULT_F as SSPC_DEW_DEFAULT_F, DEW_SPREAD_DEFAULT_LABEL as SSPC_DEW_LABEL } from "./score-windows.ts";
import { DEW_SPREAD_DEFAULT_F as SSPC_DEW_DEFAULT_F, DEW_SPREAD_DEFAULT_LABEL as SSPC_DEW_LABEL } from "./score-windows.ts";
export const PLANNING_HOURS = 72;

export type WxSource =
  | { kind: "gridpoint"; office: string; x: number; y: number; updateTime: string; label: string }
  | { kind: "open-meteo"; fetchedAt: string; label: string };

export type WxHour = {
  startIso: string; // UTC hour start
  tempF: number | null;
  rh: number | null;
  dewpointF: number | null;
  windMph: number | null;
  gustMph: number | null;
  skyCover: number | null;
  pop: number | null;
  source: WxSource;
};

export type WxNow = {
  stationId: string;
  observedAt: string;
  tempF: number | null;
  rh: number | null;
  dewpointF: number | null;
  windMph: number | null;
  label: string;
};

export type CheckStatus = "pass" | "fail" | "unavailable" | "not-stated";
export type LimitCheck = { name: string; status: CheckStatus; reason: string; spreadF?: number; basis?: SpreadBasis };
export type SpreadBasis = "air" | "est. surface" | "measured surface";
export type HourVerdict = "go" | "nogo" | "unavailable" | "outside";
export type HourCheck = { startIso: string; verdict: HourVerdict; checks: LimitCheck[]; hour: WxHour };

export type SheetWindow = {
  source: WxSource;
  /** IANA zone for display / day bucketing (NWS points timeZone, or Open-Meteo's). */
  timezone: string;
  backup: boolean;
  now: WxNow | null;
  hours: HourCheck[];
};

const r1 = (n: number) => Math.round(n * 10) / 10;
export const cToF = (c: number) => r1((c * 9) / 5 + 32);
export const kmhToMph = (k: number) => r1(k / 1.609344);

/** ISO 8601 duration (e.g. PT1H, P3DT9H, PT30M) -> whole hours (min 1). */
export function durationHours(d: string): number {
  const m = d.match(/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?)?$/);
  if (!m) return 1;
  const h = Number(m[1] ?? 0) * 24 + Number(m[2] ?? 0) + Math.floor(Number(m[3] ?? 0) / 60);
  return Math.max(1, h);
}

type Layer = { uom?: string; values?: { validTime: string; value: number | null }[] };

function convert(v: number, uom = ""): number {
  if (/degC/.test(uom)) return cToF(v);
  if (/km_h-1/.test(uom)) return kmhToMph(v);
  if (/m_s-1/.test(uom)) return r1(v * 2.236936);
  return r1(v);
}

/** Expand a gridpoint layer into hourly values keyed by UTC hour ISO ("2026-10-23T09:00:00.000Z"). */
export function expandLayer(layer: Layer | undefined): Map<string, number> {
  const out = new Map<string, number>();
  for (const { validTime, value } of layer?.values ?? []) {
    if (value == null || !Number.isFinite(value)) continue;
    const [start, dur = "PT1H"] = validTime.split("/");
    const t0 = Date.parse(start!);
    if (!Number.isFinite(t0)) continue;
    const n = Math.min(durationHours(dur), 24 * 8);
    for (let i = 0; i < n; i++) out.set(new Date(t0 + i * 3_600_000).toISOString(), convert(value, layer?.uom));
  }
  return out;
}

export type PointsJson = {
  properties?: { gridId?: string; gridX?: number; gridY?: number; forecastGridData?: string; observationStations?: string };
};
export type GridJson = { properties?: Record<string, Layer | string | undefined> & { updateTime?: string } };

/** Gridpoint JSON -> hourly values from `fromIso` for `hours` hours. */
export function gridHours(points: PointsJson, grid: GridJson, fromIso: string, hours = PLANNING_HOURS): WxHour[] {
  const p = points.properties ?? {};
  const g = grid.properties ?? {};
  const updateTime = typeof g.updateTime === "string" ? g.updateTime : "";
  const source: WxSource = {
    kind: "gridpoint",
    office: p.gridId ?? "",
    x: p.gridX ?? 0,
    y: p.gridY ?? 0,
    updateTime,
    label: `NWS gridpoint ${p.gridId}/${p.gridX},${p.gridY}, updated ${updateTime}`,
  };
  const L = (k: string) => expandLayer(g[k] as Layer | undefined);
  const t = L("temperature"), rh = L("relativeHumidity"), dp = L("dewpoint"), ws = L("windSpeed");
  const wg = L("windGust"), sky = L("skyCover"), pop = L("probabilityOfPrecipitation");
  const start = Math.floor(Date.parse(fromIso) / 3_600_000) * 3_600_000;
  const out: WxHour[] = [];
  for (let i = 0; i < hours; i++) {
    const k = new Date(start + i * 3_600_000).toISOString();
    if (!t.has(k) && !rh.has(k) && !dp.has(k)) continue;
    out.push({
      startIso: k,
      tempF: t.get(k) ?? null,
      rh: rh.get(k) ?? null,
      dewpointF: dp.get(k) ?? null,
      windMph: ws.get(k) ?? null,
      gustMph: wg.get(k) ?? null,
      skyCover: sky.get(k) ?? null,
      pop: pop.get(k) ?? null,
      source,
    });
  }
  return out;
}

type Q = { value?: number | null; unitCode?: string } | undefined;
const qv = (q: Q) => (q?.value == null || !Number.isFinite(q.value) ? null : convert(q.value, q.unitCode));

export function latestObservation(stationId: string, obs: { properties?: Record<string, unknown> }): WxNow | null {
  const o = obs.properties ?? {};
  const observedAt = typeof o.timestamp === "string" ? o.timestamp : "";
  if (!observedAt) return null;
  return {
    stationId,
    observedAt,
    tempF: qv(o.temperature as Q),
    rh: qv(o.relativeHumidity as Q),
    dewpointF: qv(o.dewpoint as Q),
    windMph: qv(o.windSpeed as Q),
    label: `Station ${stationId}, observed ${observedAt}`,
  };
}

/** One hour vs the sheet. A missing limit is "Not stated" and never counts as a pass. */
export function checkHour(
  hour: WxHour,
  env: Environmentals,
  surfaceIn?: number | null | SurfaceInput,
  opts: ScoreOptions = {},
): HourCheck {
  const notStatedBlocks = opts.notStatedBlocksGo ?? NOT_STATED_LIMIT_BLOCKS_GO;
  const surface: SurfaceInput | null =
    surfaceIn == null ? null : typeof surfaceIn === "number" ? { valueF: surfaceIn, kind: "measured" } : surfaceIn;
  const surfaceTempF = surface?.valueF ?? null;
  const checks: LimitCheck[] = [];
  const range = (name: string, v: number | null, min: number | null, max: number | null, unit: string) => {
    if (min == null && max == null) return checks.push({ name, status: "not-stated", reason: `${name}: Not stated on the sheet` });
    if (v == null) return checks.push({ name, status: "unavailable", reason: `${name}: no forecast value` });
    if (min != null && v < min) return checks.push({ name, status: "fail", reason: `${name} ${v}${unit} below sheet min ${min}${unit}` });
    if (max != null && v > max) return checks.push({ name, status: "fail", reason: `${name} ${v}${unit} above sheet max ${max}${unit}` });
    const lim = [min != null ? `min ${min}${unit}` : "", max != null ? `max ${max}${unit}` : ""].filter(Boolean).join(", ");
    checks.push({ name, status: "pass", reason: `${name} ${v}${unit} within sheet ${lim}` });
  };
  range("Air temp", hour.tempF, env.ambientTempMinF, env.ambientTempMaxF, "°F");
  if (env.substrateTempMinF == null && env.substrateTempMaxF == null) {
    checks.push({ name: "Surface temp", status: "not-stated", reason: "Surface temp: Not stated on the sheet" });
  } else if (surfaceTempF == null) {
    checks.push({ name: "Surface temp", status: "unavailable", reason: "Surface temp unknown: not measured, not assumed. Measure it on site." });
  } else {
    // An estimate may only make the verdict stricter: min vs the colder of air/estimate, max vs
    // the warmer. A measured surface is used as-is.
    const est = surface!.kind === "estimate" && hour.tempF != null;
    const cold = est ? Math.min(hour.tempF!, surfaceTempF) : surfaceTempF;
    const warm = est ? Math.max(hour.tempF!, surfaceTempF) : surfaceTempF;
    const label = `Surface temp (${SURFACE_LABEL[surface!.kind]})`;
    const lo = env.substrateTempMinF, hi = env.substrateTempMaxF;
    if (lo != null && cold < lo) {
      checks.push({ name: label, status: "fail", reason: `${label} ${cold}°F${est && cold !== surfaceTempF ? " (air, colder than estimate)" : ""} below sheet min ${lo}°F` });
    } else if (hi != null && warm > hi) {
      checks.push({ name: label, status: "fail", reason: `${label} ${warm}°F${est && warm !== surfaceTempF ? " (air, warmer than estimate)" : ""} above sheet max ${hi}°F` });
    } else {
      const lim = [lo != null ? `min ${lo}°F` : "", hi != null ? `max ${hi}°F` : ""].filter(Boolean).join(", ");
      const shown = cold === warm ? `${cold}°F` : `${cold}–${warm}°F (air and estimate)`;
      checks.push({ name: label, status: "pass", reason: `${label} ${shown} within sheet ${lim}` });
    }
  }
  range("RH", hour.rh, null, env.relativeHumidityMax, "%");
  const stated = env.dewPointSpreadMinF != null;
  const margin = stated ? env.dewPointSpreadMinF! : SSPC_DEW_DEFAULT_F;
  const marginLabel = stated ? `sheet min ${margin}°F` : `${margin}°F ${SSPC_DEW_LABEL}`;
  // Dew uses the colder of air and an estimated surface (the smaller spread); measured as-is.
  const estimate = surface?.kind === "estimate";
  const surfaceOrAir =
    surfaceTempF == null ? hour.tempF : estimate && hour.tempF != null ? Math.min(hour.tempF, surfaceTempF) : surfaceTempF;
  const basis: SpreadBasis =
    surface == null || surfaceTempF == null ? "air" : surface.kind === "measured" ? "measured surface" : surfaceOrAir === surfaceTempF ? "est. surface" : "air";
  if (surfaceOrAir == null || hour.dewpointF == null) {
    checks.push({ name: "Dew-point spread", status: "unavailable", reason: "Dew-point spread: no forecast value" });
  } else {
    const spread = r1(surfaceOrAir - hour.dewpointF);
    const ok = spread >= margin;
    checks.push({
      name: "Dew-point spread",
      status: ok ? "pass" : "fail",
      reason: `${ok ? "" : `${condensationRisk(spread)} · `}Dew-point spread ${spread}°F (${basis} − dew point) ${ok ? "meets" : "below"} ${marginLabel}`,
      spreadF: spread,
      basis,
    });
  }
  if (env.windMaxMph == null) {
    checks.push({ name: "Spray wind", status: "not-stated", reason: "Spray wind max: Not stated on the sheet" });
  } else if (hour.windMph == null) {
    checks.push({ name: "Spray wind", status: "unavailable", reason: "Wind: no forecast value" });
  } else {
    const gust = hour.gustMph != null ? ` (gusts ${hour.gustMph} mph)` : "";
    const ok = hour.windMph <= env.windMaxMph;
    checks.push({
      name: "Spray wind",
      status: ok ? "pass" : "fail",
      reason: `Wind ${hour.windMph} mph${gust} ${ok ? "within" : "above"} sheet max ${env.windMaxMph} mph`,
    });
  }
  if (!notStatedBlocks) {
    // An unstated limit never blocks; the hour carries a visible flag (and, for wind, an advisory).
    for (const c of checks) {
      if (c.status !== "not-stated") continue;
      c.reason = notStatedFlag(`${c.name.toLowerCase()} limit`);
      if (c.name === "Spray wind") c.reason += `. ${WIND_ADVISORY}`;
    }
  }
  const scored = notStatedBlocks ? checks : checks.filter((c) => c.status !== "not-stated");
  const verdict: HourVerdict = scored.some((c) => c.status === "fail")
    ? "nogo"
    : scored.length && scored.every((c) => c.status === "pass")
      ? "go"
      : "unavailable";
  return { startIso: hour.startIso, verdict, checks, hour };
}

type Deps = { fetch?: FetchLike; timeoutMs?: number; now?: () => Date };

async function getJson<T>(url: string, deps: Deps, nws: boolean): Promise<T> {
  const headers: Record<string, string> = nws ? { "User-Agent": NWS_USER_AGENT, Accept: "application/geo+json" } : {};
  const res = await fetchWithTimeout(url, { headers }, deps.timeoutMs ?? WEATHER_TIMEOUT_MS, deps.fetch ?? fetch);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as T;
}

async function nwsWindow(lat: number, lon: number, deps: Deps): Promise<{ hours: WxHour[]; now: WxNow | null; timezone: string }> {
  const points = await getJson<PointsJson>(`https://api.weather.gov/points/${lat.toFixed(4)},${lon.toFixed(4)}`, deps, true);
  const gridUrl = points.properties?.forecastGridData;
  if (!gridUrl) throw new Error("no gridpoint");
  const [grid, now] = await Promise.all([
    getJson<GridJson>(gridUrl, deps, true),
    (async () => {
      const st = points.properties?.observationStations;
      if (!st) return null;
      const list = await getJson<{ features?: { properties?: { stationIdentifier?: string } }[] }>(st, deps, true);
      const id = list.features?.[0]?.properties?.stationIdentifier;
      if (!id) return null;
      return latestObservation(id, await getJson(`https://api.weather.gov/stations/${id}/observations/latest`, deps, true));
    })().catch(() => null),
  ]);
  const hours = gridHours(points, grid, (deps.now?.() ?? new Date()).toISOString());
  if (!hours.length) throw new Error("empty gridpoint");
  return { hours, now, timezone: (points.properties as { timeZone?: string } | undefined)?.timeZone ?? "UTC" };
}

async function openMeteoWindow(lat: number, lon: number, deps: Deps): Promise<{ hours: WxHour[]; timezone: string }> {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(lat));
  url.searchParams.set("longitude", String(lon));
  url.searchParams.set("hourly", "temperature_2m,relative_humidity_2m,dew_point_2m,wind_speed_10m,wind_gusts_10m,cloud_cover,precipitation_probability");
  url.searchParams.set("temperature_unit", "fahrenheit");
  url.searchParams.set("wind_speed_unit", "mph");
  url.searchParams.set("timezone", "auto");
  url.searchParams.set("forecast_days", "3");
  const body = await getJson<{ hourly?: Record<string, (number | string | null)[]>; timezone?: string; utc_offset_seconds?: number }>(
    url.toString(),
    deps,
    false,
  );
  const offsetMs = (body.utc_offset_seconds ?? 0) * 1000;
  const h = body.hourly;
  if (!h?.time?.length) throw new Error("empty");
  const fetchedAt = (deps.now?.() ?? new Date()).toISOString();
  const source: WxSource = { kind: "open-meteo", fetchedAt, label: `${BACKUP_LABEL} (fetched ${fetchedAt})` };
  const n = (k: string, i: number) => {
    const v = h[k]?.[i];
    return typeof v === "number" && Number.isFinite(v) ? r1(v) : null;
  };
  const hours = (h.time as string[]).map((t, i) => ({
    // Open-Meteo local wall time + its UTC offset -> UTC hour.
    startIso: new Date(Date.parse(`${t.length === 16 ? `${t}:00` : t}Z`) - offsetMs).toISOString(),
    tempF: n("temperature_2m", i),
    rh: n("relative_humidity_2m", i),
    dewpointF: n("dew_point_2m", i),
    windMph: n("wind_speed_10m", i),
    gustMph: n("wind_gusts_10m", i),
    skyCover: n("cloud_cover", i),
    pop: n("precipitation_probability", i),
    source,
  }));
  return { hours, timezone: body.timezone ?? "UTC" };
}

/** NWS first; Open-Meteo (labelled) only if NWS fails/times out; null = unavailable (never GO). */
export async function sheetWindow(
  lat: number,
  lon: number,
  env: Environmentals,
  deps: Deps = {},
  surfaceTempF?: number | null,
): Promise<SheetWindow | null> {
  let hours: WxHour[] = [];
  let now: WxNow | null = null;
  let timezone = "UTC";
  let backup = false;
  try {
    ({ hours, now, timezone } = await nwsWindow(lat, lon, deps));
  } catch {
    try {
      ({ hours, timezone } = await openMeteoWindow(lat, lon, deps));
      backup = true;
    } catch {
      return null;
    }
  }
  if (!hours.length) return null;
  return { source: hours[0]!.source, timezone, backup, now, hours: hours.map((h) => workWindowCheck(checkHour(h, env, surfaceTempF), timezone)) };
}

/**
 * Re-check the NOAA table with the job's surface temperature: the saved gauge reading when present
 * ("measured"), else the sun-model estimate from the scored strip ("estimate, verify with gauge").
 */
export function applySheetSurface(forecast: ForecastBundle, env: Environmentals, site: SiteContext): ForecastBundle {
  const sheet = forecast.sheet;
  if (!sheet) return forecast;
  const est = new Map<string, number>();
  for (const d of forecast.days) {
    for (const h of d.hours ?? []) {
      if (h.substrateF != null) est.set(new Date(h.startIso).toISOString(), h.substrateF);
    }
  }
  const measured = typeof site.measuredSurfaceTempF === "number" && Number.isFinite(site.measuredSurfaceTempF)
    ? site.measuredSurfaceTempF
    : null;
  const hours = sheet.hours.map((c) => {
    const e = est.get(c.startIso);
    const surface: SurfaceInput | null =
      measured != null ? { valueF: measured, kind: "measured" } : e != null ? { valueF: e, kind: "estimate" } : null;
    return workWindowCheck(checkHour(c.hour, env, surface), sheet.timezone, site.mitigations.includes("night_shift"));
  });
  return { ...forecast, sheet: { ...sheet, hours } };
}
