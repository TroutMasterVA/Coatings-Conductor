/**
 * Draft / unverified-temperature flags from an extract (FE-3).
 *
 * Contract (docs/release-beta/CONTRACT.md on #24 @ 0903985): the extract response is flat, with
 * top-level `draft?` / `unverifiedTemps?` (missing = false). The job record saves
 * `extract: toSavedExtract(result)` next to `card`, so a reopened job reads
 * `extract.draft` / `extract.unverifiedTemps`. There is no nested `extract` on the response.
 *
 * LEAD rule: anything not verified by Azure shows as a draft. On-device results, recent cards,
 * and reopened jobs with no extract (or a non-Azure one) are drafts. Built-in samples stay flag-free.
 * This is the one place the UI reads them.
 */
export const DRAFT_BANNER = "Draft — verify every number";
export const WINDOWS_PAUSED =
  "Weather windows paused: temperature limits not verified on the sheet";

export type ExtractFlags = { draft: boolean; unverifiedTemps: boolean };
export const NO_FLAGS: ExtractFlags = { draft: false, unverifiedTemps: false };

function obj(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

/** Read from an extract response, or a saved job record. Only `true` counts. Never throws. */
export function readExtractFlags(source: unknown): ExtractFlags {
  const top = obj(source);
  if (!top) return NO_FLAGS;
  const saved = obj(top.extract);
  const pick = (key: "draft" | "unverifiedTemps") => saved?.[key] === true || top[key] === true;
  return { draft: pick("draft"), unverifiedTemps: pick("unverifiedTemps") };
}

/** Fresh extract result (flat). Not from Azure → always a draft. */
export function flagsForResult(result: unknown): ExtractFlags {
  const r = obj(result);
  if (!r) return { draft: true, unverifiedTemps: true };
  return {
    draft: r.provider !== "azure" || r.draft === true,
    unverifiedTemps: r.unverifiedTemps === true,
  };
}

/**
 * Reopened job or recent card. No saved extract → draft + unverified (nothing verified it).
 * Saved non-Azure extract → draft, temps as saved.
 */
export function flagsForSaved(record: unknown): ExtractFlags {
  const x = obj(obj(record)?.extract);
  if (!x) return { draft: true, unverifiedTemps: true };
  return {
    draft: x.provider !== "azure" || x.draft === true,
    unverifiedTemps: x.unverifiedTemps === true,
  };
}

/** Headline for the printed card / PDF stand line. Paused replaces the window call. */
export function windowHeadline(
  headline: string | undefined,
  flags: ExtractFlags,
): string | undefined {
  return flags.unverifiedTemps ? WINDOWS_PAUSED : headline;
}

/** The PDF's windows page (and the screen calendar) only shows when temps are verified. */
export function showWindows(hasForecast: boolean, flags: ExtractFlags): boolean {
  return hasForecast && !flags.unverifiedTemps;
}
