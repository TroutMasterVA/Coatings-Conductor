/**
 * Product title, dry film thickness, and standard-name masking for the on-device reader.
 * General rules: no sheet is special-cased. Nothing found -> "" (Not stated), never a guess.
 */

const MONTH = String.raw`(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?`;

/** Boilerplate that is never a product name; each match splits the head into segments. */
const BOILERPLATE: RegExp[] = [
  /\b(?:product|technical|safety)\s+data\s+sheet\b/gi,
  /\bdata\s+sheet\b/gi,
  /\b(?:product|technical)\s+data\b(?:\s*\/\s*application\s+instructions)?/gi,
  /\bapplication\s+instructions\b/gi,
  new RegExp(
    String.raw`\b(?:revised|revision|rev|issued?|date|ref|form)\b\.?\s*:?\s*(?:${MONTH}\s+(?:\d{1,2},?\s+)?\d{4}|[\w./-]*\d[\w./-]*)`,
    "gi",
  ),
  new RegExp(String.raw`\b${MONTH}\s+(?:\d{1,2},?\s+)?\d{4}\b`, "gi"),
  /\b(?:replaces|supersedes|includes)\b/gi,
  /\bpage\s+\d+\s*(?:of\s+\d+)?\b/gi,
  /\b(?:https?:\/\/|www\.)\S+/gi,
  /\bcontinued\s+on\s+(?:back|next\s+page)\b/gi,
  /\b(?:(?:protective|marine|industrial|performance|maintenance|architectural|automotive|aerospace|wood|floor(?:ing)?)\s*(?:&|and|\/)?\s*)+(?:coatings?|paints?)\b/gi,
  /\b(?:the\s+)?(?:sherwin-williams|carboline|ppg|international\s+paint|akzonobel|hempel|jotun|tnemec|rust-oleum|rpm)(?:\s+(?:company|inc\.?|ltd\.?|a\/s|asa))?\b(?=\s*(?:$|\n))/gim,
];

/** Where the title area ends: the first section heading, list bullet, or disclaimer. */
const HEAD_END =
  /\b(?:product\s+description|generic\s+description|description|product\s+profile|product\s+characteristics|characteristics|intended\s+uses?|recommended\s+uses?|selection\s+(?:&|and)\s+specification|to\s+the\s+best\s+of)\b|[•▪●]/i;

/** A lone category word is a tag, not the product name ("EPOXY TECHNICAL DATA …"). */
const CATEGORY_ONLY =
  /^(?:epoxy|urethane|polyurethane|primer|coating|paint|enamel|acrylic|alkyd|zinc|sealer|topcoat|mastic)s?$/i;

/** The leading product title, with data-sheet boilerplate removed. "" when nothing is left. */
export function productTitleFromText(text: string): string {
  const labelled = text.match(/\bproduct\s+name\s*:\s*([^\n]{3,80})/i);
  if (labelled) return clean(labelled[1]!);
  let head = text.slice(0, 400).replace(/[®™©]/g, " ");
  const end = head.search(HEAD_END);
  if (end >= 0) head = head.slice(0, end);
  for (const re of BOILERPLATE) head = head.replace(re, "\n");
  for (const raw of head.split(/\n|\s[—–|]\s/)) {
    const seg = clean(raw);
    if (!/[A-Za-z].*[A-Za-z].*[A-Za-z]/.test(seg)) continue;
    if (CATEGORY_ONLY.test(seg)) continue;
    if (/[\^{}$]|\(\w*date\)/i.test(seg)) continue; // template placeholders
    if (/^(?:a|an|the|this)\s/i.test(seg) || seg.split(/\s+/).length > 12) continue; // a sentence, not a title
    return seg.slice(0, 80);
  }
  return subjectProductName(text);
}

/**
 * Fallback when the title is not at the top of the text layer (big title type is often emitted
 * last by pdf.js): the brand + model code the sheet uses as the subject of its own sentences
 * ("Xyz 450H can be used as…", "Xyz 450H is not recommended…"), repeated at least 3 times.
 */
function subjectProductName(text: string): string {
  const t = text.replace(/[®™©]/g, " ").replace(/\s+/g, " ");
  const counts = new Map<string, number>();
  const re = /\b([A-Z][A-Za-z]{2,}(?:\s+(?=[A-Za-z-]*\d)[A-Z0-9][\w-]{1,12}))\s+(?:can\s+be\s+used|is\s+(?:a|an|not|designed|recommended|suitable|formulated|intended))\b/g;
  for (const m of t.matchAll(re)) counts.set(m[1]!, (counts.get(m[1]!) ?? 0) + 1);
  let best = "";
  let bestN = 0;
  for (const name of counts.keys()) {
    const n = t.split(name).length - 1;
    if (n >= 3 && n > bestN) {
      best = name;
      bestN = n;
    }
  }
  return best;
}

function clean(s: string): string {
  return s
    .replace(/[®™©]/g, " ")
    .replace(/^\s*\d+(?:\.\d+)+\s+/, "") // leading section/index number "113.08"
    .replace(/\s+\d{1,2}\/\d{2,4}\s*$/, "") // trailing issue date "5/2023"
    .replace(/^[\s:;,.—–-]+|[\s:;,.—–-]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const NUM = String.raw`\d+(?:\.\d+)?`;
const UNIT = String.raw`(?:mils?|microns?|µm|μm)`;
const VALUE = String.raw`${NUM}(?:\s*(?:[–-]|to)\s*${NUM})?\s*${UNIT}(?:\s*[([]\s*${NUM}(?:\s*(?:[–-]|to)\s*${NUM})?\s*${UNIT}\s*[)\]])?`;

/**
 * Dry film thickness, only with a thickness unit:
 * 1. a DFT / dry-film-thickness label followed by a value with mils/microns;
 * 2. a spreading-rate table's "Dry mils (microns)" row: the header unit (mils) applies to its
 *    Minimum/Maximum cells, e.g. "Dry mils (microns) 5.0* (125) 10.0 (250)" -> "5.0–10.0 mils".
 * A number after "@ 1 mil … dft" (theoretical coverage) is never a film thickness.
 */
export function filmThicknessFromText(text: string): string {
  const t = text.replace(/\s+/g, " ");
  const labelled = new RegExp(
    String.raw`\b(?:recommended\s+)?(?:dft|dry\s+film(?:\s+thickness)?|film\s+thickness,?\s+dry)\b(?:\s+per\s+coat)?\s*(?:[:\-]|of|is)?\s*(?:\(per\s+coat\)\s*)?(?:(?:minimum|min\.?|typical)\s+)?(${VALUE})`,
    "gi",
  );
  const lm = t.match(labelled);
  if (lm) return lm[0].match(new RegExp(VALUE, "i"))![0].trim();
  // "Dry mils: 2.4-4.0": the label's unit applies to a unitless range.
  const lr = t.match(
    new RegExp(
      String.raw`\bdry\s+(mils|microns|µm|μm)\s*:\s*(${NUM})\s*(?:[–-]|to)\s*(${NUM})(?![\d.])`,
      "i",
    ),
  );
  if (lr && Number(lr[2]) > 0 && Number(lr[3]) >= Number(lr[2]))
    return `${lr[2]}–${lr[3]} ${lr[1]!.toLowerCase()}`;
  const row = t.match(
    new RegExp(
      String.raw`\bdry\s+(mils|microns|µm|μm)(?:\s*\(\s*(?:mils|microns|µm|μm)\s*\))?\s+(?:min(?:imum)?\s+max(?:imum)?\s+)?(${NUM})\*?(?:\s*\(\s*${NUM}\s*\))?\s+(${NUM})\*?(?:\s*\(\s*${NUM}\s*\))?`,
      "i",
    ),
  );
  if (row) {
    const a = Number(row[2]);
    const b = Number(row[3]);
    if (a > 0 && b >= a && b < 1000) return `${row[2]}–${row[3]} ${row[1]!.toLowerCase()}`;
  }
  // "50-75 microns (2-3 mils) dry": a value followed by dft/dry, unless it is the "@ 1 mil" basis of a coverage figure.
  for (const m of t.matchAll(
    new RegExp(String.raw`(${VALUE})\s*(?:dft|dry)\b(?!\s+(?:to|times?|hard|through|film))`, "gi"),
  )) {
    if (/(?:@|\bat)\s*[^@]{0,16}$/i.test(t.slice(Math.max(0, m.index! - 18), m.index!))) continue;
    return m[1]!.trim();
  }
  return "";
}

/**
 * Standard and grade identifiers (SSPC-SP2/3, ISO8501-1:2007 St 2, NACE WJ-3L, ASTM D4541 …)
 * carry digits that are never temperatures. Replace them with "STD" before any number is read.
 */
export function maskStandards(text: string): string {
  return text
    .replace(
      /\b(?:SSPC|NACE|ISO|ASTM|ANSI|AWWA|BS|EN|DIN|SIS|ICRI|MPI|SSPC-SP|AS\/NZS)\s*[-‑]?\s*(?:[A-Z]{1,3}\s*[-‑]?\s*)?\d[\w.:‑-]*(?:\s*\/\s*(?:[A-Z]{1,3}\s*)?\d[\w.:‑-]*)*/g,
      "STD",
    )
    .replace(/\b(?:St|Sa|WJ|SP|SC|Sp)\s*[-‑]?\s*\d+(?:\.\d+|½)?L?\b(?:\s*\/\s*\d+)*/g, "STD");
}
