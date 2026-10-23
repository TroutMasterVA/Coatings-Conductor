/**
 * Azure claim check: runs BEFORE #24's shared `gateNumbers` (provenance.ts), which stays the
 * single source of truth for "no number without a source line". This step only adds checks on the
 * model's OWN quote, so it can only remove values, never add or rescue them:
 *  - the quote must be verbatim in the Document Intelligence text (provenance.ts quoteIsVerbatim);
 *  - it must hold every number in the value (provenance.ts quoteCoversNumbers; °C allowed for °F);
 *  - temps / dew margin need a unit and a label; wind and humidity need their label; mix ratio
 *    needs a mix/ratio label and a sane n:n;
 *  - the stored page is the page the quote is really on.
 * Seeded from BE's draft verbatim.ts (beta src-tip). No local-lookup rescue for Azure.
 */
import type { FieldCardData } from "../../types.ts";
import {
  isEmpty,
  isStructural,
  leaves,
  normalize,
  numbersIn,
  quoteCoversNumbers,
  quoteIsVerbatim,
  type SourceDoc,
} from "../provenance.ts";
import type { ProvenanceQuote } from "../provider.ts";

export type ClaimedQuote = { path: string; page: number | null; quote: string };

function quoteMatchesValue(path: string, value: string | number, quote: string): boolean {
  if (numbersIn(value).length) return quoteCoversNumbers(path, value, quote);
  const words = normalize(String(value))
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2);
  if (!words.length) return true;
  const q = normalize(quote);
  return words.filter((w) => q.includes(w)).length >= Math.ceil(words.length / 2);
}

function inferredHoldPoint(card: FieldCardData, path: string): boolean {
  const m = /^holdPoints\.(\d+)\./.exec(path);
  return Boolean(m && card.holdPoints?.[Number(m[1])]?.source === "inferred");
}

function blankAt(obj: unknown, path: string, value: string | number): void {
  const parts = path.split(".");
  let cur = obj as Record<string, unknown>;
  for (const k of parts.slice(0, -1)) cur = cur[k] as Record<string, unknown>;
  cur[parts[parts.length - 1]!] = typeof value === "number" ? null : "";
}

export type Claims = {
  /** Copy of the card with every value whose claimed quote failed blanked to Not stated. */
  card: FieldCardData;
  /** Paths whose model quote passed, with that quote and its real page. */
  verified: Map<string, ProvenanceQuote>;
  /** Paths blanked here. */
  rejected: string[];
};

export function checkClaims(
  input: FieldCardData,
  claimed: ClaimedQuote[],
  source: SourceDoc,
): Claims {
  const card = structuredClone(input);
  const byPath = new Map(claimed.map((c) => [c.path, c]));
  const verified = new Map<string, ProvenanceQuote>();
  const rejected: string[] = [];
  for (const leaf of leaves(card)) {
    if (isStructural(leaf.path) || typeof leaf.value === "boolean" || isEmpty(leaf.value)) continue;
    if (inferredHoldPoint(card, leaf.path)) continue;
    const value = leaf.value as string | number;
    const c = byPath.get(leaf.path);
    if (
      c &&
      quoteIsVerbatim(c.quote, source.text) &&
      quoteMatchesValue(leaf.path, value, c.quote) &&
      fieldQuoteOk(leaf.path, value, c.quote)
    ) {
      const page = pageOf(c.quote, source, c.page);
      verified.set(leaf.path, page ? { page, quote: c.quote.trim() } : { quote: c.quote.trim() });
    } else {
      blankAt(card, leaf.path, value);
      rejected.push(leaf.path);
    }
  }
  return { card, verified, rejected };
}

/** Temperature-limit and dew-margin card paths. */
export const TEMP_FIELD =
  /^environmentals\.(ambientTempM(in|ax)F|substrateTempM(in|ax)F|dewPointSpreadMinF)$/;

const UNIT = /°\s*[FC]\b|º\s*[FC]\b|\d\s*(deg(rees)?\.?\s*)?[FC]\b|\bdeg(rees)?\b/i;
function labelFor(path: string): RegExp {
  if (/dewPoint/.test(path)) return /dew/i;
  if (/substrate/.test(path)) return /substrate|surface|steel|metal|concrete/i;
  return /ambient|air|atmospher|temp/i;
}

/** A temperature only counts with a unit and a label in its own quote. Other fields pass. */
export function tempQuoteOk(path: string, quote: string, header = ""): boolean {
  if (!TEMP_FIELD.test(path)) return true;
  return UNIT.test(quote) && (labelFor(path).test(quote) || labelFor(path).test(header));
}

const RATIO = /(\d+(?:\.\d+)?)\s*:\s*(\d+(?:\.\d+)?)/;

/**
 * Per-field sanity on top of "verbatim and holds the number":
 *  - temps / dew margin: unit + label (see tempQuoteOk);
 *  - wind: a wind label and a speed unit; humidity: a humidity label;
 *  - mix ratio: a mix/ratio label and a sane n:n (each part 0 < n <= 100).
 */
export function fieldQuoteOk(
  path: string,
  value: string | number,
  quote: string,
  header = "",
): boolean {
  const ctx = `${quote} ${header}`;
  if (TEMP_FIELD.test(path)) return tempQuoteOk(path, quote, header);
  if (/^environmentals\.windMaxMph$/.test(path))
    return /\bwind\b/i.test(ctx) && /\b(mph|km\/h|kph|m\/s|knots?|miles per hour)\b/i.test(quote);
  if (/^environmentals\.relativeHumidityM(in|ax)$/.test(path)) return /humid|\bR\.?H\b/i.test(ctx);
  if (/^(product\.mixRatio|mixing\.ratio)$/.test(path)) {
    if (!/mix|ratio/i.test(ctx)) return false;
    const m = String(value).match(RATIO);
    if (!m) return true;
    const a = Number(m[1]),
      b = Number(m[2]);
    return a > 0 && b > 0 && a <= 100 && b <= 100;
  }
  return true;
}

/**
 * Source text plus, for quotes taken from a table row, that table's header row, so a
 * row like "| Minimum | 45°F (7°C) | 20°F (-7°C) |" can borrow its "Surface" label.
 */
export type GateSource = SourceDoc & { headerFor?: (quote: string) => string };

/** The page the quote is really on (claimed page first), when the source has pages. */
function pageOf(quote: string, source: SourceDoc, claimed: number | null): number | undefined {
  if (!source.pages) return undefined;
  const q = normalize(quote).replace(/…$/, "");
  if (claimed && source.pages[claimed - 1] && normalize(source.pages[claimed - 1]!).includes(q))
    return claimed;
  const i = source.pages.findIndex((p) => normalize(p).includes(q));
  return i >= 0 ? i + 1 : undefined;
}
