/**
 * D4 (P2): which forecast may be scored and shown. A failed, stale or missing forecast is never
 * scored, so today's line, the day rows and the hourly list can't keep an old GO next to
 * "Forecast unavailable … This is not a GO."
 */

export type ForecastView<T> = {
  /** Last forecast that loaded. */
  forecast: T | null;
  /** ZIP that forecast was loaded for (what was asked for, not what the geocoder echoed). */
  loadedZip: string | null;
  /** Error from the latest load attempt; set when the latest attempt failed. */
  error: string | null;
};

/**
 * The forecast to score, or null:
 * - the latest load failed (even if an earlier one worked) -> null
 * - nothing has loaded -> null
 * - it was loaded for a different ZIP than the one on screen (stale) -> null
 */
export function shownForecast<T>(view: ForecastView<T>, zip: string): T | null {
  if (view.error) return null;
  if (!view.forecast) return null;
  if (view.loadedZip !== zip) return null;
  return view.forecast;
}
