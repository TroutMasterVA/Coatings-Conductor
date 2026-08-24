import type { Calibration, CustomMitigation } from "./types";

export type SubstrateId =
  | "bare_steel"
  | "mill_scale"
  | "concrete"
  | "concrete_light_paint"
  | "concrete_dark_paint"
  | "wood"
  | "glass"
  | "aluminum"
  | "galvanized";

export type MitigationId =
  | "canopy"
  | "rain_tarp"
  | "fog_mist"
  | "night_shift"
  | "light_tent"
  | "dark_tent"
  | "dehumidify_tent"
  | "humidity_tent"
  | "climate_tent"
  | "early_start"
  | "heaters"
  | "preheat"
  | "windscreen";

export type Discipline = "coatings" | "cementitious" | "sealant" | "adhesive";
export type Limiter = "heat" | "solar" | "cold" | "rh" | "dew" | "rain" | "wind";
export type StandardBody = "ACI" | "ASTM" | "AMPP" | "NACE" | "SSPC" | "ICRI";
export type MitigationKind = "independent" | "package";

export type SiteContext = {
  substrate: SubstrateId;
  mitigations: MitigationId[];
  moistureTolerant?: boolean;
  discipline?: Discipline;
  bodies?: StandardBody[];
  calibration?: Calibration;
  customMitigations?: CustomMitigation[];
  customMitigationIds?: string[];
};

export const SUBSTRATES: {
  id: SubstrateId;
  label: string;
  peakGainF: number;
  metal: boolean;
  note: string;
}[] = [
  {
    id: "bare_steel",
    label: "Bare steel",
    peakGainF: 46,
    metal: true,
    note: "Blasted or bright carbon steel in full sun typically runs 40–55°F above air.",
  },
  {
    id: "mill_scale",
    label: "Mill scale steel",
    peakGainF: 54,
    metal: true,
    note: "Blue-black mill scale soaks solar harder than bare steel — often 50–60°F above air.",
  },
  {
    id: "concrete",
    label: "Concrete",
    peakGainF: 22,
    metal: false,
    note: "Gray mass lags air and holds afternoon heat into the evening.",
  },
  {
    id: "concrete_light_paint",
    label: "Light painted concrete",
    peakGainF: 10,
    metal: false,
    note: "High albedo. Stays much closer to air than bare or dark-painted concrete.",
  },
  {
    id: "concrete_dark_paint",
    label: "Dark painted concrete",
    peakGainF: 40,
    metal: false,
    note: "Dark film on mass. Afternoon faces can run like hot steel.",
  },
  {
    id: "wood",
    label: "Wood",
    peakGainF: 16,
    metal: false,
    note: "Lower peak than metal; still above air in sun, and slow to dump heat.",
  },
  {
    id: "glass",
    label: "Glass",
    peakGainF: 12,
    metal: false,
    note: "Low absorptance. Tracks air more than steel; watch dew on the lite, not solar bake.",
  },
  {
    id: "aluminum",
    label: "Aluminum",
    peakGainF: 18,
    metal: true,
    note: "Light metal heats fast but not as hot as bare or mill-scale steel.",
  },
  {
    id: "galvanized",
    label: "Galvanized steel",
    peakGainF: 26,
    metal: true,
    note: "Zinc is more reflective than carbon steel; still well above air in full sun.",
  },
];

export type MitigationDef = {
  id: MitigationId;
  label: string;
  summary: string;
  citation: string;
  owns: string;
  kind: MitigationKind;
  helps: Limiter[];
  avoid?: Limiter[];
  bodies: StandardBody[];
  disciplines: Array<Discipline | "all">;
  metalOnly?: boolean;
  concreteBare?: boolean;
  conflicts?: MitigationId[];
  core?: boolean;
};

const RAW_MITIGATIONS: MitigationDef[] = [
  {
    id: "canopy",
    label: "Canopy / sunshade",
    owns: "Solar only",
    kind: "independent",
    summary: "Open shade over the workface. Cuts solar gain; air, rain, and wind stay field conditions.",
    citation: "AMPP / NACE: keep steel inside the PDS surface-temperature window. ACI 305R: sunshades for hot-weather placement.",
    helps: ["solar", "heat"],
    bodies: ["AMPP", "NACE", "ACI"],
    disciplines: ["all"],
    core: true,
  },
  {
    id: "rain_tarp",
    label: "Rain tarping",
    owns: "Rain only",
    kind: "independent",
    summary:
      "Temporary rain fly / poly. Sheds showers; open sides — air, sun, RH, and wind stay field. Not a canopy and not a tent.",
    citation:
      "AMPP / NACE / SSPC: keep the coating dry until water-resistant. ACI 308R: protect fresh cementitious work from rain. Stake, pitch, and drain — wind-driven rain can still wet the face.",
    helps: ["rain"],
    bodies: ["AMPP", "NACE", "SSPC", "ACI"],
    disciplines: ["all"],
    core: true,
  },
  {
    id: "windscreen",
    label: "Wind block",
    owns: "Wind only",
    kind: "independent",
    summary: "Open-face screens. Cuts effective wind for spray and overspray. Does not shade, shed rain, or change air or RH.",
    citation: "SSPC spray practice; ACI 308 / 305R windbreaks to limit evaporation on concrete.",
    helps: ["wind"],
    bodies: ["SSPC", "ACI"],
    disciplines: ["all"],
    core: true,
  },
  {
    id: "fog_mist",
    label: "Water fog / mist cooldown",
    owns: "Heat cooldown",
    kind: "independent",
    summary: "Evaporative cool-down. Metals: mist, wipe dry, re-log dew point before coating. Concrete: ACI fogging — do not puddle under a coating.",
    citation: "NACE / SSPC: surface dry and ≥5°F above dew point before coating. ACI 305R: fogging/misting to cool the placement.",
    helps: ["heat", "solar"],
    bodies: ["NACE", "SSPC", "AMPP", "ACI"],
    disciplines: ["all"],
    metalOnly: false,
    concreteBare: true,
    core: true,
  },
  {
    id: "heaters",
    label: "Indirect heaters",
    owns: "Cold · air",
    kind: "independent",
    summary: "Raises air and substrate for a cold floor. Watch solvent and combustion moisture.",
    citation: "ACI 306R: heating enclosures. AMPP: indirect heat only around flammable coatings.",
    helps: ["cold"],
    bodies: ["ACI", "AMPP"],
    disciplines: ["all"],
  },
  {
    id: "preheat",
    label: "Preheat substrate",
    owns: "Cold · steel",
    kind: "independent",
    summary: "Blankets or induction on metal to clear the minimum steel temperature.",
    citation: "NACE / AMPP: steel above PDS minimum and dew point before coating.",
    helps: ["cold"],
    bodies: ["NACE", "AMPP", "ASTM"],
    disciplines: ["coatings", "adhesive", "sealant"],
    metalOnly: true,
  },
  {
    id: "night_shift",
    label: "Night shift",
    owns: "Schedule",
    kind: "independent",
    summary: "Work 19:00–06:00 only. Solar gain drops to zero — the usual fix for sun-loaded steel.",
    citation: "AMPP practice for hot-climate coating. ACI 305R: night placement to dodge peak concrete and ambient temperature.",
    helps: ["solar", "heat"],
    bodies: ["AMPP", "NACE", "ACI"],
    disciplines: ["all"],
    conflicts: ["early_start"],
    core: true,
  },
  {
    id: "early_start",
    label: "Dawn / AM only",
    owns: "Schedule",
    kind: "independent",
    summary: "Work 05:00–10:00, before peak solar. Substrate still cool from overnight.",
    citation: "AMPP hot-weather coating practice. ACI 305R: early-morning placement.",
    helps: ["solar", "heat"],
    bodies: ["AMPP", "ACI"],
    disciplines: ["all"],
    conflicts: ["night_shift"],
  },
  {
    id: "light_tent",
    label: "Light-colored tent",
    owns: "Solar + rain + wind",
    kind: "package",
    summary: "Reflective enclosure. Already covers canopy, rain tarp, and wind block — those independents cannot stack with it.",
    citation: "SSPC / AMPP containment: white or light tarps for hot weather. ACI 305R: light-colored covers over fresh concrete.",
    helps: ["solar", "heat", "rain", "wind"],
    bodies: ["AMPP", "SSPC", "ACI", "ASTM"],
    disciplines: ["all"],
    conflicts: ["dark_tent", "dehumidify_tent", "humidity_tent", "climate_tent", "canopy", "rain_tarp", "windscreen", "fog_mist"],
    core: true,
  },
  {
    id: "dark_tent",
    label: "Dark-colored tent",
    owns: "Cold + rain + wind",
    kind: "package",
    summary: "Absorptive enclosure. Covers rain tarp and wind block; traps heat — use for cold weather, not a hot steel day.",
    citation: "ACI 306R: insulated / dark covers to hold heat in cold weather. Avoid in heat — interior air can exceed PDS max.",
    helps: ["cold", "rain", "wind"],
    avoid: ["heat", "solar"],
    bodies: ["ACI", "AMPP"],
    disciplines: ["all"],
    conflicts: ["light_tent", "dehumidify_tent", "humidity_tent", "climate_tent", "canopy", "rain_tarp", "windscreen"],
    core: true,
  },
  {
    id: "dehumidify_tent",
    label: "Dehumidify tent",
    owns: "RH + dew + rain + wind",
    kind: "package",
    summary: "Enclosed work with mechanical dehumidification. Covers rain tarp and wind block; lowers RH and widens dew spread.",
    citation: "AMPP / NACE: substrate ≥5°F above dew point; SSPC climate control during coating. ASTM D4263 / moisture tests on concrete.",
    helps: ["rh", "dew", "rain", "wind"],
    bodies: ["AMPP", "NACE", "SSPC", "ASTM"],
    disciplines: ["coatings", "sealant", "adhesive"],
    conflicts: ["humidity_tent", "climate_tent", "light_tent", "dark_tent", "canopy", "rain_tarp", "windscreen"],
    core: true,
  },
  {
    id: "humidity_tent",
    label: "Humidity / moist-cure tent",
    owns: "Moist-cure · rain + wind",
    kind: "package",
    summary: "Holds moisture around cementitious work. Covers rain tarp and wind block. Wrong for solvent or epoxy that needs a dry face.",
    citation: "ACI 308R: moist curing of cementitious materials. Do not use on AMPP/NACE coating applications that require a dry substrate.",
    helps: ["wind", "rain"],
    avoid: ["rh", "dew"],
    bodies: ["ACI", "ASTM"],
    disciplines: ["cementitious"],
    conflicts: ["dehumidify_tent", "climate_tent", "light_tent", "dark_tent", "canopy", "rain_tarp", "windscreen"],
    core: true,
  },
  {
    id: "climate_tent",
    label: "Climate-control tent",
    owns: "Full environment",
    kind: "package",
    summary: "Conditioned enclosure — temperature, humidity, sun, rain, and wind. Replaces all independent covers and other tents.",
    citation: "AMPP / NACE / SSPC: controlled ambient for coating when field air is out of spec. ACI 305R/306R for extreme hot or cold placement.",
    helps: ["heat", "cold", "rh", "dew", "rain", "solar", "wind"],
    bodies: ["AMPP", "NACE", "SSPC", "ACI", "ASTM"],
    disciplines: ["all"],
    conflicts: [
      "light_tent",
      "dark_tent",
      "dehumidify_tent",
      "humidity_tent",
      "canopy",
      "rain_tarp",
      "windscreen",
      "fog_mist",
      "heaters",
      "preheat",
    ],
    core: true,
  },
];

function symmetrizeConflicts(list: MitigationDef[]): MitigationDef[] {
  const sets = new Map<MitigationId, Set<MitigationId>>();
  for (const m of list) sets.set(m.id, new Set(m.conflicts ?? []));
  for (const [id, set] of sets) {
    for (const other of set) {
      sets.get(other)?.add(id);
    }
  }
  return list.map((m) => ({ ...m, conflicts: [...(sets.get(m.id) ?? [])] }));
}

export const MITIGATIONS: MitigationDef[] = symmetrizeConflicts(RAW_MITIGATIONS);

export function substrateById(id: SubstrateId) {
  return SUBSTRATES.find((s) => s.id === id) ?? SUBSTRATES[0];
}

export function mitigationById(id: MitigationId) {
  return MITIGATIONS.find((m) => m.id === id);
}

export function coveringPackage(id: MitigationId, selected: MitigationId[]): MitigationDef | undefined {
  const def = mitigationById(id);
  if (!def || def.kind === "package") return undefined;
  for (const s of selected) {
    const p = mitigationById(s);
    if (p?.kind === "package" && p.conflicts?.includes(id)) return p;
  }
  return undefined;
}

export function isConflicted(id: MitigationId, selected: MitigationId[]) {
  if (selected.includes(id)) return false;
  const def = mitigationById(id);
  if (!def) return false;
  if (def.kind === "package") {
    return Boolean(def.conflicts?.some((c) => selected.includes(c) && mitigationById(c)?.kind === "package"));
  }
  return Boolean(def.conflicts?.some((c) => selected.includes(c)));
}

export function sanitizeMitigations(selected: MitigationId[]): MitigationId[] {
  const uniq = [...new Set(selected.filter((id) => Boolean(mitigationById(id))))];
  const packages = uniq.filter((id) => mitigationById(id)?.kind === "package");
  let keepPackage: MitigationId | undefined;
  if (packages.includes("climate_tent")) keepPackage = "climate_tent";
  else if (packages.length) keepPackage = packages[0];
  let next = uniq;
  if (keepPackage) {
    const drop = new Set(mitigationById(keepPackage)?.conflicts ?? []);
    next = uniq.filter((id) => id === keepPackage || !drop.has(id));
  }
  if (next.includes("night_shift") && next.includes("early_start")) {
    next = next.filter((id) => id !== "early_start");
  }
  return next;
}

export function selectMitigation(selected: MitigationId[], id: MitigationId): MitigationId[] {
  const def = mitigationById(id);
  if (!def) return sanitizeMitigations(selected);
  if (def.kind !== "package" && coveringPackage(id, selected)) return sanitizeMitigations(selected);
  return sanitizeMitigations([...selected.filter((m) => m !== id && !def.conflicts?.includes(m)), id]);
}

function matchSubstrate(blob: string): SubstrateId | null {
  const t = blob.toLowerCase();
  if (!t.trim()) return null;
  if (/mill[\s-]?scale/.test(t)) return "mill_scale";
  if (/galvaniz/.test(t)) return "galvanized";
  if (/aluminium|aluminum/.test(t)) return "aluminum";
  if (/\bglass\b|glazing|curtain wall/.test(t)) return "glass";
  if (/wood|timber/.test(t)) return "wood";
  if (/concrete/.test(t) && /(light|white|pastel).{0,12}paint|paint.{0,12}(light|white)/.test(t)) {
    return "concrete_light_paint";
  }
  if (/concrete/.test(t) && /(dark|black|charcoal).{0,12}paint|paint.{0,12}(dark|black)|dark painted/.test(t)) {
    return "concrete_dark_paint";
  }
  if (/painted concrete|coated concrete/.test(t)) return "concrete_dark_paint";
  if (/concrete/.test(t)) return "concrete";
  if (/bare steel|blasted|white metal|near-white|carbon steel/.test(t)) return "bare_steel";
  if (/\bsteel\b|ferrous/.test(t)) return "bare_steel";
  return null;
}

export function inferSubstrate(labels: string[] | undefined, productType = ""): SubstrateId {
  for (const label of labels ?? []) {
    const id = matchSubstrate(label);
    if (id) return id;
  }
  return matchSubstrate(productType) ?? "bare_steel";
}

export function isMoistureTolerant(cardNotes: string) {
  return /moisture-tolerant|moisture tolerant|\bssd\b|damp concrete|wet substrate/i.test(cardNotes);
}

export function inferProductRules(blob: string): { discipline: Discipline; bodies: StandardBody[] } {
  const t = blob;
  const found = new Set<StandardBody>();
  if (/\bACI\b/.test(t)) found.add("ACI");
  if (/\bASTM\b/.test(t)) found.add("ASTM");
  if (/\bAMPP\b/.test(t)) found.add("AMPP");
  if (/\bNACE\b/.test(t)) found.add("NACE");
  if (/\bSSPC\b/.test(t)) found.add("SSPC");
  if (/\bICRI\b/.test(t)) found.add("ICRI");

  const low = t.toLowerCase();
  let discipline: Discipline = "coatings";
  if (/cementitious|shotcrete|grout(?!ing bolt)|repair mortar|overlay|concrete repair|portland/.test(low)) {
    discipline = "cementitious";
  } else if (/sealant|caulk|joint seal|polyurethane sealant|silicone/.test(low)) {
    discipline = "sealant";
  } else if (/adhesive|structural epoxy|bonding paste|gel epoxy|anchoring/.test(low)) {
    discipline = "adhesive";
  } else if (/coating|epoxy|urethane|polyurea|zinc|alkyd|paint|lining/.test(low)) {
    discipline = "coatings";
  }

  if (found.size === 0) {
    if (discipline === "cementitious") {
      found.add("ACI");
      found.add("ASTM");
    } else if (discipline === "adhesive") {
      found.add("ACI");
      found.add("ASTM");
    } else if (discipline === "sealant") {
      found.add("ASTM");
    } else {
      found.add("AMPP");
      found.add("NACE");
      found.add("ASTM");
    }
  }
  return { discipline, bodies: [...found] };
}

export function skyFactor(shortForecast: string, cloudCover?: number | null) {
  if (cloudCover != null && Number.isFinite(cloudCover)) {
    return Math.max(0.05, 1 - cloudCover / 110);
  }
  const t = shortForecast.toLowerCase();
  if (/thunder|storm|rain|shower|snow|sleet|drizzle/.test(t)) return 0.08;
  if (/fog|haze/.test(t)) return 0.22;
  if (/mostly (sunny|clear)/.test(t)) return 0.82;
  if (/\b(sunny|clear)\b/.test(t)) return 1;
  if (/partly/.test(t)) return 0.55;
  if (/mostly cloudy|considerable cloud/.test(t)) return 0.28;
  if (/cloud|overcast/.test(t)) return 0.18;
  return 0.5;
}

export function solarEnvelope(hour: number) {
  if (hour < 6 || hour >= 19) return 0;
  const t = (hour + 0.5 - 6) / 13;
  return Math.sin(Math.PI * t);
}

export function inShift(hour: number, mitigations: MitigationId[]) {
  if (mitigations.includes("night_shift")) return hour >= 19 || hour < 6;
  if (mitigations.includes("early_start")) return hour >= 5 && hour < 10;
  return true;
}

export function fogMistAllowed(substrate: SubstrateId) {
  const sub = substrateById(substrate);
  return sub.metal || substrate === "concrete";
}

export function compatibleMitigations(opts: {
  substrate: SubstrateId;
  discipline?: Discipline;
  moistureTolerant?: boolean;
}): MitigationDef[] {
  const sub = substrateById(opts.substrate);
  const discipline = opts.discipline ?? "coatings";
  return MITIGATIONS.filter((m) => {
    if (m.metalOnly && !sub.metal) return false;
    if (m.id === "fog_mist" && !fogMistAllowed(opts.substrate)) return false;
    if (m.id === "humidity_tent" && discipline !== "cementitious") return false;
    if (m.id === "dehumidify_tent" && discipline === "cementitious") return false;
    if (!m.disciplines.includes("all") && !m.disciplines.includes(discipline)) return false;
    return true;
  });
}

function limiterFamilies(limiters: Limiter[]) {
  const cover = new Set(limiters);
  return {
    solar: cover.has("heat") || cover.has("solar"),
    rain: cover.has("rain"),
    wind: cover.has("wind"),
    moisture: cover.has("rh") || cover.has("dew"),
    cold: cover.has("cold"),
  };
}

export function isRecommended(
  m: MitigationDef,
  opts: {
    substrate: SubstrateId;
    discipline?: Discipline;
    limiters: Limiter[];
    unlocksHours: number;
  },
) {
  if (m.avoid?.some((l) => opts.limiters.includes(l)) && !m.helps.some((l) => opts.limiters.includes(l) && !m.avoid?.includes(l))) {
    return false;
  }
  if (m.id === "dark_tent" && (opts.limiters.includes("heat") || opts.limiters.includes("solar")) && !opts.limiters.includes("cold")) {
    return false;
  }
  if (m.id === "fog_mist" && !fogMistAllowed(opts.substrate)) return false;

  const fam = limiterFamilies(opts.limiters);
  const familyCount = [fam.solar, fam.rain, fam.wind, fam.moisture, fam.cold].filter(Boolean).length;

  if (opts.limiters.length === 0) {
    const hotFace = substrateById(opts.substrate).peakGainF >= 30;
    return hotFace && (m.id === "canopy" || m.id === "night_shift");
  }

  if (m.kind === "package") {
    if (m.id === "climate_tent") return familyCount >= 3 && opts.unlocksHours > 0;
    if (m.id === "light_tent") {
      const n = [fam.solar, fam.rain, fam.wind].filter(Boolean).length;
      return n >= 2 && opts.unlocksHours > 0;
    }
    if (m.id === "dark_tent") return fam.cold && (fam.rain || fam.wind) && opts.unlocksHours > 0;
    if (m.id === "dehumidify_tent") return fam.moisture && opts.unlocksHours > 0;
    if (m.id === "humidity_tent") return (fam.wind || fam.rain) && opts.unlocksHours > 0;
    return familyCount >= 2 && opts.unlocksHours > 0;
  }

  const helpsNow = m.helps.some((l) => opts.limiters.includes(l));
  if (!helpsNow) return false;
  return opts.unlocksHours > 0 || m.id === "canopy" || m.id === "rain_tarp" || m.id === "windscreen" || m.id === "night_shift" || m.id === "fog_mist";
}

export function peakExample(substrate: SubstrateId, airF = 80) {
  const sub = substrateById(substrate);
  const gain = Math.round(sub.peakGainF * solarEnvelope(13) * 1);
  return {
    airF,
    substrateF: airF + gain,
    gain,
    note: sub.note,
  };
}
