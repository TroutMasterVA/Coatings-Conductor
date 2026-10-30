/**
 * Extract and forecast limits on the shared database (item 3). The SQL client is injected so this
 * runs in tests; the server passes `getSql` from ../db.
 *
 * - Extract: EXTRACT_RATE_MAX per user per minute. Fails CLOSED (Azure reads cost money).
 * - Forecast: FORECAST_IP_MAX_PER_WINDOW per client IP per minute (IP only, no ZIP). Fails OPEN to
 *   the old in-memory, per-process limiter. No usable IP -> no per-IP limit for that request.
 */
import type { Sql } from "../db";
import { EXTRACT_RATE_MAX, EXTRACT_RATE_WINDOW_MS } from "../extract/extract-core";
import { FORECAST_WINDOW_MS, takeForecastSlot } from "../forecast-cap";
import { take } from "./limiter";

/**
 * 60 cache-missing lookups per minute per IP. Cache hits (same ZIP within 15 min) don't count.
 * One person planning makes a few lookups a minute, so one office behind a shared IP can have
 * a dozen people planning at once; a scripted loop is still stopped within a minute.
 */
export const FORECAST_IP_MAX_PER_WINDOW = 60;

export const EXTRACT_UNAVAILABLE_MESSAGE = "Sheet reading is paused for a moment. Try again shortly.";

export async function takeExtractSlotShared(
  getSql: () => Promise<Sql>,
  userId: string,
  log: (line: string) => void = console.error,
): Promise<{ ok: true } | { ok: false; retryAfterSec: number; message?: string }> {
  try {
    const sql = await getSql();
    const r = await take(sql, "extract-user", userId, {
      max: EXTRACT_RATE_MAX,
      windowSec: Math.round(EXTRACT_RATE_WINDOW_MS / 1000),
    });
    return r.allowed ? { ok: true } : { ok: false, retryAfterSec: r.retryAfterSec };
  } catch {
    log("[rate-limit] extract: limiter database unavailable (fail closed)");
    return { ok: false, retryAfterSec: 30, message: EXTRACT_UNAVAILABLE_MESSAGE };
  }
}

export type ForecastFallback = Map<string, number[]>;

let forecastWarned = false;

export async function takeForecastSlotShared(
  getSql: () => Promise<Sql>,
  ip: string | null,
  fallback: ForecastFallback,
  now: number = Date.now(),
  log: (line: string) => void = console.warn,
): Promise<{ ok: boolean; source: "skipped" | "db" | "memory" }> {
  if (!ip) return { ok: true, source: "skipped" };
  try {
    const sql = await getSql();
    const r = await take(sql, "forecast-ip", ip, {
      max: FORECAST_IP_MAX_PER_WINDOW,
      windowSec: Math.round(FORECAST_WINDOW_MS / 1000),
    });
    return { ok: r.allowed, source: "db" };
  } catch {
    if (!forecastWarned) {
      forecastWarned = true;
      log("[rate-limit] forecast: limiter database unavailable; using the per-process limit (fail open)");
    }
    const slot = takeForecastSlot(now, fallback.get(ip) ?? [], FORECAST_IP_MAX_PER_WINDOW);
    fallback.set(ip, slot.stamps);
    return { ok: slot.ok, source: "memory" };
  }
}
