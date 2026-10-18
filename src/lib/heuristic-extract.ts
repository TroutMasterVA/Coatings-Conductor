import type { Environmentals, FieldCardData, HoldPoint } from "./types";
import {
  methodsFromGates,
  parsePrepBySubstrate,
  substratesFromGates,
} from "./prep-by-substrate.ts";

function num(m: RegExpMatchArray | null, i = 1): number | null {
  if (!m?.[i]) return null;
  const n = Number(m[i].replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

/** One value never runs past its own line, and never past {@link MAX_VALUE_CHARS}. */
const MAX_VALUE_CHARS = 160;

export function capToOneLine(v: string, max = MAX_VALUE_CHARS): string {
  const line = (v.split(/\n/)[0] ?? "").replace(/\s+/g, " ").trim();
  if (line.length <= max) return line;
  const cut = line.slice(0, max);
  const sp = cut.lastIndexOf(" ");
  return (sp > max * 0.6 ? cut.slice(0, sp) : cut).trim() + "…";
}

function firstMatch(text: string, patterns: RegExp[]): string {
  for (const p of patterns) {
    const m = text.match(p);
    if (m?.[1]) return capToOneLine(m[1]);
  }
  return "";
}

function allMatches(text: string, pattern: RegExp, max = 8): string[] {
  const out: string[] = [];
  const p = new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : pattern.flags + "g");
  let m: RegExpExecArray | null;
  while ((m = p.exec(text)) && out.length < max) {
    const v = (m[1] ?? m[0]).replace(/\s+/g, " ").trim();
    if (v && !out.includes(v)) out.push(v);
  }
  return out;
}

/** A temperature *difference* (dew-point spread): 3°C apart is 5°F apart, not 37°F. */
function toDeltaF(value: number, unit: string | undefined): number {
  if (!unit || /f/i.test(unit)) return value;
  return Math.round((value * 9) / 5);
}

/** Rain is not allowed unless the sheet says it is. Forbid wins. */
function precipitationAllowedFromText(t: string): boolean {
  if (
    /do not apply.{0,80}(rain|wet|precipitation|snow|fog)|not apply.{0,40}(rain|wet|precipitation)|protect.{0,50}from rain|avoid rain|no rain/i.test(
      t,
    )
  ) {
    return false;
  }
  return /(?:may|can)\s+(?:be\s+)?appl(?:y|ied).{0,48}(rain|wet)|appl(?:y|ied).{0,24}(?:in|during|to)\s+(?:the\s+)?(?:rain|wet\s+surface)|(?:rain|wet(?:\s+surfaces?)?|precipitation)\s+(?:is\s+)?(?:allowed|permitted|acceptable)/i.test(
    t,
  );
}

/** Stated dew-point spread only — never invent 5°F from a bare dew mention. A unit is required. */
export function dewPointSpreadFromText(raw: string): number | null {
  const t = normalizeTempText(raw);
  const sane = (n: number) => (n > 0 && n <= 30 ? n : null);
  // "3°C (5°F) above the dew point" / "5°F [3°C] above": the sheet gave °F, use it.
  const paired = t.match(
    /(\d+(?:\.\d+)?)\s*°?\s*([CF])\b\s*[([]\s*(\d+(?:\.\d+)?)\s*°?\s*([CF])\b\s*[)\]]\s*(?:above|over|higher than)\s+(?:the\s+)?dew/i,
  );
  if (paired) {
    if (/f/i.test(paired[2])) return sane(Number(paired[1]));
    if (/f/i.test(paired[4])) return sane(Number(paired[3]));
  }
  const patterns: RegExp[] = [
    // "5°F above the dew point", "5°F (2.8°C) above dew point"
    /(\d+(?:\.\d+)?)\s*°?\s*([CF])\b(?:\s*[([][^)\]]{0,16}[)\]])?\s*(?:above|over|higher than)\s+(?:the\s+)?dew/i,
    // "Dew point spread 5 F minimum" / "dew-point spread: 5°F"
    /dew[\s-]?point\s+spread[:\s]+(\d+(?:\.\d+)?)\s*°?\s*([CF])\b/i,
    /(?:minimum|min\.?)\s+dew[\s-]?point\s+spread(?:\s+of)?[:\s]+(\d+(?:\.\d+)?)\s*°?\s*([CF])\b/i,
    /dew[\s-]?point\s+spread(?:\s+of)?\s+(?:at\s+least\s+)?(\d+(?:\.\d+)?)\s*°?\s*([CF])\b/i,
  ];
  for (const p of patterns) {
    const m = t.match(p);
    if (m?.[1]) return sane(toDeltaF(Number(m[1]), m[2]));
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Temperature gates                                                   */
/* ------------------------------------------------------------------ */

/** Degree glyphs (˚ º) to °, "40 ° F" to "40°F". Lengths may change; never quote from this. */
export function normalizeTempText(t: string): string {
  return t
    .replace(/[\u02DA\u00BA\u2103\u2109]/g, (c) => (c === "\u2103" ? "°C" : c === "\u2109" ? "°F" : "°"))
    .replace(/(\d)\s+°/g, "$1°")
    .replace(/°\s+([CF])\b/g, "°$1")
    .replace(/[\u2212\u2013\u2014]/g, "-");
}

type TempUnit = "F" | "C";
type TempExpr = {
  start: number;
  end: number;
  /** Values already in °F. `hi` set for a range. */
  lo: number;
  hi: number | null;
};

const NUM = String.raw`-?\d+(?:\.\d+)?`;
// "°F", "° F" (normalized), "deg F", bare " F" (no letter after).
const UNIT = String.raw`(?:°\s?|\s?deg(?:rees)?\.?\s?|\s?)([CF])(?![A-Za-z])`;
const RANGE_SEP = String.raw`\s*(?:-|to|through)\s*`;
const TEMP_RE = new RegExp(
  String.raw`(?<![\w.\-])(${NUM})(?:${UNIT}|(°))?(?:${RANGE_SEP}(${NUM})${UNIT})?`,
  "gi",
);

function unitOf(u: string | undefined): TempUnit | null {
  if (!u) return null;
  return /c/i.test(u) ? "C" : "F";
}

function cToF(n: number): number {
  return Math.round((n * 9) / 5 + 32);
}

function asF(n: number, u: TempUnit): number {
  return u === "C" ? cToF(n) : n;
}

type RawTemp = { start: number; end: number; lo: number; hi: number | null; loU: TempUnit; hiU: TempUnit | null };

/** Every unit-bearing temperature or temperature range in one clause, in order. */
function rawTemps(s: string): RawTemp[] {
  const out: RawTemp[] = [];
  TEMP_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = TEMP_RE.exec(s))) {
    const [whole, a, aU, , b, bU] = m;
    if (b !== undefined && bU) {
      // Range: each end converts by its own unit; a bare first end inherits the second unit.
      const hiU = unitOf(bU)!;
      const loU = unitOf(aU) ?? hiU;
      out.push({ start: m.index, end: m.index + whole.length, lo: Number(a), hi: Number(b), loU, hiU });
    } else if (aU) {
      out.push({ start: m.index, end: m.index + whole.length, lo: Number(a), hi: null, loU: unitOf(aU)!, hiU: null });
    }
    // A number with no °F/°C is not a temperature.
  }
  return out;
}

/** Fold "35°F (1.7°C)", "50°F / 10°C", "-10°C/14°F", "5°F [3°C]" into one value, preferring the stated °F. */
function tempsInClause(s: string): TempExpr[] {
  const raw = rawTemps(s);
  const out: TempExpr[] = [];
  for (let i = 0; i < raw.length; i++) {
    const r = raw[i];
    let group = [r];
    let end = r.end;
    const next = raw[i + 1];
    if (next) {
      const gap = s.slice(r.end, next.start);
      const sameShape = (r.hi === null) === (next.hi === null);
      if (sameShape && next.loU !== r.loU && /^\s*[([/]\s*$/.test(gap)) {
        group = [r, next];
        const close = s.slice(next.end).match(/^\s*[)\]]/);
        end = next.end + (close ? close[0].length : 0);
        i++;
      }
    }
    const f = group.find((g) => g.loU === "F" && (g.hi === null || g.hiU === "F")) ?? group[0];
    out.push({
      start: r.start,
      end,
      lo: asF(f.lo, f.loU),
      hi: f.hi === null ? null : asF(f.hi, f.hiU ?? f.loU),
    });
  }
  return out;
}

const LABEL_RE = /\b(air|ambient|surfaces?|substrates?|steel|material|paint|product)\b(?!\s*prep)/gi;
/** Words that mean a number belongs to some other quantity even if a gate label is nearby. */
const BLOCKER_RE =
  /\b(humidity|rh|pressure|pot\s*life|time|times|thickness|dry|drying|cure|curing|cured|stor(?:e|ed|age)|service|resistance|immersion|immersed|water|flash|tip|mils?|hours?|minutes?|exposure|heat|shelf|touch|handle|recoat|mixed|base|curing agent|activat\w*|accelerat\w*|thinn\w*)\b/i;
const MIN_Q = String.raw`minimum|min\.?|above|at least|not less than|down to|no lower than|≥|>`;
const MAX_Q = String.raw`maximum|max\.?|below|under|less than|not (?:to )?exceed|no higher than|up to|≤|<`;
const PRE_Q_RE = new RegExp(
  String.raw`(${MIN_Q}|${MAX_Q})\s*(?:(?:of|is|be|must be|should be|:|temperatures?)\s*)*$`,
  "i",
);
const POST_Q_RE = new RegExp(String.raw`^\s*(${MIN_Q}|${MAX_Q})(?![a-z])`, "i");

type Qual = "min" | "max";
function qualKind(q: string): Qual {
  return new RegExp(String.raw`^(?:${MIN_Q})$`, "i").test(q.trim()) ? "min" : "max";
}

type Target = "ambient" | "substrate";
type LabelHit = { targets: Target[]; ambiguous: boolean; start: number; end: number };

function targetsOf(word: string): Target | null | "other" {
  const w = word.toLowerCase();
  if (w === "air" || w === "ambient") return "ambient";
  if (w.startsWith("surface") || w.startsWith("substrate") || w === "steel") return "substrate";
  return "other";
}

/**
 * Label groups in a clause: "Air and surface", "air, surface and material".
 * Labels joined only by spaces ("Material Surface Ambient Humidity") are a table header: ambiguous.
 */
function labelGroups(s: string): LabelHit[] {
  const hits = [...s.matchAll(LABEL_RE)].map((m) => ({ w: m[1], start: m.index!, end: m.index! + m[0].length }));
  const groups: LabelHit[] = [];
  let cur: { words: string[]; seps: string[]; start: number; end: number } | null = null;
  const flush = () => {
    if (!cur) return;
    const targets = new Set<Target>();
    for (const w of cur.words) {
      const t = targetsOf(w);
      if (t === "ambient" || t === "substrate") targets.add(t);
    }
    groups.push({
      targets: [...targets],
      ambiguous: cur.seps.some((x) => /^\s+$/.test(x)),
      start: cur.start,
      end: cur.end,
    });
    cur = null;
  };
  for (const h of hits) {
    if (cur) {
      const sep = s.slice(cur.end, h.start);
      if (/^\s*(?:,|&|\/|and)?\s*(?:and\s+)?$/i.test(sep) && sep.length <= 7) {
        cur.words.push(h.w);
        cur.seps.push(sep);
        cur.end = h.end;
        continue;
      }
      flush();
    }
    cur = { words: [h.w], seps: [], start: h.start, end: h.end };
  }
  flush();
  return groups;
}

/**
 * Physical PDF lines wrap prose ("…Activator at air" / "temperatures between 50-120°F").
 * Re-join a line with the next when it ends in ":" or runs on into a lowercase continuation.
 */
export function logicalLines(t: string): string[] {
  const phys = t.split(/\n/).map((l) => l.trim()).filter(Boolean);
  const out: string[] = [];
  for (const l of phys) {
    const prev = out[out.length - 1];
    if (prev !== undefined && (/:$/.test(prev) || (!/[.;!?]$/.test(prev) && /^[a-z(]/.test(l)))) {
      out[out.length - 1] = `${prev} ${l}`;
    } else out.push(l);
  }
  return out;
}

/** Split into clauses that a gate value may not cross: logical lines, sentences, bullets, semicolons. */
function clauses(t: string): string[] {
  return logicalLines(t)
    .flatMap((l) => l.split(/;|•|(?<!\b(?:min|max|approx|no|temp|vs|e\.g|i\.e))\.\s+(?=[A-Z*(])/i))
    .map((c) => c.trim())
    .filter(Boolean);
}

export type TempGate = { target: Target; kind: Qual | "range"; lo: number; hi: number | null; quote: string };

/**
 * Air/surface temperature gates. A number counts only when it carries °F/°C AND a gate label
 * (air/ambient/surface/substrate) governs it in the same clause. Silent → nothing, never a guess.
 */
export function temperatureGates(raw: string): TempGate[] {
  const out: TempGate[] = [];
  const t = normalizeTempText(raw);
  for (const c of clauses(t)) {
    const temps = tempsInClause(c);
    if (!temps.length) continue;
    const groups = labelGroups(c);
    // Which side owns each qualifier gap: decided left to right.
    let prevConsumedPost = false;
    temps.forEach((tp, i) => {
      const gapBeforeStart = i === 0 ? 0 : temps[i - 1].end;
      const gapBefore = c.slice(gapBeforeStart, tp.start);
      const gapAfter = c.slice(tp.end, i + 1 < temps.length ? temps[i + 1].start : c.length);
      const pre = prevConsumedPost ? null : gapBefore.slice(-28).match(PRE_Q_RE);
      const post = pre ? null : gapAfter.match(POST_Q_RE);
      prevConsumedPost = !!post;

      // A dew-point margin is a difference, handled by dewPointSpreadFromText.
      if (/^\s*(?:above|over|higher than|below)?\s*(?:the\s+)?dew/i.test(gapAfter)) return;
      if (/dew[\w\s-]{0,18}$/i.test(c.slice(Math.max(0, tp.start - 20), tp.start))) return;

      // Governing label: nearest group before (≤ 80 chars), else a group right after when the clause
      // is a "Temperature: … air, surface and material" list.
      let g = [...groups].reverse().find((x) => x.end <= tp.start && tp.start - x.end <= 80);
      let between = g ? c.slice(g.end, tp.start) : "";
      if (!g && /temperature/i.test(c.slice(0, tp.start))) {
        g = groups.find((x) => x.start >= tp.end && x.start - tp.end <= 45);
        between = g ? c.slice(tp.end, g.start) : "";
      }
      if (!g || g.ambiguous || !g.targets.length) return;
      if (BLOCKER_RE.test(between)) return;
      // "if the surface temperature is 35°F to 60°F" is a condition, not the limit.
      const lead = c.slice(Math.max(0, Math.min(g.start, tp.start) - 12), tp.start);
      if (/\b(if|unless)\b/i.test(lead)) return;

      const quote = c.slice(Math.min(g.start, tp.start), Math.max(g.end, tp.end)).trim();
      const negated = /\b(?:not|never|avoid)\b/i.test(c.slice(Math.max(0, tp.start - 40), tp.start));
      for (const target of g.targets) {
        if (tp.hi !== null) {
          if (pre || post) continue; // "minimum 10-20°F" is unclear; skip.
          out.push({ target, kind: "range", lo: Math.min(tp.lo, tp.hi), hi: Math.max(tp.lo, tp.hi), quote });
        } else {
          const q = (pre ?? post)?.[1];
          if (!q) continue; // a bare temperature with no min/max is not a limit
          let kind = qualKind(q);
          if (negated && /^(above|below|under)$/i.test(q.trim())) kind = kind === "min" ? "max" : "min";
          out.push({ target, kind, lo: tp.lo, hi: null, quote });
        }
      }
    });
  }
  // Unit-column table: "Environmental conditions °F °C air and surface temp 20 to 120 -7 to 49".
  for (const m of t.matchAll(
    new RegExp(
      String.raw`°F\s*\/?\s*°C\s+((?:air|ambient|surface|substrate)(?:\s*(?:,|and|&|\/)\s*(?:air|ambient|surface|substrate))*)\s+temp(?:erature)?s?\.?\s+(${NUM})${RANGE_SEP}(${NUM})(?![\d.]|\s*°)`,
      "gi",
    ),
  )) {
    const targets = new Set<Target>();
    for (const w of m[1].split(/[^a-z]+/i)) {
      const tt = targetsOf(w);
      if (tt === "ambient" || tt === "substrate") targets.add(tt);
    }
    const lo = Number(m[2]);
    const hi = Number(m[3]);
    for (const target of targets) out.push({ target, kind: "range", lo: Math.min(lo, hi), hi: Math.max(lo, hi), quote: m[0] });
  }
  return out.filter((g) => g.lo >= -60 && g.lo <= 400 && (g.hi === null || g.hi <= 400));
}

/** First stated value wins per slot; a range fills a target only when both ends are still open. */
function applyTempGates(env: Environmentals, gates: TempGate[]): void {
  const slot = {
    ambient: ["ambientTempMinF", "ambientTempMaxF"],
    substrate: ["substrateTempMinF", "substrateTempMaxF"],
  } as const;
  for (const g of gates) {
    const [minK, maxK] = slot[g.target];
    if (g.kind === "range") {
      if (env[minK] == null && env[maxK] == null) {
        env[minK] = g.lo;
        env[maxK] = g.hi;
      }
    } else if (g.kind === "min") {
      if (env[minK] == null && (env[maxK] == null || g.lo < (env[maxK] as number))) env[minK] = g.lo;
    } else if (env[maxK] == null && (env[minK] == null || g.lo > (env[minK] as number))) {
      env[maxK] = g.lo;
    }
  }
}

/** Max RH only from a humidity-labelled phrase; a stated minimum, a cure note or a test condition is not a limit. */
export function relativeHumidityMaxFromText(t: string): number | null {
  const MAXQ = /(?:max(?:imum)?\.?|below|less than|under|not (?:to )?exceed|up to|<|≤)\s*(?:of\s+)?$/i;
  const MINQ = /(?:min(?:imum)?\.?|above|at least|over|>|≥)\s*(?:of\s+)?$/i;
  for (const c of clauses(t)) {
    if (/\b(determined|tested|test conditions?|measured|require|longer|shorter|faster|slower|accelerat\w*)\b/i.test(c)) continue;
    for (const m of c.matchAll(/\b(?:relative\s+humidity|humidity|RH)\b/gi)) {
      const from = m.index! + m[0].length;
      const after = c.slice(from, from + 48);
      // Only "levels", "must/should be", ":" etc. may sit between the label and its first value.
      const lead = after.match(/^[\s:\-–]*(?:levels?\s+|must\s+be\s+|should\s+be\s+|is\s+|shall\s+be\s+|range\s+)*/i)![0];
      for (const pm of after.matchAll(/(\d{1,3})\s*%/g)) {
        const pre = after.slice(0, pm.index!);
        const post = after.slice(pm.index! + pm[0].length);
        const n = Number(pm[1]);
        if (!(n > 0 && n <= 100)) continue;
        if (/^\s*(?:-|to)\s*\d/.test(post)) break; // a range like 40-90% is not a single max
        if (/^\s*(?:relative\s+humidity|humidity|RH)\b/i.test(post)) break; // "50% RH" table/test condition
        if (MINQ.test(pre)) continue;
        if (MAXQ.test(pre)) return n;
        if (/^\s*(?:max(?:imum)?|or less|or below)\b/i.test(post)) return n;
        if (pre.length === lead.length) return n; // "Relative humidity: 85%"
        break;
      }
    }
  }
  return null;
}

/** Mix ratio only from a sane pattern (n:n, n:n:n, "4 parts … to 1 part", by volume/weight) next to a mix label. */
export function mixRatioFromText(t: string): string {
  const RATIO = String.raw`(?<![\d.:])(\d{1,2}(?:\.\d)?)\s*:\s*(\d{1,2}(?:\.\d)?)(?:\s*:\s*(\d{1,2}(?:\.\d)?))?(?![\d.:])(?!\s*(?:mil|ft|sq|m²|m2))`;
  const PARTS = String.raw`(\d{1,2}(?:\.\d)?)\s+parts?\b[^.\d]{0,30}?\bto\s+(\d{1,2}(?:\.\d)?)\s+parts?\b(?:[^.\d]{0,20}?\(?by\s+(?:volume|weight)\)?)?`;
  const BY = String.raw`(?:\s*\(?\s*by\s+(?:volume|weight)\s*\)?)`;
  const sane = (...n: (string | undefined)[]) =>
    n.filter((x): x is string => x !== undefined).every((x) => Number(x) > 0 && Number(x) <= 20);
  const lines = logicalLines(t);
  const cl = lines.flatMap((l, i) =>
    // "Mixing ratio" alone on its line: the value is on the next line or two.
    /^\s*mix(?:ing)?\s+ratio\s*:?\s*$/i.test(l) ? [`${l} ${lines.slice(i + 1, i + 3).join(" ")}`] : clauses(l),
  );
  for (const c of cl) {
    for (const m of c.matchAll(/\b(?:mix(?:ing)?\s+ratio|ratio|combine(?:d)?\s+at|mix(?:ed)?\s+at)\b/gi)) {
      if (/pump\s*$/i.test(c.slice(Math.max(0, m.index! - 8), m.index!))) continue;
      const i0 = m.index!;
      const after = c.slice(i0 + m[0].length, i0 + m[0].length + 120);
      const before = c.slice(Math.max(0, i0 - 24), i0);
      const parts = after.slice(0, 60).match(new RegExp(PARTS, "i"));
      if (parts && sane(parts[1], parts[2])) return capToOneLine(parts[0]);
      const r = after.match(new RegExp(RATIO + BY + "?", "i"));
      if (r && sane(r[1], r[2], r[3])) {
        const near = r.index! <= 40 || /by\s+(?:volume|weight)/i.test(r[0]);
        if (near) return capToOneLine(r[0].replace(/^\(|\)$/g, ""));
      }
      // "Combine at a 1:1 ratio by volume": the ratio sits right before the label.
      const rb = before.match(new RegExp(RATIO + String.raw`\s*(?:an?\s+)?$`, "i"));
      if (rb && sane(rb[1], rb[2], rb[3])) {
        const tail = c.slice(i0 + m[0].length).match(new RegExp("^" + BY));
        return capToOneLine(rb[0].trim() + " ratio" + (tail ? tail[0] : ""));
      }
    }
  }
  return "";
}

/** Thinner only from its own labelled entry, stopping at the next label (cleaner, nozzle, …). */
export function thinnerFromText(t: string): string {
  const STOP = /\s(?:airless|cleaner|clean[\s-]?up|cleaning|equipment|nozzle|pot\s*life|work stoppages|application method|weight|voc)\b/i;
  for (const c of clauses(t)) {
    for (const m of c.matchAll(/\b(?:thinn(?:er|ers|ing)|reducer)\b(?:\s*\([^)]{0,16}\))?\s*:?\s+/gi)) {
      const prev = c.slice(Math.max(0, m.index! - 14), m.index!);
      if (/\b(?:with|of|additional|alternative|the|or|no\.\s*\d+)\s*$/i.test(prev)) continue;
      if (/\/\s*$/.test(m[0]) || /^[^:]*\/\s*clean/i.test(c.slice(m.index!, m.index! + 24))) continue;
      let v = c.slice(m.index! + m[0].length);
      const stop = v.match(STOP);
      if (stop) v = v.slice(0, stop.index);
      v = capToOneLine(v, 120);
      if (!v || /^(?:to|is|are|may|can|should|cleaner)\b/i.test(v) || /^[a-z]/.test(v) && !/^thin\b/i.test(v)) continue;
      if (v.length < 3) continue;
      return v;
    }
  }
  return "";
}

export function heuristicExtract(text: string): FieldCardData {
  const t = text.replace(/\u00a0/g, " ").replace(/\s+\n/g, "\n");
  const lines = t
    .split(/\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const name =
    firstMatch(t, [
      /product(?:\s+name)?[:\s]+([A-Z0-9][^\n]{3,80})/i,
      /^([A-Z][A-Za-z0-9][^\n]{4,60})$/m,
    ]) ||
    lines[0]?.slice(0, 80) ||
    "Unnamed product";

  const manufacturer = firstMatch(t, [
    /manufacturer[:\s]+([^\n]+)/i,
    /prepared\s+by[:\s]+([^\n]+)/i,
    /(Sherwin-Williams|PPG|Carboline|Sika|Tremco|3M|BASF|Master Builders|International Paint|Hempel|Jotun|Tnemec|AkzoNobel|Awlgrip|Rust-Oleum|Kansai|Nippon Paint|Dulux|Benjamin Moore|Valspar|Axalta|Dupont|DuPont|RPM|Carboline|Devcon|ITW|Loctite|Permatex|Henry|Pecora|Sonneborn|Euclid|Mapei|LATICRETE|Prosoco)[^\n]*/i,
  ]);

  const mixRatio = mixRatioFromText(t);

  const potLife = firstMatch(t, [/pot\s*life[:\s]+([^\n]+)/i, /working\s+time[:\s]+([^\n]+)/i]);
  const shelf = firstMatch(t, [/shelf\s*life[:\s]+([^\n]+)/i]);
  const voc = firstMatch(t, [/voc[:\s]+([^\n]+)/i]);
  const dft = firstMatch(t, [
    /(?:recommended\s+)?(?:dft|dry\s+film(?:\s+thickness)?)[:\s]+([^\n]+)/i,
    /(\d+\s*[–-]\s*\d+\s*mils?\s*(?:dft|dft)?)/i,
  ]);
  const recoatMin = firstMatch(t, [/recoat(?:ing)?\s+(?:min(?:imum)?|window)[:\s]+([^\n]+)/i, /minimum\s+recoat[:\s]+([^\n]+)/i]);
  const recoatMax = firstMatch(t, [/maximum\s+recoat[:\s]+([^\n]+)/i, /recoat(?:ing)?\s+max(?:imum)?[:\s]+([^\n]+)/i]);
  const coverage = firstMatch(t, [/coverage[:\s]+([^\n]+)/i, /theoretical\s+coverage[:\s]+([^\n]+)/i]);
  const induction = firstMatch(t, [/induction[:\s]+([^\n]+)/i, /sweat-?in[:\s]+([^\n]+)/i]);
  const thinning = thinnerFromText(t);

  const prepGates = parsePrepBySubstrate(t);
  const substrates = substratesFromGates(prepGates);
  const methodsPrep = methodsFromGates(prepGates);
  // Per-gate profiles only — never a single first-hit mil string for the whole sheet.
  const profile =
    prepGates.length === 1 && prepGates[0].profile
      ? prepGates[0].profile
      : "";

  const env: Environmentals = {
    ambientTempMinF: null,
    ambientTempMaxF: null,
    substrateTempMinF: null,
    substrateTempMaxF: null,
    relativeHumidityMax: null,
    relativeHumidityMin: null,
    dewPointSpreadMinF: null,
    precipitationAllowed: precipitationAllowedFromText(t),
    windMaxMph: num(t.match(/wind[^\n]{0,30}?(\d+)\s*(?:mph|miles)/i)),
    directSunNotes: "",
    notes: "",
    additional: [],
  };

  applyTempGates(env, temperatureGates(t));
  env.relativeHumidityMax = relativeHumidityMaxFromText(t);
  env.dewPointSpreadMinF = dewPointSpreadFromText(t);

  const storageRange = firstMatch(t, [
    /stor(?:e|age)[^\n]{0,40}?(\d+\s*°?\s*[CF][^\n]{0,20}\d+\s*°?\s*[CF])/i,
    /store(?:d)?\s+(?:indoors\s+)?at[:\s]+([^\n]+)/i,
  ]);

  const prepCriteria =
    prepGates.length > 0
      ? prepGates
          .map((g) => {
            const bits = [g.label, ...g.methods];
            if (g.profile) bits.push(`profile ${g.profile}`);
            return bits.join(": ").replace(/^([^:]+):\s*/, "$1 — ");
          })
          .join(" · ")
      : "Prep per PDS / spec";

  const holdPoints: HoldPoint[] = [
    { step: 1, name: "Material receipt", criteria: shelf ? `Unexpired (${shelf})` : "Verify batch and shelf life", owner: "QC", timing: "Before staging", source: "inferred" },
    { step: 2, name: "Storage check", criteria: storageRange || "Stored per PDS temperature and dryness", owner: "QC", timing: "Before issuing to the crew", source: "inferred" },
    { step: 3, name: "Credentials", criteria: "Applicator / inspector credentials on file", owner: "QC", timing: "Before work", source: "inferred" },
    {
      step: 4,
      name: "Surface preparation",
      criteria: prepCriteria,
      owner: "QC",
      timing: "Before coating or placement",
      source: prepGates.length ? "stated" : "inferred",
    },
    { step: 5, name: "Ambient / dew point", criteria: "In-window air, substrate, RH, dew-point spread; no precipitation", owner: "Applicator + QC", timing: "Immediately before application", source: "inferred" },
    { step: 6, name: "Mix", criteria: mixRatio ? `Ratio ${mixRatio}` : "Mix per PDS", owner: "Applicator", timing: "At combine; mark pot-life start", source: mixRatio ? "stated" : "inferred" },
    { step: 7, name: "Application", criteria: dft || "Film build / placement per PDS", owner: "Applicator + QC", timing: "During work (WFT / workmanship)", source: dft ? "stated" : "inferred" },
    { step: 8, name: "Cure / recoat", criteria: [recoatMin, recoatMax].filter(Boolean).join(" · ") || "Inside recoat window", owner: "QC", timing: "Before next coat or service", source: recoatMin ? "stated" : "inferred" },
    { step: 9, name: "Final inspection", criteria: "Acceptance tests per PDS / project spec", owner: "QC / owner", timing: "After required cure", source: "inferred" },
  ];

  const ppe = allMatches(t, /(respirator|goggles|gloves|protective clothing|eye protection|face shield|tyvek)/gi);

  const service = firstMatch(t, [
    /service[:\s]+([^\n]+)/i,
    /(?:recommended\s+)?(?:use|uses|applications?)[:\s]+([^\n]{8,120})/i,
    /(?:for\s+use\s+on|intended\s+for)[:\s]+([^\n]{8,120})/i,
  ]);

  return {
    id: crypto.randomUUID(),
    extractedAt: new Date().toISOString(),
    confidence: "low",
    extractionNotes: ["Heuristic extract only. Review every field against the PDS."],
    product: {
      name: name.slice(0, 120),
      manufacturer: manufacturer.slice(0, 120),
      productType: firstMatch(t, [/generic type[:\s]+([^\n]+)/i, /product type[:\s]+([^\n]+)/i]),
      systemRole: "",
      revision: firstMatch(t, [/rev(?:ision)?[:\s]+([^\n]+)/i]),
      documentDate: firstMatch(t, [/(?:date|issued)[:\s]+(\d{1,4}[-/]\d{1,2}[-/]\d{1,4})/i]),
      voc,
      mixRatio,
      colors: [],
      service: service.slice(0, 160),
    },
    storage: {
      temperatureRange: storageRange,
      conditions: allMatches(t, /(keep dry|protect from freeze|original container|tightly closed|fifo)/gi),
      notes: "",
    },
    shelfLife: {
      unopened: shelf,
      opened: "",
      mixedPotLife: potLife,
      notes: "",
    },
    credentials: {
      required: allMatches(t, /(NACE|AMPP|SSPC PCI|certified applicator|manufacturer train)/gi),
      notes: "",
    },
    surfacePrep: {
      substrates,
      methods: methodsPrep,
      profile,
      cleanliness: firstMatch(t, [/cleanliness[:\s]+([^\n]+)/i]),
      moisture: firstMatch(t, [/(surface must be dry[^\n]*)/i, /moisture[:\s]+([^\n]+)/i]),
      notes: "",
      prepGates,
    },
    environmentals: env,
    mixing: {
      components: firstMatch(t, [/two-component|2[- ]component|single-component|1[- ]component/i]),
      ratio: mixRatio,
      inductionTime: induction,
      potLife,
      thinning,
      notes: "",
    },
    installation: {
      methods: allMatches(t, /(airless|conventional spray|brush|roller|trowel|squeegee|caulk|plural|gun)/gi),
      filmThickness: dft,
      coverage,
      numberOfCoats: firstMatch(t, [/(?:number of )?coats?[:\s]+([^\n]+)/i]),
      sequence: [],
      notes: "",
    },
    holdPoints,
    inspection: {
      methods: allMatches(t, /(dft|wft|holiday|adhesion|sspc-pa 2|visual|pull-off)/gi),
      acceptance: [],
      documentation: "Record batch, mix time, ambients, and film thickness.",
    },
    cure: {
      touch: firstMatch(t, [/dry to touch[:\s]+([^\n]+)/i, /touch[:\s]+([^\n]+)/i]),
      handle: firstMatch(t, [/dry to handle[:\s]+([^\n]+)/i, /handle[:\s]+([^\n]+)/i]),
      recoatMin,
      recoatMax,
      fullCure: firstMatch(t, [/full cure[:\s]+([^\n]+)/i]),
      immersionService: firstMatch(t, [/immersion[:\s]+([^\n]+)/i]),
      temperatureDependence: "",
    },
    safety: {
      ppe: ppe.length ? ppe : ["See SDS"],
      ventilation: firstMatch(t, [/ventilat(?:e|ion)[:\s]+([^\n]+)/i]),
      hazards: allMatches(t, /(flammable|sensitizer|isocyanate|carcinogen|irritant)/gi),
    },
  };
}
