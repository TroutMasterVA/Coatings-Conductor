/**
 * Network-facing warning codes (QA P3, Oct 30). Inside the server, runExtract keeps its internal
 * codes (tests and logs use them). Before a reply leaves the server, a provider-named code is
 * swapped for a neutral one; the original code and message go to the server log only.
 */
import type { ExtractWarning, ExtractWarningCode } from "./provider.ts";

/** Neutral code for "the server reader isn't set up here; the on-device read is shown". */
export const READER_OFF_CODE: ExtractWarningCode = "SERVER_READER_OFF";
export const READER_OFF_MESSAGE = "The server reader is off on this copy; showing the on-device read.";

const NEUTRAL: Partial<Record<string, ExtractWarning>> = {
  AZURE_NOT_CONFIGURED: { code: READER_OFF_CODE, message: READER_OFF_MESSAGE },
};

type Log = (entry: Record<string, unknown>) => void;
const defaultLog: Log = (entry) => console.info(JSON.stringify(entry));

/** Same warnings with provider-named codes swapped; logs each swapped original once per call. */
export function publicWarnings(warnings: readonly ExtractWarning[], log: Log = defaultLog): ExtractWarning[] {
  return warnings.map((w) => {
    const swap = NEUTRAL[w.code];
    if (!swap) return w;
    log({ event: "extract.warning", code: w.code, detail: w.message, sentAs: swap.code });
    return { ...swap };
  });
}

/** A reply or saved extract with its `warnings` made public. Anything without warnings is returned as is. */
export function withPublicWarnings<T>(value: T, log?: Log): T {
  if (!value || typeof value !== "object") return value;
  const w = (value as { warnings?: unknown }).warnings;
  if (!Array.isArray(w)) return value;
  return { ...value, warnings: publicWarnings(w as ExtractWarning[], log) };
}
