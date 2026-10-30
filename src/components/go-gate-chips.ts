import type { FieldCardData } from "../lib/types.ts";
import { formatTempRange } from "../lib/temp-range.ts";
import { unstatedLimitFlags } from "../lib/limit-fields.ts";

/**
 * Go-gate chips for the field card. Temperatures go through BE's shared
 * formatTempRange (#40) so a one-ended limit reads "at least 50°F" / "up to 120°F",
 * never a dash pair. A limit with neither end is skipped, as before.
 */
export function goGateChips(card: FieldCardData): string[] {
  const env = card.environmentals;
  const chips: string[] = [];
  if (env.ambientTempMinF != null || env.ambientTempMaxF != null) {
    chips.push(`Air ${formatTempRange(env.ambientTempMinF, env.ambientTempMaxF)}`);
  }
  if (env.substrateTempMinF != null || env.substrateTempMaxF != null) {
    chips.push(`Substrate ${formatTempRange(env.substrateTempMinF, env.substrateTempMaxF)}`);
  }
  if (env.materialTempMinF != null || env.materialTempMaxF != null) {
    chips.push(`Material ${formatTempRange(env.materialTempMinF, env.materialTempMaxF)}`);
  }
  if (env.dewPointSpreadMinF != null) {
    chips.push(`Dew spread ≥ ${env.dewPointSpreadMinF}°F`);
  } else {
    chips.push("Dew spread not stated");
  }
  if (env.relativeHumidityMax != null) chips.push(`RH ≤ ${env.relativeHumidityMax}%`);
  if (env.relativeHumidityMin != null) chips.push(`RH ≥ ${env.relativeHumidityMin}%`);
  if (env.precipitationAllowed === false) chips.push("No precipitation");
  if (env.windMaxMph != null) chips.push(`Wind ≤ ${env.windMaxMph} mph`);
  return chips;
}

/**
 * The job card's Go gates line: stated gates plus a "Not stated — check the sheet for …" item for
 * every unstated limit, from the single list in limit-fields.ts (replaces the bare dew chip).
 */
export function jobCardGateLine(card: FieldCardData): string[] {
  const flags = unstatedLimitFlags(card.environmentals);
  return [...goGateChips(card).filter((c) => c !== "Dew spread not stated"), ...flags];
}
