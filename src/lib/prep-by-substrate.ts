import type { SubstrateFamily, SubstratePrepGate } from "./types.ts";

const FAMILY_LABEL: Record<SubstrateFamily, string> = {
  "steel-immersion": "Steel immersion",
  "steel-non-immersion": "Steel non-immersion",
  concrete: "Concrete",
  "non-ferrous": "Non-ferrous metals",
};

const FAMILIES: SubstrateFamily[] = [
  "steel-immersion",
  "steel-non-immersion",
  "concrete",
  "non-ferrous",
];

/** Ordered longest/most-specific first for mid-line splits. */
const MARKERS: { family: SubstrateFamily; re: RegExp }[] = [
  {
    family: "steel-non-immersion",
    re: /non[\s-]?immersion(?:\s+service)?|atmospheric(?:\s+service)?|non[\s-]?immersed/gi,
  },
  {
    family: "steel-immersion",
    re: /immersion(?:\s+service)?|immersed(?:\s+service)?|steel\s+immersion/gi,
  },
  {
    // A bare steel label ("Iron & Steel:", "Carbon steel", "STEEL:") opens a steel gate, so its
    // methods are not filed under whatever substrate was named before it.
    family: "steel-non-immersion",
    re: /(?<!stainless\s|galvanized\s|galvanised\s|primed\s|shop\s|weathering\s)\b(?:iron\s*(?:&|and)\s*)?(?:carbon\s+|bare\s+|new\s+)?steel\b(?!\s*(?:immersion|immersed|wool|grit|shot))/gi,
  },
  {
    family: "concrete",
    re: /\bconcrete\b|\bmasonry\b|\bicri\b|\bcsp\b/gi,
  },
  {
    family: "non-ferrous",
    re: /non[\s-]?ferrous|\baluminum\b|\baluminium\b|\bgalvanized\b|\bstainless\b|sspc[\s-]?sp\s*16|sspc[\s-]?sp\s*17/gi,
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
  for (const m of chunk.matchAll(/NACE\s*(?:No\.?\s*)?(\d+)(?!\s*CIP)/gi)) {
    push(`NACE ${m[1]}`);
  }
  for (const m of chunk.matchAll(/\bICRI\s*CSP\s*([\d]+(?:\s*[–-]\s*[\d]+)?)/gi)) {
    push(`ICRI CSP ${m[1].replace(/\s+/g, "")}`);
  }
  return out;
}

function extractProfileStrict(chunk: string): string {
  const withWord =
    chunk.match(
      /(?:anchor\s+)?profile[:\s]+[^\n.]{0,12}?(\d+(?:\.\d+)?\s*[–-]\s*\d+(?:\.\d+)?)\s*mils?/i,
    ) ||
    chunk.match(/(\d+(?:\.\d+)?\s*[–-]\s*\d+(?:\.\d+)?)\s*mils?[^\n.]{0,28}(?:anchor\s+)?profile/i);
  if (withWord?.[1]) {
    return `${withWord[1].replace(/\s+/g, "").replace(/–/g, "-")} mil`;
  }
  if (/blast|near[\s-]?white|commercial\s+blast|anchor/i.test(chunk)) {
    const m = chunk.match(/(\d+(?:\.\d+)?\s*[–-]\s*\d+(?:\.\d+)?)\s*mils?/i);
    if (m?.[1]) {
      const around = chunk.slice(Math.max(0, (m.index ?? 0) - 60), (m.index ?? 0) + 40);
      if (/dft|dry\s+film|wft|wet\s+film|thickness|coverage/i.test(around) && !/profile|anchor|blast/i.test(around)) {
        return "";
      }
      return `${m[1].replace(/\s+/g, "").replace(/–/g, "-")} mil`;
    }
  }
  return "";
}

type MarkerHit = { family: SubstrateFamily; index: number; len: number };

function collectMarkers(text: string): MarkerHit[] {
  const hits: MarkerHit[] = [];
  for (const { family, re } of MARKERS) {
    const g = new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g");
    let m: RegExpExecArray | null;
    while ((m = g.exec(text))) {
      // Skip immersion credential prose without prep verbs nearby.
      if (family === "steel-immersion") {
        const around = text.slice(Math.max(0, m.index - 30), m.index + m[0].length + 80);
        if (/CIP|credential|inspector|trained/i.test(around) && !/SSPC|NACE\s*No|blast|profile|prep/i.test(around)) {
          continue;
        }
      }
      hits.push({ family, index: m.index, len: m[0].length });
    }
  }
  hits.sort((a, b) => a.index - b.index || b.len - a.len);
  // De-dupe overlapping starts (keep first after sort).
  const out: MarkerHit[] = [];
  let lastEnd = -1;
  for (const h of hits) {
    if (h.index < lastEnd) continue;
    out.push(h);
    lastEnd = h.index + h.len;
  }
  return out;
}

function chunksForFamily(text: string, family: SubstrateFamily, markers: MarkerHit[]): string[] {
  const parts: string[] = [];
  for (let i = 0; i < markers.length; i++) {
    const m = markers[i];
    if (m.family !== family) continue;
    const start = m.index;
    const next = markers.slice(i + 1).find((x) => x.index > start);
    const end = next ? next.index : Math.min(text.length, start + 400);
    parts.push(text.slice(start, end));
  }
  return parts;
}

function gateFromChunks(family: SubstrateFamily, parts: string[]): SubstratePrepGate | null {
  const chunk = parts.join("\n\n");
  if (!chunk.trim()) return null;
  const methods = extractMethods(chunk);
  // Profile from the first gate chunk that states one; a DFT range in one chunk must not hide it.
  const profile = parts.map(extractProfileStrict).find(Boolean) ?? extractProfileStrict(chunk);
  if (!methods.length && !profile) return null;
  return {
    family,
    label: FAMILY_LABEL[family],
    methods,
    profile,
  };
}

/**
 * Manufacturer-agnostic: parse sectioned (or mid-line) PDS prep into per-substrate gates.
 * Silent → omitted gate (not invented).
 */
export function parsePrepBySubstrate(text: string): SubstratePrepGate[] {
  const n = normalize(text);
  const markers = collectMarkers(n);
  const gates: SubstratePrepGate[] = [];

  for (const family of FAMILIES) {
    const gate = gateFromChunks(family, chunksForFamily(n, family, markers));
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
