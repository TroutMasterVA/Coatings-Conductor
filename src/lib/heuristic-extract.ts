import type { Confidence, Environmentals, FieldCardData, HoldPoint } from "./types";

function clip(s: string, n = 240) {
  return s.replace(/\s+/g, " ").trim().slice(0, n);
}

function unique(items: string[], max = 12): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of items) {
    const v = clip(raw, 240);
    if (!v) continue;
    const key = v.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(v);
    if (out.length >= max) break;
  }
  return out;
}

/** Drop a token that is already contained in a longer token (NACE No. 3 ⊂ SSPC-SP6 / NACE No. 3). */
function preferLonger(items: string[], max = 12): string[] {
  const uniq = unique(items, 24);
  const kept = uniq.filter(
    (a, i) =>
      !uniq.some(
        (b, j) => i !== j && b.length > a.length && b.toLowerCase().includes(a.toLowerCase()),
      ),
  );
  return kept.slice(0, max);
}

function toF(value: number, unit?: string | null): number {
  if (!Number.isFinite(value)) return value;
  if (unit && /^c/i.test(unit)) return Math.round((value * 9) / 5 + 32);
  return Math.round(value);
}

function firstMatch(text: string, patterns: RegExp[]): string {
  for (const p of patterns) {
    const m = text.match(p);
    const v = (m?.[1] ?? "").replace(/\s+/g, " ").trim();
    if (v) return v;
  }
  return "";
}

function allMatches(text: string, pattern: RegExp, max = 12): string[] {
  const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`;
  const p = new RegExp(pattern.source, flags);
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = p.exec(text)) && out.length < max) {
    const v = clip(m[1] ?? m[0], 160);
    if (v) out.push(v);
  }
  return unique(out, max);
}

/**
 * Read the value after a label and stop at the next field — never at a decimal point.
 * "Recoat minimum: ~3.5 hours. Recoat maximum: 14 days" → "~3.5 hours"
 */
function labeled(text: string, label: RegExp, stop?: RegExp, max = 140): string {
  if (!text) return "";
  const lab = new RegExp(`${label.source}\\s*[:.\\-–—]?\\s*`, label.flags.includes("i") ? "i" : "");
  const m = lab.exec(text);
  if (!m) return "";
  let rest = text.slice(m.index + m[0].length);
  if (stop) {
    const idx = rest.search(stop);
    if (idx >= 0) rest = rest.slice(0, idx);
  }
  const sent = rest.match(/^[\s~≈]*[\s\S]*?(?=(?:\.\s+[A-Z(])|\n|$)/);
  const v = (sent ? sent[0] : rest).replace(/^[.\s]+/, "").replace(/[.\s;]+$/, "");
  return clip(v, max);
}

function firstLabeled(text: string, labels: RegExp[], stop?: RegExp, max = 140): string {
  for (const lab of labels) {
    const v = labeled(text, lab, stop, max);
    if (v) return v;
  }
  return "";
}

type SectionId =
  | "header"
  | "storage"
  | "shelf"
  | "credentials"
  | "prep"
  | "env"
  | "mixing"
  | "install"
  | "hold"
  | "inspect"
  | "cure"
  | "safety"
  | "coverage"
  | "other";

/** True section titles only — never field labels like "Substrates:" or "pot life". */
const HEADING_MAP: { id: SectionId; pat: string }[] = [
  { id: "storage", pat: "handling\\s+and\\s+storage|storage(?:\\s+conditions?)?" },
  { id: "shelf", pat: "shelf\\s*-?life" },
  { id: "credentials", pat: "credentials?|qualifications?" },
  { id: "prep", pat: "surface\\s+prep(?:aration)?|substrate\\s+preparation" },
  { id: "env", pat: "environmental(?:\\s+conditions?)?|application\\s+conditions?|ambient\\s+conditions?|weather\\s+limits?" },
  { id: "mixing", pat: "mixing|proportioning" },
  { id: "install", pat: "installation|application\\s+procedures|application\\s+equipment|methods?\\s+of\\s+application" },
  { id: "hold", pat: "hold\\s*points?|inspection\\s+and\\s+test\\s+plan" },
  { id: "inspect", pat: "inspection|acceptance\\s+criteria" },
  { id: "cure", pat: "cure\\s+times|drying\\s+times|dry\\s+times|curing\\s+schedule|\\bcure\\b" },
  { id: "safety", pat: "health\\s+and\\s+safety|\\bsafety\\b|precautions?" },
  { id: "coverage", pat: "theoretical\\s+coverage|typical\\s+properties|product\\s+characteristics|\\bcoverage\\b|spreading\\s+rate" },
];

const CAPS_BREAKS = [
  "PRODUCT DATA SHEET",
  "PRODUCT DESCRIPTION",
  "PRODUCT CHARACTERISTICS",
  "SURFACE PREPARATION",
  "APPLICATION CONDITIONS",
  "ENVIRONMENTAL CONDITIONS",
  "APPLICATION PROCEDURES",
  "APPLICATION EQUIPMENT",
  "METHODS OF APPLICATION",
  "HEALTH AND SAFETY",
  "TYPICAL PROPERTIES",
  "RECOMMENDED USES",
  "HOLD POINTS",
  "SHELF LIFE",
  "FILM THICKNESS",
  "DRY TIMES",
  "CURE TIMES",
  "INSTALLATION",
  "CREDENTIALS",
  "INSPECTION",
  "COVERAGE",
  "MIXING",
  "STORAGE",
  "SAFETY",
  "CURE",
];

/** Insert newlines before ALL-CAPS PDS banners so flattened PDF text still sections. */
export function insertSectionBreaks(text: string): string {
  const alt = CAPS_BREAKS.map((p) => p.replace(/ /g, "\\s+")).join("|");
  return text.replace(new RegExp(`(?<!\\n)\\s+(${alt})\\b`, "g"), "\n$1");
}

function emptySections(): Record<SectionId, string> {
  return {
    header: "",
    storage: "",
    shelf: "",
    credentials: "",
    prep: "",
    env: "",
    mixing: "",
    install: "",
    hold: "",
    inspect: "",
    cure: "",
    safety: "",
    coverage: "",
    other: "",
  };
}

function isTitleLine(src: string, index: number, end: number): boolean {
  const lineStart = src.lastIndexOf("\n", Math.max(0, index)) + 1;
  const nl = src.indexOf("\n", end);
  const line = src.slice(lineStart, nl === -1 ? src.length : nl).trim();
  if (!line) return false;
  // Flattened PDFs keep the whole section on one line after a CAPS banner — still a heading.
  if (!/^\d+[.)]/.test(line)) return true;
  const body = line.replace(/^\d+[.)]\s*/, "");
  const words = body.split(/\s+/).filter(Boolean).length;
  if (words >= 4) return false;
  if (/\s+[—–-]\s+/.test(line)) return false;
  return true;
}

function splitSections(text: string): Record<SectionId, string> {
  const src = insertSectionBreaks(text);
  const hits: { id: SectionId; index: number; end: number }[] = [];
  for (const h of HEADING_MAP) {
    const re = new RegExp(`(?:^|\\n)\\s*(?:\\d+[.)]\\s*)?(?:${h.pat})\\b`, "gim");
    let m: RegExpExecArray | null;
    while ((m = re.exec(src))) {
      if (!isTitleLine(src, m.index, m.index + m[0].length)) continue;
      hits.push({ id: h.id, index: m.index, end: m.index + m[0].length });
    }
  }
  hits.sort((a, b) => a.index - b.index || b.end - a.end);
  const kept: typeof hits = [];
  let cursor = -1;
  for (const h of hits) {
    if (h.index < cursor) continue;
    kept.push(h);
    cursor = h.end;
  }
  const out = emptySections();
  if (!kept.length) {
    out.header = src;
    return out;
  }
  out.header = src.slice(0, kept[0].index);
  for (let i = 0; i < kept.length; i++) {
    const end = i + 1 < kept.length ? kept[i + 1].index : src.length;
    const chunk = src.slice(kept[i].end, end).replace(/^[:.\-–—\s]+/, "").trim();
    out[kept[i].id] = [out[kept[i].id], chunk].filter(Boolean).join("\n");
  }
  return out;
}

function around(text: string, re: RegExp, span = 1100): string {
  const m = re.exec(text);
  if (!m || m.index == null) return "";
  return text.slice(m.index, m.index + span);
}

function pick(...chunks: string[]): string {
  for (const c of chunks) {
    if (c && c.trim().length >= 20) return c;
  }
  return chunks.find((c) => c && c.trim()) ?? "";
}

function parseRange(text: string): { min: number; max: number } | null {
  const m = text.match(
    /(\d+(?:\.\d+)?)\s*°?\s*([CF])?[^\n]{0,40}?(?:to|through|–|-|—|and)\s*(\d+(?:\.\d+)?)\s*°?\s*([CF])?/i,
  );
  if (m) {
    const min = toF(Number(m[1]), m[2] || m[4]);
    const max = toF(Number(m[3]), m[4] || m[2]);
    if (Number.isFinite(min) && Number.isFinite(max)) {
      return min <= max ? { min, max } : { min: max, max: min };
    }
  }
  const deg = text.match(/(\d+(?:\.\d+)?)\s*°\s*([CF])\s+(\d+(?:\.\d+)?)\s*°\s*([CF])/i);
  if (deg) {
    const min = toF(Number(deg[1]), deg[2]);
    const max = toF(Number(deg[3]), deg[4]);
    if (Number.isFinite(min) && Number.isFinite(max)) {
      return min <= max ? { min, max } : { min: max, max: min };
    }
  }
  return null;
}

function parseMinMaxTokens(text: string): { min: number | null; max: number | null } {
  let min: number | null = null;
  let max: number | null = null;
  for (const m of text.matchAll(/(\d+(?:\.\d+)?)\s*°?\s*([CF])?\s*(?:minimum|min\.?)\b/gi)) {
    min = min ?? toF(Number(m[1]), m[2]);
  }
  for (const m of text.matchAll(/(\d+(?:\.\d+)?)\s*°?\s*([CF])?\s*(?:maximum|max\.?)\b/gi)) {
    max = max ?? toF(Number(m[1]), m[2]);
  }
  const range = parseRange(text);
  if (range && range.max - range.min >= 5) {
    min = min ?? range.min;
    max = max ?? range.max;
  }
  for (const m of text.matchAll(/(?:minimum|min\.?|not below|no lower than)[^\n]{0,48}?(\d+(?:\.\d+)?)\s*°?\s*([CF])?/gi)) {
    min = min ?? toF(Number(m[1]), m[2]);
  }
  for (const m of text.matchAll(/(?:maximum|max\.?|not exceed|no higher than|do not exceed)[^\n]{0,48}?(\d+(?:\.\d+)?)\s*°?\s*([CF])?/gi)) {
    max = max ?? toF(Number(m[1]), m[2]);
  }
  return { min, max };
}

function dewSpread(text: string): number | null {
  const patterns = [
    /(\d+(?:\.\d+)?)\s*°?\s*([CF])?\s*(?:above|over|higher than|greater than)\s+(?:the\s+)?dew/i,
    /(?:at least|minimum|min\.?|≥|>=)\s*(\d+(?:\.\d+)?)\s*°?\s*([CF])?\s*(?:above|over).{0,20}dew/i,
    /dew[^\n]{0,40}?(\d+(?:\.\d+)?)\s*°?\s*([CF])?/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m?.[1]) return toF(Number(m[1]), m[2]);
  }
  if (/dew\s*point/i.test(text) || /above dew/i.test(text) || /no condensation/i.test(text)) return 5;
  return null;
}

function classifyHold(line: string): { owner: string; timing: string } {
  if (/receipt|shelf|stor|condition(?:ing)?/i.test(line)) return { owner: "QC", timing: "Before staging" };
  if (/prep|blast|profile|soundness|geometry|backer|primer|cleanliness/i.test(line)) {
    return { owner: "QC", timing: "Before coating / placement" };
  }
  if (/ambient|dew|substrate temp/i.test(line)) {
    return { owner: "Applicator + QC", timing: "Immediately before mix / apply" };
  }
  if (/\bmix\b|pot life|ratio/i.test(line)) return { owner: "Applicator", timing: "At combine" };
  if (/stripe|wft|gun|tool|place|bond-line|profile inspection/i.test(line)) {
    return { owner: "Applicator + QC", timing: "During work" };
  }
  if (/dft|holiday|adhesion|pinhole|survey/i.test(line)) return { owner: "QC", timing: "After required cure" };
  if (/recoat|cure before|water test|load/i.test(line)) {
    return { owner: "QC", timing: "Before next coat or service" };
  }
  return { owner: "Applicator + QC", timing: "Per PDS / ITP" };
}

function parseHoldList(text: string): HoldPoint[] {
  const items: HoldPoint[] = [];
  const re =
    /(?:^|\n|;|\s{0,3})(?:\(?\d{1,2}\)?[.)]|[-–•])\s+(.+?)(?=(?:\s+\d{1,2}[.)]\s+)|\n|$)/gs;
  let m: RegExpExecArray | null;
  let step = 1;
  while ((m = re.exec(text)) && items.length < 14) {
    const line = clip(m[1], 220);
    if (line.length < 8) continue;
    if (/^nace\s+no/i.test(line) || /^\d+\s*:\s*\d+/.test(line)) continue;
    const parts = line.split(/\s+[—–-]\s+|:\s+/);
    const name = clip(parts[0], 90).replace(/[.]+$/, "");
    const criteria = parts.length > 1 ? clip(parts.slice(1).join(" — "), 200) : "";
    const { owner, timing } = classifyHold(line);
    items.push({
      step,
      name,
      criteria: criteria || line,
      owner,
      timing,
      source: "stated",
    });
    step += 1;
  }
  return items;
}

function defaultHoldPoints(ctx: {
  shelf: string;
  storage: string;
  creds: string[];
  prep: string;
  mix: string;
  dft: string;
  recoat: string;
  inspect: string;
}): HoldPoint[] {
  return [
    {
      step: 1,
      name: "Material receipt",
      criteria: ctx.shelf ? `Unexpired · ${ctx.shelf}` : "Verify batch, shelf life, and storage history",
      owner: "QC",
      timing: "Before staging",
      source: ctx.shelf ? "stated" : "inferred",
    },
    {
      step: 2,
      name: "Storage check",
      criteria: ctx.storage || "Stored per PDS temperature and dryness",
      owner: "QC",
      timing: "Before issuing to the crew",
      source: ctx.storage ? "stated" : "inferred",
    },
    {
      step: 3,
      name: "Credentials",
      criteria: ctx.creds[0] || "Applicator / inspector credentials on file per spec",
      owner: "QC",
      timing: "Before work",
      source: ctx.creds.length ? "stated" : "inferred",
    },
    {
      step: 4,
      name: "Surface preparation",
      criteria: ctx.prep || "Prep, profile, and cleanliness per PDS / spec",
      owner: "QC",
      timing: "Before coating or placement",
      source: ctx.prep ? "stated" : "inferred",
    },
    {
      step: 5,
      name: "Ambient / dew point",
      criteria: "Log air, substrate, RH, and dew-point spread at the workface. No precipitation.",
      owner: "Applicator + QC",
      timing: "Immediately before mix / apply",
      source: "inferred",
    },
    {
      step: 6,
      name: "Mix",
      criteria: ctx.mix || "Ratio, induction, and pot-life start per PDS",
      owner: "Applicator",
      timing: "At combine; mark pot-life start",
      source: ctx.mix ? "stated" : "inferred",
    },
    {
      step: 7,
      name: "Application",
      criteria: ctx.dft || "Film build / placement per PDS; stripe welds and edges when specified",
      owner: "Applicator + QC",
      timing: "During work (WFT / workmanship)",
      source: ctx.dft ? "stated" : "inferred",
    },
    {
      step: 8,
      name: "Cure / recoat",
      criteria: ctx.recoat || "Inside recoat window before next coat or service",
      owner: "QC",
      timing: "Before next coat or service",
      source: ctx.recoat ? "stated" : "inferred",
    },
    {
      step: 9,
      name: "Final inspection",
      criteria: ctx.inspect || "Acceptance tests per PDS / project spec",
      owner: "QC / owner",
      timing: "After required cure",
      source: ctx.inspect ? "stated" : "inferred",
    },
  ];
}

function titleish(s: string) {
  if (/^[A-Z0-9() /.-]{4,}$/.test(s) && s === s.toUpperCase()) {
    return s
      .toLowerCase()
      .replace(/\b([a-z])/g, (c) => c.toUpperCase())
      .replace(/\b(Sspc|Nace|Ampp|Astm|Aci|Dft|Wft|Pds|Voc|Rh)\b/g, (x) => x.toUpperCase());
  }
  return s.replace(/^[a-z]/, (c) => c.toUpperCase());
}

const MAKERS =
  "Sherwin-Williams|PPG|Carboline|Sika(?:dur)?|Tremco|3M|BASF|Master Builders|International Paint|Hempel|Jotun|Tnemec|Akzo ?Nobel|Awlgrip|Rust-Oleum|Kansai|Nippon|Dulux|Benjamin Moore|Davis-Frost|Wasser|Axxxon|Belzona|ITW|Devcon|Chockfast";

const CURE_STOP =
  /\b(?:dry\s+to\s+touch|tack-free|skins?|dry\s+to\s+handle|handle|initial\s+set|light\s+load|recoat(?:ing)?\s+(?:min|max)|minimum\s+recoat|maximum\s+recoat|recoat\s+minimum|recoat\s+maximum|full(?:\s+mechanical)?(?:\s+cure)?|immersion(?:\s+service)?)\b/i;

const MIX_STOP = /\b(?:thinning|thinner|induction|sweat-?in|pot\s*life|working\s+time|do not thin)\b/i;

function parseVoc(text: string): string {
  const labeledVoc = labeled(text, /\bVOC\b/i, /\b(?:mix|thin|reducer|pot|job spec)\b/i, 80);
  if (labeledVoc && /\d/.test(labeledVoc)) return labeledVoc;
  const qty = text.match(
    /(\d+(?:\.\d+)?\s*(?:g\/L|g\/l|lbs?\/gal)[^\n]{0,24}\bVOC\b|\bVOC\b[^\n]{0,24}\d+(?:\.\d+)?\s*(?:g\/L|g\/l|lbs?\/gal))/i,
  );
  return qty ? clip(qty[0], 80) : "";
}

function tidy(s: string): string {
  return clip(s.replace(/^[(\s]+|[)\s.;]+$/g, ""), 180);
}

function credentialLines(text: string): string[] {
  const sentences = text
    .split(/(?<=[.])\s+/)
    .map((s) => clip(s, 220))
    .filter((s) => s.length > 20);
  const hits = (sentences.length ? sentences : text.split(/\n/).map((l) => clip(l, 220))).filter((l) =>
    /nace|ampp|sspc pci|\bcip\b|certified|trained|applicator|inspector|qualification|manufacturer train|warranty/i.test(
      l,
    ),
  );
  if (hits.length) return unique(hits, 6);
  return unique(allMatches(text, /((?:NACE|AMPP|SSPC(?:\s+PCI)?|CIP)[^.\n]{8,100})/gi, 4), 4);
}

function parseSubstrates(prepT: string, header: string): string[] {
  const listed = firstMatch(prepT, [/substrates?[:]\s+([^.]+)/i]);
  const fromList = listed
    ? listed
        .split(/,|\/|;|\band\b/i)
        .map((s) => tidy(s.replace(/\([^)]*\)/g, "").replace(/\s+in sound\b.*$/i, "")))
        .filter((s) => s.length > 2)
    : [];
  const known = allMatches(
    prepT + "\n" + header,
    /(mill[\s-]?scale(?: steel)?|bare steel|carbon steel|previously coated steel|galvanized(?: steel)?|aluminum|aluminium|masonry|light painted concrete|dark painted concrete|painted concrete|concrete|wood|glass|structural steel|steel)/gi,
  );
  const materials = fromList.filter((s) =>
    /steel|concrete|wood|glass|aluminum|aluminium|masonry|galvaniz|coat|scale|metal|timber|brick/i.test(s),
  );
  return preferLonger([...(materials.length ? materials : fromList), ...known], 8).map(titleish);
}

export function heuristicExtract(text: string): FieldCardData {
  const raw = text.replace(/\u00a0/g, " ").replace(/\r/g, "").replace(/[ \t]+\n/g, "\n");
  const t = insertSectionBreaks(raw.replace(/[ \t]{2,}/g, " "));
  const sec = splitSections(t);
  const header = pick(sec.header, t.slice(0, 1600));
  const storageT = pick(sec.storage, around(t, /\bstor(?:e|age)\b/i));
  const shelfT = pick(sec.shelf, around(t, /\bshelf\s*-?life\b/i, 500));
  const credT = pick(sec.credentials, around(t, /\b(credentials?|nace|ampp|sspc pci)\b/i, 700));
  const prepT = pick(sec.prep, around(t, /\bsurface\s+prep/i));
  const envT = pick(sec.env, around(t, /\b(environmental|application conditions|dew\s*point|air and surface)\b/i));
  const mixT = pick(sec.mixing, around(t, /\bmix(?:ing)?\b/i, 800));
  const installT = pick(sec.install, around(t, /\b(installation|application|airless|coverage|dft)\b/i));
  const holdT = pick(sec.hold, around(t, /\bhold\s*points?\b/i, 1200));
  const inspectT = pick(sec.inspect, around(t, /\binspection\b/i, 700));
  const cureT = pick(sec.cure, around(t, /\b(cure|recoat|dry to touch|tack-free|skins?\s+in)\b/i, 900));
  const safetyT = pick(sec.safety, around(t, /\b(safety|ppe|respirator|sds)\b/i, 600));
  const coverageT = pick(sec.coverage, around(t, /\b(coverage|film thickness|dft)\b/i, 500));

  const name =
    firstMatch(header, [
      /product data sheet\s*[—–:\-]\s*([^\n]{4,90})/i,
      /product(?:\s+name)?[:\s]+([^\n]{3,90})/i,
    ]) ||
    t
      .split("\n")
      .map((l) => l.trim())
      .find((l) => /[A-Za-z]{4,}/.test(l) && l.length < 90 && !/product data/i.test(l))
      ?.slice(0, 90) ||
    "Unnamed product";

  const manufacturer = firstMatch(header, [
    /manufacturer[:\s]+([^\n]+)/i,
    /prepared\s+by[:\s]+([^\n]+)/i,
    new RegExp(`((?:${MAKERS})[^\\n]{0,60})`, "i"),
  ]);

  const mixRatioRaw = firstMatch(mixT, [
    /mix(?:ing)?\s+ratio[:\s]+([^\n.]+)/i,
    /ratio[:\s]+(\d+\s*:\s*\d+(?:\s*:\s*\d+)?(?:\s*by\s+(?:volume|weight))?)/i,
    /(\d+\s*:\s*\d+(?:\s*:\s*\d+)?\s*by\s+(?:volume|weight))/i,
  ]);
  const singleComp = /single[- ]component|1[- ]component|no mixing/i.test(mixT + "\n" + header);
  const mixRatio = mixRatioRaw || (singleComp ? "Single component (no mix)" : "");

  const potLife = firstLabeled(
    shelfT + "\n" + mixT,
    [/(?:mixed\s+)?pot\s*life/i, /working\s+time/i],
    MIX_STOP,
    120,
  ) || firstMatch(shelfT + "\n" + mixT, [
    /(?:approximately|approx\.?|~)\s*(\d+\s*[–-]\s*\d+\s+minutes?[^.\n]*)/i,
    /(?:approximately|approx\.?|~)\s*(\d+(?:\.\d+)?\s+hours?[^.\n]*)/i,
  ]);

  const shelf = firstMatch(shelfT, [
    /shelf\s*-?life[:\s]+([^\n.]+)/i,
    /(\d+\s+months?[^.\n]*)/i,
  ]);

  const voc = parseVoc(t);
  const dft = firstMatch(installT + "\n" + coverageT, [
    /(?:typical|recommended)?\s*(?:dft|dry\s+film(?:\s+thickness)?)[:\s]+([^\n.]+)/i,
    /(\d+(?:\.\d+)?\s*[–-]\s*\d+(?:\.\d+)?\s*mils?\s*(?:dft)?)/i,
    /(bond-line[^\n.]{0,40})/i,
    /(typical joint[:\s]+[^\n.]{0,80})/i,
  ]);
  const profile = firstMatch(prepT, [
    /(?:anchor\s+)?profile[:\s]+([^\n.]{3,60})/i,
    /(\d+(?:\.\d+)?\s*[–-]\s*\d+(?:\.\d+)?\s*mils?)/i,
  ]);
  const recoatMin = firstLabeled(
    cureT,
    [/recoat(?:ing)?\s+min(?:imum)?/i, /minimum\s+recoat/i, /recoat minimum/i],
    CURE_STOP,
    80,
  );
  const recoatMax = firstLabeled(
    cureT,
    [/recoat(?:ing)?\s+max(?:imum)?/i, /maximum\s+recoat/i, /recoat maximum/i],
    CURE_STOP,
    80,
  );
  const coverage = firstMatch(installT + "\n" + coverageT, [
    /(?:theoretical\s+)?coverage[:\s]+([^\n]+)/i,
    /(\d+\s*[–-]\s*\d+\s*(?:sq\s*ft|ft²)[^\n]{0,40})/i,
  ]);
  const induction = firstMatch(mixT, [
    /(no induction[^.\n]*)/i,
    /induction[:\s]+([^\n.]+)/i,
    /sweat-?in[:\s]+([^\n.]+)/i,
  ]);
  const thinning = firstMatch(mixT, [
    /thinn(?:ing|er)[:\s]+([^\n.]+)/i,
    /(do not thin[^.\n]*)/i,
  ]);

  const sspc = allMatches(prepT, /(SSPC[-\s]?SP\s?\d+[A-Z]?(?:\s*\/\s*NACE No\.?\s*\d+)?)/gi);
  const nace = allMatches(prepT, /(NACE(?:\s+No\.?\s*\d+|\s+SP\d+))/gi);
  const icri = allMatches(prepT, /(ICRI\s+CSP\s*\d+(?:\s*[–-]\s*\d+)?)/gi);
  const prepVerbs = allMatches(
    prepT,
    /((?:shotblast|needle scal(?:e|ing)|abrasive blast|power tool|scarif(?:y|ication)|backer rod|bond breaker)[^,\n.]{0,40})/gi,
  ).map(tidy);
  const primer = allMatches(prepT, /(primer(?:\s+where[^.\n]{0,50})?)/gi).map(tidy);
  const methodsPrep = preferLonger([...sspc, ...nace, ...icri, ...prepVerbs, ...primer]);

  const envFocus = envT;
  const env: Environmentals = {
    ambientTempMinF: null,
    ambientTempMaxF: null,
    substrateTempMinF: null,
    substrateTempMaxF: null,
    relativeHumidityMax: null,
    relativeHumidityMin: null,
    dewPointSpreadMinF: dewSpread(envT) ?? dewSpread(t),
    precipitationAllowed: !/(do not apply.{0,50}(rain|wet|precip|snow|fog)|protect.{0,30}rain|no precipitation|dry (?:only|substrate)|not apply to wet|avoid rain)/i.test(
      envT || t,
    ),
    windMaxMph: (() => {
      const m =
        envFocus.match(/wind[^\n]{0,70}?(\d+)\s*(?:mph|miles)/i) ||
        t.match(/(\d+)\s*mph[^\n]{0,20}(?:spray|wind|overspray)/i);
      return m ? Number(m[1]) : null;
    })(),
    directSunNotes: /sun|solar|direct sunlight/i.test(t)
      ? "Sun can drive substrate above air — measure the workface."
      : "",
    notes: clip(
      firstMatch(envFocus, [/^(.*dew[^\n]{0,80})/im, /^(.*temperature[^\n]{0,80})/im]),
      280,
    ),
    additional: [],
  };

  const airChunk = firstMatch(envFocus, [
    /air[^\n]{0,80}/i,
    /ambient[^\n]{0,80}/i,
    /application temperature[^\n]{0,80}/i,
    /air and surface[^\n]{0,120}/i,
  ]);
  const subChunk = firstMatch(envFocus, [/(?:surface|substrate|steel)[^\n]{0,100}/i]);
  const airMM = parseMinMaxTokens(airChunk || envFocus);
  const subMM = parseMinMaxTokens(subChunk);
  const allMM = parseMinMaxTokens(envFocus);

  env.ambientTempMinF = airMM.min ?? allMM.min;
  env.ambientTempMaxF = airMM.max ?? allMM.max;
  env.substrateTempMinF = subMM.min ?? env.ambientTempMinF;
  env.substrateTempMaxF = subMM.max ?? env.ambientTempMaxF;

  const rhMax = envFocus.match(/(?:relative humidity|rh)[^\n]{0,40}?(\d+)\s*%/i);
  if (rhMax && !/no (?:stated |hard )?cap|no maximum|no hard cap/i.test(envFocus)) {
    env.relativeHumidityMax = Number(rhMax[1]);
  }
  const rhMin = envFocus.match(/(?:relative humidity|rh)[^\n]{0,24}(?:min(?:imum)?|≥|at least)\s*(\d+)\s*%/i);
  if (rhMin) env.relativeHumidityMin = Number(rhMin[1]);

  const storageRange =
    firstMatch(sec.storage || storageT, [
      /stor(?:e|age)[^\n]{0,50}?(\d+\s*°?\s*[CF][^\n]{0,36}\d+\s*°?\s*[CF]\)?)/i,
      /(\d+\s*°?\s*[CF]\s*[–-]\s*\d+\s*°?\s*[CF])/i,
      /store(?:d)?[^\n]{0,20}at[:\s]+([^\n]+)/i,
    ]) ||
    (() => {
      const r = parseRange(sec.storage || storageT);
      return r ? `${r.min}–${r.max}°F` : "";
    })();

  const storageConditions = unique([
    ...allMatches(
      sec.storage || storageT,
      /(keep dry|protect from freez\w*|original(?: unopened)? containers?|tightly closed|fifo|do not freeze|rotate stock|do not open until[^.\n]*)/gi,
    ),
  ]);

  const creds = credentialLines(credT);
  const substrates = parseSubstrates(prepT, header);

  const methodsInstall = unique(
    allMatches(
      installT,
      /(airless(?: spray)?|conventional spray|plural(?:-component)?|brush|roller|trowel|squeegee|gloved hand|caulk(?:-style)?|gun(?:ning)?)/gi,
    ),
  ).map(titleish);

  const inspectMethods = preferLonger(
    allMatches(
      inspectT,
      /(SSPC-PA\s*2|ASTM\s+D\d+(?:\s*\/\s*D\d+)?|NACE\s+SP\d+|holiday(?: detection)?|adhesion(?: field tests?)?|WFT(?:\s+gauge)?|DFT|visual(?: mix(?: uniformity)?)?|pull-?off|sounding|field pull|joint factor|proof-?load)/gi,
    ),
  );

  const ppe = unique(
    allMatches(
      safetyT,
      /(respirator[^,\n]{0,40}|goggles|gloves|protective clothing|eye protection|face shield|long sleeves|tyvek|chemical goggles)/gi,
    ),
  );
  const hazards = unique(
    allMatches(safetyT, /(flammable[^,\n.]{0,40}|sensitizer|isocyanate|carcinogen|irritant|solvent)/gi),
  );

  const statedHold = parseHoldList(holdT);
  const inspectLine = inspectMethods.slice(0, 4).join(" · ");
  const holdPoints =
    statedHold.length >= 4
      ? statedHold
      : defaultHoldPoints({
          shelf,
          storage: storageRange,
          creds,
          prep: [...methodsPrep, profile].filter(Boolean).join(" · "),
          mix: [mixRatio, potLife].filter(Boolean).join(" · "),
          dft,
          recoat: [recoatMin, recoatMax].filter(Boolean).join(" · "),
          inspect: inspectLine,
        });

  const components = firstMatch(mixT + "\n" + header, [
    /(two-component|2[- ]component|single-component|1[- ]component|100%\s*solids)/i,
  ]);

  const skin = labeled(cureT, /\bskins?\b/i, CURE_STOP, 80);
  const tack = labeled(cureT, /tack-free/i, CURE_STOP, 80);
  const dryTouch = firstLabeled(cureT, [/dry\s+to\s+touch/i, /\btouch\b/i], CURE_STOP, 80);
  const dryHandle = firstLabeled(cureT, [/dry\s+to\s+handle/i, /\bhandle\b/i], CURE_STOP, 80);
  const initialSet = labeled(cureT, /initial\s+set/i, CURE_STOP, 80);
  const lightLoad = labeled(cureT, /light\s+load/i, CURE_STOP, 80);
  const touch = dryTouch || (skin ? (/skin/i.test(skin) ? skin : clip(`Skins ${skin}`, 80)) : "") || tack;
  const handle = dryHandle || initialSet || lightLoad || (skin && tack ? tack : "");
  const fullCure = firstLabeled(
    cureT,
    [/full\s+mechanical(?:\s+cure)?/i, /full\s+cure/i],
    CURE_STOP,
    100,
  );
  const immersionService = firstLabeled(cureT, [/immersion(?:\s+service)?/i], CURE_STOP, 140);

  let filled = 0;
  if (name && !/^unnamed/i.test(name)) filled += 1;
  if (manufacturer) filled += 1;
  if (env.ambientTempMinF != null || env.ambientTempMaxF != null) filled += 1;
  if (env.dewPointSpreadMinF != null) filled += 1;
  if (mixRatio || potLife) filled += 1;
  if (methodsPrep.length || profile) filled += 1;
  if (shelf) filled += 1;
  if (dft || methodsInstall.length) filled += 1;
  if (statedHold.length >= 4 || touch || fullCure) filled += 1;
  const confidence: Confidence = filled >= 7 ? "high" : filled >= 4 ? "medium" : "low";

  const missing: string[] = [];
  if (env.ambientTempMinF == null && env.ambientTempMaxF == null) missing.push("air/surface temperature window");
  if (!mixRatio) missing.push("mix ratio");
  if (!dft) missing.push("film thickness");
  const notes = [
    "Local PDS parser — no AI credits used. Confirm every number against the current manufacturer revision and the project spec.",
  ];
  if (missing.length) notes.push(`Weak or missing: ${missing.join(", ")}.`);

  const opened = firstMatch(shelfT, [/(?<!un)opened[:\s]+([^\n.]+)/i]);

  return {
    id: crypto.randomUUID(),
    extractedAt: new Date().toISOString(),
    confidence,
    extractionNotes: notes,
    product: {
      name: clip(name, 120),
      manufacturer: clip(manufacturer, 120),
      productType: clip(
        firstMatch(header, [/generic type[:\s]+([^\n]+)/i, /product type[:\s]+([^\n]+)/i]),
        160,
      ),
      systemRole: clip(firstMatch(header, [/system[:\s]+([^\n]+)/i]), 120),
      revision: clip(firstMatch(header, [/rev(?:ision)?[:\s]+([^\n]+)/i]), 80),
      documentDate: firstMatch(header, [/(?:date|issued)[:\s]+(\d{1,4}[-/]\d{1,2}[-/]\d{1,4})/i]),
      voc: clip(voc, 80),
      mixRatio: clip(mixRatio, 80),
      colors: [],
      service: clip(firstMatch(header, [/service[:\s]+([^\n]+)/i]), 160),
    },
    storage: {
      temperatureRange: clip(storageRange, 80),
      conditions: storageConditions,
      notes: clip((sec.storage || storageT).split("\n").slice(0, 2).join(" "), 220),
    },
    shelfLife: {
      unopened: clip(shelf, 120),
      opened: clip(opened, 80),
      mixedPotLife: clip(potLife, 120),
      notes: "",
    },
    credentials: {
      required: creds.length ? creds : unique(allMatches(credT, /([^\n]{20,140})/g, 3)),
      notes: "",
    },
    surfacePrep: {
      substrates,
      methods: methodsPrep,
      profile: clip(profile, 80),
      cleanliness: clip(
        firstMatch(prepT, [/(dust-free[^.\n]*)/i, /cleanliness[:\s]+([^\n.]+)/i, /(oil-free[^.\n]*)/i]),
        160,
      ),
      moisture: clip(
        firstMatch(prepT, [
          /(surface must be dry[^.\n]*)/i,
          /(SSD or dry[^.\n]*)/i,
          /(ssd[^.\n]*)/i,
          /moisture[:\s]+([^\n.]+)/i,
        ]),
        160,
      ),
      notes: clip((sec.prep || prepT).split("\n")[0] ?? "", 220),
    },
    environmentals: env,
    mixing: {
      components: clip(components || (singleComp ? "Single component" : ""), 80),
      ratio: clip(mixRatio, 80),
      inductionTime: clip(induction, 80),
      potLife: clip(potLife, 120),
      thinning: clip(thinning, 140),
      notes: clip((sec.mixing || mixT).split("\n")[0] ?? "", 220),
    },
    installation: {
      methods: methodsInstall,
      filmThickness: clip(dft, 140),
      coverage: clip(coverage, 140),
      numberOfCoats: clip(
        firstMatch(installT, [
          /number of coats[:\s]+([^\n.]+)/i,
          /((?:two|2)\s+coats?[^.;\n]{0,40})/i,
        ]),
        80,
      ),
      sequence: unique(
        allMatches(installT, /sequence[:\s]+([^\n]+)/i, 4).flatMap((s) =>
          s.split(/\s*→\s*|\s*>\s*/).map((p) => clip(p, 80)),
        ),
        8,
      ),
      notes: clip((sec.install || installT).split("\n")[0] ?? "", 220),
    },
    holdPoints,
    inspection: {
      methods: inspectMethods,
      acceptance: unique(
        allMatches(inspectT, /(sspc-pa\s*2[^,\n.]{0,40}|adhesion[^,\n.]{0,40})/gi).map(tidy),
      ),
      documentation: "Record batch, mix time, air, substrate, RH, dew point, and film thickness.",
    },
    cure: {
      touch: clip(touch, 80),
      handle: clip(handle, 80),
      recoatMin: clip(recoatMin, 80),
      recoatMax: clip(recoatMax, 80),
      fullCure: clip(fullCure, 80),
      immersionService: clip(immersionService, 120),
      temperatureDependence: /faster in heat|slower.{0,12}40|temperature|heat|cold/i.test(cureT)
        ? "Times shorten in heat and stretch in the cold — use the PDS table for the workface temperature."
        : "",
    },
    safety: {
      ppe: ppe.length ? ppe : ["See SDS"],
      ventilation: clip(firstMatch(safetyT, [/(ventilat(?:e|ion)[^.\n]*)/i]), 120),
      hazards,
    },
  };
}
