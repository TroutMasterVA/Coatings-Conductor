import type { FieldCardData } from "./types";

function stamp(partial: Omit<FieldCardData, "id" | "extractedAt">): FieldCardData {
  return {
    id: crypto.randomUUID(),
    extractedAt: new Date().toISOString(),
    ...partial,
  };
}

export const SAMPLE_PDS_TEXT: Record<string, string> = {
  macropoxy: `PRODUCT DATA SHEET — Macropoxy 646 Fast Cure
Manufacturer: Sherwin-Williams Protective & Marine
Generic Type: Polyamide epoxy, two-component
Service: Atmospheric and immersion (when specified) on structural steel
Revision: Typical published PDS (illustrative field extract)

STORAGE
Store indoors at 40°F–100°F (4°C–38°C). Keep containers tightly closed. Protect from freezing and direct sunlight. Rotate stock FIFO.

SHELF LIFE
24 months unopened at 77°F (25°C). Mixed pot life approximately 2 hours at 77°F; shorter in heat.

CREDENTIALS
Coatings applied by personnel trained in plural-component or two-component epoxies. Immersion and critical structural steel: NACE CIP Level 2 / AMPP CIP or SSPC PCI equivalent recommended for hold-point inspection. Surface preparation per SSPC/NACE standards.

SURFACE PREPARATION
Substrates: carbon steel, previously coated steel in sound condition.
Atmospheric: SSPC-SP6 / NACE No. 3 Commercial Blast. Immersion / severe: SSPC-SP10 / NACE No. 2 Near-White.
Anchor profile: 1.5–3.0 mils (38–75 µm). Remove oil, dust, weld spatter. Do not apply over chloride-contaminated steel. Surface must be dry and dust-free.

ENVIRONMENTAL CONDITIONS
Air and surface temperature: 35°F minimum (Fast Cure), 120°F maximum.
Surface must be at least 5°F (3°C) above the dew point.
Relative humidity: no stated maximum if dew-point spread is met; do not apply to wet or ice-covered surfaces.
Do not apply if rain, snow, or fog is imminent before the coating reaches a water-resistant state.
Wind: avoid overspray; typical stop work above 25 mph for spray.

MIXING
Two components, 1:1 by volume. Power mix each part, then combine and mix 2–3 minutes. No induction (sweat-in) required for Fast Cure. Thinning: up to 10% with specified reducer if allowed by VOC / job spec. Do not exceed pot life.

INSTALLATION
Airless spray, brush, or roller. Typical DFT 5–10 mils (125–250 µm) per coat. WFT approximately 7–14 mils depending on volume solids. Two coats common for atmospheric; follow specification for stripe coat on edges, welds, and corners. Coverage theoretically ~160–225 sq ft/gal at 5–7 mils DFT.

HOLD POINTS (ITP)
1. Material receipt — verify batch, shelf life, storage temp.
2. Surface preparation inspection — standard, profile, cleanliness.
3. Ambient / substrate / dew point log immediately before application.
4. Mix start time and ratio check.
5. Stripe coat on welds and edges (hold before full coat if specified).
6. WFT checks during application.
7. DFT survey after cure (SSPC-PA 2).
8. Holiday / pinhole test if immersion or lining.
9. Recoat window verification before next coat or topcoat.

INSPECTION
Visual, WFT gauge, DFT (SSPC-PA 2), adhesion (ASTM D3359 / D4541 as specified), holiday detection (NACE SP0188) for immersion. Record batch numbers, mix times, ambients, and film thickness.

CURE (Fast Cure, 77°F / 50% RH, typical)
Touch: ~2 hours. Handle: ~5 hours. Recoat minimum: ~3.5 hours. Recoat maximum: 14 days (abrade if exceeded). Full cure: 7 days. Immersion service: consult current PDS; typically 7–14 days depending on temperature.

SAFETY
Organic vapor respirator as required, chemical goggles, gloves, protective clothing. Provide ventilation. Flammable solvents in reducers. Consult SDS.
`,
  sikadur: `PRODUCT DATA SHEET — Sikadur-31 Hi-Mod Gel
Manufacturer: Sika Corporation
Generic Type: Two-component, 100% solids, moisture-tolerant structural epoxy adhesive / paste
Service: Structural bonding, grouting, bolt anchoring, concrete repair paste, steel-to-concrete
Revision: Typical published PDS (illustrative field extract)

STORAGE
Store dry at 40°F–90°F (4°C–32°C) in original unopened containers. Do not freeze. Condition material to 65°F–75°F before mixing for best workability.

SHELF LIFE
24 months in original unopened containers. Mixed gel working time approximately 30–45 minutes at 73°F; decreases sharply above 90°F.

CREDENTIALS
Installers experienced in structural epoxy adhesives. For fracture-critical or fracture-repair work, engineer-approved procedure and certified applicator as specified. ITP hold points by project QC.

SURFACE PREPARATION
Concrete: sound, clean, SSD or dry as specified; remove laitance (SSP, shotblast, or needle scale). Steel: SSPC-SP6 minimum, SP10 preferred; profile 2–3 mils. Bonding surfaces free of oil, curing compound, standing water. Substrate temperature 40°F minimum and 5°F above dew point.

ENVIRONMENTAL CONDITIONS
Minimum substrate / ambient: 40°F (4°C). Maximum: 95°F (35°C) typical.
Dew point: substrate ≥ 5°F above dew point.
Do not apply to frozen or frost-covered concrete.
Relative humidity: no hard cap; avoid condensation on steel.
Precipitation: protect fresh epoxy from rain until tack-free.

MIXING
Ratio 1:1 by volume (Part A : Part B). Mix until uniform gray, no streaks, ~3 minutes. Mix only what can be placed within pot life. Do not thin.

INSTALLATION
Trowel, gloved hand, or caulk-style for paste. Contact pressure for bonding. Typical bond-line 1/32–1/8 in. For anchoring, follow hole diameter / depth per engineer. Sequence: prep → dry-fit → mix → place → clamp/support → hold point.

HOLD POINTS
1. Material conditioning and shelf-life check.
2. Substrate soundness / prep inspection.
3. Ambient and substrate temperature / dew point.
4. Mix uniformity and start time.
5. Placement / bond-line inspection before close-up.
6. Cure before load (engineer).

INSPECTION
Visual mix uniformity, bond-line squeeze-out, sounding after cure, proof-load of anchors if specified. Record lot numbers and temperatures.

CURE at 73°F
Tack-free ~1–2 hours. Initial set ~2–3 hours. Ready for light load ~8–12 hours. Full mechanical ~3 days (faster in heat, much slower near 40°F).

SAFETY
Avoid skin contact (sensitizer). Gloves, eye protection, long sleeves. Ventilate. See SDS.
`,
  dymonic: `PRODUCT DATA SHEET — Dymonic 100
Manufacturer: Tremco
Generic Type: High-performance, high-movement, single-component, moisture-cure polyurethane sealant
Service: Expansion joints, perimeter caulking, precast, metal panel, windows — building envelope
Revision: Typical published PDS (illustrative field extract)

STORAGE
Store unopened cartridges / sausages at 40°F–110°F. Keep dry. Do not open until ready to gun.

SHELF LIFE
12 months from manufacture in unopened containers stored under recommended conditions.

CREDENTIALS
Installers trained in joint design (width/depth, backing rod). Manufacturer training recommended for warranty work. QC joint inspection before and after tool-off.

SURFACE PREPARATION
Substrates: concrete, masonry, aluminum, steel, glass (verify primer). Joints clean, dry, frost-free. Remove old sealant, laitance, form-release. Use closed-cell backer rod; bond breaker as required. Primer where PDS / adhesion test requires.

ENVIRONMENTAL CONDITIONS
Application temperature typically 40°F–120°F. Do not apply to wet or frozen substrates.
Avoid rain on uncured sealant. High humidity accelerates skinning (plan tooling time).
Dew point: substrate dry, no condensation.

MIXING
Single component. No mixing. Condition cartridges to 60°F–80°F for consistent gunning.

INSTALLATION
Gun in one continuous pass. Tool immediately. Typical joint: width ¼–1½ in per data; depth ½ of width, min ¼ in. Two-sided adhesion only. Sequence: clean → primer (if req, with open time) → backer rod → gun → tool → skin.

HOLD POINTS
1. Joint geometry / backer rod check.
2. Cleanliness and primer open-time.
3. Ambient / substrate temperature.
4. Adhesion test (field pull) as specified.
5. Tooling and profile inspection.
6. Cure before water test / coating over (if overcoating allowed).

INSPECTION
Visual continuity, adhesion field tests, joint factor (width/depth), photo documentation.

CURE
Skins in 2–4 hours at 75°F / 50% RH. Tack-free ~24 hours. Full cure ~7 days for typical joints (longer in cold / low RH; faster in heat / high RH).

SAFETY
Use in well-ventilated areas. Gloves and eye protection. Uncured polyurethane — avoid skin. SDS.
`,
};

export const SAMPLES: { key: string; title: string; blurb: string; card: () => FieldCardData }[] = [
  {
    key: "macropoxy",
    title: "Macropoxy 646 Fast Cure",
    blurb: "Structural steel epoxy — blast, dew point, DFT hold points",
    card: () =>
      stamp({
        confidence: "high",
        extractionNotes: [
          "Loaded from the built-in steel-epoxy sample. Confirm numbers against the current manufacturer PDS before use.",
        ],
        product: {
          name: "Macropoxy 646 Fast Cure",
          manufacturer: "Sherwin-Williams Protective & Marine",
          productType: "Two-component polyamide epoxy",
          systemRole: "Intermediate / finish on structural steel (atmospheric or specified immersion)",
          revision: "Sample extract — verify current PDS",
          documentDate: "",
          voc: "Check current PDS / local VOC table",
          mixRatio: "1:1 by volume",
          colors: ["Standard industrial catalog"],
          service: "Atmospheric; immersion when specified",
        },
        storage: {
          temperatureRange: "40–100°F (4–38°C)",
          conditions: ["Indoors", "Tightly closed", "Protect from freeze and direct sun", "FIFO"],
          notes: "Do not store on a hot deck or in an unconditioned conex in summer heat.",
        },
        shelfLife: {
          unopened: "24 months at 77°F",
          opened: "Use promptly; reseal and mark date",
          mixedPotLife: "~2 hours at 77°F (shorter in heat)",
          notes: "Discard mixed material that has bodyed or exceeded pot life.",
        },
        credentials: {
          required: [
            "Two-component epoxy trained applicators",
            "NACE/AMPP CIP or SSPC PCI for critical / immersion hold points",
            "SSPC-SP competent blasters",
          ],
          notes: "Match inspector credentials to the specification, not the PDS minimum.",
        },
        surfacePrep: {
          substrates: ["Carbon steel", "Sound existing coating (when overcoating is allowed)"],
          methods: ["SSPC-SP6 / NACE No. 3 commercial blast (atmospheric)", "SSPC-SP10 / NACE No. 2 near-white (immersion / severe)"],
          profile: "1.5–3.0 mils",
          cleanliness: "Dust-free, oil-free, chloride-free per spec",
          moisture: "Dry; no ice, no visible moisture",
          notes: "Stripe coat welds, corners, and edges. Do not paint over mill scale or rust bloom after blast.",
        },
        environmentals: {
          ambientTempMinF: 35,
          ambientTempMaxF: 120,
          substrateTempMinF: 35,
          substrateTempMaxF: 120,
          relativeHumidityMax: null,
          relativeHumidityMin: null,
          dewPointSpreadMinF: 5,
          precipitationAllowed: false,
          windMaxMph: 25,
          directSunNotes: "Steel in sun can exceed air temp — measure the substrate.",
          notes: "Fast Cure minimum 35°F. No rain/snow/fog until water-resistant. RH is governed by dew-point spread.",
          additional: ["Stop for visible moisture on steel", "Log air, steel, RH, dew point at each setup"],
        },
        mixing: {
          components: "Part A + Part B",
          ratio: "1:1 by volume",
          inductionTime: "None (Fast Cure)",
          potLife: "~2 hours at 77°F",
          thinning: "Only with specified reducer; typically ≤10% and only if VOC / spec allows",
          notes: "Power mix each component, then combine 2–3 minutes. Clock pot life at combine.",
        },
        installation: {
          methods: ["Airless spray", "Brush", "Roller"],
          filmThickness: "5–10 mils DFT per coat (≈7–14 mils WFT, confirm volume solids)",
          coverage: "~160–225 ft²/gal at 5–7 mils DFT (theoretical; waste extra)",
          numberOfCoats: "Typically 2 atmospheric + stripe; follow the spec",
          sequence: [
            "Verify storage and shelf life",
            "Blast / prep and hold",
            "Log ambients",
            "Stripe welds and edges",
            "Full coat to WFT",
            "Cure and DFT",
            "Recoat / topcoat inside window",
          ],
          notes: "Hold spray in high wind to protect adjacent surfaces and film build.",
        },
        holdPoints: [
          { step: 1, name: "Material receipt", criteria: "Batch / lot, shelf life, storage temperature in range", owner: "QC / warehouse", timing: "Before staging to the workface", source: "inferred" },
          { step: 2, name: "Surface preparation", criteria: "Specified SSPC/NACE standard, profile 1.5–3.0 mils, cleanliness", owner: "QC + blaster", timing: "Immediately after blast, before bloom", source: "stated" },
          { step: 3, name: "Ambient / dew point", criteria: "Air and steel ≥35°F and ≤120°F; steel ≥5°F above dew point; no rain", owner: "Applicator + QC", timing: "Immediately before mix and every 4 hours / weather change", source: "stated" },
          { step: 4, name: "Mix & pot life", criteria: "1:1 by volume, start time marked, no exceeded pot life", owner: "Applicator", timing: "At combine", source: "stated" },
          { step: 5, name: "Stripe coat", criteria: "Welds, corners, edges, bolts stripe-coated", owner: "QC", timing: "Before or as specified with full coat", source: "inferred" },
          { step: 6, name: "WFT during apply", criteria: "WFT in range for target DFT", owner: "Applicator / QC", timing: "Continuous during application", source: "stated" },
          { step: 7, name: "DFT survey", criteria: "SSPC-PA 2 frequency and range", owner: "QC / third party", timing: "After dry-to-handle", source: "stated" },
          { step: 8, name: "Holiday test", criteria: "NACE SP0188 if immersion / lining", owner: "QC", timing: "After full cure of lining coats", source: "stated" },
          { step: 9, name: "Recoat window", criteria: "Min ~3.5 h at 77°F; max 14 days or abrade", owner: "QC", timing: "Before next coat or topcoat", source: "stated" },
        ],
        inspection: {
          methods: ["Visual", "WFT gauge", "DFT (SSPC-PA 2)", "Adhesion ASTM D3359 / D4541 as specified", "Holiday NACE SP0188 (immersion)"],
          acceptance: ["DFT within spec range", "No holidays on linings", "No rust bloom, sags, or dry spray", "Ambients logged in range"],
          documentation: "Batch numbers, mix times, air/steel/RH/dew point, WFT/DFT, inspector, hold-point sign-off",
        },
        cure: {
          touch: "~2 hours at 77°F",
          handle: "~5 hours at 77°F",
          recoatMin: "~3.5 hours at 77°F",
          recoatMax: "14 days at 77°F (abrade if exceeded)",
          fullCure: "7 days at 77°F",
          immersionService: "Typically 7–14 days — confirm current PDS and spec",
          temperatureDependence: "Cold extends every clock; heat shortens pot life and recoat min",
        },
        safety: {
          ppe: ["Chemical goggles", "Solvent-resistant gloves", "Protective clothing", "Organic vapor respirator as required"],
          ventilation: "Required for confined space and indoor spray",
          hazards: ["Solvent vapors", "Skin sensitizer", "Reducer flammability"],
        },
      }),
  },
  {
    key: "sikadur",
    title: "Sikadur-31 Hi-Mod Gel",
    blurb: "Structural epoxy paste — concrete/steel bond, 40°F floor",
    card: () =>
      stamp({
        confidence: "high",
        extractionNotes: ["Loaded from the built-in structural-adhesive sample. Confirm against the current Sika PDS."],
        product: {
          name: "Sikadur-31 Hi-Mod Gel",
          manufacturer: "Sika Corporation",
          productType: "Two-component 100% solids structural epoxy paste",
          systemRole: "Bonding, grouting, anchoring, concrete repair paste",
          revision: "Sample extract — verify current PDS",
          documentDate: "",
          voc: "100% solids — confirm current PDS",
          mixRatio: "1:1 by volume",
          colors: ["Gray when mixed"],
          service: "Structural bond / repair",
        },
        storage: {
          temperatureRange: "40–90°F (4–32°C)",
          conditions: ["Dry", "Original containers", "Do not freeze", "Condition to 65–75°F before mix"],
          notes: "Cold material is stiff; overheated material has a short pot life.",
        },
        shelfLife: {
          unopened: "24 months original unopened",
          opened: "Not for partial long-term storage once contaminated",
          mixedPotLife: "30–45 minutes at 73°F",
          notes: "Mix only a workable quantity.",
        },
        credentials: {
          required: ["Structural epoxy experience", "Engineer-approved procedure for fracture-critical work"],
          notes: "Project QC / PE defines load-before-cure.",
        },
        surfacePrep: {
          substrates: ["Sound concrete", "Carbon steel"],
          methods: ["Remove laitance (shotblast / needle scale)", "Steel SSPC-SP6 min, SP10 preferred"],
          profile: "Steel 2–3 mils; concrete ICRI CSP per spec",
          cleanliness: "Oil-free, curing-compound-free, no standing water",
          moisture: "SSD or dry per spec; no frost",
          notes: "Bonding to unsound concrete will fail the epoxy, not the spec.",
        },
        environmentals: {
          ambientTempMinF: 40,
          ambientTempMaxF: 95,
          substrateTempMinF: 40,
          substrateTempMaxF: 95,
          relativeHumidityMax: null,
          relativeHumidityMin: null,
          dewPointSpreadMinF: 5,
          precipitationAllowed: false,
          windMaxMph: null,
          directSunNotes: "Shade dark steel and bags in summer; condition kits.",
          notes: "Do not place on frozen concrete. Protect from rain until tack-free.",
          additional: [],
        },
        mixing: {
          components: "Part A + Part B",
          ratio: "1:1 by volume",
          inductionTime: "None",
          potLife: "30–45 min at 73°F",
          thinning: "Do not thin",
          notes: "Mix to uniform gray, no streaks, ~3 minutes.",
        },
        installation: {
          methods: ["Trowel", "Gloved hand", "Cartridge / bulk gun"],
          filmThickness: "Bond line typically 1/32–1/8 in",
          coverage: "Depends on bond-line and geometry",
          numberOfCoats: "Single placement",
          sequence: ["Prep and dry-fit", "Log temps", "Mix", "Place", "Clamp / support", "Hold for cure"],
          notes: "Contact pressure required for structural bond.",
        },
        holdPoints: [
          { step: 1, name: "Conditioning & shelf life", criteria: "Kits 65–75°F, unexpired", owner: "QC", timing: "Before mix", source: "stated" },
          { step: 2, name: "Substrate soundness", criteria: "Prep complete, no unsound concrete, steel profile", owner: "QC", timing: "Before mix", source: "stated" },
          { step: 3, name: "Ambient / dew point", criteria: "≥40°F, ≤95°F, steel ≥5°F above dew point", owner: "Applicator + QC", timing: "Immediately before mix", source: "stated" },
          { step: 4, name: "Mix uniformity", criteria: "Uniform gray, start time, quantity vs pot life", owner: "Applicator", timing: "At mix", source: "stated" },
          { step: 5, name: "Bond-line / placement", criteria: "Full contact, squeeze-out, support", owner: "QC", timing: "Before close-up", source: "inferred" },
          { step: 6, name: "Cure before load", criteria: "Engineer / PDS clock met", owner: "PE / QC", timing: "Before putting into service", source: "stated" },
        ],
        inspection: {
          methods: ["Visual mix", "Bond-line squeeze-out", "Sounding after cure", "Proof load of anchors if specified"],
          acceptance: ["No unmixed streaks", "Full contact", "No frost/wet placement", "Cure clock completed"],
          documentation: "Lot numbers, substrate temps, mix time, PE hold if structural",
        },
        cure: {
          touch: "Tack-free ~1–2 hours at 73°F",
          handle: "Initial set ~2–3 hours",
          recoatMin: "N/A (single placement)",
          recoatMax: "N/A",
          fullCure: "~3 days at 73°F for full mechanical",
          immersionService: "N/A unless specified",
          temperatureDependence: "Near 40°F cure is much slower; heat cuts pot life",
        },
        safety: {
          ppe: ["Gloves", "Eye protection", "Long sleeves"],
          ventilation: "Avoid confined unventilated mix",
          hazards: ["Skin sensitizer", "Do not ingest"],
        },
      }),
  },
  {
    key: "dymonic",
    title: "Dymonic 100",
    blurb: "PU joint sealant — gun, tool, humidity-aware cure",
    card: () =>
      stamp({
        confidence: "high",
        extractionNotes: ["Loaded from the built-in sealant sample. Confirm against the current Tremco PDS."],
        product: {
          name: "Dymonic 100",
          manufacturer: "Tremco",
          productType: "Single-component moisture-cure polyurethane sealant",
          systemRole: "Expansion and perimeter joints, envelope",
          revision: "Sample extract — verify current PDS",
          documentDate: "",
          voc: "Check current PDS / SCAQMD table",
          mixRatio: "Single component",
          colors: ["Architectural catalog"],
          service: "Building envelope / joints",
        },
        storage: {
          temperatureRange: "40–110°F",
          conditions: ["Unopened cartridges / sausages", "Dry"],
          notes: "Do not open until gunning.",
        },
        shelfLife: {
          unopened: "12 months from manufacture, unopened",
          opened: "Use opened sausages the same shift",
          mixedPotLife: "N/A (skins in the nozzle)",
          notes: "Expired material skins in the tube — discard.",
        },
        credentials: {
          required: ["Joint-design trained installers", "Manufacturer training for warranted work"],
          notes: "Field adhesion tests as specified.",
        },
        surfacePrep: {
          substrates: ["Concrete", "Masonry", "Aluminum", "Steel", "Glass (verify)"],
          methods: ["Clean, dry, frost-free", "Remove failed sealant", "Primer where PDS / test requires"],
          profile: "Joint factor: depth ≈ ½ width, min ¼ in",
          cleanliness: "No dust, form-release, or standing water",
          moisture: "Dry substrate",
          notes: "Closed-cell backer rod; two-sided adhesion only.",
        },
        environmentals: {
          ambientTempMinF: 40,
          ambientTempMaxF: 120,
          substrateTempMinF: 40,
          substrateTempMaxF: 120,
          relativeHumidityMax: null,
          relativeHumidityMin: null,
          dewPointSpreadMinF: 5,
          precipitationAllowed: false,
          windMaxMph: null,
          directSunNotes: "Hot dark substrates skin faster — tool immediately.",
          notes: "High RH skins faster. No rain on uncured sealant. No condensation.",
          additional: [],
        },
        mixing: {
          components: "Single component",
          ratio: "N/A",
          inductionTime: "None",
          potLife: "Tooling time shortens in heat / high RH",
          thinning: "Do not thin",
          notes: "Condition cartridges to 60–80°F.",
        },
        installation: {
          methods: ["Gun", "Immediate tooling"],
          filmThickness: "Joint depth per design (min ¼ in)",
          coverage: "Depends on joint width × depth",
          numberOfCoats: "Single pass",
          sequence: ["Clean", "Primer + open time", "Backer rod", "Gun continuous", "Tool", "Skin"],
          notes: "One continuous bead; tool off to hourglass profile.",
        },
        holdPoints: [
          { step: 1, name: "Joint geometry", criteria: "Width/depth, backer rod, bond breaker", owner: "QC", timing: "Before gunning", source: "stated" },
          { step: 2, name: "Cleanliness / primer", criteria: "Dry, primed, inside primer open time", owner: "Applicator + QC", timing: "Before gunning", source: "stated" },
          { step: 3, name: "Ambient", criteria: "40–120°F, dry substrate, no rain", owner: "Applicator", timing: "Before gunning", source: "stated" },
          { step: 4, name: "Field adhesion", criteria: "Pull test as specified", owner: "QC", timing: "After cure of test joints", source: "stated" },
          { step: 5, name: "Profile / continuity", criteria: "Tooled, no voids, two-sided adhesion only", owner: "QC", timing: "After tool-off", source: "inferred" },
        ],
        inspection: {
          methods: ["Visual continuity", "Joint factor check", "Field adhesion pull", "Photos"],
          acceptance: ["Continuous tooled joint", "Adhesion pass", "Correct backer"],
          documentation: "Lot, joint ID, ambients, primer used, adhesion results",
        },
        cure: {
          touch: "Skins 2–4 hours at 75°F / 50% RH",
          handle: "Tack-free ~24 hours",
          recoatMin: "Only if overcoating is allowed — confirm PDS",
          recoatMax: "Confirm PDS",
          fullCure: "~7 days typical joint",
          immersionService: "Not a tank lining",
          temperatureDependence: "Cold / dry slows; heat / humid skins fast",
        },
        safety: {
          ppe: ["Gloves", "Eye protection"],
          ventilation: "Well-ventilated areas",
          hazards: ["Uncured polyurethane — skin irritant"],
        },
      }),
  },
];
