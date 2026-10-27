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

export function sourceOf(input: { text?: string; pages?: string[] }): SourceDoc {
  const pages = input.pages?.length ? input.pages : undefined;
  return { text: pages ? pages.join("\n\n") : (input.text ?? ""), pages };
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

function q(seg: { page?: number; text: string }, at?: { start: number; end: number }): ProvenanceQuote {
  const quote = at ? windowOf(seg.text, at.start, at.end) : clip(seg.text);
  return seg.page ? { page: seg.page, quote } : { quote };
}

/**
 * The part of a line around [start, end) (the value itself), cut at word edges, at most 240 chars.
 * A long run-on line (flat pdf.js text has no line breaks) is no longer quoted from its start,
 * which put page headers and titles in front of values that were further along the line.
 */
function windowOf(text: string, start: number, end: number, before = 80, after = 60): string {
  if (text.length <= 240 && start < 240) return text;
  let a = Math.max(0, start - before);
  let b = Math.min(text.length, Math.max(end, start) + after);
  if (b - a > 240) b = a + 240;
  if (a > 0) a = text.indexOf(" ", a) + 1 || a;
  if (b < text.length) b = Math.max(text.lastIndexOf(" ", b), Math.min(end, a + 240));
  if (a > start) a = start;
  return text.slice(a, b).trim();
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

function hasTemperature(haystack: string, forms: string[]): boolean {
  const end = String.raw`(?:\s*(?:-|–|to)\s*-?\d+(?:\.\d+)?)?\s*(?:°|º|˚|deg|[FC]\b)`;
  const start = String.raw`(?:\d+(?:\.\d+)?\s*°?\s*[FC]?\s*(?:-|–|to)\s*)?`;
  for (const f of forms) {
    const re = new RegExp(String.raw`(^|[^\d.])(${start})(${f.replace(".", "\\.")})${end}`, "gi");
    for (const m of haystack.matchAll(re)) {
      const at = m.index! + m[1]!.length + m[2]!.length;
      if (!isHeaderTemp(haystack, at)) return true;
    }
  }
  // Table row under a unit column header: "˚F ˚C air and surface temp 20 to 120 -7 to 49".
  // The °F header, then the row label (words only), then the row's own °F cell, whole-number
  // matched. A header with no row label and cell after it never counts.
  const f = forms[0]!.replace(".", "\\.");
  return new RegExp(
    String.raw`[°˚º]\s*F\b(?:\s*[°˚º]\s*C\b)?\s+[A-Za-z][A-Za-z ,&/()*:\-]{0,40}?\s(?:-?\d+(?:\.\d+)?\s*(?:-|–|to)\s*)?(?<![\d.])${f}(?![\d.])`,
    "i",
  ).test(haystack.replace(/\s+/g, " "));
}

/** True when every number in `value` is present in `quote` (°C allowed for °F temp fields). */
export function quoteCoversNumbers(path: string, value: string | number, quote: string): boolean {
  const temp = TEMP_PATH.test(path) || /dewPointSpreadMinF$/.test(path);
  // A temperature needs its number printed AS a temperature (unit after it or after its range end),
  // and a dew margin needs "dew" on the line: "DFT: 5-7 mils" never backs a 5°F dew margin.
  if (temp && /dewPointSpreadMinF$/.test(path) && !/dew/i.test(quote)) return false;
  const nums = numbersIn(value);
  // The quote must state the value as the same KIND of quantity: a % limit next to "%"/RH,
  // a duration next to a time unit. "40°-95°F" never backs "RH ≤ 95%".
  if (PERCENT_PATH.test(path) && !nums.every((n) => hasPercent(quote, n))) return false;
  if (TIME_PATH.test(path) && nums.length && !hasTimeUnit(quote, nums[0]!) && !rowHeadingUnit(path, value, quote)) return false;
  return nums.every((n) =>
    temp ? hasTemperature(quote, numberForms(path, n)) : hasNumber(quote, numberForms(path, n)),
  );
}

/** Words a row label must carry to be the row for a given duration field. */
const ROW_LABEL: Array<[RegExp, RegExp]> = [
  [/(potLife|mixedPotLife)$/, /pot\s*life|working\s*time/i],
  [/recoatMin$/, /\bmin/i],
  [/recoatMax$/, /\bmax/i],
  [/\.touch$/, /touch|dry/i],
  [/\.handle$/, /handl/i],
  [/inductionTime$/, /induction|sweat/i],
];
const UNIT_HEADING = /\(\s*(?:hours?|hrs?|minutes?|mins?|days?)\s*\)/gi;
// Column-header junk that may sit between a row heading and its cells: "F˚/C˚", "90/32", "@50°F", "70 °F".
const HEADER_TOKEN = /^\s*(?:[°˚º]?[FC]\s*[°˚º]?\s*\/\s*[°˚º]?[FC]\s*[°˚º]?|@?\s*\d+(?:\.\d+)?\s*\/\s*\d+(?:\.\d+)?|@?\s*-?\d+(?:\.\d+)?\s*[°˚º]\s*[FC]?)/;

/**
 * Unit from the table ROW's own heading: "Pot life (hours) [F˚/C˚ 90/32 70/21] 2 4 6" gives the unit
 * for that row's cells. Strict: the "(unit)" must sit in the row label that names this field, and
 * every duration in the value must be one of that row's cells. A unit in a column header, another
 * row, or an "@50°F @77°F" header run never counts.
 */
export function rowHeadingUnit(path: string, value: string | number, quote: string): boolean {
  const label = ROW_LABEL.find(([p]) => p.test(path))?.[1];
  if (!label || typeof value !== "string") return false;
  const durs = [...value.matchAll(/(\d+(?:\.\d+)?(?:\s*(?:-|–|to)\s*\d+(?:\.\d+)?)?)\s*[½¼¾]?\s*(?:hours?|hrs?|minutes?|mins?|days?)\b/gi)]
    .flatMap((m) => numbersIn(m[1]!));
  if (!durs.length) return false;
  for (const m of quote.matchAll(UNIT_HEADING)) {
    // Row label = the words just before "(unit)", back to the previous cell/sentence.
    const before = quote.slice(Math.max(0, m.index! - 40), m.index!).replace(/^.*[\d.)*•]\s+/s, "");
    if (!label.test(before)) continue;
    let rest = quote.slice(m.index! + m[0].length);
    for (;;) {
      const h = HEADER_TOKEN.exec(rest);
      if (!h) break;
      rest = rest.slice(h[0].length);
    }
    const cells = new Set<string>();
    for (const t of rest.trimStart().split(/\s+/)) {
      if (/^\d+(?:\.\d+)?$/.test(t)) cells.add(t);
      else if (t !== "⁄" && t !== "/") break;
    }
    if (durs.every((d) => cells.has(d))) return true;
  }
  return false;
}

const PERCENT_PATH = /relativeHumidity(Max|Min)$/;
const TIME_PATH = /(potLife|recoatMin|recoatMax|inductionTime|\.touch|\.handle|mixedPotLife)$/;

/** "85%", "85 %", "RH 85", "85% RH", "relative humidity: 85 maximum" (adjacent, same row). */
function hasPercent(quote: string, n: string): boolean {
  const f = n.replace(".", "\\.");
  return (
    new RegExp(String.raw`(?<![\d.])(?:\d+(?:\.\d+)?\s*(?:-|–|to)\s*)?${f}\s*%`).test(quote) ||
    new RegExp(String.raw`\b(?:RH|relative\s+humidity)\b\s*[:≤<]?\s*(?:max(?:imum)?\.?\s*)?(?<![\d.])${f}(?![\d.]|\s*[°˚º]|\s*[FC]\b)`, "i").test(quote)
  );
}

/** "4 hours", "2-4 hrs", "30 min", "7 days": the number (or its range) followed by a time unit. */
function hasTimeUnit(quote: string, n: string): boolean {
  const f = n.replace(".", "\\.");
  return new RegExp(
    String.raw`(?<![\d.])${f}[½¼¾]?(?:\s*(?:-|–|to)\s*\d+(?:\.\d+)?[½¼¾]?)?\s*(?:hours?|hrs?\.?|h\b|minutes?|mins?\.?|days?|d\b|weeks?|wks?|months?|years?|yrs?)`,
    "i",
  ).test(quote);
}

const T_TOKEN = String.raw`-?\d+(?:\.\d+)?\s*[°˚º]\s*[FC]?(?:\s*\(\s*-?\d+(?:\.\d+)?\s*[°˚º]\s*[FC]\s*\))?`;

/**
 * A temperature at `idx` that is a column header, not a limit: "@"-prefixed ("@50°F @77°F"),
 * or inside a run of 2+ temperatures with no row label before the run.
 */
function isHeaderTemp(text: string, idx: number): boolean {
  if (/@\s*$/.test(text.slice(Math.max(0, idx - 3), idx))) return true;
  const run = new RegExp(String.raw`(?:${T_TOKEN}\s+)+${T_TOKEN}`, "gi");
  for (const m of text.matchAll(run)) {
    if (idx < m.index! || idx >= m.index! + m[0].length) continue;
    const before = text.slice(0, m.index!).trimEnd();
    // A row label (a word, optionally with ':' or '*') must sit right before the run.
    return !/[A-Za-z][A-Za-z*)]*:?$/.test(before);
  }
  return false;
}

/** Spaces, dash styles and degree glyphs normalized before the number check. */
function normQuote(s: string): string {
  return s
    .replace(/[\u2010-\u2015\u2212]/g, "-")
    .replace(/[\u02DA\u00BA\u2103\u2109]/g, "°")
    .replace(/\s+/g, " ");
}

/** True when the quote contains every number in the value (temps: as a temperature). */
export function quoteBacksValue(path: string, value: string | number, quote: string): boolean {
  if (!quote.trim()) return false;
  return quoteCoversNumbers(path, typeof value === "string" ? normQuote(value) : value, normQuote(quote));
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
      // A needle starting/ending with a digit must not match inside a longer number ("2 hours" in "12 hours").
      const esc = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const re = new RegExp(`${/^\d/.test(needle) ? "(?<![\\d.])" : ""}${esc}${/\d$/.test(needle) ? "(?![\\d])" : ""}`);
      for (const hit of segs) {
        const m = re.exec(normalize(hit.text));
        if (m) return q(hit, { start: m.index, end: m.index + needle.length });
      }
    }
    const want = tokens(value);
    if (want.length) {
      const hit = segs.find((s) => {
        const have = new Set(tokens(s.text));
        return want.every((t) => have.has(t)) && quoteCoversNumbers(path, value, s.text);
      });
      if (hit) {
        // Quote the span from the value's first number to its last (table cells may be spaced,
        // tab- or newline-separated), not the first 240 chars of a run-on line.
        const nums = numbersIn(value);
        const num = (n: string) => new RegExp(`(?<![\\d.])${n.replace(".", "\\.")}(?!\\d|\\.\\d)`, "g");
        if (!nums.length) return q(hit);
        // First occurrence of the value's first number whose span to its last number is short.
        let first: RegExpExecArray | null = null;
        let end = 0;
        for (const f of hit.text.matchAll(num(nums[0]!))) {
          let e = f.index! + f[0].length;
          for (const n of nums.slice(1)) {
            const m = num(n);
            m.lastIndex = e;
            const r = m.exec(hit.text);
            if (r) e = r.index + r[0].length;
          }
          if (e - f.index! <= 200) {
            first = f as RegExpExecArray;
            end = e;
            break;
          }
        }
        if (!first) return q(hit);
        const lead = hit.text.slice(Math.max(0, first.index - 60), first.index);
        const label = lead.search(/[A-Za-z][^.;]*$/);
        const startAt = label >= 0 ? Math.max(0, first.index - 60) + label : first.index;
        return q(hit, { start: startAt, end });
      }
    }
    return null;
  }
  const forms = numberForms(path, String(value));
  const key = keywordFor(path);
  // Every numeric field needs its own keyword on the same line; a bare number match is not proof.
  if (!key) return null;
  const temp = TEMP_PATH.test(path) || /dewPointSpreadMinF$/.test(path);
  // A generic "Temperature:" heading is not the substrate's own label.
  const nearKey = /substrateTemp/.test(path) ? /substrate|surface|steel/i : key;
  // Pass 1: the field's keyword sits right before the number ("Surface*: 35°F"), so the quote is
  // that field's own line. Pass 2: keyword anywhere in the quote window.
  for (const near of [true, false])
  for (const seg of segs) {
    for (const f of forms) {
      const re = new RegExp(`(^|[^\\d.])(${f.replace(".", "\\.")})(?![\\d])`, "g");
      for (const m of seg.text.matchAll(re)) {
        const start = m.index! + m[1]!.length;
        const quote = q(seg, { start, end: start + m[2]!.length });
        // The quote must carry the keyword and back the value (a temp needs its unit: "SP2" is not 2°C).
        if (near && !nearKey.test(seg.text.slice(Math.max(0, start - 24), start))) continue;
        if (key.test(quote.quote) && quoteCoversNumbers(path, value, quote.quote) && (!temp || hasTemperature(quote.quote, forms))) {
          return quote;
        }
      }
    }
  }
  // Pass 3: a table whose row label / column header sits further back in the same row block
  // ("Ambient ... Maximum 130 ° F"): quote from the nearest keyword to the value, verbatim.
  for (const seg of segs) {
    for (const f of forms) {
      const re = new RegExp(`(^|[^\\d.])(${f.replace(".", "\\.")})(?![\\d])`, "g");
      for (const m of seg.text.matchAll(re)) {
        const start = m.index! + m[1]!.length;
        const before = seg.text.slice(Math.max(0, start - 300), start);
        let kw = -1;
        for (const k of before.matchAll(new RegExp(key.source, "gi"))) kw = k.index!;
        if (kw < 0) continue;
        const from = Math.max(0, start - 300) + kw;
        const tail = seg.text.slice(start + m[2]!.length).match(/^\s*(?:°|º|˚)?\s*[FC]?\b/)?.[0] ?? "";
        const quote = seg.text.slice(from, start + m[2]!.length + tail.length).trim();
        if (quote.length <= 320 && quoteCoversNumbers(path, value, quote) && (!temp || hasTemperature(quote, forms))) {
          return seg.page ? { page: seg.page, quote } : { quote };
        }
      }
    }
  }
  return null;
}

function keywordFor(path: string): RegExp | null {
  if (/ambientTemp/.test(path)) return /ambient|air/i;
  if (/substrateTemp/.test(path)) return /substrate|surface|steel|temp/i;
  if (/relativeHumidity/.test(path)) return /humid|RH\b/i;
  if (/dewPoint/.test(path)) return /dew/i;
  if (/windMax/.test(path)) return /wind|mph/i;
  return null;
}

function clip(s: string, max = 240): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

/**
 * Is `quote` really in the sheet (whitespace, case and dash style ignored)?
 * Not used by the on-device path (its quotes are taken from the source); BE-2's Azure gate uses it.
 */
/** Is `quote` really in the sheet (whitespace, case and dash style ignored)? */
export function quoteIsVerbatim(quote: string, source: string): boolean {
  const q = normalize(quote).replace(/…$/, "");
  return q.length >= 3 && normalize(source).includes(q);
}

function hasDigit(v: string | number): boolean {
  return typeof v === "number" || /\d/.test(v);
}

/** Inferred hold points are app guidance, not sheet text, so they need no quote. */
function inferredHoldPoint(card: FieldCardData, path: string): boolean {
  const m = /^holdPoints\.(\d+)\./.exec(path);
  return Boolean(m && card.holdPoints?.[Number(m[1])]?.source === "inferred");
}

/** Blank one leaf in place: numbers become null, strings "". */
function blankAt(obj: unknown, path: string, value: string | number): void {
  const parts = path.split(".");
  let cur = obj as Record<string, unknown>;
  for (const k of parts.slice(0, -1)) cur = cur[k] as Record<string, unknown>;
  cur[parts[parts.length - 1]!] = typeof value === "number" ? null : "";
}

export type Gated = {
  card: FieldCardData;
  provenance: Provenance;
  /** How many values with numbers had no source line and were blanked. */
  dropped: number;
  /** Their paths (dot.N form). */
  droppedPaths: string[];
  /** Paths kept with quote "" (non-numeric, normalized text such as a method name). */
  unpinned: string[];
};

/**
 * The "no number without a quote" gate, for every provider (on-device here; Azure reuses it): every stated value gets a source
 * line; a value holding a number that cannot be pinned is blanked to Not stated; non-numeric text
 * that was normalized (e.g. "NACE No. 2") may keep quote "". Silent fields are not-stated.
 */
export function gateNumbers(input: FieldCardData, source: SourceDoc): Gated {
  const card = structuredClone(input);
  const provenance: Provenance = {};
  const droppedPaths: string[] = [];
  const unpinned: string[] = [];
  for (const leaf of leaves(card)) {
    if (isStructural(leaf.path) || typeof leaf.value === "boolean" || inferredHoldPoint(card, leaf.path)) continue;
    if (isEmpty(leaf.value)) {
      provenance[leaf.path] = "not-stated";
      continue;
    }
    const v = leaf.value as string | number;
    // "10 hours at 35°F": the temperature is the table's column header, not part of the row's
    // line, so the quote must contain the row's own numbers (the durations).
    const core = typeof v === "string" ? v.replace(/ at -?\d+(?:\.\d+)?°F(?=,|$)/g, "") : v;
    // The full value verbatim first; the duration-only core only when that fails.
    const full = findQuote(leaf.path, v, source);
    const useFull = !!full && (!hasDigit(v) || quoteBacksValue(leaf.path, v, full.quote));
    const found = useFull ? full : core === v ? full : findQuote(leaf.path, core, source);
    // Shared rule for every provider: a value with a number is shown only when its own quote
    // literally contains that number (spaces, dashes and degree signs normalized). Otherwise it is
    // Not stated and counted as dropped (VALUES_DROPPED_UNQUOTED; the read stays a draft).
    const hit = found && (!hasDigit(v) || quoteBacksValue(leaf.path, useFull ? v : core, found.quote)) ? found : null;
    if (hit) provenance[leaf.path] = hit;
    else if (hasDigit(v)) {
      blankAt(card, leaf.path, v);
      provenance[leaf.path] = "not-stated";
      droppedPaths.push(leaf.path);
    } else {
      provenance[leaf.path] = { quote: "" };
      unpinned.push(leaf.path);
    }
  }
  return { card, provenance, dropped: droppedPaths.length, droppedPaths, unpinned };
}

/** Provenance only (no blanking). Kept for callers that already verified the card. */
export function locateProvenance(card: FieldCardData, source: SourceDoc): Provenance {
  return gateNumbers(card, source).provenance;
}

const TEMP_FIELDS = /^environmentals\.(ambientTempM(in|ax)F|substrateTempM(in|ax)F|dewPointSpreadMinF)$/;

/**
 * Interim `unverifiedTemps` from the number gate: true if any temperature path was dropped or kept
 * with an empty quote. To be replaced by `unverified-temps.ts` (accuracy pack) when it lands.
 */
export function unverifiedTempsFromGate(provenance: Provenance, droppedPaths: string[]): boolean {
  if (droppedPaths.some((p) => TEMP_FIELDS.test(p))) return true;
  return Object.entries(provenance).some(([p, v]) => TEMP_FIELDS.test(p) && v !== "not-stated" && v.quote === "");
}
