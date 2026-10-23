import type { RawHour } from "./score-windows";

/**
 * Weather fetch hardening (go/no-go is a core feature, so a slow or dead source must never turn
 * into a silent blank or a GO):
 *   - every call has a timeout (AbortSignal.timeout);
 *   - weather.gov first, Open-Meteo as the backup;
 *   - hours missing temperature, humidity or dew point are dropped, so they can never score GO;
 *   - if no source gives enough usable hours: ForecastUnavailableError (UI: "Forecast unavailable").
 */
export const WEATHER_TIMEOUT_MS = 8000;
export const MIN_USABLE_HOURS = 12;
export const FORECAST_UNAVAILABLE_MESSAGE =
  "Forecast unavailable: the weather services did not answer. This is not a GO. Plan later or check the site conditions by hand.";

export class ForecastUnavailableError extends Error {
  constructor(message = FORECAST_UNAVAILABLE_MESSAGE) {
    super(message);
    this.name = "ForecastUnavailableError";
  }
}

export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

/** fetch with a hard timeout (default 8s). Rejects on timeout or network failure. */
export function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  timeoutMs = WEATHER_TIMEOUT_MS,
  fetchImpl: FetchLike = fetch,
): Promise<Response> {
  return fetchImpl(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
}

/** Only hours with the core values the go/no-go needs. A missing value is never treated as OK. */
export function usableHours(hours: RawHour[]): RawHour[] {
  return hours.filter(
    (h) =>
      typeof h.tempF === "number" && Number.isFinite(h.tempF) &&
      typeof h.rh === "number" && Number.isFinite(h.rh) &&
      typeof h.dewpointF === "number" && Number.isFinite(h.dewpointF),
  );
}

export type HourlyPack = { hours: RawHour[]; source: string; timezone: string };
export type HourlySource = () => Promise<HourlyPack | null>;

/** Try each source in order (primary, then backups); first with enough usable hours wins. */
export async function hourlyWithBackup(sources: HourlySource[]): Promise<HourlyPack> {
  for (const source of sources) {
    try {
      const pack = await source();
      if (!pack) continue;
      const hours = usableHours(pack.hours);
      if (hours.length >= MIN_USABLE_HOURS) return { ...pack, hours };
    } catch {
      // timeout / network / bad JSON: try the next source
    }
  }
  throw new ForecastUnavailableError();
}
