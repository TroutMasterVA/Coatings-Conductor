import type { FieldCardData } from "../types.ts";
import type { Provenance, ProvenanceQuote } from "./provider.ts";

/** Card paths that are structure or bookkeeping, not facts read from the sheet. */
const STRUCTURAL = [
  /^id$/,
  /^extractedAt$/,
  /^confidence$/,
  /^extractionNotes(\.|$)/,
  /^environmentals\.precipitationAllowed$/,
  /^holdPoints\.\d+\.(step|source|owner|timing|name)$/,
  /^surfacePrep\.prepGates\.\d+\.(family|label)$/,
];

export function isStructural(path: string): boolean {
  return STRUCTURAL.some((re) => re.test(path));
}

export type Leaf = { path: string; value: string | number | boolean | null };

/** Every scalar leaf in the card, dot paths with array indexes. */
export function leaves(obj: unknown, prefix = ""): Leaf[] {
  if (obj === null || obj === undefined) return prefix ? [{ path: prefix, value: null }] : [];
  if (Array.isArray(obj)) return obj.flatMap((v, i) => leaves(v, prefix ? `${prefix}.${i}` : String(i)));
  if (typeof obj === "object") {
    return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) =>
      leaves(v, prefix ? `${prefix}.${k}` : k),
    );
  }
  if (typeof obj === "string" || typeof obj === "number" || typeof obj === "boolean") {
    return [{ path: prefix, value: obj }];
  }
  return [];
}

export function isEmpty(v: Leaf["value"]): boolean {
  return v === null || (typeof v === "string" && v.trim() === "");
}

export function normalize(s: string): string {
  return s
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/**
 * The sheet as the provider saw it. `pages` (1-based by index) is set only when the
 * caller sent real page breaks; otherwise quotes carry no page number.
 */
export type SourceDoc = { text: string; pages?: string[] };

export function sourceOf(input: { text: string; pages?: string[] }): SourceDoc {
  const pages = input.pages?.length ? input.pages : undefined;
  return { text: pages ? pages.join("\n\n") : input.text, pages };
}

/** Sentences/lines with their page number when known. */
function segments(src: SourceDoc): { page?: number; text: string }[] {
  const out: { page?: number; text: string }[] = [];
  const chunks = src.pages ?? [src.text];
  chunks.forEach((chunk, i) => {
    for (const line of chunk.split(/\n|(?<=[.;])\s+(?=[A-Z])/)) {
      const t = line.replace(/\s+/g, " ").trim();
      if (t) out.push({ page: src.pages ? i + 1 : undefined, text: t });
    }
  });
  return out;
}

function q(seg: { page?: number; text: string }): ProvenanceQuote {
  return seg.page ? { page: seg.page, quote: clip(seg.text) } : { quote: clip(seg.text) };
}

/** Numbers that appear in a value, as strings (e.g. "2", "3", "77", "1.5"). */
export function numbersIn(v: string | number): string[] {
  if (typeof v === "number") return [String(v)];
  return [...v.matchAll(/\d+(?:\.\d+)?/g)].map((m) => m[0]);
}

const TEMP_PATH = /TempM(in|ax)F$/;

/** °F number as the sheet may have printed it: F value or rounded °C. */
function numberForms(path: string, n: string): string[] {
  const forms = [n];
  if (TEMP_PATH.test(path)) {
    const c = Math.round(((Number(n) - 32) * 5) / 9);
    forms.push(String(c));
  }
  if (/dewPointSpreadMinF$/.test(path)) {
    forms.push(String(Math.round((Number(n) * 5) / 9)));
  }
  return forms;
}

function hasNumber(haystack: string, forms: string[]): boolean {
  return forms.some((f) => new RegExp(`(^|[^\\d.])${f.replace(".", "\\.")}([^\\d]|$)`).test(haystack));
}

/** True when every number in `value` is present in `quote` (°C allowed for °F temp fields). */
export function quoteCoversNumbers(path: string, value: string | number, quote: string): boolean {
  return numbersIn(value).every((n) => hasNumber(quote, numberForms(path, n)));
}

const STOP = new Set(["no", "the", "and", "of", "or", "a", "to", "at", "by", "for", "in", "with"]);
function tokens(s: string): string[] {
  return normalize(s)
    .split(/[^a-z0-9]+/)
    .filter((t) => t && !STOP.has(t));
}

/**
 * Best source line for a value: exact text first, then a line holding all its words and numbers.
 * Returns null when nothing fits.
 */
export function findQuote(path: string, value: string | number, source: SourceDoc): ProvenanceQuote | null {
  const segs = segments(source);
  if (typeof value === "string") {
    const needle = normalize(value);
    if (needle.length >= 2) {
      const hit = segs.find((s) => normalize(s.text).includes(needle));
      if (hit) return q(hit);
    }
    const want = tokens(value);
    if (want.length) {
      const hit = segs.find((s) => {
        const have = new Set(tokens(s.text));
        return want.every((t) => have.has(t)) && quoteCoversNumbers(path, value, s.text);
      });
      if (hit) return q(hit);
    }
    return null;
  }
  const forms = numberForms(path, String(value));
  const key = keywordFor(path);
  const hits = segs.filter((s) => hasNumber(s.text, forms));
  const best = (key && hits.find((s) => key.test(s.text))) || (key ? null : hits[0]);
  return best ? q(best) : null;
}

function keywordFor(path: string): RegExp | null {
  if (/ambientTemp/.test(path)) return /ambient|air|temp|°|\bF\b|\bC\b/i;
  if (/substrateTemp/.test(path)) return /substrate|surface|steel|temp/i;
  if (/relativeHumidity/.test(path)) return /humid|RH\b/i;
  if (/dewPoint/.test(path)) return /dew/i;
  if (/windMax/.test(path)) return /wind|mph/i;
  return null;
}

function clip(s: string, max = 240): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

/** Is `quote` really in the sheet (whitespace, case and dash style ignored)? */
export function quoteIsVerbatim(quote: string, source: string): boolean {
  const q = normalize(quote).replace(/…$/, "");
  return q.length >= 3 && normalize(source).includes(q);
}

/** On-device provenance: look up a line for every stated value; silent fields are not-stated. */
export function locateProvenance(card: FieldCardData, source: SourceDoc): Provenance {
  const prov: Provenance = {};
  for (const leaf of leaves(card)) {
    if (isStructural(leaf.path) || typeof leaf.value === "boolean") continue;
    if (isEmpty(leaf.value)) {
      prov[leaf.path] = "not-stated";
      continue;
    }
    prov[leaf.path] = findQuote(leaf.path, leaf.value as string | number, source) ?? { quote: "" };
  }
  return prov;
}
