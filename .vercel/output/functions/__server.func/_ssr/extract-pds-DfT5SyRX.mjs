import { r as createServerFn } from "./ssr.mjs";
import { t as createServerRpc } from "./createServerRpc-CcvdN_gc.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/extract-pds-DfT5SyRX.js
function num(m, i = 1) {
	if (!m?.[i]) return null;
	const n = Number(m[i].replace(/,/g, ""));
	return Number.isFinite(n) ? n : null;
}
function firstMatch(text, patterns) {
	for (const p of patterns) {
		const m = text.match(p);
		if (m?.[1]) return m[1].replace(/\s+/g, " ").trim();
	}
	return "";
}
function allMatches(text, pattern, max = 8) {
	const out = [];
	const p = new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : pattern.flags + "g");
	let m;
	while ((m = p.exec(text)) && out.length < max) {
		const v = (m[1] ?? m[0]).replace(/\s+/g, " ").trim();
		if (v && !out.includes(v)) out.push(v);
	}
	return out;
}
function toF(value, unit) {
	if (!unit) return value;
	if (/c/i.test(unit)) return Math.round(value * 9 / 5 + 32);
	return value;
}
function heuristicExtract(text) {
	const t = text.replace(/\u00a0/g, " ").replace(/\s+\n/g, "\n");
	const lines = t.split(/\n/).map((l) => l.trim()).filter(Boolean);
	const name = firstMatch(t, [/product(?:\s+name)?[:\s]+([A-Z0-9][^\n]{3,80})/i, /^([A-Z][A-Za-z0-9][^\n]{4,60})$/m]) || lines[0]?.slice(0, 80) || "Unnamed product";
	const manufacturer = firstMatch(t, [
		/manufacturer[:\s]+([^\n]+)/i,
		/prepared\s+by[:\s]+([^\n]+)/i,
		/(Sherwin-Williams|PPG|Carboline|Sika|Tremco|3M|BASF|Master Builders|International Paint|Hempel|Jotun|Tnemec|AkzoNobel|Awlgrip|Rust-Oleum)[^\n]*/i
	]);
	const mixRatio = firstMatch(t, [/mix(?:ing)?\s+ratio[:\s]+([^\n]+)/i, /(\d+\s*:\s*\d+(?:\s*:\s*\d+)?(?:\s*by\s+volume|\s*by\s+weight)?)/i]);
	const potLife = firstMatch(t, [/pot\s*life[:\s]+([^\n]+)/i, /working\s+time[:\s]+([^\n]+)/i]);
	const shelf = firstMatch(t, [/shelf\s*life[:\s]+([^\n]+)/i]);
	const voc = firstMatch(t, [/voc[:\s]+([^\n]+)/i]);
	const dft = firstMatch(t, [/(?:recommended\s+)?(?:dft|dry\s+film(?:\s+thickness)?)[:\s]+([^\n]+)/i, /(\d+\s*[–-]\s*\d+\s*mils?\s*(?:dft|dft)?)/i]);
	const profile = firstMatch(t, [/(?:anchor\s+)?profile[:\s]+([^\n]+)/i, /(\d+(?:\.\d+)?\s*[–-]\s*\d+(?:\.\d+)?\s*mils?.{0,20}profile)/i]);
	const recoatMin = firstMatch(t, [/recoat(?:ing)?\s+(?:min(?:imum)?|window)[:\s]+([^\n]+)/i, /minimum\s+recoat[:\s]+([^\n]+)/i]);
	const recoatMax = firstMatch(t, [/maximum\s+recoat[:\s]+([^\n]+)/i, /recoat(?:ing)?\s+max(?:imum)?[:\s]+([^\n]+)/i]);
	const coverage = firstMatch(t, [/coverage[:\s]+([^\n]+)/i, /theoretical\s+coverage[:\s]+([^\n]+)/i]);
	const induction = firstMatch(t, [/induction[:\s]+([^\n]+)/i, /sweat-?in[:\s]+([^\n]+)/i]);
	const thinning = firstMatch(t, [/thinn(?:ing|er)[:\s]+([^\n]+)/i]);
	const sspc = allMatches(t, /SSPC[-\s]?SP\s?\d+[A-Z]?/gi);
	const nace = allMatches(t, /NACE(?:\s+No\.?\s*\d+|\s+SP\d+)?/gi);
	const methodsPrep = [...sspc, ...nace];
	const tempPairs = [...t.matchAll(/(?:air|ambient|application|surface|substrate|steel|store|storage)[^\n]{0,40}?(\d+(?:\.\d+)?)\s*°?\s*([CF])?[^\n]{0,24}?(?:to|–|-|and)\s*(\d+(?:\.\d+)?)\s*°?\s*([CF])?/gi)];
	const env = {
		ambientTempMinF: null,
		ambientTempMaxF: null,
		substrateTempMinF: null,
		substrateTempMaxF: null,
		relativeHumidityMax: null,
		relativeHumidityMin: null,
		dewPointSpreadMinF: null,
		precipitationAllowed: !/not apply.{0,40}(rain|wet|precipitation)/i.test(t),
		windMaxMph: num(t.match(/wind[^\n]{0,30}?(\d+)\s*(?:mph|miles)/i)),
		directSunNotes: "",
		notes: "",
		additional: []
	};
	for (const m of tempPairs) {
		const label = m[0].toLowerCase();
		const min = toF(Number(m[1]), m[2]);
		const max = toF(Number(m[3]), m[4]);
		if (label.includes("store") || label.includes("storage")) continue;
		if (label.includes("surface") || label.includes("substrate") || label.includes("steel")) {
			env.substrateTempMinF = env.substrateTempMinF ?? min;
			env.substrateTempMaxF = env.substrateTempMaxF ?? max;
		} else {
			env.ambientTempMinF = env.ambientTempMinF ?? min;
			env.ambientTempMaxF = env.ambientTempMaxF ?? max;
		}
	}
	const minOnly = t.match(/(?:minimum|min\.?)\s+(?:air|ambient|surface|substrate|application)?\s*(?:temp(?:erature)?)?[^\n]{0,20}?(\d+)\s*°?\s*([CF])?/i);
	if (minOnly && env.ambientTempMinF == null) env.ambientTempMinF = toF(Number(minOnly[1]), minOnly[2]);
	const rh = t.match(/relative humidity[^\n]{0,40}?(\d+)\s*%/i);
	if (rh) env.relativeHumidityMax = Number(rh[1]);
	const dew = t.match(/(\d+(?:\.\d+)?)\s*°?\s*([CF])?\s*(?:above|over|higher than)\s+(?:the\s+)?dew/i);
	if (dew) env.dewPointSpreadMinF = toF(Number(dew[1]), dew[2]);
	else if (/dew\s*point/i.test(t)) env.dewPointSpreadMinF = 5;
	const storageRange = firstMatch(t, [/stor(?:e|age)[^\n]{0,40}?(\d+\s*°?\s*[CF][^\n]{0,20}\d+\s*°?\s*[CF])/i, /store(?:d)?\s+(?:indoors\s+)?at[:\s]+([^\n]+)/i]);
	const holdPoints = [
		{
			step: 1,
			name: "Material receipt",
			criteria: shelf ? `Unexpired (${shelf})` : "Verify batch and shelf life",
			owner: "QC",
			timing: "Before staging",
			source: "inferred"
		},
		{
			step: 2,
			name: "Storage check",
			criteria: storageRange || "Stored per PDS temperature and dryness",
			owner: "QC",
			timing: "Before issuing to the crew",
			source: "inferred"
		},
		{
			step: 3,
			name: "Credentials",
			criteria: "Applicator / inspector credentials on file",
			owner: "QC",
			timing: "Before work",
			source: "inferred"
		},
		{
			step: 4,
			name: "Surface preparation",
			criteria: methodsPrep.slice(0, 3).join(", ") || "Prep per PDS / spec",
			owner: "QC",
			timing: "Before coating or placement",
			source: methodsPrep.length ? "stated" : "inferred"
		},
		{
			step: 5,
			name: "Ambient / dew point",
			criteria: "In-window air, substrate, RH, dew-point spread; no precipitation",
			owner: "Applicator + QC",
			timing: "Immediately before application",
			source: "inferred"
		},
		{
			step: 6,
			name: "Mix",
			criteria: mixRatio ? `Ratio ${mixRatio}` : "Mix per PDS",
			owner: "Applicator",
			timing: "At combine; mark pot-life start",
			source: mixRatio ? "stated" : "inferred"
		},
		{
			step: 7,
			name: "Application",
			criteria: dft || "Film build / placement per PDS",
			owner: "Applicator + QC",
			timing: "During work (WFT / workmanship)",
			source: dft ? "stated" : "inferred"
		},
		{
			step: 8,
			name: "Cure / recoat",
			criteria: [recoatMin, recoatMax].filter(Boolean).join(" · ") || "Inside recoat window",
			owner: "QC",
			timing: "Before next coat or service",
			source: recoatMin ? "stated" : "inferred"
		},
		{
			step: 9,
			name: "Final inspection",
			criteria: "Acceptance tests per PDS / project spec",
			owner: "QC / owner",
			timing: "After required cure",
			source: "inferred"
		}
	];
	const ppe = allMatches(t, /(respirator|goggles|gloves|protective clothing|eye protection|face shield|tyvek)/gi);
	return {
		id: crypto.randomUUID(),
		extractedAt: (/* @__PURE__ */ new Date()).toISOString(),
		confidence: "low",
		extractionNotes: ["Heuristic extract only — AI was unavailable or returned unusable JSON. Review every field against the PDS."],
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
			service: firstMatch(t, [/service[:\s]+([^\n]+)/i])
		},
		storage: {
			temperatureRange: storageRange,
			conditions: allMatches(t, /(keep dry|protect from freeze|original container|tightly closed|fifo)/gi),
			notes: ""
		},
		shelfLife: {
			unopened: shelf,
			opened: "",
			mixedPotLife: potLife,
			notes: ""
		},
		credentials: {
			required: allMatches(t, /(NACE|AMPP|SSPC PCI|certified applicator|manufacturer train)/gi),
			notes: ""
		},
		surfacePrep: {
			substrates: allMatches(t, /(mill[\s-]?scale|bare steel|carbon steel|galvanized|aluminum|aluminium|light painted concrete|dark painted concrete|painted concrete|concrete|wood|glass)/gi),
			methods: methodsPrep,
			profile,
			cleanliness: firstMatch(t, [/cleanliness[:\s]+([^\n]+)/i]),
			moisture: firstMatch(t, [/(surface must be dry[^\n]*)/i, /moisture[:\s]+([^\n]+)/i]),
			notes: ""
		},
		environmentals: env,
		mixing: {
			components: firstMatch(t, [/two-component|2[- ]component|single-component|1[- ]component/i]),
			ratio: mixRatio,
			inductionTime: induction,
			potLife,
			thinning,
			notes: ""
		},
		installation: {
			methods: allMatches(t, /(airless|conventional spray|brush|roller|trowel|squeegee|caulk|plural)/gi),
			filmThickness: dft,
			coverage,
			numberOfCoats: firstMatch(t, [/(?:number of )?coats?[:\s]+([^\n]+)/i]),
			sequence: [],
			notes: ""
		},
		holdPoints,
		inspection: {
			methods: allMatches(t, /(dft|wft|holiday|adhesion|sspc-pa 2|visual|pull-off)/gi),
			acceptance: [],
			documentation: "Record batch, mix time, ambients, and film thickness."
		},
		cure: {
			touch: firstMatch(t, [/dry to touch[:\s]+([^\n]+)/i, /touch[:\s]+([^\n]+)/i]),
			handle: firstMatch(t, [/dry to handle[:\s]+([^\n]+)/i, /handle[:\s]+([^\n]+)/i]),
			recoatMin,
			recoatMax,
			fullCure: firstMatch(t, [/full cure[:\s]+([^\n]+)/i]),
			immersionService: firstMatch(t, [/immersion[:\s]+([^\n]+)/i]),
			temperatureDependence: ""
		},
		safety: {
			ppe: ppe.length ? ppe : ["See SDS"],
			ventilation: firstMatch(t, [/ventilat(?:e|ion)[:\s]+([^\n]+)/i]),
			hazards: allMatches(t, /(flammable|sensitizer|isocyanate|carcinogen|irritant)/gi)
		}
	};
}
var SYSTEM = `You extract construction / protective-coatings / adhesive / sealant / grout Product Data Sheets into a field QC card.

Return ONLY valid JSON matching this TypeScript shape (no markdown):
{
  "confidence": "high" | "medium" | "low",
  "extractionNotes": string[],
  "product": { "name", "manufacturer", "productType", "systemRole", "revision", "documentDate", "voc", "mixRatio", "colors": string[], "service" },
  "storage": { "temperatureRange", "conditions": string[], "notes" },
  "shelfLife": { "unopened", "opened", "mixedPotLife", "notes" },
  "credentials": { "required": string[], "notes" },
  "surfacePrep": { "substrates": string[], "methods": string[], "profile", "cleanliness", "moisture", "notes" },
  "environmentals": {
    "ambientTempMinF": number | null,
    "ambientTempMaxF": number | null,
    "substrateTempMinF": number | null,
    "substrateTempMaxF": number | null,
    "relativeHumidityMax": number | null,
    "relativeHumidityMin": number | null,
    "dewPointSpreadMinF": number | null,
    "precipitationAllowed": boolean,
    "windMaxMph": number | null,
    "directSunNotes": string,
    "notes": string,
    "additional": string[]
  },
  "mixing": { "components", "ratio", "inductionTime", "potLife", "thinning", "notes" },
  "installation": { "methods": string[], "filmThickness", "coverage", "numberOfCoats", "sequence": string[], "notes" },
  "holdPoints": [{ "step": number, "name", "criteria", "owner", "timing", "source": "stated" | "inferred" }],
  "inspection": { "methods": string[], "acceptance": string[], "documentation" },
  "cure": { "touch", "handle", "recoatMin", "recoatMax", "fullCure", "immersionService", "temperatureDependence" },
  "safety": { "ppe": string[], "ventilation", "hazards": string[] }
}

Rules:
- Convert all temperatures to °F numbers in environmentals. Keep the original phrase in notes.
- If a value is not in the PDS, use "" or [] or null — never invent numeric limits.
- Always emit hold points in process order (receive → store → credentials → prep → ambient → mix → apply → inspect → cure). Mark inferred vs stated.
- Dew-point spread is the minimum °F the substrate must be above dew point (often 5°F).
- precipitationAllowed is false unless the PDS explicitly allows damp/wet application.
- Be terse. Field-card language, not marketing.
- If the text is not a PDS, still extract what you can and set confidence to low.`;
function parseJson(raw) {
	const stripped = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
	const start = stripped.indexOf("{");
	const end = stripped.lastIndexOf("}");
	if (start < 0 || end <= start) return null;
	try {
		return JSON.parse(stripped.slice(start, end + 1));
	} catch {
		return null;
	}
}
function mergeCard(base, ai) {
	const env = {
		...base.environmentals,
		...ai.environmentals ?? {}
	};
	return {
		...base,
		...ai,
		id: base.id,
		extractedAt: base.extractedAt,
		confidence: ai.confidence ?? "medium",
		extractionNotes: ai.extractionNotes?.length ? ai.extractionNotes : base.extractionNotes,
		product: {
			...base.product,
			...ai.product ?? {}
		},
		storage: {
			...base.storage,
			...ai.storage ?? {}
		},
		shelfLife: {
			...base.shelfLife,
			...ai.shelfLife ?? {}
		},
		credentials: {
			...base.credentials,
			...ai.credentials ?? {}
		},
		surfacePrep: {
			...base.surfacePrep,
			...ai.surfacePrep ?? {}
		},
		environmentals: env,
		mixing: {
			...base.mixing,
			...ai.mixing ?? {}
		},
		installation: {
			...base.installation,
			...ai.installation ?? {}
		},
		holdPoints: ai.holdPoints?.length ? ai.holdPoints : base.holdPoints,
		inspection: {
			...base.inspection,
			...ai.inspection ?? {}
		},
		cure: {
			...base.cure,
			...ai.cure ?? {}
		},
		safety: {
			...base.safety,
			...ai.safety ?? {}
		}
	};
}
var extractPds_createServerFn_handler = createServerRpc({
	id: "a1bccce983c3465caaf01eba3c27c8b93bb9183ed308a2efa75abbde3fc0552d",
	name: "extractPds",
	filename: "src/lib/extract-pds.ts"
}, (opts) => extractPds.__executeServer(opts));
var extractPds = createServerFn({ method: "POST" }).validator((input) => {
	const text = (input?.text ?? "").trim();
	if (text.length < 40) throw new Error("PDS text is too short.");
	if (text.length > 4e4) throw new Error("PDS text exceeds 40,000 characters.");
	return { text: text.slice(0, 24e3) };
}).handler(extractPds_createServerFn_handler, async ({ data }) => {
	const fallback = heuristicExtract(data.text);
	const apiKey = process.env.XAI_API_KEY;
	if (!apiKey) {
		fallback.extractionNotes = ["AI is not available in this environment. Fields were pattern-matched — review every number."];
		return {
			ok: true,
			card: fallback,
			usedAi: false
		};
	}
	try {
		const res = await fetch("https://api.x.ai/v1/chat/completions", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${apiKey}`
			},
			body: JSON.stringify({
				model: "grok-4.5",
				temperature: .1,
				max_tokens: 3500,
				response_format: { type: "json_object" },
				messages: [{
					role: "system",
					content: SYSTEM
				}, {
					role: "user",
					content: data.text
				}]
			})
		});
		if (!res.ok) {
			fallback.extractionNotes = [`xAI extract failed (${res.status}). Showing heuristic fields — review every number.`];
			return {
				ok: true,
				card: fallback,
				usedAi: false
			};
		}
		const parsed = parseJson((await res.json()).choices?.[0]?.message?.content ?? "");
		if (!parsed) {
			fallback.extractionNotes = ["Model returned unreadable JSON. Showing heuristic fields."];
			return {
				ok: true,
				card: fallback,
				usedAi: false
			};
		}
		const card = mergeCard(fallback, parsed);
		if (!card.extractionNotes?.length) card.extractionNotes = ["Extracted from PDS. Confirm against the current manufacturer revision before use."];
		return {
			ok: true,
			card,
			usedAi: true
		};
	} catch (err) {
		return {
			ok: false,
			error: err instanceof Error ? err.message : "Extract failed"
		};
	}
});
//#endregion
export { extractPds_createServerFn_handler };
