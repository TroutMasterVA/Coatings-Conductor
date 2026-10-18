import type { FieldCardData } from "../lib/types.ts";
import { formatTempRange } from "../lib/temp-range.ts";

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
