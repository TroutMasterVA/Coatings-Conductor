import type { SubstrateFamily, SubstratePrepGate } from "./types.ts";

const FAMILY_LABEL: Record<SubstrateFamily, string> = {
  "steel-immersion": "Steel immersion",
  "steel-non-immersion": "Steel non-immersion",
  concrete: "Concrete",
  "non-ferrous": "Non-ferrous metals",
};

const HEADER: { family: SubstrateFamily; re: RegExp }[] = [
  {
    family: "steel-immersion",
    re: /\b(?:immersion(?:\s+service)?|steel\s+immersion|immersed(?:\s+service)?)\b/i,
  },
  {
    family: "steel-non-immersion",
    re: /\b(?:non[\s-]?immersion(?:\s+service)?|atmospheric(?:\s+service)?|non[\s-]?immersed|exterior(?:\s+exposure)?)\b/i,
  },
  {
    family: "concrete",
    re: /\b(?:concrete|masonry|icri|csp)\b/i,
  },
  {
    family: "non-ferrous",
    re: /\b(?:non[\s-]?ferrous|aluminum|aluminium|galvanized|stainless|sspc[\s-]?sp\s*16|sspc[\s-]?sp\s*17)\b/i,
  },
];

function normalize(text: string): string {
  return text.replace(/\u00a0/g, " ").replace(/\r\n/g, "\n");
}

function extractMethods(chunk: string): string[] {
  const out: string[] = [];
  const push = (v: string) => {
    const t = v.replace(/\s+/g, " ").trim();
    if (t && !out.some((x) => x.toLowerCase() === t.toLowerCase())) out.push(t);
  };

  for (const m of chunk.matchAll(/SSPC[\s-]?SP\s*(\d+[A-Za-z]?)/gi)) {
    push(`SSPC-SP${m[1].toUpperCase()}`);
  }
  for (const m of chunk.matchAll(/NACE\s*(?:No\.?\s*)?(\d+)/gi)) {
    push(`NACE ${m[1]}`);
  }
  for (const m of chunk.matchAll(/\bICRI\s*CSP\s*([\d]+(?:\s*[–-]\s*[\d]+)?)/gi)) {
    push(`ICRI CSP ${m[1].replace(/\s+/g, "")}`);
  }
  return out;
}

function extractProfile(chunk: string): string {
  const m =
    chunk.match(
      /(?:anchor\s+)?profile[^\n.]{0,40}?(\d+(?:\.\d+)?\s*[–-]\s*\d+(?:\.\d+)?)\s*mils?/i,
    ) ||
    chunk.match(/(\d+(?:\.\d+)?\s*[–-]\s*\d+(?:\.\d+)?)\s*mils?[^\n.]{0,24}(?:anchor\s+)?profile/i) ||
    chunk.match(/(\d+(?:\.\d+)?\s*[–-]\s*\d+(?:\.\d+)?)\s*mils?(?=\s|$|\.|,|;)/i);
  if (!m?.[1]) return "";
  // Only accept mil ranges near prep language to avoid grabbing DFT film build.
  const around = chunk.slice(Math.max(0, (m.index ?? 0) - 80), (m.index ?? 0) + 80);
  if (/dft|dry\s+film|wft|wet\s+film|thickness|coverage/i.test(around) && !/profile|anchor|blast/i.test(around)) {
    return "";
  }
  if (!/profile|anchor|blast|mil/i.test(around)) return "";
  return `${m[1].replace(/\s+/g, "").replace(/–/g, "-")} mil`;
}

/** Prefer explicit profile wording; fall back to mil range only when blast/profile context. */
function extractProfileStrict(chunk: string): string {
  const withWord =
    chunk.match(
      /(?:anchor\s+)?profile[:\s]+[^\n.]{0,8}?(\d+(?:\.\d+)?\s*[–-]\s*\d+(?:\.\d+)?)\s*mils?/i,
    ) ||
    chunk.match(/(\d+(?:\.\d+)?\s*[–-]\s*\d+(?:\.\d+)?)\s*mils?[^\n.]{0,28}(?:anchor\s+)?profile/i);
  if (withWord?.[1]) {
    return `${withWord[1].replace(/\s+/g, "").replace(/–/g, "-")} mil`;
  }
  if (/blast|near[\s-]?white|commercial\s+blast|anchor/i.test(chunk)) {
    return extractProfile(chunk);
  }
  return "";
}

function detectHeaderFamily(line: string): SubstrateFamily | null {
  const trimmed = line.trim();
  if (trimmed.length > 120) return null;
  // Prefer immersion before generic steel; non-immersion before bare "atmospheric".
  for (const h of HEADER) {
    if (h.re.test(trimmed) && (trimmed.length < 80 || /^[A-Z0-9]/.test(trimmed))) {
      // Avoid classifying a long prep sentence as a header unless it leads with the family word.
      if (trimmed.length > 60 && !new RegExp(`^.{0,20}${h.re.source}`, "i").test(trimmed)) {
        continue;
      }
      return h.family;
    }
  }
  return null;
}

function sectionBlobs(text: string): Partial<Record<SubstrateFamily, string>> {
  const lines = normalize(text).split(/\n/);
  const blobs: Partial<Record<SubstrateFamily, string[]>> = {};
  let current: SubstrateFamily | null = null;

  for (const line of lines) {
    const header = detectHeaderFamily(line);
    if (header) {
      current = header;
      blobs[current] ??= [];
      blobs[current]!.push(line);
      continue;
    }
    if (current) {
      blobs[current] ??= [];
      blobs[current]!.push(line);
    }
  }

  const out: Partial<Record<SubstrateFamily, string>> = {};
  for (const [k, v] of Object.entries(blobs) as [SubstrateFamily, string[]][]) {
    out[k] = v.join("\n");
  }
  return out;
}

/** Window around family keyword when PDS is not cleanly sectioned. */
function proximityBlob(text: string, family: SubstrateFamily): string {
  const n = normalize(text);
  const re = HEADER.find((h) => h.family === family)!.re;
  const parts: string[] = [];
  const flags = re.flags.includes("g") ? re.flags : re.flags + "g";
  const g = new RegExp(re.source, flags);
  let m: RegExpExecArray | null;
  while ((m = g.exec(n)) && parts.length < 4) {
    const start = Math.max(0, m.index - 40);
    const end = Math.min(n.length, m.index + m[0].length + 280);
    parts.push(n.slice(start, end));
  }
  return parts.join("\n\n");
}

function gateFromChunk(family: SubstrateFamily, chunk: string): SubstratePrepGate | null {
  if (!chunk.trim()) return null;
  const methods = extractMethods(chunk);
  const profile = extractProfileStrict(chunk);
  // Present only when the sheet ties prep language to this family.
  if (!methods.length && !profile) {
    // Explicit substrate mention alone is not enough without a prep method nearby.
    return null;
  }
  // Concrete / non-ferrous may list ICRI or SP16 without NACE — already in methods.
  return {
    family,
    label: FAMILY_LABEL[family],
    methods,
    profile,
  };
}

/**
 * Manufacturer-agnostic: parse sectioned PDS prep into per-substrate gates.
 * Silent → omitted gate (not invented).
 */
export function parsePrepBySubstrate(text: string): SubstratePrepGate[] {
  const sections = sectionBlobs(text);
  const families: SubstrateFamily[] = [
    "steel-immersion",
    "steel-non-immersion",
    "concrete",
    "non-ferrous",
  ];
  const gates: SubstratePrepGate[] = [];

  for (const family of families) {
    const chunk = sections[family] || proximityBlob(text, family);
    const gate = gateFromChunk(family, chunk);
    if (gate) gates.push(gate);
  }

  return gates;
}

export function substratesFromGates(gates: SubstratePrepGate[]): string[] {
  return gates.map((g) => g.label);
}

export function methodsFromGates(gates: SubstratePrepGate[]): string[] {
  const out: string[] = [];
  for (const g of gates) {
    for (const m of g.methods) {
      if (!out.some((x) => x.toLowerCase() === m.toLowerCase())) out.push(m);
    }
  }
  return out;
}
