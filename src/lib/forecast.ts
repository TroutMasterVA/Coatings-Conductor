import { createServerFn } from "@tanstack/react-start";
import { bundleDays, scoreHour, type RawHour } from "./score-windows";
import { FORECAST_RATE_LIMIT_MESSAGE, forecastCacheFresh } from "./forecast-cap";
import type { Environmentals, ForecastBundle } from "./types";
import { ForecastUnavailableError, MIN_USABLE_HOURS, fetchWithTimeout } from "./forecast-sources";
import { sheetWindow, type WxHour } from "./noaa";


type ForecastMem = {
  stamps: Map<string, number[]>;
  cache: Map<string, { at: number; forecast: ForecastBundle }>;
};

const globalForecast = globalThis as typeof globalThis & { __ccForecastCap__?: ForecastMem };
function forecastStore(): ForecastMem {
  globalForecast.__ccForecastCap__ ??= { stamps: new Map(), cache: new Map() };
  return globalForecast.__ccForecastCap__;
}

/** Client IP per TRUSTED_PROXY_HOPS / CLIENT_IP_HEADER, else the socket peer, else null (item 3). */
async function forecastClientIp(): Promise<string | null> {
  try {
    const { getRequest, getRequestIP } = await import("@tanstack/react-start/server");
    const { clientIpConfigFromEnv, resolveClientIp, warnNoClientIpOnce } = await import(
      "./rate-limit/client-ip"
    );
    const req = getRequest();
    let peer: string | undefined;
    try {
      peer = getRequestIP();
    } catch {
      peer = undefined;
    }
    const res = resolveClientIp(req?.headers, peer, clientIpConfigFromEnv());
    if (res.ip === null) {
      warnNoClientIpOnce(res.reason);
      return null;
    }
    return res.ip;
  } catch {
    return null;
  }
}

async function geocodeZip(zip: string) {
  let res: Response;
  try {
    res = await fetchWithTimeout(`https://api.zippopotam.us/us/${zip}`);
  } catch {
    throw new ForecastUnavailableError(
      "Forecast unavailable: the ZIP lookup did not answer. This is not a GO. Try again later.",
    );
  }
  if (!res.ok) throw new Error("ZIP not found. Use a 5-digit US ZIP.");
  const body = (await res.json()) as {
    "post code"?: string;
    places?: { "place name": string; state: string; latitude: string; longitude: string; "state abbreviation": string }[];
  };
  const place = body.places?.[0];
  if (!place) throw new Error("ZIP not found.");
  return {
    zip: body["post code"] ?? zip,
    city: place["place name"],
    state: place["state abbreviation"] || place.state,
    lat: Number(place.latitude),
    lon: Number(place.longitude),
  };
}

/** Sheet-window hour -> the RawHour the existing strip scores (no forecast text is used). */
function toRawHour(h: WxHour): RawHour {
  return {
    startIso: h.startIso,
    tempF: h.tempF,
    rh: h.rh,
    dewpointF: h.dewpointF,
    pop: h.pop,
    precipIn: null,
    windMph: h.windMph,
    shortForecast: h.skyCover != null ? `Sky cover ${Math.round(h.skyCover)}%` : "",
    cloudCover: h.skyCover,
  };
}

export const loadForecast = createServerFn({ method: "POST" })
  .validator((input: { zip: string; environmentals: Environmentals }) => {
    const zip = (input?.zip ?? "").replace(/\D/g, "").slice(0, 5);
    if (zip.length !== 5) throw new Error("Enter a 5-digit US ZIP.");
    return { zip, environmentals: input.environmentals };
  })
  .handler(async ({ data }): Promise<{ ok: true; forecast: ForecastBundle } | { ok: false; error: string }> => {
    try {
      const { assertSameSiteRequest } = await import("@/lib/auth/isolation.server");
      assertSameSiteRequest();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Forbidden";
      return { ok: false, error: message };
    }

    const now = Date.now();
    const store = forecastStore();
    const cached = store.cache.get(data.zip);
    if (cached && forecastCacheFresh(cached.at, now)) {
      return { ok: true, forecast: cached.forecast };
    }

    // Per client IP only (no ZIP), shared database; fails open to the per-process stamps (item 3).
    const [{ getSql }, { takeForecastSlotShared }] = await Promise.all([
      import("./db"),
      import("./rate-limit/app-limits"),
    ]);
    const slot = await takeForecastSlotShared(getSql, await forecastClientIp(), store.stamps, now);
    if (!slot.ok) {
      return { ok: false, error: FORECAST_RATE_LIMIT_MESSAGE };
    }

    try {
      const geo = await geocodeZip(data.zip);
      // NWS gridpoint first, Open-Meteo (labelled) as backup; all down -> "Forecast unavailable" (never GO).
      const sheet = await sheetWindow(geo.lat, geo.lon, data.environmentals);
      if (!sheet || sheet.hours.length < MIN_USABLE_HOURS) throw new ForecastUnavailableError();
      const pack = { hours: sheet.hours.map((c) => toRawHour(c.hour)), source: sheet.source.label, timezone: sheet.timezone };
      const scored = pack.hours.map((h) => scoreHour(h, data.environmentals, pack.timezone));
      const forecast = bundleDays(
        scored,
        {
          zip: geo.zip,
          city: geo.city,
          state: geo.state,
          lat: geo.lat,
          lon: geo.lon,
          timezone: pack.timezone,
          source: pack.source,
          issuedAt: new Date().toISOString(),
          rawHours: pack.hours,
        },
        data.environmentals,
      );
      forecast.sheet = sheet;
      store.cache.set(data.zip, { at: now, forecast });
      return { ok: true, forecast };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "Forecast failed" };
    }
  });
