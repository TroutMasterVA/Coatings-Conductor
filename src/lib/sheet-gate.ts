import type { Environmentals, ForecastBundle } from "./types.ts";

/** Shown instead of any verdict when no data sheet has been loaded. */
export const NO_SHEET_MESSAGE = "No sheet loaded";
/** Shown instead of any verdict when the sheet failed or nothing usable was read from it. */
export const SHEET_UNREADABLE_MESSAGE = "Sheet couldn't be read";

export type SheetGate = { ok: true } | { ok: false; reason: "none" | "unreadable"; message: string };

/** At least one numeric application limit (air, surface, RH, dew-point spread, wind) is stated. */
export function hasStatedLimit(env: Environmentals | null | undefined): boolean {
  if (!env) return false;
  const values = [
    env.ambientTempMinF,
    env.ambientTempMaxF,
    env.substrateTempMinF,
    env.substrateTempMaxF,
    env.relativeHumidityMax,
    env.relativeHumidityMin,
    env.dewPointSpreadMinF,
    env.windMaxMph,
  ];
  return values.some((v) => typeof v === "number" && Number.isFinite(v));
}

/**
 * Scoring only runs against a sheet that loaded: never against default or empty limits.
 * - no card -> "No sheet loaded"
 * - the last read failed, or it came back with no stated limits (e.g. a text file named .pdf,
 *   an image-only sheet with no reader) -> "Sheet couldn't be read"
 */
export function sheetGate(card: { environmentals: Environmentals } | null | undefined, readFailed: boolean): SheetGate {
  if (readFailed) return { ok: false, reason: "unreadable", message: SHEET_UNREADABLE_MESSAGE };
  if (!card) return { ok: false, reason: "none", message: NO_SHEET_MESSAGE };
  if (!hasStatedLimit(card.environmentals)) {
    return { ok: false, reason: "unreadable", message: SHEET_UNREADABLE_MESSAGE };
  }
  return { ok: true };
}

/** The forecast to score and show: none at all unless the sheet gate is open. */
export function gatedForecast<T extends ForecastBundle>(gate: SheetGate, forecast: T | null): T | null {
  return gate.ok ? forecast : null;
}
