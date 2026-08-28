import type { Environmentals, FieldCardData, HoldPoint } from "./types";

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

function toF(value: number, unit: string | undefined): number {
  if (!unit) return value;
  if (/c/i.test(unit)) return Math.round((value * 9) / 5 + 32);
  return value;
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
    /(Sherwin-Williams|PPG|Carboline|Sika|Tremco|3M|BASF|Master Builders|International Paint|Hempel|Jotun|Tnemec|AkzoNobel|Awlgrip|Rust-Oleum)[^\n]*/i,
  ]);

  const mixRatio = firstMatch(t, [
    /mix(?:ing)?\s+ratio[:\s]+([^\n]+)/i,
    /(\d+\s*:\s*\d+(?:\s*:\s*\d+)?(?:\s*by\s+volume|\s*by\s+weight)?)/i,
  ]);

  const potLife = firstMatch(t, [/pot\s*life[:\s]+([^\n]+)/i, /working\s+time[:\s]+([^\n]+)/i]);
  const shelf = firstMatch(t, [/shelf\s*life[:\s]+([^\n]+)/i]);
  const voc = firstMatch(t, [/voc[:\s]+([^\n]+)/i]);
  const dft = firstMatch(t, [
    /(?:recommended\s+)?(?:dft|dry\s+film(?:\s+thickness)?)[:\s]+([^\n]+)/i,
    /(\d+\s*[–-]\s*\d+\s*mils?\s*(?:dft|dft)?)/i,
  ]);
  const profile = firstMatch(t, [
    /(?:anchor\s+)?profile[:\s]+([^\n]+)/i,
    /(\d+(?:\.\d+)?\s*[–-]\s*\d+(?:\.\d+)?\s*mils?.{0,20}profile)/i,
  ]);
  const recoatMin = firstMatch(t, [/recoat(?:ing)?\s+(?:min(?:imum)?|window)[:\s]+([^\n]+)/i, /minimum\s+recoat[:\s]+([^\n]+)/i]);
  const recoatMax = firstMatch(t, [/maximum\s+recoat[:\s]+([^\n]+)/i, /recoat(?:ing)?\s+max(?:imum)?[:\s]+([^\n]+)/i]);
  const coverage = firstMatch(t, [/coverage[:\s]+([^\n]+)/i, /theoretical\s+coverage[:\s]+([^\n]+)/i]);
  const induction = firstMatch(t, [/induction[:\s]+([^\n]+)/i, /sweat-?in[:\s]+([^\n]+)/i]);
  const thinning = firstMatch(t, [/thinn(?:ing|er)[:\s]+([^\n]+)/i]);

  const sspc = allMatches(t, /SSPC[-\s]?SP\s?\d+[A-Z]?/gi);
  const nace = allMatches(t, /NACE(?:\s+No\.?\s*\d+|\s+SP\d+)?/gi);
  const methodsPrep = [...sspc, ...nace];

  const tempPairs = [
    ...t.matchAll(
      /(?:air|ambient|application|surface|substrate|steel|store|storage)[^\n]{0,40}?(\d+(?:\.\d+)?)\s*°?\s*([CF])?[^\n]{0,24}?(?:to|–|-|and)\s*(\d+(?:\.\d+)?)\s*°?\s*([CF])?/gi,
    ),
  ];

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

  for (const m of tempPairs) {
    const label = m[0].toLowerCase();
    const min = toF(Number(m[1]), m[2]);
    const max = toF(Number(m[3]), m[4]);
    if (label.includes("store") || label.includes("storage")) {
      continue;
    }
    if (label.includes("surface") || label.includes("substrate") || label.includes("steel")) {
      env.substrateTempMinF = env.substrateTempMinF ?? min;
      env.substrateTempMaxF = env.substrateTempMaxF ?? max;
    } else {
      env.ambientTempMinF = env.ambientTempMinF ?? min;
      env.ambientTempMaxF = env.ambientTempMaxF ?? max;
    }
  }

  const minOnly = t.match(
    /(?:minimum|min\.?)\s+(?:air|ambient|surface|substrate|application)?\s*(?:temp(?:erature)?)?[^\n]{0,20}?(\d+)\s*°?\s*([CF])?/i,
  );
  if (minOnly && env.ambientTempMinF == null) {
    env.ambientTempMinF = toF(Number(minOnly[1]), minOnly[2]);
  }

  const rh = t.match(/relative humidity[^\n]{0,40}?(\d+)\s*%/i);
  if (rh) env.relativeHumidityMax = Number(rh[1]);

  const dew = t.match(/(\d+(?:\.\d+)?)\s*°?\s*([CF])?\s*(?:above|over|higher than)\s+(?:the\s+)?dew/i);
  if (dew) env.dewPointSpreadMinF = toF(Number(dew[1]), dew[2]);

  const storageRange = firstMatch(t, [
    /stor(?:e|age)[^\n]{0,40}?(\d+\s*°?\s*[CF][^\n]{0,20}\d+\s*°?\s*[CF])/i,
    /store(?:d)?\s+(?:indoors\s+)?at[:\s]+([^\n]+)/i,
  ]);

  const holdPoints: HoldPoint[] = [
    { step: 1, name: "Material receipt", criteria: shelf ? `Unexpired (${shelf})` : "Verify batch and shelf life", owner: "QC", timing: "Before staging", source: "inferred" },
    { step: 2, name: "Storage check", criteria: storageRange || "Stored per PDS temperature and dryness", owner: "QC", timing: "Before issuing to the crew", source: "inferred" },
    { step: 3, name: "Credentials", criteria: "Applicator / inspector credentials on file", owner: "QC", timing: "Before work", source: "inferred" },
    { step: 4, name: "Surface preparation", criteria: methodsPrep.slice(0, 3).join(", ") || "Prep per PDS / spec", owner: "QC", timing: "Before coating or placement", source: methodsPrep.length ? "stated" : "inferred" },
    { step: 5, name: "Ambient / dew point", criteria: "In-window air, substrate, RH, dew-point spread; no precipitation", owner: "Applicator + QC", timing: "Immediately before application", source: "inferred" },
    { step: 6, name: "Mix", criteria: mixRatio ? `Ratio ${mixRatio}` : "Mix per PDS", owner: "Applicator", timing: "At combine; mark pot-life start", source: mixRatio ? "stated" : "inferred" },
    { step: 7, name: "Application", criteria: dft || "Film build / placement per PDS", owner: "Applicator + QC", timing: "During work (WFT / workmanship)", source: dft ? "stated" : "inferred" },
    { step: 8, name: "Cure / recoat", criteria: [recoatMin, recoatMax].filter(Boolean).join(" · ") || "Inside recoat window", owner: "QC", timing: "Before next coat or service", source: recoatMin ? "stated" : "inferred" },
    { step: 9, name: "Final inspection", criteria: "Acceptance tests per PDS / project spec", owner: "QC / owner", timing: "After required cure", source: "inferred" },
  ];

  const ppe = allMatches(t, /(respirator|goggles|gloves|protective clothing|eye protection|face shield|tyvek)/gi);

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
      service: firstMatch(t, [/service[:\s]+([^\n]+)/i]),
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
      substrates: allMatches(t, /(mill[\s-]?scale|bare steel|carbon steel|galvanized|aluminum|aluminium|light painted concrete|dark painted concrete|painted concrete|concrete|wood|glass)/gi),
      methods: methodsPrep,
      profile,
      cleanliness: firstMatch(t, [/cleanliness[:\s]+([^\n]+)/i]),
      moisture: firstMatch(t, [/(surface must be dry[^\n]*)/i, /moisture[:\s]+([^\n]+)/i]),
      notes: "",
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
      methods: allMatches(t, /(airless|conventional spray|brush|roller|trowel|squeegee|caulk|plural)/gi),
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
