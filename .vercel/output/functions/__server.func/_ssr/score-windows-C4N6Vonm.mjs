//#region node_modules/.nitro/vite/services/ssr/assets/score-windows-C4N6Vonm.js
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
var MITIGATIONS = [
	{
		id: "canopy",
		label: "Canopy / sunshade",
		summary: "Open shade over the workface. Cuts solar gain; air stays ambient.",
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
		id: "fog_mist",
		label: "Water fog / mist cooldown",
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
		id: "night_shift",
		label: "Night shift",
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
		id: "light_tent",
		label: "Light-colored tent",
		summary: "Reflective enclosure. Kills rain and most sun without cooking the interior the way a dark tarp will.",
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
		conflicts: ["dark_tent"],
		core: true
	},
	{
		id: "dark_tent",
		label: "Dark-colored tent",
		summary: "Absorptive enclosure. Shades the work but traps heat in the sun — use for cold weather, not a hot steel day.",
		citation: "ACI 306R: insulated / dark covers to hold heat in cold weather. Avoid in heat — interior air can exceed PDS max.",
		helps: [
			"cold",
			"rain",
			"wind"
		],
		avoid: ["heat", "solar"],
		bodies: ["ACI", "AMPP"],
		disciplines: ["all"],
		conflicts: ["light_tent"],
		core: true
	},
	{
		id: "dehumidify_tent",
		label: "Dehumidify tent",
		summary: "Enclosed work with mechanical dehumidification. Lowers RH and widens dew-point spread.",
		citation: "AMPP / NACE: substrate ≥5°F above dew point; SSPC climate control during coating. ASTM D4263 / moisture tests on concrete.",
		helps: [
			"rh",
			"dew",
			"rain"
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
		core: true
	},
	{
		id: "humidity_tent",
		label: "Humidity / moist-cure tent",
		summary: "Holds moisture around cementitious work. Wrong for solvent or epoxy coatings that need a dry face.",
		citation: "ACI 308R: moist curing of cementitious materials. Do not use on AMPP/NACE coating applications that require a dry substrate.",
		helps: ["wind"],
		avoid: ["rh", "dew"],
		bodies: ["ACI", "ASTM"],
		disciplines: ["cementitious"],
		conflicts: ["dehumidify_tent"],
		core: true
	},
	{
		id: "climate_tent",
		label: "Climate-control tent",
		summary: "Conditioned enclosure — temperature, humidity, and weather. The full AMPP environmental-control package.",
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
		core: true
	},
	{
		id: "early_start",
		label: "Dawn / AM only",
		summary: "Work 05:00–10:00, before peak solar. Substrate still cool from overnight.",
		citation: "AMPP hot-weather coating practice. ACI 305R: early-morning placement.",
		helps: ["solar", "heat"],
		bodies: ["AMPP", "ACI"],
		disciplines: ["all"],
		conflicts: ["night_shift"]
	},
	{
		id: "heaters",
		label: "Indirect heaters",
		summary: "Raises air and substrate for a cold floor. Watch solvent and combustion moisture.",
		citation: "ACI 306R: heating enclosures. AMPP: indirect heat only around flammable coatings.",
		helps: ["cold"],
		bodies: ["ACI", "AMPP"],
		disciplines: ["all"]
	},
	{
		id: "preheat",
		label: "Preheat substrate",
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
		id: "windscreen",
		label: "Wind screens",
		summary: "Cuts effective wind for spray and overspray. Does not cool the workface.",
		citation: "SSPC spray practice; ACI 308 / 305R windbreaks to limit evaporation on concrete.",
		helps: ["wind"],
		bodies: ["SSPC", "ACI"],
		disciplines: ["all"]
	}
];
function substrateById(id) {
	return SUBSTRATES.find((s) => s.id === id) ?? SUBSTRATES[0];
}
function mitigationById(id) {
	return MITIGATIONS.find((m) => m.id === id);
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
function isRecommended(m, opts) {
	if (m.avoid?.some((l) => opts.limiters.includes(l)) && !m.helps.some((l) => opts.limiters.includes(l) && !m.avoid?.includes(l))) return false;
	if (m.id === "dark_tent" && (opts.limiters.includes("heat") || opts.limiters.includes("solar")) && !opts.limiters.includes("cold")) return false;
	if (m.id === "climate_tent") return opts.limiters.length >= 3 && opts.unlocksHours > 0;
	const helpsNow = m.helps.some((l) => opts.limiters.includes(l));
	if (!helpsNow && opts.limiters.length > 0) return false;
	if (opts.limiters.length === 0) return substrateById(opts.substrate).peakGainF >= 30 && (m.id === "canopy" || m.id === "night_shift" || m.id === "light_tent");
	if (m.id === "fog_mist" && !fogMistAllowed(opts.substrate)) return false;
	return helpsNow && (opts.unlocksHours > 0 || m.id === "canopy" || m.id === "light_tent" || m.id === "night_shift" || m.id === "fog_mist" || m.id === "dehumidify_tent" || m.id === "humidity_tent");
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
var KEY = "fieldcard.learning.v1";
var DEFAULT_CALIBRATION = {
	master: .55,
	solar: .55,
	thermal: .55,
	moisture: .55,
	precip: .55,
	wind: .55,
	linked: true
};
function clamp01(n) {
	return Math.min(1, Math.max(0, n));
}
function lerp(a, b, t) {
	return a + (b - a) * clamp01(t);
}
function axes(cal) {
	if (cal.linked) return {
		solar: cal.master,
		thermal: cal.master,
		moisture: cal.master,
		precip: cal.master,
		wind: cal.master
	};
	return cal;
}
function empty() {
	return {
		calibration: { ...DEFAULT_CALIBRATION },
		outcomes: [],
		custom: []
	};
}
function read() {
	if (typeof window === "undefined") return empty();
	try {
		const raw = localStorage.getItem(KEY);
		if (!raw) return empty();
		const parsed = JSON.parse(raw);
		return {
			calibration: {
				...DEFAULT_CALIBRATION,
				...parsed.calibration ?? {}
			},
			outcomes: parsed.outcomes ?? [],
			custom: parsed.custom ?? []
		};
	} catch {
		return empty();
	}
}
function write(store) {
	localStorage.setItem(KEY, JSON.stringify(store));
}
function loadLearning() {
	return read();
}
function saveCalibration(calibration) {
	const s = read();
	s.calibration = calibration;
	write(s);
}
function tightnessLabel(v) {
	if (v < .28) return "Open — field judgment";
	if (v < .45) return "Lean open";
	if (v < .62) return "Balanced";
	if (v < .8) return "Lean spec-hard";
	return "Spec-hard";
}
function dayGoHoursNeeded(master) {
	return Math.round(lerp(2, 5, master));
}
/** Live copy for an unlocked tightness slider — numbers match score-windows.ts. */
function axisImpact(id, v) {
	if (id === "solar") return {
		id,
		label: "Solar on substrate",
		why: "NOAA is air at the ZIP. This scales how hot we model the workface in sun before checking the PDS surface-temp max.",
		live: `Steel in sun modeled at ${Math.round(lerp(58, 118, v))}% of catalog solar gain`,
		left: "Cooler workface — closer to air temp, more GO on hot days",
		right: "Full solar bake — hotter substrate, more heat NO-GOs"
	};
	if (id === "thermal") {
		const hard = Math.round(lerp(10, 0, v));
		const soft = Math.round(lerp(8, 3, v));
		return {
			id,
			label: "Air / surface temp",
			why: "Does not change the PDS min/max. It changes how close air and substrate must be before the hour flips caution or no-go.",
			live: hard === 0 ? `No-go at the PDS number · caution within ${soft}°F` : `No-go ${hard}°F past PDS min/max · caution starts ${soft}°F inside`,
			left: "Field pad — about 10°F past spec before a hard no-go",
			right: "Inspector-tight — no-go at the PDS temperature"
		};
	}
	if (id === "moisture") {
		const rhPad = Math.round(lerp(10, 0, v));
		const dewHard = Math.round(lerp(3, 0, v) * 10) / 10;
		const dewSoft = Math.round(lerp(4, 1.5, v) * 10) / 10;
		return {
			id,
			label: "Dew point & RH",
			why: "RH max and dew-point spread (usually ≥5°F above dew). Open this if the workface reads drier than NOAA; harden it after a condensation miss.",
			live: rhPad === 0 ? `RH no-go at PDS max · dew spread no-go at spec (${dewSoft}°F caution band)` : `RH no-go ${rhPad}% over max · dew can be ${dewHard}°F thinner than spec before no-go`,
			left: "Forgiving RH and a thinner dew-spread before stop",
			right: "NACE/SSPC tight — RH max and dew spread are exact"
		};
	}
	if (id === "precip") return {
		id,
		label: "Rain call",
		why: "When the PDS forbids precipitation. NOAA PoP is not a rain gauge — this is how sure we must be before we stop the hour.",
		live: `Rain no-go at ≥${Math.round(lerp(68, 32, v))}% chance · caution at ≥${Math.round(lerp(42, 15, v))}%`,
		left: "Stop only on a likely wet hour (~68%+) or a wet wording",
		right: "Stop early — no-go around 32% PoP, caution from 15%"
	};
	const hard = Math.round(lerp(10, 0, v));
	const soft = Math.round(lerp(6, 3, v));
	return {
		id: "wind",
		label: "Wind",
		why: "Spray, overspray, and solvent pop. Does not change the PDS wind max — only the pad around it.",
		live: hard === 0 ? `No-go at the PDS wind max · caution within ${soft} mph` : `No-go ${hard} mph over PDS wind max · caution ${soft} mph inside`,
		left: "Field pad — about 10 mph over spec before a hard no-go",
		right: "No-go at the PDS wind number"
	};
}
function applyOutcomeToCalibration(cal, outcome) {
	const next = { ...cal };
	const step = .07;
	const bump = (key, delta) => {
		next[key] = clamp01(next[key] + delta);
	};
	if (outcome.actual === "false_nogo") {
		bump("master", -.07);
		bump("thermal", -.07);
	} else if (outcome.actual === "false_go") {
		bump("master", step);
		bump("thermal", step);
	}
	if (outcome.forecastSteel != null && outcome.measuredSteel != null && outcome.measuredAir != null) {
		const modeled = outcome.forecastSteel - (outcome.forecastAir ?? outcome.measuredAir);
		const seen = outcome.measuredSteel - outcome.measuredAir;
		if (Math.abs(modeled) > 2) bump("solar", clamp01(.5 + (1 - seen / modeled) * .35) - .5);
	}
	if (next.linked) {
		next.solar = next.master;
		next.thermal = next.master;
		next.moisture = next.master;
		next.precip = next.master;
		next.wind = next.master;
	}
	return next;
}
function recordOutcome(outcome, cal) {
	const full = {
		...outcome,
		id: crypto.randomUUID(),
		at: (/* @__PURE__ */ new Date()).toISOString()
	};
	const s = read();
	s.outcomes = [full, ...s.outcomes].slice(0, 200);
	s.calibration = applyOutcomeToCalibration(cal, full);
	write(s);
	return {
		outcome: full,
		calibration: s.calibration,
		count: s.outcomes.length
	};
}
function upsertCustomMitigation(input) {
	const d = (a, b) => a != null && b != null ? b - a : 0;
	const dAir = d(input.before.air, input.after.air);
	const dSteel = d(input.before.steel, input.after.steel);
	const dRh = d(input.before.rh, input.after.rh);
	const dDew = d(input.before.dew, input.after.dew);
	const dWind = d(input.before.wind, input.after.wind);
	let sunMul = 1;
	if (input.before.steel != null && input.before.air != null && input.after.steel != null && input.after.air != null) {
		const g0 = input.before.steel - input.before.air;
		const g1 = input.after.steel - input.after.air;
		if (g0 > 2) sunMul = Math.min(1.15, Math.max(.05, g1 / g0));
	}
	const s = read();
	const existing = s.custom.find((c) => c.label.trim().toLowerCase() === input.label.trim().toLowerCase());
	if (existing) {
		const n = existing.samples + 1;
		existing.samples = n;
		existing.dAirF = existing.dAirF + (dAir - existing.dAirF) / n;
		existing.dSubstrateF = existing.dSubstrateF + (dSteel - existing.dSubstrateF) / n;
		existing.dRh = existing.dRh + (dRh - existing.dRh) / n;
		existing.dDewF = existing.dDewF + (dDew - existing.dDewF) / n;
		existing.dWindMph = existing.dWindMph + (dWind - existing.dWindMph) / n;
		existing.sunMul = existing.sunMul + (sunMul - existing.sunMul) / n;
		existing.summary = input.summary || existing.summary;
		existing.notes = input.notes || existing.notes;
		existing.helps = input.helps.length ? input.helps : existing.helps;
		write(s);
		return existing;
	}
	const created = {
		id: `c_${Date.now().toString(36)}`,
		label: input.label.trim(),
		summary: input.summary.trim() || "Field-learned mitigation",
		helps: input.helps,
		createdAt: (/* @__PURE__ */ new Date()).toISOString(),
		samples: 1,
		dAirF: dAir,
		dSubstrateF: dSteel,
		dRh,
		dDewF: dDew,
		dWindMph: dWind,
		sunMul,
		notes: input.notes.trim()
	};
	s.custom = [created, ...s.custom].slice(0, 40);
	write(s);
	return created;
}
function catalogHelps() {
	return [
		"heat",
		"solar",
		"cold",
		"rh",
		"dew",
		"rain",
		"wind"
	];
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
	const mits = (site?.mitigations ?? []).filter((id) => Boolean(mitigationById(id)));
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
	if (mits.includes("canopy")) sun *= .12;
	const lightTent = mits.includes("light_tent");
	const darkTent = mits.includes("dark_tent");
	const dehu = mits.includes("dehumidify_tent");
	const humid = mits.includes("humidity_tent");
	const climate = mits.includes("climate_tent");
	if (lightTent) {
		sun *= .08;
		wind = wind != null ? wind * .25 : wind;
		precipBlocked = false;
		if (air != null) air = round1(air + 2 * envelope);
	}
	if (darkTent) {
		sun *= .12;
		wind = wind != null ? wind * .25 : wind;
		precipBlocked = false;
		if (air != null) air = round1(air + 12 * Math.max(envelope, sky > .4 && z.hour >= 8 && z.hour <= 18 ? .35 : 0));
	}
	if (dehu) {
		if (!lightTent && !darkTent && !climate) sun *= .1;
		wind = wind != null ? wind * .2 : wind;
		precipBlocked = false;
		if (rh != null) rh = Math.max(20, rh - 18);
		if (dew != null) dew = round1(dew - 4);
	}
	if (humid) {
		if (!lightTent && !darkTent && !climate) sun *= .12;
		precipBlocked = false;
		if (rh != null) rh = Math.max(rh, discipline === "cementitious" ? 70 : 85);
	}
	if (climate) {
		sun = 0;
		wind = 0;
		precipBlocked = false;
		if (air != null) air = round1(air + (72 - air) * .65);
		if (rh != null) rh = round1(rh + (48 - rh) * .7);
		if (dew != null && air != null) dew = round1(Math.min(dew, air - 8));
	}
	if (mits.includes("windscreen") && wind != null) wind *= .4;
	if (mits.includes("heaters") && air != null && !climate) air = round1(air + 16);
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
	if (mits.includes("preheat") && sub.metal && substrateF != null) substrateF = round1(substrateF + 14);
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
export { unlockedGoHours as C, tightnessLabel as S, recordOutcome as _, catalogHelps as a, scoreHour as b, detectLimiters as c, inferSubstrate as d, isMoistureTolerant as f, peakExample as g, mitigationById as h, bundleDays as i, goHourCount as l, loadLearning as m, SUBSTRATES as n, compatibleMitigations as o, isRecommended as p, axisImpact as r, dayGoHoursNeeded as s, DEFAULT_CALIBRATION as t, inferProductRules as u, rescoreForecast as v, upsertCustomMitigation as w, substrateById as x, saveCalibration as y };
