import type { LimitKey } from "./limit-fields.ts";
import type { MaterialLimitKey } from "./material-temp.ts";
import type { Environmentals } from "./types.ts";
import { DEW_SPREAD_DEFAULT_F } from "./score-windows.ts";
import { describeQuote, isEditedEntry, valueAt, type ClientProvenance } from "./extract-client.ts";

/** Where a panel limit's value comes from: a hand edit, the sheet (with its quote), or nowhere. */
export type LimitSource =
  | { kind: "edited"; sheetQuote?: string }
  | { kind: "sheet"; quote?: string }
  | { kind: "unstated" };

function blank(v: unknown): boolean {
  return v == null || (typeof v === "string" && v.trim() === "");
}

/**
 * `current` = card on screen; `asRead` = card as the sheet was read (or reopened); `provenance` = that
 * read's sources, where a saved hand edit carries an `edited` stamp (server, or the guest's device).
 */
export function limitSource(
  path: string,
  current: unknown,
  asRead?: unknown,
  provenance?: ClientProvenance | null,
): LimitSource {
  const now = valueAt(current, path);
  const entry = provenance?.[path];
  const changed =
    asRead !== undefined && JSON.stringify(valueAt(asRead, path) ?? null) !== JSON.stringify(now ?? null);
  if (changed || isEditedEntry(entry)) {
    const kept = isEditedEntry(entry) && entry.sheetQuote ? describeQuote(entry.sheetQuote) : undefined;
    return blank(now) ? { kind: "unstated" } : { kind: "edited", ...(kept ? { sheetQuote: kept } : {}) };
  }
  if (blank(now)) return { kind: "unstated" };
  return entry && entry !== "not-stated" ? { kind: "sheet", quote: describeQuote(entry) } : { kind: "sheet" };
}

export const SSPC_DEW_DEFAULT_TEXT = `SSPC ${DEW_SPREAD_DEFAULT_F}°F default`;
export const USER_EDITED = "user-edited";
export const FROM_SHEET = "from sheet";

function numOrNull(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/** One numeric panel edit → the card's new environmentals (what every verdict then reads). */
export function editLimit(env: Environmentals, key: LimitKey, raw: string): Environmentals {
  return { ...env, [key]: numOrNull(raw) };
}

/** One material-limit panel edit (min or max); blank = Not stated. */
export function editMaterialLimit(env: Environmentals, key: MaterialLimitKey, raw: string): Environmentals {
  return { ...env, [key]: numOrNull(raw) };
}
