import { n as axes, o as lerp, t as DEFAULT_CALIBRATION } from "./learning-CQdNi_eK.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/score-windows-CQikBYHv.js
var SUBSTRATES = [
	{
		id: "bare_steel",
		label: "Bare steel",
		peakGainF: 46,
		metal: true,
		note: "Blasted or bright carbon steel in full sun typically runs 40–55°F above air."
	},
	{
		id: "mill_scale",
		label: "Mill scale steel",
		peakGainF: 54,
		metal: true,
		note: "Blue-black mill scale soaks solar harder than bare steel — often 50–60°F above air."
	},
	{
		id: "concrete",
		label: "Concrete",
		peakGainF: 22,
		metal: false,
		note: "Gray mass lags air and holds afternoon heat into the evening."
	},
	{
		id: "concrete_light_paint",
		label: "Light painted concrete",
		peakGainF: 10,
		metal: false,
		note: "High albedo. Stays much closer to air than bare or dark-painted concrete."
	},
	{
		id: "concrete_dark_paint",
		label: "Dark painted concrete",
		peakGainF: 40,
		metal: false,
		note: "Dark film on mass. Afternoon faces can run like hot steel."
	},
	{
		id: "wood",
		label: "Wood",
		peakGainF: 16,
		metal: false,
		note: "Lower peak than metal; still above air in sun, and slow to dump heat."
	},
	{
		id: "glass",
		label: "Glass",
		peakGainF: 12,
		metal: false,
		note: "Low absorptance. Tracks air more than steel; watch dew on the lite, not solar bake."
	},
	{
		id: "aluminum",
		label: "Aluminum",
		peakGainF: 18,
		metal: true,
		note: "Light metal heats fast but not as hot as bare or mill-scale steel."
	},
	{
		id: "galvanized",
		label: "Galvanized steel",
		peakGainF: 26,
		metal: true,
		note: "Zinc is more reflective than carbon steel; still well above air in full sun."
	}
];
var RAW_MITIGATIONS = [
	{
		id: "canopy",
		label: "Canopy / sunshade",
		owns: "Solar only",
		kind: "independent",
		summary: "Open shade over the workface. Cuts solar gain; air, rain, and wind stay field conditions.",
		citation: "AMPP / NACE: keep steel inside the PDS surface-temperature window. ACI 305R: sunshades for hot-weather placement.",
		helps: ["solar", "heat"],
		bodies: [
			"AMPP",
			"NACE",
			"ACI"
		],
		disciplines: ["all"],
		core: true
	},
	{
		id: "rain_tarp",
		label: "Rain tarping",
		owns: "Rain only",
		kind: "independent",
		summary: "Temporary rain fly / poly. Sheds showers; open sides — air, sun, RH, and wind stay field. Not a canopy and not a tent.",
		citation: "AMPP / NACE / SSPC: keep the coating dry until water-resistant. ACI 308R: protect fresh cementitious work from rain. Stake, pitch, and drain — wind-driven rain can still wet the face.",
		helps: ["rain"],
		bodies: [
			"AMPP",
			"NACE",
			"SSPC",
			"ACI"
		],
		disciplines: ["all"],
		core: true
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
		core: true
	},
	{
		id: "fog_mist",
		label: "Water fog / mist cooldown",
		owns: "Heat cooldown",
		kind: "independent",
		summary: "Evaporative cool-down. Metals: mist, wipe dry, re-log dew point before coating. Concrete: ACI fogging — do not puddle under a coating.",
		citation: "NACE / SSPC: surface dry and ≥5°F above dew point before coating. ACI 305R: fogging/misting to cool the placement.",
		helps: ["heat", "solar"],
		bodies: [
			"NACE",
			"SSPC",
			"AMPP",
			"ACI"
		],
		disciplines: ["all"],
		metalOnly: false,
		concreteBare: true,
		core: true
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
		disciplines: ["all"]
	},
	{
		id: "preheat",
		label: "Preheat substrate",
		owns: "Cold · steel",
		kind: "independent",
		summary: "Blankets or induction on metal to clear the minimum steel temperature.",
		citation: "NACE / AMPP: steel above PDS minimum and dew point before coating.",
		helps: ["cold"],
		bodies: [
			"NACE",
			"AMPP",
			"ASTM"
		],
		disciplines: [
			"coatings",
			"adhesive",
			"sealant"
		],
		metalOnly: true
	},
	{
		id: "night_shift",
		label: "Night shift",
		owns: "Schedule",
		kind: "independent",
		summary: "Work 19:00–06:00 only. Solar gain drops to zero — the usual fix for sun-loaded steel.",
		citation: "AMPP practice for hot-climate coating. ACI 305R: night placement to dodge peak concrete and ambient temperature.",
		helps: ["solar", "heat"],
		bodies: [
			"AMPP",
			"NACE",
			"ACI"
		],
		disciplines: ["all"],
		conflicts: ["early_start"],
		core: true
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
		conflicts: ["night_shift"]
	},
	{
		id: "light_tent",
		label: "Light-colored tent",
		owns: "Solar + rain + wind",
		kind: "package",
		summary: "Reflective enclosure. Already covers canopy, rain tarp, and wind block — those independents cannot stack with it.",
		citation: "SSPC / AMPP containment: white or light tarps for hot weather. ACI 305R: light-colored covers over fresh concrete.",
		helps: [
			"solar",
			"heat",
			"rain",
			"wind"
		],
		bodies: [
			"AMPP",
			"SSPC",
			"ACI",
			"ASTM"
		],
		disciplines: ["all"],
		conflicts: [
			"dark_tent",
			"dehumidify_tent",
			"humidity_tent",
			"climate_tent",
			"canopy",
			"rain_tarp",
			"windscreen",
			"fog_mist"
		],
		core: true
	},
	{
		id: "dark_tent",
		label: "Dark-colored tent",
		owns: "Cold + rain + wind",
		kind: "package",
		summary: "Absorptive enclosure. Covers rain tarp and wind block; traps heat — use for cold weather, not a hot steel day.",
		citation: "ACI 306R: insulated / dark covers to hold heat in cold weather. Avoid in heat — interior air can exceed PDS max.",
		helps: [
			"cold",
			"rain",
			"wind"
		],
		avoid: ["heat", "solar"],
		bodies: ["ACI", "AMPP"],
		disciplines: ["all"],
		conflicts: [
			"light_tent",
			"dehumidify_tent",
			"humidity_tent",
			"climate_tent",
			"canopy",
			"rain_tarp",
			"windscreen"
		],
		core: true
	},
	{
		id: "dehumidify_tent",
		label: "Dehumidify tent",
		owns: "RH + dew + rain + wind",
		kind: "package",
		summary: "Enclosed work with mechanical dehumidification. Covers rain tarp and wind block; lowers RH and widens dew spread.",
		citation: "AMPP / NACE: substrate ≥5°F above dew point; SSPC climate control during coating. ASTM D4263 / moisture tests on concrete.",
		helps: [
			"rh",
			"dew",
			"rain",
			"wind"
		],
		bodies: [
			"AMPP",
			"NACE",
			"SSPC",
			"ASTM"
		],
		disciplines: [
			"coatings",
			"sealant",
			"adhesive"
		],
		conflicts: [
			"humidity_tent",
			"climate_tent",
			"light_tent",
			"dark_tent",
			"canopy",
			"rain_tarp",
			"windscreen"
		],
		core: true
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
		conflicts: [
			"dehumidify_tent",
			"climate_tent",
			"light_tent",
			"dark_tent",
			"canopy",
			"rain_tarp",
			"windscreen"
		],
		core: true
	},
	{
		id: "climate_tent",
		label: "Climate-control tent",
		owns: "Full environment",
		kind: "package",
		summary: "Conditioned enclosure — temperature, humidity, sun, rain, and wind. Replaces all independent covers and other tents.",
		citation: "AMPP / NACE / SSPC: controlled ambient for coating when field air is out of spec. ACI 305R/306R for extreme hot or cold placement.",
		helps: [
			"heat",
			"cold",
			"rh",
			"dew",
			"rain",
			"solar",
			"wind"
		],
		bodies: [
			"AMPP",
			"NACE",
			"SSPC",
			"ACI",
			"ASTM"
		],
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
			"preheat"
		],
		core: true
	}
];
function symmetrizeConflicts(list) {
	const sets = /* @__PURE__ */ new Map();
	for (const m of list) sets.set(m.id, new Set(m.conflicts ?? []));
	for (const [id, set] of sets) for (const other of set) sets.get(other)?.add(id);
	return list.map((m) => ({
		...m,
		conflicts: [...sets.get(m.id) ?? []]
	}));
}
var MITIGATIONS = symmetrizeConflicts(RAW_MITIGATIONS);
function substrateById(id) {
	return SUBSTRATES.find((s) => s.id === id) ?? SUBSTRATES[0];
}
function mitigationById(id) {
	return MITIGATIONS.find((m) => m.id === id);
}
function coveringPackage(id, selected) {
	const def = mitigationById(id);
	if (!def || def.kind === "package") return void 0;
	for (const s of selected) {
		const p = mitigationById(s);
		if (p?.kind === "package" && p.conflicts?.includes(id)) return p;
	}
}
function isConflicted(id, selected) {
	if (selected.includes(id)) return false;
	const def = mitigationById(id);
	if (!def) return false;
	if (def.kind === "package") return Boolean(def.conflicts?.some((c) => selected.includes(c) && mitigationById(c)?.kind === "package"));
	return Boolean(def.conflicts?.some((c) => selected.includes(c)));
}
function sanitizeMitigations(selected) {
	const uniq = [...new Set(selected.filter((id) => Boolean(mitigationById(id))))];
	const packages = uniq.filter((id) => mitigationById(id)?.kind === "package");
	let keepPackage;
	if (packages.includes("climate_tent")) keepPackage = "climate_tent";
	else if (packages.length) keepPackage = packages[0];
	let next = uniq;
	if (keepPackage) {
		const drop = new Set(mitigationById(keepPackage)?.conflicts ?? []);
		next = uniq.filter((id) => id === keepPackage || !drop.has(id));
	}
	if (next.includes("night_shift") && next.includes("early_start")) next = next.filter((id) => id !== "early_start");
	return next;
}
function selectMitigation(selected, id) {
	const def = mitigationById(id);
	if (!def) return sanitizeMitigations(selected);
	if (def.kind !== "package" && coveringPackage(id, selected)) return sanitizeMitigations(selected);
	return sanitizeMitigations([...selected.filter((m) => m !== id && !def.conflicts?.includes(m)), id]);
}
function matchSubstrate(blob) {
	const t = blob.toLowerCase();
	if (!t.trim()) return null;
	if (/mill[\s-]?scale/.test(t)) return "mill_scale";
	if (/galvaniz/.test(t)) return "galvanized";
	if (/aluminium|aluminum/.test(t)) return "aluminum";
	if (/\bglass\b|glazing|curtain wall/.test(t)) return "glass";
	if (/wood|timber/.test(t)) return "wood";
	if (/concrete/.test(t) && /(light|white|pastel).{0,12}paint|paint.{0,12}(light|white)/.test(t)) return "concrete_light_paint";
	if (/concrete/.test(t) && /(dark|black|charcoal).{0,12}paint|paint.{0,12}(dark|black)|dark painted/.test(t)) return "concrete_dark_paint";
	if (/painted concrete|coated concrete/.test(t)) return "concrete_dark_paint";
	if (/concrete/.test(t)) return "concrete";
	if (/bare steel|blasted|white metal|near-white|carbon steel/.test(t)) return "bare_steel";
	if (/\bsteel\b|ferrous/.test(t)) return "bare_steel";
	return null;
}
function inferSubstrate(labels, productType = "") {
	for (const label of labels ?? []) {
		const id = matchSubstrate(label);
		if (id) return id;
	}
	return matchSubstrate(productType) ?? "bare_steel";
}
function isMoistureTolerant(cardNotes) {
	return /moisture-tolerant|moisture tolerant|\bssd\b|damp concrete|wet substrate/i.test(cardNotes);
}
function inferProductRules(blob) {
	const t = blob;
	const found = /* @__PURE__ */ new Set();
	if (/\bACI\b/.test(t)) found.add("ACI");
	if (/\bASTM\b/.test(t)) found.add("ASTM");
	if (/\bAMPP\b/.test(t)) found.add("AMPP");
	if (/\bNACE\b/.test(t)) found.add("NACE");
	if (/\bSSPC\b/.test(t)) found.add("SSPC");
	if (/\bICRI\b/.test(t)) found.add("ICRI");
	const low = t.toLowerCase();
	let discipline = "coatings";
	if (/cementitious|shotcrete|grout(?!ing bolt)|repair mortar|overlay|concrete repair|portland/.test(low)) discipline = "cementitious";
	else if (/sealant|caulk|joint seal|polyurethane sealant|silicone/.test(low)) discipline = "sealant";
	else if (/adhesive|structural epoxy|bonding paste|gel epoxy|anchoring/.test(low)) discipline = "adhesive";
	else if (/coating|epoxy|urethane|polyurea|zinc|alkyd|paint|lining/.test(low)) discipline = "coatings";
	if (found.size === 0) {
		if (discipline === "cementitious") {
			found.add("ACI");
			found.add("ASTM");
		} else if (discipline === "adhesive") {
			found.add("ACI");
			found.add("ASTM");
		} else if (discipline === "sealant") found.add("ASTM");
		else {
			found.add("AMPP");
			found.add("NACE");
			found.add("ASTM");
		}
	}
	return {
		discipline,
		bodies: [...found]
	};
}
function skyFactor(shortForecast, cloudCover) {
	if (cloudCover != null && Number.isFinite(cloudCover)) return Math.max(.05, 1 - cloudCover / 110);
	const t = shortForecast.toLowerCase();
	if (/thunder|storm|rain|shower|snow|sleet|drizzle/.test(t)) return .08;
	if (/fog|haze/.test(t)) return .22;
	if (/mostly (sunny|clear)/.test(t)) return .82;
	if (/\b(sunny|clear)\b/.test(t)) return 1;
	if (/partly/.test(t)) return .55;
	if (/mostly cloudy|considerable cloud/.test(t)) return .28;
	if (/cloud|overcast/.test(t)) return .18;
	return .5;
}
function solarEnvelope(hour) {
	if (hour < 6 || hour >= 19) return 0;
	const t = (hour + .5 - 6) / 13;
	return Math.sin(Math.PI * t);
}
function inShift(hour, mitigations) {
	if (mitigations.includes("night_shift")) return hour >= 19 || hour < 6;
	if (mitigations.includes("early_start")) return hour >= 5 && hour < 10;
	return true;
}
function fogMistAllowed(substrate) {
	return substrateById(substrate).metal || substrate === "concrete";
}
function compatibleMitigations(opts) {
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
function limiterFamilies(limiters) {
	const cover = new Set(limiters);
	return {
		solar: cover.has("heat") || cover.has("solar"),
		rain: cover.has("rain"),
		wind: cover.has("wind"),
		moisture: cover.has("rh") || cover.has("dew"),
		cold: cover.has("cold")
	};
}
function isRecommended(m, opts) {
	if (m.avoid?.some((l) => opts.limiters.includes(l)) && !m.helps.some((l) => opts.limiters.includes(l) && !m.avoid?.includes(l))) return false;
	if (m.id === "dark_tent" && (opts.limiters.includes("heat") || opts.limiters.includes("solar")) && !opts.limiters.includes("cold")) return false;
	if (m.id === "fog_mist" && !fogMistAllowed(opts.substrate)) return false;
	const fam = limiterFamilies(opts.limiters);
	const familyCount = [
		fam.solar,
		fam.rain,
		fam.wind,
		fam.moisture,
		fam.cold
	].filter(Boolean).length;
	if (opts.limiters.length === 0) return substrateById(opts.substrate).peakGainF >= 30 && (m.id === "canopy" || m.id === "night_shift");
	if (m.kind === "package") {
		if (m.id === "climate_tent") return familyCount >= 3 && opts.unlocksHours > 0;
		if (m.id === "light_tent") return [
			fam.solar,
			fam.rain,
			fam.wind
		].filter(Boolean).length >= 2 && opts.unlocksHours > 0;
		if (m.id === "dark_tent") return fam.cold && (fam.rain || fam.wind) && opts.unlocksHours > 0;
		if (m.id === "dehumidify_tent") return fam.moisture && opts.unlocksHours > 0;
		if (m.id === "humidity_tent") return (fam.wind || fam.rain) && opts.unlocksHours > 0;
		return familyCount >= 2 && opts.unlocksHours > 0;
	}
	if (!m.helps.some((l) => opts.limiters.includes(l))) return false;
	return opts.unlocksHours > 0 || m.id === "canopy" || m.id === "rain_tarp" || m.id === "windscreen" || m.id === "night_shift" || m.id === "fog_mist";
}
function peakExample(substrate, airF = 80) {
	const sub = substrateById(substrate);
	const gain = Math.round(sub.peakGainF * solarEnvelope(13) * 1);
	return {
		airF,
		substrateF: airF + gain,
		gain,
		note: sub.note
	};
}
function zoned(iso, timeZone) {
	const naive = iso.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2})(?::(\d{2}))?(?!.*(?:Z|[+-]\d{2}:\d{2}))/);
	if (naive) {
		const month = Number(naive[2]);
		const day = Number(naive[3]);
		return {
			hour: Number(naive[4]),
			weekday: (/* @__PURE__ */ new Date(`${naive[1]}-${naive[2]}-${naive[3]}T12:00:00Z`)).toLocaleDateString("en-US", {
				weekday: "short",
				timeZone: "UTC"
			}),
			dateLabel: `${month}/${day}`,
			dateKey: `${naive[1]}-${naive[2]}-${naive[3]}`
		};
	}
	const d = new Date(iso);
	const fmt = new Intl.DateTimeFormat("en-US", {
		timeZone,
		weekday: "short",
		hour: "2-digit",
		hourCycle: "h23",
		month: "numeric",
		day: "numeric",
		year: "numeric"
	});
	const map = {};
	for (const p of fmt.formatToParts(d)) if (p.type !== "literal") map[p.type] = p.value;
	const hour = Number(map.hour);
	const month = Number(map.month);
	const day = Number(map.day);
	const year = Number(map.year);
	return {
		hour: Number.isFinite(hour) ? hour : d.getHours(),
		weekday: map.weekday ?? "",
		dateLabel: `${month}/${day}`,
		dateKey: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
	};
}
function hasNumericWindow(env) {
	return env.ambientTempMinF != null || env.ambientTempMaxF != null || env.substrateTempMinF != null || env.substrateTempMaxF != null || env.relativeHumidityMax != null || env.dewPointSpreadMinF != null || env.windMaxMph != null || env.precipitationAllowed === false;
}
function wetForecast(text) {
	return /\b(rain|shower|storm|thunder|snow|sleet|drizzle|precip)/i.test(text);
}
function frozenPrecip(text) {
	return /\b(snow|sleet|ice|freezing rain)\b/i.test(text);
}
function round1(n) {
	return Math.round(n * 10) / 10;
}
function overLimit(value, max, axis, unitSoft = 8) {
	const hardPad = lerp(10, 0, axis);
	const softStart = lerp(unitSoft, 3, axis);
	if (value > max + hardPad) return "hard";
	if (value > max - softStart) return "soft";
	return null;
}
function underLimit(value, min, axis, unitSoft = 8) {
	const hardPad = lerp(10, 0, axis);
	const softStart = lerp(unitSoft, 3, axis);
	if (value < min - hardPad) return "hard";
	if (value < min + softStart) return "soft";
	return null;
}
function scoreHour(raw, env, timeZone = "UTC", site) {
	const z = zoned(raw.startIso, timeZone);
	const reasons = [];
	let hard = 0;
	let soft = 0;
	const mits = sanitizeMitigations((site?.mitigations ?? []).filter((id) => Boolean(mitigationById(id))));
	const sub = substrateById(site?.substrate ?? "bare_steel");
	const shiftOk = inShift(z.hour, mits);
	const discipline = site?.discipline ?? "coatings";
	const cal = axes(site?.calibration ?? DEFAULT_CALIBRATION);
	const customActive = (site?.customMitigations ?? []).filter((c) => site?.customMitigationIds?.includes(c.id));
	let air = raw.tempF;
	let rh = raw.rh;
	let dew = raw.dewpointF;
	let wind = raw.windMph;
	let precipBlocked = env.precipitationAllowed === false;
	const sky = skyFactor(raw.shortForecast, raw.cloudCover);
	let sun = solarEnvelope(z.hour) * sky;
	const envelope = solarEnvelope(z.hour);
	const rainTarp = mits.includes("rain_tarp");
	const lightTent = mits.includes("light_tent");
	const darkTent = mits.includes("dark_tent");
	const dehu = mits.includes("dehumidify_tent");
	const humid = mits.includes("humidity_tent");
	const climate = mits.includes("climate_tent");
	const canopy = mits.includes("canopy");
	const windBlock = mits.includes("windscreen");
	const enclosed = climate || lightTent || darkTent || dehu || humid;
	if (climate) sun = 0;
	else if (lightTent) sun *= .08;
	else if (darkTent) sun *= .12;
	else if (dehu || humid) sun *= .1;
	else if (canopy) sun *= .12;
	if (climate) wind = 0;
	else if (lightTent || darkTent || dehu || humid) wind = wind != null ? wind * .25 : wind;
	else if (windBlock) wind = wind != null ? wind * .4 : wind;
	if (enclosed || rainTarp) precipBlocked = false;
	if (climate && air != null) air = round1(air + (72 - air) * .65);
	else if (mits.includes("heaters") && air != null) air = round1(air + 16);
	else if (lightTent && air != null) air = round1(air + 2 * envelope);
	else if (darkTent && air != null) air = round1(air + 12 * Math.max(envelope, sky > .4 && z.hour >= 8 && z.hour <= 18 ? .35 : 0));
	if (climate) {
		if (rh != null) rh = round1(rh + (48 - rh) * .7);
		if (dew != null && air != null) dew = round1(Math.min(dew, air - 8));
	} else if (dehu) {
		if (rh != null) rh = Math.max(20, rh - 18);
		if (dew != null) dew = round1(dew - 4);
	} else if (humid) {
		if (rh != null) rh = Math.max(rh, discipline === "cementitious" ? 70 : 85);
	}
	for (const cm of customActive) {
		sun *= cm.sunMul > 0 ? cm.sunMul : 1;
		if (air != null) air = round1(air + (cm.dAirF || 0));
		if (rh != null) rh = Math.max(0, Math.min(100, rh + (cm.dRh || 0)));
		if (dew != null) dew = round1(dew + (cm.dDewF || 0));
		if (wind != null) wind = Math.max(0, wind + (cm.dWindMph || 0));
	}
	let solarGain = sun * sub.peakGainF * lerp(.58, 1.18, cal.solar);
	if (z.hour >= 4 && z.hour <= 7) solarGain -= 2;
	let substrateF = air != null ? round1(air + solarGain) : null;
	if (mits.includes("preheat") && sub.metal && substrateF != null && !climate) substrateF = round1(substrateF + 14);
	if (mits.includes("heaters") && substrateF != null && !climate) substrateF = round1(substrateF + 10);
	let fogged = false;
	if (mits.includes("fog_mist") && substrateF != null && solarGain > 3) {
		if (sub.metal) {
			substrateF = round1(substrateF - 22);
			fogged = true;
		} else if (sub.id === "concrete") {
			substrateF = round1(substrateF - 10);
			if (air != null) air = round1(air - 3);
			fogged = true;
		}
	}
	for (const cm of customActive) if (substrateF != null) substrateF = round1(substrateF + (cm.dSubstrateF || 0));
	const skipRhMax = humid && discipline === "cementitious";
	const skipDew = humid && discipline === "cementitious";
	const airMin = env.ambientTempMinF;
	const airMax = env.ambientTempMaxF;
	const subMin = env.substrateTempMinF ?? env.ambientTempMinF;
	const subMax = env.substrateTempMaxF ?? env.ambientTempMaxF;
	if (air != null && airMin != null) {
		const hit = underLimit(air, airMin, cal.thermal);
		if (hit === "hard") {
			reasons.push(`Air ${air}°F below min ${airMin}°F`);
			hard += 1;
		} else if (hit === "soft") {
			reasons.push(`Air ${air}°F near min ${airMin}°F`);
			soft += 1;
		}
	}
	if (air != null && airMax != null) {
		const hit = overLimit(air, airMax, cal.thermal);
		if (hit === "hard") {
			reasons.push(`Air ${air}°F above max ${airMax}°F`);
			hard += 1;
		} else if (hit === "soft") {
			reasons.push(`Air ${air}°F near max ${airMax}°F`);
			soft += 1;
		}
	}
	if (substrateF != null && subMin != null) {
		const hit = underLimit(substrateF, subMin, cal.thermal);
		if (hit === "hard") {
			reasons.push(`${sub.label} ${substrateF}°F below min ${subMin}°F`);
			hard += 1;
		} else if (hit === "soft") {
			reasons.push(`${sub.label} ${substrateF}°F near min`);
			soft += 1;
		}
	}
	if (substrateF != null && subMax != null) {
		const hit = overLimit(substrateF, subMax, cal.thermal);
		if (hit === "hard") {
			reasons.push(`${sub.label} ${substrateF}°F > max ${subMax}°F (air ${air ?? "—"}° + sun ${round1(Math.max(0, solarGain))}°)`);
			hard += 1;
		} else if (hit === "soft") {
			reasons.push(`${sub.label} ${substrateF}°F near max`);
			soft += 1;
		}
	}
	if (rh != null && env.relativeHumidityMax != null && !skipRhMax) {
		const hit = overLimit(rh, env.relativeHumidityMax, cal.moisture, 6);
		if (hit === "hard") {
			reasons.push(`RH ${rh}% above max ${env.relativeHumidityMax}%`);
			hard += 1;
		} else if (hit === "soft") {
			reasons.push(`RH ${rh}% near max`);
			soft += 1;
		}
	}
	const spread = substrateF != null && dew != null ? round1(substrateF - dew) : air != null && dew != null ? round1(air - dew) : null;
	if (spread != null && env.dewPointSpreadMinF != null && !skipDew) {
		const hardPad = lerp(3, 0, cal.moisture);
		const softPad = lerp(4, 1.5, cal.moisture);
		if (spread < env.dewPointSpreadMinF - hardPad) {
			reasons.push(`Dew spread ${spread}°F < ${env.dewPointSpreadMinF}°F`);
			hard += 1;
		} else if (spread < env.dewPointSpreadMinF + softPad) {
			reasons.push(`Dew spread ${spread}°F is thin`);
			soft += 1;
		}
	}
	if (precipBlocked) {
		const nogoPop = lerp(68, 32, cal.precip);
		const softPop = lerp(42, 15, cal.precip);
		if (raw.pop != null && raw.pop >= nogoPop || raw.precipIn != null && raw.precipIn > .02 || wetForecast(raw.shortForecast)) {
			reasons.push(raw.pop != null ? `Precip ${raw.pop}% · ${raw.shortForecast || "wet"}` : raw.shortForecast || "Precipitation risk");
			hard += 1;
		} else if (raw.pop != null && raw.pop >= softPop) {
			reasons.push(`Precip ${raw.pop}%`);
			soft += 1;
		}
	} else if (rainTarp && !lightTent && !darkTent && !dehu && !humid && !climate) {
		if (frozenPrecip(raw.shortForecast)) {
			reasons.push("Rain tarp does not cover snow/sleet — hold");
			hard += 1;
		} else if (/\b(thunder|severe)\b/i.test(raw.shortForecast) || (wind ?? 0) >= 28 && wetForecast(raw.shortForecast)) {
			reasons.push("Rain tarp — stake and pitch; wind-driven rain can still wet the face");
			soft += 1;
		}
	}
	if (wind != null && env.windMaxMph != null) {
		const hit = overLimit(wind, env.windMaxMph, cal.wind, 6);
		if (hit === "hard") {
			reasons.push(`Wind ${Math.round(wind)} mph > ${env.windMaxMph}`);
			hard += 1;
		} else if (hit === "soft") {
			reasons.push(`Wind ${Math.round(wind)} mph near limit`);
			soft += 1;
		}
	}
	if (fogged) {
		if (discipline === "cementitious" || site?.moistureTolerant) {
			reasons.push("Fog/mist cooldown — confirm SSD or dry per PDS before placing");
			soft += 1;
		} else {
			reasons.push("Fog/mist cooldown — wipe dry and re-log dew point before coating (NACE/SSPC)");
			soft += 1;
		}
	}
	if (!shiftOk) {
		reasons.unshift(mits.includes("night_shift") ? "Outside night shift (19:00–06:00)" : "Outside dawn window (05:00–10:00)");
		hard += 1;
	}
	let status = "go";
	if (!hasNumericWindow(env)) status = "unknown";
	else if (hard > 0) status = "nogo";
	else if (soft > 0) status = "caution";
	if (status === "go" && reasons.length === 0) {
		const extra = mits.length ? ` after ${mits.map((id) => mitigationById(id)?.label ?? id).join(", ")}` : "";
		reasons.push(`Inside PDS window${extra}`);
	}
	return {
		startIso: raw.startIso,
		hour: z.hour,
		weekday: z.weekday,
		dateLabel: z.dateLabel,
		status,
		reasons,
		tempF: raw.tempF,
		rh: raw.rh,
		dewpointF: raw.dewpointF,
		spreadF: spread,
		pop: raw.pop,
		precipIn: raw.precipIn,
		windMph: raw.windMph,
		shortForecast: raw.shortForecast,
		dateKey: z.dateKey,
		substrateF,
		solarGainF: round1(Math.max(0, solarGain)),
		inShift: shiftOk
	};
}
function bestRange(hours, wrapNight = false) {
	if (hours.length === 0) return null;
	const preferGo = hours.some((h) => h.status === "go");
	const ok = (h) => preferGo ? h.status === "go" : h.status === "go" || h.status === "caution";
	let bestStart = -1;
	let bestLen = 0;
	let i = 0;
	while (i < hours.length) {
		if (!ok(hours[i])) {
			i += 1;
			continue;
		}
		let j = i;
		while (j < hours.length && ok(hours[j])) j += 1;
		const len = j - i;
		if (len > bestLen) {
			bestLen = len;
			bestStart = i;
		}
		i = j;
	}
	const fmt = (h) => `${String(h).padStart(2, "0")}:00`;
	if (wrapNight && hours.length > 4) {
		let prefix = 0;
		while (prefix < hours.length && ok(hours[prefix])) prefix += 1;
		let suffix = 0;
		while (suffix < hours.length && ok(hours[hours.length - 1 - suffix])) suffix += 1;
		if (prefix > 0 && suffix > 0 && prefix + suffix < hours.length && prefix + suffix >= bestLen) {
			const startH = hours[hours.length - suffix].hour;
			let endH = hours[prefix - 1].hour + 1;
			if (endH >= 24) endH = 24;
			return `${fmt(startH)}–${fmt(endH)}`;
		}
	}
	if (bestStart < 0) return null;
	if (bestLen >= 18) return "All day";
	const a = hours[bestStart];
	let endHour = hours[bestStart + bestLen - 1].hour + 1;
	if (endHour >= 24) endHour = 24;
	return `${fmt(a.hour)}–${fmt(endHour)}`;
}
function bundleDays(hours, meta, env, site) {
	const byDate = /* @__PURE__ */ new Map();
	for (const h of hours) {
		const key = h.dateKey || h.startIso.slice(0, 10);
		const list = byDate.get(key) ?? [];
		list.push(h);
		byDate.set(key, list);
	}
	const wrapNight = Boolean(site?.mitigations.includes("night_shift"));
	const days = [];
	for (const [date, list] of byDate) {
		const goHours = list.filter((h) => h.status === "go").length;
		const cautionHours = list.filter((h) => h.status === "caution").length;
		const nogoHours = list.filter((h) => h.status === "nogo").length;
		const goNeed = Math.round(lerp(2, 5, site?.calibration?.master ?? .55));
		const cautionNeed = Math.round(lerp(2, 5, site?.calibration?.master ?? .55));
		let status = "unknown";
		if (goHours >= goNeed) status = "go";
		else if (goHours > 0 || cautionHours >= cautionNeed) status = "caution";
		else if (list.some((h) => h.status !== "unknown")) status = "nogo";
		const reasonCount = /* @__PURE__ */ new Map();
		for (const h of list) if (h.status === "nogo" || h.status === "caution") {
			const key = h.reasons[0] ?? "";
			if (key) reasonCount.set(key, (reasonCount.get(key) ?? 0) + 1);
		}
		const limiting = [...reasonCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2).map(([k]) => k);
		days.push({
			date,
			weekday: list[0]?.weekday ?? "",
			dateLabel: list[0]?.dateLabel ?? date,
			status,
			goHours,
			cautionHours,
			nogoHours,
			bestRange: bestRange(list, wrapNight),
			limiting,
			hours: list
		});
	}
	days.sort((a, b) => a.date.localeCompare(b.date));
	const scored = hasNumericWindow(env);
	const best = [...days].filter((d) => d.status === "go").sort((a, b) => b.goHours - a.goHours)[0];
	const alt = [...days].filter((d) => d.bestRange).sort((a, b) => b.goHours + b.cautionHours - (a.goHours + a.cautionHours))[0];
	const mitLabel = (site?.mitigations ?? []).map((id) => mitigationById(id)?.label).filter(Boolean).join(" + ");
	const withMits = mitLabel ? ` with ${mitLabel}` : "";
	let headline = "Forecast loaded — PDS has no numeric application window to score against.";
	if (scored && best?.bestRange) headline = `Best window${withMits}: ${best.weekday} ${best.dateLabel}  ${best.bestRange}  (${best.goHours} go hours)`;
	else if (scored && alt?.bestRange) headline = `No clean go-day${withMits}. Least-bad: ${alt.weekday} ${alt.dateLabel}  ${alt.bestRange}`;
	else if (scored) headline = mitLabel ? `Still no in-window hours with ${mitLabel}. Add another mitigation or hold the product.` : "No in-window hours in this forecast. Hold the product or add a mitigation.";
	return {
		...meta,
		days,
		headline
	};
}
function rescoreForecast(forecast, env, site) {
	const raw = forecast.rawHours ?? [];
	if (!raw.length) return forecast;
	return bundleDays(raw.map((h) => scoreHour(h, env, forecast.timezone, site)), {
		zip: forecast.zip,
		city: forecast.city,
		state: forecast.state,
		lat: forecast.lat,
		lon: forecast.lon,
		timezone: forecast.timezone,
		source: forecast.source,
		issuedAt: forecast.issuedAt,
		rawHours: raw
	}, env, site);
}
function goHourCount(forecast, env, site) {
	return (forecast.rawHours ?? []).map((h) => scoreHour(h, env, forecast.timezone, site)).filter((h) => h.status === "go").length;
}
function unlockedGoHours(forecast, env, site) {
	const raw = forecast.rawHours ?? [];
	const none = {
		...site,
		mitigations: []
	};
	let n = 0;
	for (const h of raw) {
		const a = scoreHour(h, env, forecast.timezone, none);
		const b = scoreHour(h, env, forecast.timezone, site);
		if (a.status !== "go" && b.status === "go") n += 1;
	}
	return n;
}
function detectLimiters(forecast, env, site) {
	const raw = forecast.rawHours ?? [];
	const none = {
		...site,
		mitigations: []
	};
	const counts = {
		heat: 0,
		solar: 0,
		cold: 0,
		rh: 0,
		dew: 0,
		rain: 0,
		wind: 0
	};
	for (const h of raw) {
		const scored = scoreHour(h, env, forecast.timezone, none);
		if (scored.status !== "nogo" && scored.status !== "caution") continue;
		const text = scored.reasons.join(" ");
		if (/sun |solar/.test(text) || (scored.solarGainF ?? 0) > 10 && /above max/.test(text)) counts.solar += 1;
		if (/above max/.test(text)) counts.heat += 1;
		if (/below min/.test(text)) counts.cold += 1;
		if (/\bRH\b/.test(text)) counts.rh += 1;
		if (/Dew/.test(text)) counts.dew += 1;
		if (/Precip|wet/i.test(text)) counts.rain += 1;
		if (/Wind/.test(text)) counts.wind += 1;
	}
	return Object.entries(counts).filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]).map(([k]) => k);
}
//#endregion
export { selectMitigation as _, detectLimiters as a, inferSubstrate as c, isRecommended as d, mitigationById as f, scoreHour as g, sanitizeMitigations as h, coveringPackage as i, isConflicted as l, rescoreForecast as m, bundleDays as n, goHourCount as o, peakExample as p, compatibleMitigations as r, inferProductRules as s, SUBSTRATES as t, isMoistureTolerant as u, substrateById as v, unlockedGoHours as y };
