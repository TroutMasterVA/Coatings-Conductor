/**
 * Draft / unverified-temperature flags from an extract (FE-3).
 *
 * Contract (docs/release-beta/CONTRACT.md on #24/#26): the ok response carries
 * `extract: SavedExtract` with `draft` and `unverifiedTemps`; the job record saves it as
 * `extract` next to `card`. LEAD also allowed top-level `draft` / `unverifiedTemps` on the
 * response. Missing = false. This is the one place the UI reads them.
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
