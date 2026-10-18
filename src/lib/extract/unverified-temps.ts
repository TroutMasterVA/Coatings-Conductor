import type { FieldCardData } from "../types.ts";
import type { Provenance } from "./provider.ts";

/**
 * Temperature fields that drive weather go/no-go scoring. Absolute temperatures and the
 * dew-point margin (a difference, so its °C form is n × 5/9 with no −32).
 */
export const TEMP_FIELDS = [
  { path: "environmentals.ambientTempMinF", key: "ambientTempMinF", delta: false },
  { path: "environmentals.ambientTempMaxF", key: "ambientTempMaxF", delta: false },
  { path: "environmentals.substrateTempMinF", key: "substrateTempMinF", delta: false },
  { path: "environmentals.substrateTempMaxF", key: "substrateTempMaxF", delta: false },
  { path: "environmentals.dewPointSpreadMinF", key: "dewPointSpreadMinF", delta: true },
] as const;

export type TempFieldKey = (typeof TEMP_FIELDS)[number]["key"];

/** Degree glyphs (˚ º ℃ ℉) and spacing normalized, so "40 ˚ F" reads as "40°F". */
function norm(s: string): string {
  return s
    .replace(/\u00a0/g, " ")
    .replace(/\u2103/g, "°C")
    .replace(/\u2109/g, "°F")
    .replace(/[\u02DA\u00BA]/g, "°")
    .replace(/[\u2212\u2013\u2014]/g, "-")
    .replace(/(\d)\s+°/g, "$1°")
    .replace(/°\s+([CF])\b/g, "°$1");
}

const DEW_AFTER = /^[^.;\n]{0,24}?\b(?:above|over|higher than)\s+(?:the\s+)?dew/i;

/**
 * Every number written with that unit in `text` ("35°F", "-10 °C", "5 F", "50-104°F" counts 50 and 104).
 * `margins` picks dew-point margins ("3°C above the dew point") or excludes them: a margin is a
 * difference, so it can never quote an absolute air/surface temperature, and vice versa.
 */
function numbersWithUnit(text: string, unit: "F" | "C", margins: boolean): number[] {
  const out: number[] = [];
  const keep = (m: RegExpMatchArray) =>
    DEW_AFTER.test(text.slice(m.index! + m[0].length)) === margins;
  const U = String.raw`(?:°\s?|\s?deg(?:rees)?\.?\s?|\s?)${unit}(?![A-Za-z])`;
  const single = new RegExp(String.raw`(?<![\w.])(-?\d+(?:\.\d+)?)${U}`, "gi");
  for (const m of text.matchAll(single)) if (keep(m)) out.push(Number(m[1]));
  // Range whose first end borrows the unit of the second: "10-40°C", "20 to 120°F".
  const range = new RegExp(
    String.raw`(?<![\w.])(-?\d+(?:\.\d+)?)°?\s*(?:-|to|through)\s*(-?\d+(?:\.\d+)?)${U}`,
    "gi",
  );
  for (const m of text.matchAll(range)) if (keep(m)) out.push(Number(m[1]), Number(m[2]));
  return out;
}

/** True when `text` states `valueF` verbatim in °F, or its °C equivalent. */
export function textStatesTemp(text: string, valueF: number, delta: boolean): boolean {
  const t = norm(text);
  if (numbersWithUnit(t, "F", delta).some((n) => n === valueF)) return true;
  const c = delta ? (valueF * 5) / 9 : ((valueF - 32) * 5) / 9;
  // A sheet's °C may be rounded to 0 or 1 decimals; °F on the card is rounded to an integer,
  // so any °C that converts back to the same integer °F counts.
  return numbersWithUnit(t, "C", delta).some((n) => {
    const back = delta ? Math.round((n * 9) / 5) : Math.round((n * 9) / 5 + 32);
    return back === valueF || Math.abs(n - c) < 0.05;
  });
}

/**
 * Per temperature field on the card: is there a verbatim quote that states this number?
 * `null` for fields the card leaves empty (Not stated needs no quote).
 * With a Provenance map the field's own quote must state the number; with source text,
 * the number must appear on the sheet with a °F/°C unit.
 */
export function tempVerification(
  card: FieldCardData,
  evidence: Provenance | string,
): Record<TempFieldKey, boolean | null> {
  const env = card.environmentals;
  const out = {} as Record<TempFieldKey, boolean | null>;
  for (const f of TEMP_FIELDS) {
    const v = env[f.key];
    if (v == null) {
      out[f.key] = null;
      continue;
    }
    if (typeof evidence === "string") {
      out[f.key] = textStatesTemp(evidence, v, f.delta);
    } else {
      const p = evidence[f.path];
      out[f.key] =
        !!p && p !== "not-stated" && p.quote.trim() !== "" && textStatesTemp(p.quote, v, f.delta);
    }
  }
  return out;
}

/**
 * `extract.unverifiedTemps`: true when ANY temperature value on the card lacks a verbatim
 * quote stating it (°F, or its °C form). Empty fields never count. Pure; no I/O.
 */
export function computeUnverifiedTemps(
  card: FieldCardData,
  evidence: Provenance | string,
): boolean {
  return Object.values(tempVerification(card, evidence)).some((ok) => ok === false);
}
