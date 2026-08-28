/** Spend/rate cap for `loadForecast`. ZIP is the only weather input. */
export const FORECAST_WINDOW_MS = 60_000;
export const FORECAST_MAX_PER_WINDOW = 8;
export const FORECAST_CACHE_MS = 15 * 60 * 1000;
export const FORECAST_RATE_LIMIT_MESSAGE = "Weather lookup is limited. Try again in a minute.";

export function takeForecastSlot(
  now: number,
  prior: number[],
  max = FORECAST_MAX_PER_WINDOW,
  windowMs = FORECAST_WINDOW_MS,
): { ok: true; stamps: number[] } | { ok: false; stamps: number[] } {
  const stamps = prior.filter((t) => now - t < windowMs);
  if (stamps.length >= max) return { ok: false, stamps };
  return { ok: true, stamps: [...stamps, now] };
}

export function forecastCacheFresh(
  cachedAt: number | undefined,
  now: number,
  ttl = FORECAST_CACHE_MS,
): boolean {
  return cachedAt != null && now - cachedAt < ttl;
}
