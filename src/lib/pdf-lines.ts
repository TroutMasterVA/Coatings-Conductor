/**
 * Rebuild reading-order text from positioned pdf.js text items. Pure: no pdf.js import,
 * so it is unit-testable. Used by pdf-text.ts.
 *
 * 1. Rows: items whose baselines sit within a fraction of the font height are one row,
 *    sorted left→right; a space goes in only where the x gap is wide enough to be one.
 * 2. Columns: within a run of rows, a vertical gutter that no item crosses, with real text
 *    (not a label/value pair or a table) on both sides, is a two-column block. The left
 *    column is emitted in full, then the right. Full-width rows (headings, paragraphs)
 *    break a block. Blocks are found recursively, so a page can switch between one and
 *    two columns, and a column can itself split once more.
 * 3. Lines are joined with "\n"; newlines are never collapsed.
 */

/** Positioned text item, in PDF user space (y grows upward; x, y = baseline start). */
export type PositionedItem = { str: string; x: number; y: number; width: number; height: number };

type Row = { y: number; h: number; items: PositionedItem[] };

/** Baselines within this fraction of the font height are on the same row. */
const ROW_TOLERANCE = 0.5;
/** A gap wider than this fraction of the font height becomes a space. */
const SPACE_GAP = 0.15;
/** Minimum rows with text on both sides of a gutter before we call it two columns. */
const MIN_SPLIT_ROWS = 3;
/** Each side's median word count must reach this, so label/value pairs and tables stay together. */
const MIN_SIDE_WORDS = 4;
/** Gutters are only looked for in the middle of the block's width. */
const GUTTER_BAND = [0.2, 0.8] as const;
/** Each side's median count of real words (2+ letters) must reach this, so number tables stay together. */
const MIN_SIDE_ALPHA_WORDS = 2;
/** One level only: nested splits inside a column were almost always tables. */
const MAX_DEPTH = 1;
/** Above this many items on a page, skip column detection (cost ≈ items × rows). */
export const MAX_SPLIT_ITEMS = 3_000;
/** Hard cap on items read per page; anything beyond is ignored (a sheet page is far below this). */
export const MAX_PAGE_ITEMS = 20_000;

/** Drop empties and the duplicate copies some PDFs draw at one spot (fake bold). */
function usable(items: PositionedItem[]): PositionedItem[] {
  const seen = new Set<string>();
  const out: PositionedItem[] = [];
  for (const it of items) {
    if (out.length >= MAX_PAGE_ITEMS) break;
    if (typeof it.str !== "string" || it.str.trim() === "") continue;
    if (!Number.isFinite(it.x) || !Number.isFinite(it.y)) continue;
    const key = `${it.str}|${Math.round(it.x)}|${Math.round(it.y)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(it);
  }
  return out;
}

function fontH(it: PositionedItem): number {
  return it.height > 0 ? it.height : 10;
}

/** Group items into rows, top of page first. */
export function groupRows(items: PositionedItem[]): Row[] {
  const sorted = usable(items).sort((a, b) => b.y - a.y || a.x - b.x);
  const rows: Row[] = [];
  let maxH = 0;
  for (const it of sorted) {
    const h = fontH(it);
    maxH = Math.max(maxH, h);
    // Items arrive top to bottom, so rows are created in descending y. Only the trailing rows
    // within ROW_TOLERANCE × the tallest font can match; scan just those (keeps this ~linear on big
    // pages) and take the earliest match, same as a full search.
    let row: Row | undefined;
    for (let k = rows.length - 1; k >= 0; k -= 1) {
      const r = rows[k]!;
      if (r.y - it.y > ROW_TOLERANCE * maxH) break;
      if (Math.abs(r.y - it.y) <= ROW_TOLERANCE * Math.min(r.h, h)) row = r;
    }
    if (row) {
      row.items.push(it);
      row.h = Math.max(row.h, h);
    } else {
      rows.push({ y: it.y, h, items: [it] });
    }
  }
  rows.sort((a, b) => b.y - a.y);
  // Superscripts / subscripts: a row of smaller text that sits inside a neighbour row's height
  // (e.g. the "2" in "ft²", "®", footnote marks) joins that neighbour instead of becoming its own line.
  // Single pass, top to bottom, building `kept`. For each row, the candidate hosts are the row just
  // below it (`rows[i + 1]`, checked first) and the last row we kept above it. Merged rows are
  // never added to `kept`, so nothing is spliced out of the list being walked.
  const hosts = (n: Row | undefined, r: Row): n is Row =>
    !!n && r.h < 0.8 * n.h && r.y > n.y - 0.35 * n.h && r.y + r.h < n.y + 1.1 * n.h;
  const kept: Row[] = [];
  for (let i = 0; i < rows.length; i += 1) {
    const r = rows[i]!;
    const below = rows[i + 1];
    const above = kept[kept.length - 1];
    const host = hosts(below, r) ? below : hosts(above, r) ? above : null;
    if (host) host.items.push(...r.items);
    else kept.push(r);
  }
  for (const r of kept) r.items.sort((a, b) => a.x - b.x);
  return kept;
}

/** One row's text: items left→right, a space only where the gap warrants one. */
export function rowText(items: PositionedItem[]): string {
  let out = "";
  let prevEnd: number | null = null;
  for (const it of [...items].sort((a, b) => a.x - b.x)) {
    const s = it.str.replace(/\s+/g, " ");
    if (prevEnd !== null) {
      const gap = it.x - prevEnd;
      const wantSpace = gap > SPACE_GAP * fontH(it) && !out.endsWith(" ") && !s.startsWith(" ");
      if (wantSpace) out += " ";
    }
    out += s;
    prevEnd = Math.max(prevEnd ?? -Infinity, it.x + Math.max(0, it.width));
  }
  return out.replace(/ {2,}/g, " ").trim();
}

function words(s: string): number {
  return s.split(/\s+/).filter(Boolean).length;
}

function alphaWords(s: string): number {
  return s.split(/\s+/).filter((w) => /[A-Za-z]{2,}/.test(w)).length;
}

function median(ns: number[]): number {
  if (!ns.length) return 0;
  const s = [...ns].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)]!;
}

const crosses = (it: PositionedItem, x: number) => it.x < x && it.x + Math.max(0, it.width) > x;

type Split = { start: number; end: number; x: number; score: number };

/** Best two-column block in these rows, or null. */
function findSplit(rows: Row[]): Split | null {
  const all = rows.flatMap((r) => r.items);
  if (all.length < 2 * MIN_SPLIT_ROWS) return null;
  // Size guard: the gutter search costs about candidates × rows. Past this many items we skip
  // column detection and keep plain top-to-bottom rows, which are still readable.
  if (all.length > MAX_SPLIT_ITEMS) return null;
  const minX = Math.min(...all.map((i) => i.x));
  const maxX = Math.max(...all.map((i) => i.x + Math.max(0, i.width)));
  const width = maxX - minX;
  if (width <= 0) return null;
  // Candidate gutters: just right of each item's end, inside the middle band.
  const lo = minX + GUTTER_BAND[0] * width;
  const hi = minX + GUTTER_BAND[1] * width;
  const candidates = [...new Set(all.map((i) => i.x + Math.max(0, i.width) + 0.5))]
    .filter((x) => x > lo && x < hi)
    .sort((a, b) => a - b);

  let best: Split | null = null;
  for (const x of candidates) {
    let start = 0;
    while (start < rows.length) {
      // Extend a run of rows that nothing crosses at x.
      let end = start;
      const leftWords: number[] = [];
      const rightWords: number[] = [];
      const leftAlpha: number[] = [];
      const rightAlpha: number[] = [];
      let both = 0;
      while (end < rows.length && !rows[end]!.items.some((it) => crosses(it, x))) {
        const left = rows[end]!.items.filter((it) => it.x + Math.max(0, it.width) <= x);
        const right = rows[end]!.items.filter((it) => it.x >= x);
        if (left.length && right.length) {
          both += 1;
          const lt = rowText(left);
          const rt = rowText(right);
          leftWords.push(words(lt));
          rightWords.push(words(rt));
          leftAlpha.push(alphaWords(lt));
          rightAlpha.push(alphaWords(rt));
        }
        end += 1;
      }
      if (
        both >= MIN_SPLIT_ROWS &&
        median(leftWords) >= MIN_SIDE_WORDS &&
        median(rightWords) >= MIN_SIDE_WORDS &&
        median(leftAlpha) >= MIN_SIDE_ALPHA_WORDS &&
        median(rightAlpha) >= MIN_SIDE_ALPHA_WORDS &&
        (!best || both > best.score)
      ) {
        best = { start, end, x, score: both };
      }
      start = end === start ? start + 1 : end;
    }
  }
  return best;
}

function rowsOf(items: PositionedItem[]): Row[] {
  return groupRows(items);
}

function layout(rows: Row[], depth: number): string[] {
  if (!rows.length) return [];
  const split = depth < MAX_DEPTH ? findSplit(rows) : null;
  if (!split) return rows.map((r) => rowText(r.items)).filter(Boolean);
  const block = rows.slice(split.start, split.end).flatMap((r) => r.items);
  const left = block.filter((it) => it.x + Math.max(0, it.width) <= split.x);
  const right = block.filter((it) => it.x >= split.x);
  return [
    ...layout(rows.slice(0, split.start), depth),
    ...layout(rowsOf(left), depth + 1),
    ...layout(rowsOf(right), depth + 1),
    ...layout(rows.slice(split.end), depth),
  ];
}

/** Lines for one page, in reading order. */
export function pageLines(items: PositionedItem[]): string[] {
  return layout(groupRows(items), 0);
}

/** One page's text: lines joined by "\n". */
export function pageText(items: PositionedItem[]): string {
  return pageLines(items).join("\n");
}

/** Raw pdf.js text item (subset). transform = [a, b, c, d, e, f]; e, f = baseline origin. */
export type PdfJsTextItem = { str?: string; transform?: number[]; width?: number; height?: number };

/** Convert pdf.js items to positioned items. Rotated text (e.g. side labels) is kept, placed by origin. */
export function fromPdfJsItems(items: readonly unknown[]): PositionedItem[] {
  const out: PositionedItem[] = [];
  for (const raw of items) {
    const it = raw as PdfJsTextItem;
    if (typeof it?.str !== "string" || !Array.isArray(it.transform) || it.transform.length < 6)
      continue;
    const [a, b, , d, e, f] = it.transform as [number, number, number, number, number, number];
    const h = it.height && it.height > 0 ? it.height : Math.hypot(b, d) || Math.abs(a) || 10;
    out.push({ str: it.str, x: e, y: f, width: it.width ?? 0, height: h });
  }
  return out;
}

/** Pages joined by a blank line (same convention as before). */
export function joinPages(pages: { page: number; text: string }[]): string {
  return pages
    .map((p) => p.text.trim())
    .filter(Boolean)
    .join("\n\n");
}
