import { notStatedFlag } from "./limit-fields.ts";
import { formatTempRange } from "./temp-range.ts";
import type { Environmentals } from "./types.ts";

/**
 * Material (product) temperature (Item 5, PO Oct 30). The sheet's material min/max is scored ONLY
 * against a reading the crew takes of the product on site. Air and surface are never used in its
 * place: no forecast or sun model knows how warm the material is.
 *
 * Rules (one helper, read by the day rows / today's line and the hourly list):
 * - not stated: never blocks; flagged "Not stated — check the sheet for material temp".
 * - stated, today, fresh reading (≤ 4 h, same site date) outside the limit: NO-GO.
 * - stated, today, no reading or a stale one: CAUTION at most.
 * - stated, any other day: GO allowed, always with "Measure material temp before mixing".
 * - stated, no valid reading, forecast air outside the material range: CAUTION with the air line;
 *   never NO-GO for this.
 */

export type MaterialLimitKey = "materialTempMinF" | "materialTempMaxF";

export const MATERIAL_LIMIT_FIELDS: ReadonlyArray<{ key: MaterialLimitKey; label: string; unit: string }> = [
  { key: "materialTempMinF", label: "Material min", unit: "°F" },
  { key: "materialTempMaxF", label: "Material max", unit: "°F" },
];

export const MATERIAL_LIMIT_LABEL: Record<MaterialLimitKey, string> = {
  materialTempMinF: "material min",
  materialTempMaxF: "material max",
};

/** Shown wherever the sheet states no material temperature. */
export const MATERIAL_NOT_STATED = notStatedFlag("material temp");
/** PO Oct 30, exact wording: every day with a stated material limit and no valid reading. */
export const MEASURE_MATERIAL_LINE = "Measure material temp before mixing";
/** PO Oct 30, exact wording: no valid reading and forecast air outside the material range. */
export const AIR_OUTSIDE_MATERIAL_LINE = "Air is outside the material range. Measure and condition material.";
/** A reading counts for this long after it is taken (PO Oct 30). */
export const MATERIAL_READING_HOURS = 4;
const READING_MS = MATERIAL_READING_HOURS * 3_600_000;
/** Clock skew allowed between the phone that stamped the reading and the scoring clock. */
const SKEW_MS = 5 * 60_000;

export type MaterialLimits = { minF: number | null; maxF: number | null };
export type MaterialReading = { valueF: number; at: string };

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** The sheet's material limits, or null when neither side is stated (absent keys = not stated). */
export function materialLimits(env: Partial<Pick<Environmentals, MaterialLimitKey>> | null | undefined): MaterialLimits | null {
  const minF = num(env?.materialTempMinF);
  const maxF = num(env?.materialTempMaxF);
  return minF == null && maxF == null ? null : { minF, maxF };
}

/** "Not stated — check the sheet for material temp" when the sheet gives no material limit. */
export function materialUnstatedFlags(env: Partial<Pick<Environmentals, MaterialLimitKey>> | null | undefined): string[] {
  return materialLimits(env) ? [] : [MATERIAL_NOT_STATED];
}

/** "at least 40°F", "40–95°F", "up to 130°F". */
export function materialRangeText(lim: MaterialLimits): string {
  return formatTempRange(lim.minF, lim.maxF);
}

/** The sheet's Normal band (info only), or null. */
export function materialNormalText(env: Partial<Environmentals> | null | undefined): string | null {
  const lo = num(env?.materialNormalTempMinF);
  const hi = num(env?.materialNormalTempMaxF);
  return lo == null && hi == null ? null : formatTempRange(lo, hi);
}

/** The saved on-site reading (value + time it was taken), or null. */
export function readingFromSite(site: { measuredMaterialTempF?: number | null; measuredMaterialAt?: string | null } | null | undefined): MaterialReading | null {
  const valueF = num(site?.measuredMaterialTempF);
  const at = site?.measuredMaterialAt;
  if (valueF == null || typeof at !== "string" || !Number.isFinite(Date.parse(at))) return null;
  return { valueF, at };
}

/** YYYY-MM-DD at the site (forecast time zone). */
export function dateKeyIn(timeZone: string, d: Date): string | null {
  try {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(d);
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
    const key = `${get("year")}-${get("month")}-${get("day")}`;
    return /^\d{4}-\d{2}-\d{2}$/.test(key) ? key : null;
  } catch {
    return null;
  }
}

/** A reading counts when it was taken within the last 4 hours, on today's site date. */
export function readingIsFresh(reading: MaterialReading | null, now: Date, timeZone: string): boolean {
  if (!reading) return false;
  const at = Date.parse(reading.at);
  const age = now.getTime() - at;
  if (!(age >= -SKEW_MS && age <= READING_MS)) return false;
  const today = dateKeyIn(timeZone, now);
  return today != null && dateKeyIn(timeZone, new Date(at)) === today;
}

/** "9:40 AM" in the site's time zone. */
export function readingTimeText(at: string, timeZone?: string): string {
  try {
    // Some ICU builds put a narrow no-break space before AM/PM; show a plain space everywhere.
    return new Date(at)
      .toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", ...(timeZone ? { timeZone } : {}) })
      .replace(/[\u202f\u00a0]/g, " ");
  } catch {
    return new Date(at).toISOString().slice(11, 16);
  }
}

export type MaterialOutcome = {
  /** What the material rule does to this hour: nothing, a caution, or a hard NO-GO. */
  effect: "none" | "caution" | "nogo";
  /** Reasons that carry the effect (caution / NO-GO), in order. */
  reasons: string[];
  /** Lines that never change the verdict but must show (measure line, not-stated flag, reading info). */
  notes: string[];
  /** For the hourly list: a check when a fresh reading was compared with the sheet. */
  check?: { status: "pass" | "fail"; reason: string };
};

/**
 * The material rule for one forecast hour. `hourDateKey` is the hour's site date; `airF` is the
 * forecast air for the hour (used only to warn, never as a reading).
 */
export function materialHour(args: {
  env: Partial<Environmentals> | null | undefined;
  reading: MaterialReading | null;
  hourDateKey: string;
  timeZone: string;
  now: Date;
  airF: number | null;
}): MaterialOutcome {
  const lim = materialLimits(args.env);
  if (!lim) return { effect: "none", reasons: [], notes: [MATERIAL_NOT_STATED] };
  const sheet = materialRangeText(lim);
  const today = dateKeyIn(args.timeZone, args.now);
  const isToday = today != null && args.hourDateKey === today;
  const fresh = isToday && readingIsFresh(args.reading, args.now, args.timeZone);
  if (fresh) {
    const v = args.reading!.valueF;
    const when = readingTimeText(args.reading!.at, args.timeZone);
    if (lim.minF != null && v < lim.minF) {
      const reason = `Material ${v}°F (measured ${when}) below sheet min ${lim.minF}°F. Condition it before mixing.`;
      return { effect: "nogo", reasons: [reason], notes: [], check: { status: "fail", reason } };
    }
    if (lim.maxF != null && v > lim.maxF) {
      const reason = `Material ${v}°F (measured ${when}) above sheet max ${lim.maxF}°F. Condition it before mixing.`;
      return { effect: "nogo", reasons: [reason], notes: [], check: { status: "fail", reason } };
    }
    const note = `Material ${v}°F (measured ${when}) within sheet ${sheet}`;
    return { effect: "none", reasons: [], notes: [note], check: { status: "pass", reason: note } };
  }
  const air = args.airF;
  const airOutside = air != null && ((lim.minF != null && air < lim.minF) || (lim.maxF != null && air > lim.maxF));
  const reasons: string[] = [];
  if (isToday) {
    reasons.push(
      args.reading
        ? `Material reading from ${readingTimeText(args.reading.at, args.timeZone)} is no longer valid (counts ${MATERIAL_READING_HOURS} hours). Sheet: ${sheet}.`
        : `Material temp not measured today. Sheet: ${sheet}.`,
    );
  }
  if (airOutside) reasons.push(AIR_OUTSIDE_MATERIAL_LINE);
  return { effect: reasons.length ? "caution" : "none", reasons, notes: [MEASURE_MATERIAL_LINE] };
}
