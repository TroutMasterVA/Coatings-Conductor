/** Full PPG PITT-THERM 1000 FX PDS (Jan 15 2025) — gold fixture for high extract. */
export const PITT_THERM_PDS = `PRODUCT DATA SHEET
January 15 2025 (Revision of January 15 2025)
PPG PITT-THERM 1000 FX

DESCRIPTION
Two-component, 100% solids, flexible, high-build syntactic epoxy insulation coating. For use as a thermal barrier in conjunction with PPG PITT-CHAR epoxy intumescent fire protection or as a stand-alone thermal insulation coating

PRINCIPAL CHARACTERISTICS
• Extends the operating temperature limits of epoxy intumescent passive fire protection (PFP) coating while retaining advantages of a fully bonded, corrosion resistant barrier
• Tested in conjunction with PITT-CHAR NX against pool and jet fires as a thermal barrier for use either under the epoxy PFP or over it
• Low thermal conductivity across a wide range of temperatures, requiring low film thicknesses to provide the required thermal barrier
• Can be applied by spray, nozzle or trowel techniques
• Low density coating, offering light weight, cost effective solutions
• Operating Temperature Limits: -60°C (-76°F) to +125°C (+257°F) continuous; for short term/infrequent excursions beyond these limits please contact PPG for advice
• Resistant to the damage from vibration, abrasion and impact from deflection of structures during fabrication, transportation and extreme loading conditions

COLOR AND GLOSS LEVEL
• Green
• Matt

BASIC DATA AT 20°C (68°F)
Data for mixed product
Number of components Two
Mass density Applied density 0.5 g/cm³ (31.2 lb/ft³)
Volume solids 100%
VOC (Supplied) Directive 2010/75/EU, SED: max. 0.0 g/kg max. 0.0 g/l (approx. 0.0 lb/US gal) EPA Method 24: 0.0 g/l (0.0 lb/USgal)
Temperature resistance (Continuous) -60°C (-76°F) to 125°C (260°F)
Recommended dry film thickness 78.7 - 1181 mils (2000 - 30000 µm) depending on system
Shelf life Base: at least 12 months when stored cool and dry Hardener: at least 12 months when stored cool and dry

Notes:
- See ADDITIONAL DATA – Curing time
- The applied density is dependent upon many variables such as temperature, test method, application method and equipment
- Apply appropriate loss/wastage factor
- Required material thickness is dependent on thermal barrier requirements, contact your local PPG representative for more information
- Material should be stored in dry conditions, out of direct sunlight and at temperatures above 0°C (32°F) and below 35°C (95°F). If material is stored at higher temperatures, shelf life may be reduced
- At 35°C the shelf life for both components is reduced to 10 months.

RECOMMENDED SUBSTRATE CONDITIONS AND TEMPERATURES
• Previous coating layer should be within specified thickness, fully cured, and within over-coating interval guidelines for the system used
• For qualified primers and topcoats, please contact your PPG representative
• Please refer to the application guidelines

Substrate temperature and application conditions
• Ambient temperature below 10°C (50°F) is acceptable; however curing to hardness takes longer, and it will cease curing below 5°C (41°F)
• Substrate temperature during application and curing should be at least 3°C (5°F) above dew point
• Relative humidity during application and curing should not exceed 85%

Note:
- Curing will effectively cease below 5°C (41°F), but once temperature rises again, it will continue to cure

INSTRUCTIONS FOR USE
• Application should be strictly in accordance with the PITT-THERM 1000 FX application guidelines
• Product shall only be applied by suitably trained applicators

Mixing ratio
• By volume: base to hardener 1:1
• By weight: base to hardener 1.16:1
• Tolerance +/- 10%

Airless spray: Plural component
Recommended thinner
No thinner should be added
Nozzle angle
40° – 60°, depending on shape of steel parts
Nozzle orifice
Approx. 0.74 - 0.89 mm (0.029 - 0.035 in)
Nozzle pressure
24.0 - 31.0 MPa (approx. 240 - 310 bar; 3481 - 4496 p.s.i.)

Notes:
- Hoses should be kept as short as possible; Suitable insulated and/or heated hoses should be used
- After airless application, surface should be smoothed with trowel and/or roller using recommended cleaning solvent

Trowel
Recommended thinner
No thinner should be added

Cleaning solvent
• THINNER 91-92

ADDITIONAL DATA
Curing time for solvent-free application
Substrate temperature Dry to touch Through Dry Dry to walk on Dry to handle/ship Full cure
5°C (41°F) 16 hours 4 days 1.5 months 60 hours 96 hours
10°C (50°F) 12 hours 48 hours 30 days 42 hours 72 hours
15°C (59°F) 10 hours 12 hours 18 hours 36 hours 56 hours
20°C (68°F) 8 hours 10 hours 16 hours 30 hours 48 hours
25°C (77°F) 6 hours 8 hours 12 hours 24 hours 36 hours
30°C (86°F) 4 hours 6 hours 10 hours 18 hours 30 hours
35°C (95°F) 3 hours 5 hours 8 hours 16 hours 24 hours
40°C (104°F) 2 hours 3 hours 6 hours 12 hours 20 hours

Notes:
- Adequate ventilation must be maintained during application and curing
- Curing times may vary depending on substrate, ambient and material temperature

Pot life
Mixed product temperature Pot life
23°C (73°F) 1 hour
30°C (86°F) 30 minutes

Note:
- Pot life is dependent on many variables including material temperature, substrate temperature, mixing time, addition of solvent, etc. Figures provided are for guidance only

SAFETY PRECAUTIONS
• See Safety Data Sheet and product label for complete safety and precaution requirements
• Although this is a solvent-free paint, care should be taken to avoid inhalation of spray mist, as well as contact between the wet paint and exposed skin or eyes

WORLDWIDE AVAILABILITY
It is always the aim of PPG Protective & Marine Coatings to supply the same product on a worldwide basis.

REFERENCES
• Guide | PPG PITT-THERM 1000 FX | Application guidelines
`;

export function smashPds(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/** Typical zinc-rich epoxy primer layout (illustrative, field-extract gold). */
export const ZINC_PRIMER_PDS = `PRODUCT DATA SHEET — Carbozinc 859
Manufacturer: Carboline
Generic Type: Two-component organic zinc-rich epoxy primer
Service: Primer on blasted carbon steel, atmospheric and marine

STORAGE
Store indoors at 40°F–110°F. Keep dry. Protect from freeze.

SHELF LIFE
12 months unopened. Mixed pot life 4 hours at 77°F.

SURFACE PREPARATION
Substrates: carbon steel. SSPC-SP6 / NACE No. 3 Commercial Blast. Anchor profile: 1.5–3.0 mils.
Surface must be dry.

ENVIRONMENTAL CONDITIONS
Air and surface temperature: 50°F minimum, 110°F maximum.
Surface must be at least 5°F (3°C) above the dew point.
Relative humidity: should not exceed 85%.
Do not apply if rain is imminent.

MIXING
Two components, 4:1 by volume. No induction. Thinning: up to 10% with Thinner 2 if allowed.

INSTALLATION
Airless spray, brush, or roller. Typical DFT 3–5 mils.

CURE at 77°F
Touch: 30 minutes. Handle: 2 hours. Recoat minimum: 2 hours. Full cure: 7 days.

SAFETY
Respirator, gloves, eye protection. Provide ventilation. Consult SDS.
`;

/** Plural-component polyurea lining. */
export const POLYUREA_PDS = `PRODUCT DATA SHEET — EnviroLastic AR425
Manufacturer: Sherwin-Williams Protective & Marine
Generic Type: Two-component aromatic polyurea lining, 100% solids
Service: Secondary containment and truck bed lining

STORAGE
Store at 50°F–90°F in original containers.

SHELF LIFE
12 months unopened. Gel time approximately 5 seconds at 77°F.

SURFACE PREPARATION
Concrete or steel. Steel: SSPC-SP10 / NACE No. 2. Profile 3 mils. Concrete: ICRI CSP 3–5. Surface must be dry.

ENVIRONMENTAL CONDITIONS
Air and substrate: 40°F minimum, 120°F maximum.
Substrate at least 5°F above the dew point.
Do not apply to wet or ice-covered surfaces.

MIXING
Ratio 1:1 by volume, plural component. Do not thin.

INSTALLATION
Plural-component spray. Typical DFT 30–60 mils.

CURE at 77°F
Tack-free: 10 seconds. Walk-on: 5 minutes. Full cure: 24 hours.

SAFETY
Spray mist respirator, gloves, eye protection. Ventilate. SDS.
`;

/** Intumescent epoxy PFP. */
export const PFP_EPOXY_PDS = `PRODUCT DATA SHEET — PPG PITT-CHAR NX
Manufacturer: PPG
Generic Type: Two-component epoxy intumescent fire protection
Service: Cellulosic and hydrocarbon fire protection on structural steel

STORAGE
Material should be stored in dry conditions, out of direct sunlight, above 40°F and below 90°F.

SHELF LIFE
12 months unopened.

SURFACE PREPARATION
Qualified primer on carbon steel, fully cured. SSPC-SP6 minimum.

ENVIRONMENTAL CONDITIONS
Ambient and substrate 50°F minimum, 120°F maximum.
Substrate temperature during application should be at least 5°F (3°C) above dew point.
Relative humidity should not exceed 85%.
Do not apply if rain, snow, or fog is imminent.

MIXING
By volume: base to hardener 2.5:1. No thinner should be added.

INSTALLATION
Plural component airless spray or trowel. Recommended dry film thickness 200–500 mils depending on rating.

CURE at 77°F
Touch: 8 hours. Handle: 24 hours. Full cure: 7 days.

SAFETY
Avoid inhalation of spray mist. Gloves and eye protection. Adequate ventilation. SDS.
`;

/** Single-component moisture-cure urethane. */
export const MCU_PDS = `PRODUCT DATA SHEET — Sherwin-Williams Corothane I GalvaPac
Manufacturer: Sherwin-Williams Protective & Marine
Generic Type: Single-component moisture-cure zinc-rich urethane primer
Service: Primer on steel in atmospheric service

STORAGE
Store unopened at 40°F–100°F. Keep dry.

SHELF LIFE
12 months from manufacture in unopened containers. No mixing.

SURFACE PREPARATION
Carbon steel, SSPC-SP6. Anchor profile 1.5–2.5 mils. Surface must be dry.

ENVIRONMENTAL CONDITIONS
Application 35°F–120°F. Surface at least 5°F above the dew point.
Do not apply to wet substrates. High humidity accelerates cure.

MIXING
Single-component. No mixing. Stir. Do not thin unless specified.

INSTALLATION
Airless spray, brush, or roller. DFT 3–4 mils.

CURE at 75°F / 50% RH
Touch 1 hour. Recoat 4 hours. Full cure 7 days.

SAFETY
Gloves, eye protection, organic vapor respirator. Ventilate. SDS.
`;

/** Jotun-style epoxy mastic. */
export const JOTUN_PDS = `PRODUCT DATA SHEET — Penguard Midcoat
Manufacturer: Jotun
Generic Type: Two-component polyamide cured epoxy coating
Service: Intermediate coat in atmospheric and immersed systems

STORAGE
Store in a dry, cool, well ventilated space at 40°F–95°F. Keep containers tightly closed.

SHELF LIFE
48 months at 73°F. Mixed pot life 2 hours at 73°F.

SURFACE PREPARATION
Carbon steel: Sa 2½ (ISO 8501-1) / SSPC-SP10. Anchor profile 2–3 mils. Surface must be dry and clean.

ENVIRONMENTAL CONDITIONS
Air and substrate temperature: 50°F minimum, 140°F maximum.
Surface must be at least 5°F (3°C) above the dew point.
Relative humidity should not exceed 85%.
Do not apply if rain is imminent.

MIXING
Mixing ratio 3:1 by volume (base:curing agent). No induction. Thinning: up to 10% Jotun Thinner No. 17 if allowed.

INSTALLATION
Airless spray, brush, or roller. Typical DFT 5–8 mils.

CURE at 73°F
Touch: 2 hours. Handle: 8 hours. Recoat minimum: 8 hours. Full cure: 7 days.

SAFETY
Respirator, gloves, eye protection. Ventilate. Consult SDS.
`;

/** Hempel epoxy. */
export const HEMPEL_PDS = `PRODUCT DATA SHEET — Hempadur 45141
Manufacturer: Hempel
Generic Type: Two-component polyamide adduct cured epoxy
Service: Primer/intermediate on steel in atmospheric service

STORAGE
Store at 41°F–104°F. Protect from frost and direct sunlight.

SHELF LIFE
36 months unopened. Pot life 3 hours at 68°F.

SURFACE PREPARATION
Steel: SSPC-SP6 / NACE No. 3. Profile 1.5–2.5 mils. Surface must be dry.

ENVIRONMENTAL CONDITIONS
Minimum steel and air 41°F (5°C). Maximum 122°F (50°C).
The steel temperature must be at least 5°F (3°C) above the dew point.
Relative humidity: max 80%.
Do not apply to wet or ice-covered surfaces.

MIXING
Mixing ratio 4:1 by volume. Stir each pack. Do not thin beyond 5%.

INSTALLATION
Airless spray. Typical DFT 4–6 mils.

CURE at 68°F
Touch: 4 hours. Handle: 10 hours. Recoat min: 8 hours. Full cure: 7 days.

SAFETY
Gloves, goggles, respirator for spray. Ventilation required. SDS.
`;

/** Tnemec series epoxy. */
export const TNEMEC_PDS = `PRODUCT DATA SHEET — Series 66 Hi-Build Epoxoline
Manufacturer: Tnemec Company
Generic Type: Two-component polyamide epoxy
Service: Steel and concrete, atmospheric

STORAGE
Store at 40°F–110°F. Do not freeze.

SHELF LIFE
24 months. Pot life 4 hours at 75°F.

SURFACE PREPARATION
Steel: SSPC-SP6. Concrete: abrasive blast to ICRI CSP 3. Anchor profile 1.5–2.5 mils.

ENVIRONMENTAL CONDITIONS
Air and surface 50°F–135°F.
Surface at least 5°F above dew point.
Humidity: not greater than 85%.
Do not apply if rain, snow, or fog is imminent.

MIXING
Ratio 1:1 by volume. Mix 3 minutes. Induction 15 minutes.

INSTALLATION
Airless spray, brush, roller. DFT 4–6 mils.

CURE at 75°F
Touch 2 hours. Handle 8 hours. Recoat 12 hours. Full cure 7 days.

SAFETY
Protective clothing, gloves, eye protection, respirator. SDS.
`;

/** International Paint zinc. */
export const INTERZINC_PDS = `PRODUCT DATA SHEET — Interzinc 52
Manufacturer: International Paint
Generic Type: Two-component zinc-rich epoxy primer
Service: Primer on blasted steel, ISO 12944 C5

STORAGE
Store indoors 40°F–100°F, dry.

SHELF LIFE
12 months. Mixed pot life 6 hours at 77°F.

SURFACE PREPARATION
Carbon steel SSPC-SP10 / NACE No. 2. Profile 1.5–3.0 mils. Dry, dust-free.

ENVIRONMENTAL CONDITIONS
Air and surface 41°F minimum, 120°F maximum.
Surface 5°F (3°C) above dew point.
Relative humidity should not exceed 90%.
Do not apply if rain is imminent.

MIXING
4 parts base to 1 part converter by volume. Power mix. Thinning max 5% GTA220.

INSTALLATION
Airless spray, conventional spray, brush. Typical DFT 3–4 mils.

CURE at 77°F
Touch 30 minutes. Handle 3 hours. Recoat 4 hours. Full cure 7 days.

SAFETY
Zinc dust — respirator, gloves, eye protection. Ventilate. SDS.
`;

/** Single-component alkyd finish. */
export const ALKYD_PDS = `PRODUCT DATA SHEET — Shop-Alkyd 500
Manufacturer: TestCoatings Inc
Generic Type: Single-component alkyd enamel
Service: Shop finish on primed steel, atmospheric

STORAGE
Store at 50°F–90°F. Keep away from heat and flame.

SHELF LIFE
24 months unopened. No mixing.

SURFACE PREPARATION
Primed steel in sound condition. Clean, dry, free of oil.

ENVIRONMENTAL CONDITIONS
Application 50°F–100°F.
Do not apply if rain is expected before the film is rain-resistant.
Relative humidity no stated maximum.

MIXING
Single-component. Stir thoroughly. Thinning: mineral spirits ≤10% if allowed.

INSTALLATION
Brush, roller, or conventional spray. DFT 2–3 mils.

CURE at 77°F
Touch 4 hours. Handle 16 hours. Recoat 24 hours. Full cure 7 days.

SAFETY
Organic vapor respirator, gloves, eye protection. Flammable. SDS.
`;


