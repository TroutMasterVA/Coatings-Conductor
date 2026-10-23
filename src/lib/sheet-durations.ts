/**
 * Pot life and recoat min/max are durations read from the sheet: a number with a time unit
 * (min, h, hours, days, weeks, months, years), "none"/"unlimited"/"extended", or a table of such
 * cells (a unit header like "(hours)" applies to unitless cells). Prose only -> "" (Not stated).
 */

const UNIT = String.raw`(?:hour\(s\)|day\(s\)|minutes?|mins?\.?|hours?|hrs?\.?|h|days?|d|weeks?|wks?|months?|years?|yrs?)(?![a-z])`;
const NUM = String.raw`(?:\d+(?:\.\d+)?(?:\s+\d\/\d|\s*[¼½¾])?|[¼½¾])`;
const WORD = String.raw`(?:unlimited|none|extended|indefinite|no\s+maximum)\*?`;
const DUR = String.raw`(?:${NUM}(?:\s*(?:-|–|to)\s*${NUM})?\s*${UNIT}|${WORD})`;
/** A temperature qualifier that may sit next to a duration cell: "at 77°F (25°C)", "20°C/68°F", "@77°F". */
const TEMPQ = String.raw`(?:(?:at|@)\s*)?-?\d+(?:\.\d+)?\s*°\s*[CF](?:\s*[([/]\s*-?\d+(?:\.\d+)?\s*°?\s*[CF][)\]]?)?`;
const GLUE = String.raw`(?:\s*(?:,|;|/|and|or)?\s*)`;

const durRe = new RegExp(String.raw`^${DUR}`, "i");
const tempRe = new RegExp(String.raw`^${TEMPQ}`, "i");

function norm(t: string): string {
  return t
    .replace(/[˚º]/g, "°")
    .replace(/(\d)\s+°/g, "$1°")
    .replace(/°\s+([CF])\b/g, "°$1")
    .replace(/\s+/g, " ");
}

function cap(v: string, max = 100): string {
  const s = v.trim().replace(/[,;/\s]+$/, "");
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const sp = cut.lastIndexOf(" ");
  return (sp > 60 ? cut.slice(0, sp) : cut).trim() + "…";
}

/** Identical cells ("1 year 1 year 1 year") collapse to one. */
function collapse(cells: string[]): string {
  const uniq = [...new Set(cells.map((c) => c.toLowerCase()))];
  return uniq.length === 1 ? cells[0]! : cells.join(" / ");
}

/**
 * A run of duration cells at the start of `s` (temperature qualifiers may sit between them).
 * Returns the verbatim run, or null when `s` does not start with a duration.
 */
function durationRun(s: string): { text: string; cells: string[]; end: number } | null {
  let pos = 0;
  const cells: string[] = [];
  let lastEnd = 0;
  for (let guard = 0; guard < 24; guard++) {
    const rest = s.slice(pos);
    const glue = rest.match(new RegExp(`^${GLUE}`, "i"))![0];
    const r2 = rest.slice(glue.length);
    const d = r2.match(durRe);
    if (d) {
      cells.push(d[0].trim());
      pos += glue.length + d[0].length;
      lastEnd = pos;
      continue;
    }
    const tq = cells.length ? r2.match(tempRe) : null;
    if (tq) {
      pos += glue.length + tq[0].length;
      const rh = s.slice(pos).match(/^\s*(?:and\s+)?\d{1,3}\s*%\s*R\.?\s?H\.?/i);
      if (rh) pos += rh[0].length;
      lastEnd = pos;
      continue;
    }
    break;
  }
  return cells.length ? { text: s.slice(0, lastEnd), cells, end: lastEnd } : null;
}

/** Temperature column headers like "F˚/C˚ 90/32 70/21 50/10" or "@50°F @77°F @110°F"; returns °F values. */
function tempHeaders(s: string): { temps: number[]; end: number } {
  const m = s.match(/^\s*(?:F°\s*\/\s*C°|°F\s*\/\s*°C)?((?:\s*\d+\s*\/\s*-?\d+(?![\d.]))+)/i);
  if (m)
    return {
      temps: [...m[1]!.matchAll(/(\d+)\s*\/\s*-?\d+/g)].map((x) => Number(x[1])),
      end: m[0].length,
    };
  return { temps: [], end: 0 };
}

/** "(hours) F˚/C˚ 90/32 70/21 50/10 2 4 6": a unit header, optional temperature headers, unitless cells. */
function headerUnitRow(s: string, inheritedTemps: number[] = []): string | null {
  const h = s.match(/^\s*:?\s*\((minutes|mins?|hours|hrs?|days|weeks|months)\)/i);
  if (!h) return null;
  const unit = h[1]!
    .toLowerCase()
    .replace(/^hrs?$/, "hours")
    .replace(/^mins?$/, "minutes");
  let rest = s.slice(h[0].length);
  const th = tempHeaders(rest);
  rest = rest.slice(th.end);
  const cells = rest.match(/^(?:\s*\d+(?:\.\d+)?(?:\s+\d\s*⁄\s*\d)?(?![\d.]|\s*[°%/]))+/);
  if (!cells) return null;
  const nums = [...cells[0].matchAll(/\d+(?:\.\d+)?(?:\s+\d\s*⁄\s*\d)?/g)].map((x) =>
    x[0].replace(/\s+/g, " "),
  );
  const temps = th.temps.length ? th.temps : inheritedTemps;
  if (temps.length === nums.length)
    return nums.map((n, i) => `${n} ${unit} at ${temps[i]}°F`).join(", ");
  return nums.map((n) => `${n} ${unit}`).join(" / ");
}

/** One note instead of unlabeled numbers when a temperature row can't be paired with confidence. */
export const VARIES_BY_TEMP = "Varies by temperature, see sheet table";

/**
 * Temperature column headers printed before a table row, as °F: the LAST run of 2+ consecutive
 * temperatures ("35°F (1.7°C) 77°F (25°C) 100°F (38°C)", "-5°C (23°F) 5°C (41°F)"), with optional
 * "50% RH" cells between them. Empty when there is no such run.
 */
export function columnTemps(before: string): number[] {
  const one = String.raw`(?:(-?\d+(?:\.\d+)?)°F(?:\s*\(\s*-?\d+(?:\.\d+)?°C\s*\))?|-?\d+(?:\.\d+)?°C\s*\(\s*(-?\d+(?:\.\d+)?)°F\s*\))`;
  const runRe = new RegExp(String.raw`${one}(?:\s+${one})+`, "gi");
  let last: string | null = null;
  for (const m of before.matchAll(runRe)) last = m[0];
  if (!last) return [];
  return [...last.matchAll(new RegExp(one, "gi"))].map((m) => Number(m[1] ?? m[2]));
}

/**
 * Cells of one row ("10 hours 4 hours 2 hours") paired with column temperatures:
 * "10 hours at 35°F, 4 hours at 77°F, 2 hours at 100°F". When the counts don't match, one note.
 */
export function pairCells(cells: string[], temps: number[]): string {
  if (temps.length === cells.length) return cells.map((c, i) => `${c} at ${temps[i]}°F`).join(", ");
  return VARIES_BY_TEMP;
}

/**
 * Durations right after a label. Up to 16 characters of kit-size noise (e.g. "8 2 gallons") may sit
 * between the label and the first cell; any other text or a colon (another label) stops the search.
 */
function afterLabel(s: string, inheritedTemps: number[] = [], before = ""): string | null {
  const hu = headerUnitRow(s, inheritedTemps);
  if (hu) return hu;
  const body = s.replace(/^\s*[:\-–]?\s*/, "");
  for (let skip = 0; skip <= 16 && skip < body.length; skip++) {
    if (skip > 0 && /[:]/.test(body.slice(0, skip))) break;
    if (skip > 0 && !/\s/.test(body[skip - 1]!)) continue; // start at a word boundary
    // Only kit-size noise ("8 2 gallons") may sit in the gap; any other word belongs to another
    // label or sentence, so its duration is not this field's.
    if (
      skip > 0 &&
      !/^[\d\s¼½¾/.\-–]*(?:gallons?|gal\.?|kits?|lit(?:re|er)s?|L)?\s*$/i.test(body.slice(0, skip))
    )
      break;
    const run = durationRun(body.slice(skip));
    const distinct = run ? new Set(run.cells.map((c) => c.toLowerCase())).size : 0;
    // Several different cells with no temperature written next to them are table columns:
    // pair each with its column header, or say it varies. Never a list of unlabeled numbers.
    if (run && distinct > 1 && !/°[CF]/.test(run.text)) {
      return pairCells(run.cells, inheritedTemps.length ? inheritedTemps : columnTemps(before));
    }
    if (run)
      return cap(
        new Set(run.cells.map((c) => c.toLowerCase())).size === 1 && run.cells.length > 1
          ? collapse(run.cells)
          : run.text,
      ).replace(/\*$/, "");
  }
  return null;
}

/** Pot life / working pot life: the first labelled occurrence followed by durations. */
export function potLifeFromText(text: string): string {
  const t = norm(text);
  for (const m of t.matchAll(
    /\b(?:working\s+)?pot\s*life\b(?:\s*\((?=minutes|mins?|hours|hrs?)|\s*:?)/gi,
  )) {
    const start = m.index! + m[0].length - (m[0].endsWith("(") ? 1 : 0);
    const v = afterLabel(t.slice(start, start + 220), [], t.slice(Math.max(0, m.index! - 400), m.index!));
    if (v) return v;
  }
  return "";
}

export type Recoat = { min: string; max: string };

/**
 * Recoat window. Labelled "recoat (interval) min/max: <dur>", "minimum/maximum recoat: <dur>";
 * a "Recoat (times)" block with "minimum"/"maximum" rows of duration cells; or "Recoat <dur> to <dur>".
 */
export function recoatFromText(text: string): Recoat {
  const t = norm(text);
  const out: Recoat = { min: "", max: "" };
  const set = (k: keyof Recoat, v: string | null) => {
    if (v && !out[k]) out[k] = v;
  };
  for (const m of t.matchAll(
    /\brecoat(?:ing)?\s+(?:interval|time|window)?,?\s*(min|max)(?:imum)?\.?\s*:?/gi,
  )) {
    set(
      /min/i.test(m[1]!) ? "min" : "max",
      afterLabel(t.slice(m.index! + m[0].length, m.index! + m[0].length + 200), [], t.slice(Math.max(0, m.index! - 400), m.index!)),
    );
  }
  for (const m of t.matchAll(
    /\b(minimum|maximum)\s+recoat(?:ing)?(?:\s+(?:time|interval)s?)?\s*:?/gi,
  )) {
    set(
      /min/i.test(m[1]!) ? "min" : "max",
      afterLabel(t.slice(m.index! + m[0].length, m.index! + m[0].length + 200), [], t.slice(Math.max(0, m.index! - 400), m.index!)),
    );
  }
  for (const m of t.matchAll(/\brecoat(?:s|ing)?(?:\s+times?)?\b\s*:?/gi)) {
    const block = t.slice(m.index! + m[0].length, m.index! + m[0].length + 260);
    // "Recoat 16 hours to 1 year": a range is the window.
    const range = block.match(
      new RegExp(String.raw`^\s*(${NUM}\s*${UNIT})\s+to\s+(${NUM}\s*${UNIT}|${WORD})`, "i"),
    );
    if (range) {
      set("min", range[1]!);
      set("max", range[2]!);
      continue;
    }
    const th = tempHeaders(block);
    for (const row of block.matchAll(/\b(minimum|maximum|min\.|max\.)\s*:?/gi)) {
      // A row label must come before any sentence ends (stay inside the block).
      if (/[.!?]\s+[A-Z]/.test(block.slice(0, row.index!))) break;
      const v = afterLabel(
        block.slice(row.index! + row[0].length),
        th.temps,
        t.slice(Math.max(0, m.index! - 400), m.index! + m[0].length + row.index!),
      );
      if (v) set(/^min/i.test(row[1]!) ? "min" : "max", v);
    }
  }
  return out;
}
