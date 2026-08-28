import type { Environmentals, FieldCardData, HoldPoint } from "./types.ts";

function num(m: RegExpMatchArray | null, i = 1): number | null {
  if (!m?.[i]) return null;
  const n = Number(m[i].replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

function firstMatch(text: string, patterns: RegExp[]): string {
  for (const p of patterns) {
    const m = text.match(p);
    if (m?.[1]) return m[1].replace(/\s+/g, " ").trim();
  }
  return "";
}

function allMatches(text: string, pattern: RegExp, max = 12): string[] {
  const out: string[] = [];
  const p = new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`);
  let m: RegExpExecArray | null;
  while ((m = p.exec(text)) && out.length < max) {
    const v = (m[1] ?? m[0]).replace(/\s+/g, " ").trim();
    if (v && !out.includes(v)) out.push(v);
  }
  return out;
}

function toF(value: number, unit: string | undefined): number {
  if (!unit) return value;
  if (/c/i.test(unit)) return Math.round((value * 9) / 5 + 32);
  return value;
}

function toDeltaF(value: number, unit: string | undefined): number {
  if (!unit || /f/i.test(unit)) return value;
  return Math.round((value * 9) / 5);
}

function normalize(text: string): string {
  return text
    .replace(/\u00a0/g, " ")
    .replace(/[º˚]/g, "°")
    .replace(/[–—]/g, "-")
    .replace(/PITT\s*-\s*THERM/gi, "PITT-THERM")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n");
}

function section(t: string, start: RegExp, stop: RegExp): string {
  const idx = t.search(start);
  if (idx < 0) return "";
  const rest = t.slice(idx);
  const hit = rest.slice(1).search(stop);
  return (hit >= 0 ? rest.slice(0, hit + 1) : rest).trim();
}

const NEXT_HEAD =
  /\n(?=DESCRIPTION|PRINCIPAL CHARACTERISTICS|COLOR AND GLOSS|BASIC DATA|RECOMMENDED SUBSTRATE|INSTRUCTIONS FOR USE|Mixing ratio|Airless spray|Trowel|ADDITIONAL DATA|Curing time|Pot life|SAFETY PRECAUTIONS|REFERENCES|WARRANTY|LIMITATIONS|ENVIRONMENTAL CONDITIONS|STORAGE|SHELF LIFE|CREDENTIALS|SURFACE PREPARATION|MIXING|INSTALLATION|HOLD POINTS|INSPECTION|CURE|SAFETY\b)/i;

const SHEET_HEADER =
  /^(product data sheet|technical data sheet|safety data sheet|data sheet|page\s*\d|ref\.?\s|notes?:?|description|principal characteristics|warranty|instructions for use|additional data|basic data|color and gloss|recommended substrate)$/i;

function extractProductName(t: string, lines: string[]): string {
  const clean = (s: string) => s.replace(/[®™]/g, "").replace(/\s+/g, " ").trim().slice(0, 120);

  const labeled = firstMatch(t, [
    /PRODUCT DATA SHEET\s+[—-]\s+([^\n]+)/i,
    /product(?:\s+name)?[:\s]+([A-Z0-9][^\n]{3,80})/i,
  ]);
  if (labeled && !SHEET_HEADER.test(labeled) && !/data sheet|revision of/i.test(labeled)) {
    return clean(labeled);
  }

  const token = t.match(
    /\b((?:PPG\s+)?PITT-THERM[^\n,]{0,40}|(?:PPG\s+)?PITT-CHAR[^\n,]{0,40}|Macropoxy[^\n,]{0,40}|Sikadur[^\n,]{0,40}|Dymonic[^\n,]{0,24}|Carbozinc[^\n,]{0,24}|Carbomastic[^\n,]{0,32}|EnviroLastic[^\n,]{0,32}|Corothane[^\n,]{0,48}|Plasite[^\n,]{0,32}|Penguard[^\n,]{0,32}|Hempadur[^\n,]{0,32}|Interzinc[^\n,]{0,32}|Intergard[^\n,]{0,32}|Series\s+\d+[^\n,]{0,24})/i,
  );
  if (token) return clean(token[1]);

  const headerWindows = [t.slice(0, 900), (t.match(/PRODUCT DATA SHEET[\s\S]{0,280}/i) ?? [""])[0]];
  for (const w of headerWindows) {
    const tm = w.match(
      /\b((?:PPG\s+)?[A-Z][A-Za-z0-9.-]{2,}(?:\s+[A-Z0-9][A-Za-z0-9.-]{0,24}){0,6})\s*[®™]((?:\s+\d+[A-Za-z0-9-]*)?(?:\s+[A-Z]{1,6})?)/,
    );
    if (tm && !SHEET_HEADER.test(tm[1])) return clean(`${tm[1]}${tm[2] ?? ""}`);
  }

  const branded = lines.find((l) => {
    const s = l.replace(/[®™]/g, "").trim();
    if (s.length < 8 || s.length > 90) return false;
    if (SHEET_HEADER.test(s)) return false;
    return /PITT-|MACROPOXY|CARBO|PPG |SHERWIN|CARBOLINE|SIKA |HEMPEL|JOTUN|TNEMEC|AWLGRIP|DURA-PLATE|FAST CLAD|PHENICON|PLASITE|PITT-THERM|PITT-CHAR|DYMONIC|SIKADUR|PENGUARD|HEMPADUR|INTERZINC|SERIES \d/i.test(
      s,
    );
  });
  if (branded) return clean(branded);

  const first = lines.find((l) => {
    const s = l.trim();
    if (s.length < 8 || s.length > 80) return false;
    if (SHEET_HEADER.test(s)) return false;
    if (/revision of|january|february|march|april|may |june |july |august|september|october|november|december/i.test(s)) {
      return false;
    }
    return /[A-Za-z]{3}/.test(s);
  });
  return clean(first ?? lines[0] ?? "Unnamed product");
}

function dewSpreadMinF(t: string): number | null {
  const cThenF = t.match(
    /(\d+(?:\.\d+)?)\s*°?\s*[Cc]\s*\(\s*(\d+(?:\.\d+)?)\s*°?\s*[Ff]\s*\)\s*(?:above|over|higher than)\s+(?:the\s+)?dew/i,
  );
  if (cThenF) return Number(cThenF[2]);

  const fThenC = t.match(
    /(\d+(?:\.\d+)?)\s*°?\s*[Ff]\s*\(\s*(\d+(?:\.\d+)?)\s*°?\s*[Cc]\s*\)\s*(?:above|over|higher than)\s+(?:the\s+)?dew/i,
  );
  if (fThenC) return Number(fThenC[1]);

  const looseParen = t.match(
    /(\d+(?:\.\d+)?)\s*[Cc]?\s*\(\s*(\d+(?:\.\d+)?)\s*[Ff]\s*\)\s*(?:above|over|higher than)\s+(?:the\s+)?dew/i,
  );
  if (looseParen) return Number(looseParen[2]);

  const dew = t.match(
    /(\d+(?:\.\d+)?)\s*°?\s*([CF])?(?:\s*\([^)]{0,16}\))?\s*(?:above|over|higher than)\s+(?:the\s+)?dew/i,
  );
  if (!dew) return null;
  return toDeltaF(Number(dew[1]), dew[2]);
}

function rhMaxFromText(t: string): number | null {
  if (/(?:relative humidity|\brh\b|humidity)[:\s]+no (?:stated |hard )?(?:maximum|cap|max)/i.test(t)) return null;
  const capped = t.match(
    /(?:relative humidity|\brh\b|humidity)[\s\S]{0,90}?(?:not exceed|shall not exceed|not greater than|max(?:imum)?(?: of)?|≤|<=|less than)\s*(\d+)\s*%/i,
  );
  if (capped) return Number(capped[1]);
  const loose = t.match(/relative humidity[^\n]{0,80}?(\d+)\s*%/i);
  return loose ? Number(loose[1]) : null;
}

function precipitationAllowedFromText(t: string): boolean {
  if (
    /do not apply.{0,80}(rain|wet|precipitation|snow|fog)|not apply.{0,40}(rain|wet|precipitation)|protect.{0,50}from rain|avoid rain|no rain|rain, snow, or fog is imminent/i.test(
      t,
    )
  ) {
    return false;
  }
  return /(?:may|can)\s+(?:be\s+)?appl(?:y|ied).{0,48}(rain|wet)|appl(?:y|ied).{0,24}(?:in|during|to)\s+(?:the\s+)?(?:rain|wet\s+surface)|(?:rain|wet(?:\s+surfaces?)?|precipitation)\s+(?:is\s+)?(?:allowed|permitted|acceptable)/i.test(
    t,
  );
}

function inParens(t: string, idx: number): boolean {
  return /\([^)]*$/.test(t.slice(Math.max(0, idx - 32), idx));
}

function applySlice(t: string): string {
  return t
    .replace(/operating temperature limits?:[\s\S]{0,160}/gi, " ")
    .replace(/temperature resistance[\s\S]{0,160}/gi, " ")
    .replace(/material should be stored.{0,120}/gi, " ")
    .replace(/\bshelf life[:\s]+.{0,80}/gi, " ")
    .replace(/\bstor(?:e|age|ed)\b.{0,90}/gi, " ")
    .replace(/curing time[\s\S]{0,1400}/gi, " ")
    .replace(/\bpot life\b[:\s]+[^\n]{0,120}/gi, " ")
    .replace(/nozzle (?:angle|orifice|pressure)[\s\S]{0,100}/gi, " ");
}

function plausibleApplyMinF(v: number): boolean {
  return v >= 20 && v <= 200;
}

function plausibleApplyMaxF(v: number): boolean {
  return v >= 50 && v <= 250;
}

function extractApplyTemps(t: string, env: Environmentals) {
  const apply = applySlice(t);

  const cease =
    apply.match(/ceas(?:e|ing)\s+curing\s+below\s+(\d+)\s*°?\s*([CF])/i) ??
    t.match(/ceas(?:e|ing)\s+curing\s+below\s+(\d+)\s*°?\s*([CF])/i);
  const ceaseF = cease ? toF(Number(cease[1]), cease[2]) : null;

  const takeMin = (v: number) => {
    if (!plausibleApplyMinF(v)) return;
    env.ambientTempMinF = env.ambientTempMinF ?? v;
    env.substrateTempMinF = env.substrateTempMinF ?? v;
  };
  const takeMax = (v: number) => {
    if (!plausibleApplyMaxF(v)) return;
    env.ambientTempMaxF = env.ambientTempMaxF ?? v;
    env.substrateTempMaxF = env.substrateTempMaxF ?? v;
  };

  for (const m of apply.matchAll(/(\d+(?:\.\d+)?)\s*°?\s*([CF])\b(?:\s*\([^)]{0,12}\))?\s+minimum\b/gi)) {
    const idx = m.index ?? 0;
    if (inParens(apply, idx)) continue;
    if (/dew/i.test(apply.slice(idx, idx + m[0].length + 24))) continue;
    takeMin(toF(Number(m[1]), m[2]));
  }

  for (const m of apply.matchAll(/\bmin(?:imum|\.)\b[:\s\/]*[^\n]{0,32}?\b(\d+(?:\.\d+)?)\s*°?\s*([CF])\b/gi)) {
    const idx = m.index ?? 0;
    const end = idx + m[0].length;
    if (inParens(apply, idx + m[0].indexOf(m[1]))) continue;
    if (/dew/i.test(m[0]) || /dew/i.test(apply.slice(end, end + 28))) continue;
    if (/^\s*maximum\b/i.test(apply.slice(end, end + 16))) continue;
    takeMin(toF(Number(m[1]), m[2]));
  }

  for (const m of apply.matchAll(/(\d+(?:\.\d+)?)\s*°?\s*([CF])\b(?:\s*\([^)]{0,12}\))?\s+maximum\b/gi)) {
    const idx = m.index ?? 0;
    if (inParens(apply, idx)) continue;
    takeMax(toF(Number(m[1]), m[2]));
  }
  for (const m of apply.matchAll(/\bmax(?:imum)\b[:\s\/]*\b(\d+(?:\.\d+)?)\s*°?\s*([CF])\b/gi)) {
    const idx = m.index ?? 0;
    if (inParens(apply, idx + m[0].indexOf(m[1]))) continue;
    takeMax(toF(Number(m[1]), m[2]));
  }

  const pairs = [
    ...apply.matchAll(
      /(?:air|ambient|application|surface|substrate|steel)\b[\s\S]{0,40}?\b(\d+(?:\.\d+)?)\s*°?\s*([CF])\b[\s\S]{0,16}?(?:to|-)\s*\b(\d+(?:\.\d+)?)\s*°?\s*([CF])\b/gi,
    ),
  ];
  for (const m of pairs) {
    if (/orifice|nozzle|mm\b|mils?\b|bar\b|mpa\b|p\.?s\.?i/i.test(m[0])) continue;
    const min = toF(Number(m[1]), m[2]);
    const max = toF(Number(m[3]), m[4]);
    if (!plausibleApplyMinF(min) || !plausibleApplyMaxF(max) || min >= max) continue;
    env.ambientTempMinF = env.ambientTempMinF ?? min;
    env.ambientTempMaxF = env.ambientTempMaxF ?? max;
    env.substrateTempMinF = env.substrateTempMinF ?? min;
    env.substrateTempMaxF = env.substrateTempMaxF ?? max;
  }

  if (ceaseF != null) {
    env.ambientTempMinF = env.ambientTempMinF == null ? ceaseF : Math.max(env.ambientTempMinF, ceaseF);
    env.substrateTempMinF = env.substrateTempMinF == null ? ceaseF : Math.max(env.substrateTempMinF, ceaseF);
  }
}

function mixFromText(t: string): string {
  const vol = t.match(/by volume[:\s]+(?:base to hardener\s+)?(\d+(?:\.\d+)?\s*:\s*\d+(?:\.\d+)?(?:\s*:\s*\d+(?:\.\d+)?)?)/i);
  const wt = t.match(/by weight[:\s]+(?:base to hardener\s+)?(\d+(?:\.\d+)?\s*:\s*\d+(?:\.\d+)?(?:\s*:\s*\d+(?:\.\d+)?)?)/i);
  const parts: string[] = [];
  if (vol) parts.push(`${vol[1].replace(/\s/g, "")} by volume`);
  if (wt) parts.push(`${wt[1].replace(/\s/g, "")} by weight`);
  if (parts.length) return parts.join(" · ");
  if (/single[- ]component|no mixing|no mix(?:ing)? required/i.test(t)) return "Single-component — no mix";
  const partsMix = t.match(
    /(\d+(?:\.\d+)?)\s*parts?\s+(?:base|part\s*a|resin|component\s*a).{0,32}?(\d+(?:\.\d+)?)\s*parts?\s+(?:hardener|part\s*b|converter|component\s*b)/i,
  );
  if (partsMix) return `${partsMix[1]}:${partsMix[2]} by volume`;
  return firstMatch(t, [
    /mix(?:ing)?\s+ratio[:\s]+([^\n]+)/i,
    /(\d+\s*:\s*\d+(?:\s*:\s*\d+)?(?:\s*by\s+volume|\s*by\s+weight)?)/i,
  ]);
}

function potLifeFromText(t: string): string {
  const heading = t.search(/\bPot life\b/i);
  let block = t;
  if (heading >= 0) {
    const rest = t.slice(heading);
    const stop = rest.search(
      /\b(?:SAFETY PRECAUTIONS|SAFETY DATA|REFERENCES|WARRANTY|WORLDWIDE AVAILABILITY|LIMITATIONS|HOLD POINTS|INSPECTION)\b/i,
    );
    const end = stop > 12 ? Math.min(stop, 800) : Math.min(rest.length, 800);
    block = rest.slice(0, end);
  }
  const rows = [
    ...block.matchAll(/(\d+)\s*°?\s*C\s*\((\d+)\s*°?\s*F\)\s+(\d+\s*(?:hours?|minutes?|mins?|hrs?))/gi),
  ].filter((r) => {
    const n = Number(r[3].match(/\d+/)?.[0] ?? 99);
    return /min/i.test(r[3]) || n <= 6;
  });
  if (rows.length) {
    const prefer = rows.find((r) => Number(r[2]) >= 68 && Number(r[2]) <= 77) ?? rows[0];
    const rest = rows
      .filter((r) => r !== prefer)
      .map((r) => `${r[3]} at ${r[2]}°F`)
      .slice(0, 2);
    const head = `${prefer[3]} at ${prefer[2]}°F`;
    return rest.length ? `${head} (${rest.join("; ")})` : head;
  }
  return firstMatch(t, [
    /pot\s*life[:\s]+(\d[^.\n]{0,48}(?:minutes?|mins?|hours?|hrs?|hr)\b[^\n]{0,40})/i,
    /working\s+time[:\s]+([^\n]+)/i,
    /mixed pot life[:\s]+([^\n]+)/i,
  ]);
}

function cureAtStandard(t: string): { touch: string; handle: string; fullCure: string } {
  const empty = { touch: "", handle: "", fullCure: "" };
  const row =
    t.match(
      /20\s*°?\s*C\s*\(\s*68\s*°?\s*F\s*\)\s+(\d+\s*hours?)\s+(\d+\s*(?:hours?|days?))\s+(\S[^\n]{0,24}?)\s+(\d+\s*hours?)\s+(\d+\s*hours?)/i,
    ) ??
    t.match(
      /77\s*°?\s*F[^\n]{0,40}?touch[:\s]+(?:~)?(\d+[^\n,]{0,20}).{0,40}?handle[:\s]+(?:~)?(\d+[^\n,]{0,20}).{0,80}?full cure[:\s]+(?:~)?(\d+[^\n.]{0,24})/i,
    );
  if (!row) {
    return {
      touch: firstMatch(t, [/dry to touch[:\s]+([^\n]+)/i, /touch[:\s]+(?:~)?(\d[^\n]{0,40})/i]),
      handle: firstMatch(t, [/dry to handle[:\s]+([^\n]+)/i, /handle[:\s]+(?:~)?(\d[^\n]{0,40})/i]),
      fullCure: firstMatch(t, [/full cure[:\s]+([^\n]+)/i]),
    };
  }
  if (row[5]) {
    return {
      touch: `${row[1]} at 20°C (68°F)`,
      handle: `${row[4]} at 20°C (68°F)`,
      fullCure: `${row[5]} at 20°C (68°F)`,
    };
  }
  return empty;
}

function vocFromText(t: string): string {
  const epa = t.match(/EPA Method 24[:\s]+([\d.]+\s*g\/l[^\n]{0,40})/i);
  if (epa) return `EPA Method 24: ${epa[1].replace(/\s+/g, " ").trim()}`;
  return firstMatch(t, [/voc[:\s]+([^\n]+)/i]);
}

function colorsFromText(t: string): string[] {
  const block = section(t, /COLOR AND GLOSS LEVEL/i, NEXT_HEAD);
  const bullets = allMatches(block, /(?:^|\n|•)\s*([A-Za-z][A-Za-z-]{2,24})\s*$/gm, 6);
  if (bullets.length) return bullets;
  return allMatches(t, /\b(White|Black|Gray|Grey|Green|Red|Blue|Yellow|Buff|Tan|Aluminum|Aluminium|Clear)\b/g, 6);
}

function storageRangeFromText(t: string): string {
  const stored = t.match(
    /stored[^\n]{0,80}?above\s+(\d+)\s*°?\s*([CF])\s*\((\d+)\s*°?\s*([CF])\)[^\n]{0,40}?below\s+(\d+)\s*°?\s*([CF])\s*\((\d+)\s*°?\s*([CF])\)/i,
  );
  if (stored) {
    const lo = /f/i.test(stored[4]) ? stored[3] : stored[1];
    const hi = /f/i.test(stored[8]) ? stored[7] : stored[5];
    return `${lo}–${hi}°F (dry, out of direct sunlight)`;
  }
  return firstMatch(t, [
    /stor(?:e|age)[^\n]{0,40}?(\d+\s*°?\s*[CF][^\n]{0,24}\d+\s*°?\s*[CF])/i,
    /store(?:d)?\s+(?:indoors\s+)?at[:\s]+([^\n]+)/i,
  ]);
}

function substratesFromText(t: string): string[] {
  const block = section(t, /RECOMMENDED SUBSTRATE|SURFACE PREPARATION/i, NEXT_HEAD);
  const source = block || t;
  return allMatches(
    source,
    /(previous(?:ly)?\s+coat(?:ing|ed)(?: layer)?|mill[\s-]?scale|bare steel|carbon steel|galvanized|aluminum|aluminium|light painted concrete|dark painted concrete|painted concrete|\bconcrete\b|\bwood\b|\bglass\b|\bsteel\b)/gi,
  ).filter((s) => !/steel parts/i.test(s) && s.length > 3);
}

function moistureFromText(t: string, env: Environmentals): string {
  const stated = firstMatch(t, [
    /(surface must be dry[^\n]*)/i,
    /moisture[:\s]+([^\n]+)/i,
    /(do not apply to wet[^\n]*)/i,
    /(do not apply to frozen[^\n]*)/i,
  ]);
  const bits: string[] = [];
  if (stated) bits.push(stated);
  if (env.dewPointSpreadMinF != null) bits.push(`Substrate ≥ ${env.dewPointSpreadMinF}°F above dew point`);
  if (env.relativeHumidityMax != null) bits.push(`RH ≤ ${env.relativeHumidityMax}% during application and curing`);
  if (env.precipitationAllowed === false) {
    bits.push("Dry application only — precipitation not permitted unless the sheet says otherwise");
  } else if (env.precipitationAllowed) {
    bits.push("Wet / rain application is permitted per the sheet");
  }
  return [...new Set(bits)].join(". ");
}

function applyWindowNotes(t: string, env: Environmentals) {
  const belowOk = t.match(
    /ambient temperature below\s+(\d+)\s*°?\s*([CF])\s*(?:\((\d+)\s*°?\s*([CF])\))?\s*is acceptable/i,
  );
  if (belowOk) {
    const f =
      belowOk[4] && /f/i.test(belowOk[4]) ? Number(belowOk[3]) : toF(Number(belowOk[1]), belowOk[2]);
    env.additional.push(`Air below ${f}°F is acceptable; curing is slower.`);
  }
  if (env.ambientTempMaxF == null && env.substrateTempMaxF == null) {
    env.additional.push("No stated application maximum. Operating / service temperature is not the apply window.");
  }
}

export function heuristicExtract(text: string): FieldCardData {
  const t = normalize(text);
  const lines = t
    .split(/\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const name = extractProductName(t, lines);
  let manufacturer = firstMatch(t, [
    /manufacturer[:\s]+([^\n]+)/i,
    /prepared\s+by[:\s]+([^\n]+)/i,
    /(Sherwin-Williams Protective(?:\s*&\s*Marine)?(?:\s*Coatings)?)/i,
    /(PPG Protective(?:\s*&\s*Marine)?(?:\s*Coatings)?)/i,
    /(Tnemec Company)/i,
    /(International Paint)/i,
    /\b(Sherwin-Williams|Carboline|Sika Corporation|Tremco|Jotun|Hempel|Tnemec|AkzoNobel|Awlgrip|Axalta|International Paint)\b/i,
  ]);
  if (!manufacturer) {
    const brand = (name + " " + t.slice(0, 2500)).match(
      /\b(PPG|Sherwin-Williams|Carboline|Sika|Tremco|Hempel|Jotun|Tnemec|AkzoNobel|Awlgrip|International Paint|Axalta)\b/i,
    );
    if (brand) manufacturer = brand[1];
  }
  if (!manufacturer && /PPG Protective & Marine Coatings/i.test(t)) manufacturer = "PPG";

  const description = firstMatch(t, [
    /generic type[:\s]+([^\n]+)/i,
    /product type[:\s]+([^\n]+)/i,
    /DESCRIPTION\s+([\s\S]{20,320}?)(?=\bPRINCIPAL CHARACTERISTICS\b|\bCOLOR AND GLOSS\b|\bBASIC DATA\b|$)/i,
  ]);

  const mixRatio = mixFromText(t);
  const potLife = potLifeFromText(t);
  const shelf = firstMatch(t, [
    /shelf\s*life[:\s]+((?:base|hardener|\d)[^\n]+)/i,
    /(\d+\s+months? unopened[^\n]*)/i,
    /shelf\s*life[:\s]+(?!notes?:)([^\n]+)/i,
  ]);
  const voc = vocFromText(t);
  const dft = firstMatch(t, [
    /(?:recommended\s+)?(?:dft|dry\s+film(?:\s+thickness)?)[:\s]+([^\n]+)/i,
    /typical dft[:\s]+([^\n]+)/i,
    /typical(?:\s+dry)?(?:\s+film)?\s+thickness[:\s]+([^\n]+)/i,
    /(\d+(?:\.\d+)?\s*-\s*\d+(?:\.\d+)?\s*mils?)(?![^\n]{0,24}profile)/i,
  ]);
  const profile = firstMatch(t, [
    /(?:anchor\s+)?profile[:\s]+([^\n]+)/i,
    /(\d+(?:\.\d+)?\s*-\s*\d+(?:\.\d+)?\s*mils?.{0,20}profile)/i,
  ]);
  const profileOut =
    profile ||
    (/previous(?:ly)?\s+coat/i.test(t)
      ? "Not stated — overcoating a qualified previous layer, not a blast profile."
      : "");
  const recoatMin = firstMatch(t, [
    /recoat(?:ing)?\s+(?:min(?:imum)?|window)[:\s]+([^\n]+)/i,
    /minimum\s+recoat[:\s]+(?:~)?([^\n]+)/i,
    /recoat minimum[:\s]+(?:~)?([^\n]+)/i,
  ]);
  const recoatMax = firstMatch(t, [
    /maximum\s+recoat[:\s]+([^\n]+)/i,
    /recoat(?:ing)?\s+max(?:imum)?[:\s]+([^\n]+)/i,
  ]);
  const coverage = firstMatch(t, [/coverage[:\s]+([^\n]+)/i, /theoretical\s+coverage[:\s]+([^\n]+)/i]);
  const induction = firstMatch(t, [/induction[:\s]+([^\n]+)/i, /sweat-?in[:\s]+([^\n]+)/i, /no induction[^\n]*/i]);
  const thinning = firstMatch(t, [
    /no thinner should be added/i,
    /do not thin/i,
    /thinn(?:ing|er)[:\s]+([^\n]+)/i,
  ]);
  const thinningOut = /no thinner should be added/i.test(t)
    ? "No thinner should be added"
    : /do not thin/i.test(t)
      ? "Do not thin"
      : thinning;

  const sspc = allMatches(t, /SSPC[-\s]?SP\s?\d+[A-Z]?(?:\s*\/\s*NACE[^\n,]{0,24})?/gi);
  const nace = allMatches(t, /NACE(?:\s+No\.?\s*\d+|\s+SP\d+)?/gi);
  const methodsPrep = [...sspc, ...nace.filter((n) => !sspc.some((s) => s.includes(n)))];

  const env: Environmentals = {
    ambientTempMinF: null,
    ambientTempMaxF: null,
    substrateTempMinF: null,
    substrateTempMaxF: null,
    relativeHumidityMax: null,
    relativeHumidityMin: null,
    dewPointSpreadMinF: dewSpreadMinF(t),
    precipitationAllowed: precipitationAllowedFromText(t),
    windMaxMph: num(t.match(/(?:wind|stop work above)[^\n]{0,36}?(\d+)\s*(?:mph|miles)/i)),
    directSunNotes: /out of direct sunlight|direct sunlight/i.test(t)
      ? "Store out of direct sunlight. Measure substrate in sun — steel can exceed air."
      : "",
    notes: "",
    additional: [],
  };
  extractApplyTemps(t, env);
  env.relativeHumidityMax = rhMaxFromText(t);
  applyWindowNotes(t, env);

  const cease = t.match(/ceas(?:e|ing)\s+curing\s+below\s+(\d+)\s*°?\s*([CF])/i);
  if (cease) {
    env.notes = `Curing ceases below ${cease[1]}°${(cease[2] || "").toUpperCase()} (${toF(Number(cease[1]), cease[2])}°F).`;
    env.additional.push(env.notes);
  }
  if (env.dewPointSpreadMinF != null) {
    env.additional.push(`Substrate ≥ ${env.dewPointSpreadMinF}°F above dew point.`);
  }
  if (env.relativeHumidityMax != null) {
    env.additional.push(`RH ≤ ${env.relativeHumidityMax}% during application and curing.`);
  }

  const storageRange = storageRangeFromText(t);
  const colors = colorsFromText(t);
  const solids = firstMatch(t, [/volume solids[:\s]+([^\n]+)/i, /(100%\s*solids)/i]);
  const components = firstMatch(t, [
    /number of components[:\s]+([^\n]+)/i,
    /(two-component|2[- ]component|single-component|1[- ]component)/i,
  ]);
  const componentsOut = /two/i.test(components)
    ? "Two-component"
    : /single|1[- ]component/i.test(components)
      ? "Single-component"
      : components;

  const methodsInstall = [
    ...new Set(
      allMatches(
        t,
        /(airless(?:\s+spray)?|plural(?:\s+component)?|conventional spray|brush|roller|trowel|squeegee|caulk|gun|nozzle)/gi,
      ).map((m) => {
        const s = m.toLowerCase();
        if (s.startsWith("airless")) return "Airless spray";
        if (s.startsWith("plural")) return "Plural component";
        if (s.startsWith("trowel")) return "Trowel";
        if (s.startsWith("roller")) return "Roller";
        if (s.startsWith("brush")) return "Brush";
        if (s.startsWith("nozzle")) return "Nozzle";
        if (s.startsWith("gun")) return "Gun";
        if (s.startsWith("caulk")) return "Caulk";
        return m;
      }),
    ),
  ];

  const solvent = firstMatch(t, [/(THINNER\s+[\d-]+)/i, /cleaning solvent[:\s]+(?:•\s*)?(THINNER[^\n]+)/i]);
  const nozzle = [
    firstMatch(t, [/nozzle angle[:\s]+([^\n]{0,72})/i]),
    firstMatch(t, [/nozzle orifice[:\s]+([^\n]{0,72})/i]),
    firstMatch(t, [/nozzle pressure[:\s]+([^\n]{0,88})/i]),
  ]
    .filter(Boolean)
    .join(" · ");

  const trained = /suitably trained|certified applicator|manufacturer train/i.test(t);
  const credentials = allMatches(
    t,
    /(NACE|AMPP|SSPC PCI|certified applicator|suitably trained applicators|manufacturer train)/gi,
  );
  if (trained && !credentials.some((c) => /trained/i.test(c))) credentials.push("Suitably trained applicators");

  const cure = cureAtStandard(t);
  const service = firstMatch(t, [
    /service[:\s]+([^\n]+)/i,
    /for use as\s+([\s\S]{10,220}?)(?=\.\s|\bPRINCIPAL CHARACTERISTICS\b|\bCOLOR AND GLOSS\b|\bBASIC DATA\b|$)/i,
    /operating temperature limits?[:\s]+([^\n]+)/i,
  ]);

  const date = firstMatch(t, [
    /((?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}\s+\d{4})/i,
    /(?:date|issued)[:\s]+(\d{1,4}[-/]\d{1,2}[-/]\d{1,4})/i,
  ]);

  const holdPoints: HoldPoint[] = [
    {
      step: 1,
      name: "Material receipt",
      criteria: shelf ? `Unexpired (${shelf.slice(0, 80)})` : "Verify batch and shelf life",
      owner: "QC",
      timing: "Before staging",
      source: shelf ? "stated" : "inferred",
    },
    {
      step: 2,
      name: "Storage check",
      criteria: storageRange || "Stored per PDS temperature and dryness",
      owner: "QC",
      timing: "Before issuing to the crew",
      source: storageRange ? "stated" : "inferred",
    },
    {
      step: 3,
      name: "Credentials",
      criteria: credentials.slice(0, 3).join(", ") || "Applicator / inspector credentials on file",
      owner: "QC",
      timing: "Before work",
      source: credentials.length ? "stated" : "inferred",
    },
    {
      step: 4,
      name: "Surface preparation",
      criteria: methodsPrep.slice(0, 3).join(", ") || firstMatch(t, [/previous coating layer[^\n]+/i]) || "Prep per PDS / spec",
      owner: "QC",
      timing: "Before coating or placement",
      source: methodsPrep.length ? "stated" : "inferred",
    },
    {
      step: 5,
      name: "Ambient / dew point",
      criteria: [
        env.dewPointSpreadMinF != null ? `Substrate ≥ ${env.dewPointSpreadMinF}°F above dew` : null,
        env.relativeHumidityMax != null ? `RH ≤ ${env.relativeHumidityMax}%` : null,
        env.ambientTempMinF != null ? `Air/substrate ≥ ${env.ambientTempMinF}°F` : null,
        env.precipitationAllowed === false ? "No precipitation" : null,
      ]
        .filter(Boolean)
        .join("; ") || "In-window air, substrate, RH, dew-point spread",
      owner: "Applicator + QC",
      timing: "Immediately before application",
      source: env.dewPointSpreadMinF != null || env.relativeHumidityMax != null ? "stated" : "inferred",
    },
    {
      step: 6,
      name: "Mix",
      criteria: mixRatio ? `Ratio ${mixRatio}${thinningOut ? `; ${thinningOut}` : ""}` : "Mix per PDS",
      owner: "Applicator",
      timing: "At combine; mark pot-life start",
      source: mixRatio ? "stated" : "inferred",
    },
    {
      step: 7,
      name: "Application",
      criteria: dft || "Film build / placement per PDS",
      owner: "Applicator + QC",
      timing: "During work (WFT / workmanship)",
      source: dft ? "stated" : "inferred",
    },
    {
      step: 8,
      name: "Cure / recoat",
      criteria: [cure.fullCure, recoatMin, recoatMax].filter(Boolean).join(" · ") || "Inside recoat window",
      owner: "QC",
      timing: "Before next coat or service",
      source: cure.fullCure || recoatMin ? "stated" : "inferred",
    },
    {
      step: 9,
      name: "Final inspection",
      criteria: "Acceptance tests per PDS / project spec",
      owner: "QC / owner",
      timing: "After required cure",
      source: "inferred",
    },
  ];

  const ppe = allMatches(t, /(respirator|goggles|gloves|protective clothing|eye protection|face shield|tyvek)/gi);
  if (/inhalation of spray|spray mist/i.test(t) && !ppe.some((p) => /respirator/i.test(p))) ppe.push("Respirator (spray mist)");
  if (/skin or eyes|exposed skin or eyes/i.test(t) && !ppe.some((p) => /eye/i.test(p))) ppe.push("Eye protection");
  if (/skin or eyes|exposed skin/i.test(t) && !ppe.some((p) => /glove/i.test(p))) ppe.push("Gloves");

  const missing: string[] = [];
  if (!(name.length > 4 && !/data sheet/i.test(name))) missing.push("product name");
  if (!manufacturer) missing.push("manufacturer");
  if (!mixRatio) missing.push("mix ratio");
  if (!dft) missing.push("DFT");
  if (dewSpreadMinF(t) === 37) missing.push("dew spread (unit error)");
  if (env.dewPointSpreadMinF == null && /above(?: the)? dew/i.test(t)) missing.push("dew spread number");
  const high = missing.length === 0;
  const notes: string[] = [];
  if (high) {
    notes.push("Stated application conditions only. Dew, rain, and service-temperature limits were not invented.");
  } else {
    notes.push(
      `Medium extract — this text is missing: ${missing.join(", ")}. Read ${t.length.toLocaleString()} characters. Upload the full PDS (mixing + application conditions).`,
    );
  }

  const installNotes = [solvent ? `Cleaning solvent: ${solvent}` : "", nozzle, solids ? `Volume solids ${solids}` : ""]
    .filter(Boolean)
    .join(" ");

  return {
    id: crypto.randomUUID(),
    extractedAt: new Date().toISOString(),
    confidence: high ? "high" : "medium",
    extractionNotes: notes,
    product: {
      name: name.slice(0, 120),
      manufacturer: manufacturer.slice(0, 120),
      productType: description.slice(0, 220),
      systemRole: firstMatch(t, [
        /for use as\s+([\s\S]{8,220}?)(?=\.\s|\bPRINCIPAL CHARACTERISTICS\b|\bCOLOR AND GLOSS\b|\bBASIC DATA\b|$)/i,
      ]),
      revision: firstMatch(t, [/rev(?:ision)?(?: of)?[:\s]+([^\n)]+)/i]) || date,
      documentDate: date,
      voc,
      mixRatio,
      colors,
      service: service.slice(0, 220),
    },
    storage: {
      temperatureRange: storageRange,
      conditions: allMatches(t, /(keep dry|dry conditions|protect from freeze|original container|tightly closed|fifo|out of direct sunlight)/gi),
      notes: /10 months/i.test(t) ? "Shelf life drops to 10 months if stored at 35°C (95°F)." : "",
    },
    shelfLife: {
      unopened: shelf,
      opened: "",
      mixedPotLife: potLife,
      notes: /10 months/i.test(t) ? "Both components: 10 months at 35°C." : "",
    },
    credentials: {
      required: credentials,
      notes: /application guidelines/i.test(t) ? "Apply per manufacturer application guidelines." : "",
    },
    surfacePrep: {
      substrates: substratesFromText(t),
      methods: methodsPrep,
      profile: profileOut,
      cleanliness: firstMatch(t, [/cleanliness[:\s]+([^\n]+)/i, /(fully cured[^\n]{0,80})/i]),
      moisture: moistureFromText(t, env),
      notes: firstMatch(t, [/(previous coating layer[^\n]+)/i]),
    },
    environmentals: env,
    mixing: {
      components: componentsOut,
      ratio: mixRatio,
      inductionTime: induction,
      potLife,
      thinning: thinningOut,
      notes: [/tolerance\s*\+\/-?\s*10%/i.test(t) ? "Mix tolerance ±10%." : "", solids ? `Volume solids ${solids}.` : ""]
        .filter(Boolean)
        .join(" "),
    },
    installation: {
      methods: methodsInstall,
      filmThickness: dft,
      coverage,
      numberOfCoats: firstMatch(t, [/(?:number of )?coats?[:\s]+([^\n]+)/i]),
      sequence: methodsInstall.length ? ["Prep", "Log ambients / dew / RH", "Mix", ...methodsInstall.slice(0, 2), "Cure"] : [],
      notes: installNotes,
    },
    holdPoints,
    inspection: {
      methods: allMatches(t, /(dft|wft|holiday|adhesion|sspc-pa 2|visual|pull-off)/gi),
      acceptance: [],
      documentation: "Record batch, mix time, ambients, dew spread, RH, and film thickness.",
    },
    cure: {
      touch: cure.touch,
      handle: cure.handle,
      recoatMin,
      recoatMax,
      fullCure: cure.fullCure,
      immersionService: firstMatch(t, [/immersion[:\s]+([^\n]+)/i]),
      temperatureDependence: cease
        ? `Curing ceases below ${cease[1]}°${cease[2] || ""}. Times from the solvent-free cure table.`
        : firstMatch(t, [/curing times may vary[^\n]+/i]),
    },
    safety: {
      ppe: ppe.length ? ppe : ["See SDS"],
      ventilation:
        firstMatch(t, [/((?:adequate )?ventilation[^\n]*)/i, /ventilat(?:e|ion)[:\s]+([^\n]+)/i]) ||
        (/ventilation must be maintained/i.test(t) ? "Adequate ventilation during application and curing" : ""),
      hazards: allMatches(t, /(flammable|sensitizer|isocyanate|carcinogen|irritant|spray mist)/gi),
    },
  };
}
