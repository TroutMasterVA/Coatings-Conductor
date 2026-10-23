/**
 * Five mocked Azure fixtures (CONTRACT.md "Test fixtures"): each has the file type, the mocked
 * Document Intelligence layout, the mocked model reply and what the card must say after the gate.
 */
import type { ModelOutput } from "../schema.ts";
import {
  FAKE_PDF,
  FAKE_TIFF,
  output,
  pagesFrom,
  tableFrom,
  type AnalyzeResultMock,
} from "./helpers.ts";

export type Fixture = {
  name: string;
  fileName: string;
  mimeType: string;
  fileBase64: string;
  analyze: AnalyzeResultMock;
  reply: ModelOutput;
  /** Mocked rendered page count for PDFs (renderPages stub). */
  images?: number;
  expect: Record<string, string | number | null>;
  /** Paths whose provenance page must be this. */
  expectPages?: Record<string, number>;
  expectDropped?: string[];
};

const q = (path: string, quote: string, page: number | null = 1) => ({ path, page, quote });

// 1. Dense table spec sheet, metric units only, values live in tables.
const dense: Fixture = {
  name: "dense table spec",
  fileName: "tableguard-300.pdf",
  mimeType: "application/pdf",
  fileBase64: FAKE_PDF,
  analyze: {
    pages: pagesFrom([
      "TableGuard 300 Epoxy Mastic\nAcme Protective Coatings\nTECHNICAL DATA\nMixing ratio: 3:1 by volume (Base:Hardener)\nApply only when the steel temperature is at least 3°C above the dew point.",
    ]),
    tables: [
      tableFrom(
        [
          ["Condition", "Air temperature", "Surface temperature", "Relative humidity"],
          ["Minimum", "10°C", "5°C", "-"],
          ["Maximum", "40°C", "50°C", "85%"],
        ],
        1,
      ),
      tableFrom(
        [
          ["Substrate temperature", "Recoat min", "Recoat max"],
          ["10°C", "16 hours", "30 days"],
          ["23°C", "8 hours", "21 days"],
        ],
        1,
      ),
    ],
  },
  reply: output({
    product: {
      name: "TableGuard 300 Epoxy Mastic",
      manufacturer: "Acme Protective Coatings",
      mixRatio: "3:1 by volume",
    },
    mixing: { ratio: "3:1 by volume" },
    environmentals: {
      ambientTempMinF: 50,
      ambientTempMaxF: 104,
      substrateTempMinF: 41,
      substrateTempMaxF: 122,
      relativeHumidityMax: 85,
      dewPointSpreadMinF: 5,
    },
    cure: { recoatMin: "8 hours at 23°C", recoatMax: "21 days at 23°C" },
    provenance: [
      q("product.name", "TableGuard 300 Epoxy Mastic"),
      q("product.manufacturer", "Acme Protective Coatings"),
      q("product.mixRatio", "Mixing ratio: 3:1 by volume (Base:Hardener)"),
      q("mixing.ratio", "Mixing ratio: 3:1 by volume (Base:Hardener)"),
      q("environmentals.ambientTempMinF", "Air temperature: 10°C"),
      q("environmentals.ambientTempMaxF", "Air temperature: 40°C"),
      q("environmentals.substrateTempMinF", "Surface temperature: 5°C"),
      q(
        "environmentals.substrateTempMaxF",
        "| Condition: Maximum | Air temperature: 40°C | Surface temperature: 50°C |",
      ),
      q("environmentals.relativeHumidityMax", "Relative humidity: 85%"),
      q("environmentals.dewPointSpreadMinF", "at least 3°C above the dew point"),
      q("cure.recoatMin", "Substrate temperature: 23°C | Recoat min: 8 hours"),
      q(
        "cure.recoatMax",
        "| Substrate temperature: 23°C | Recoat min: 8 hours | Recoat max: 21 days |",
      ),
    ],
  }),
  expect: {
    "environmentals.ambientTempMinF": 50,
    "environmentals.ambientTempMaxF": 104,
    "environmentals.substrateTempMinF": 41,
    "environmentals.substrateTempMaxF": 122,
    "environmentals.relativeHumidityMax": 85,
    "environmentals.dewPointSpreadMinF": 5,
    "mixing.ratio": "3:1 by volume",
    "cure.recoatMin": "8 hours at 23°C",
    "environmentals.windMaxMph": null,
  },
};

// 2. Brochure: marketing first page, data on page 2 in two columns; page images matter.
const brochure: Fixture = {
  name: "brochure",
  fileName: "shieldcoat-brochure.pdf",
  mimeType: "application/pdf",
  fileBase64: FAKE_PDF,
  images: 2,
  analyze: {
    pages: pagesFrom([
      "ShieldCoat 88 Polyurethane\nBeauty that lasts. Up to 15 years of gloss retention!\nNorthwind Coatings",
      "APPLICATION\nPRODUCT DATA\nAir temperature: 40°F to 95°F\nVolume solids 68%\nMaterial temperature 50°F min.\nPot life 4 hours at 77°F\nSurface temperature must be 5°F above dew point\nMix ratio 4:1 (A:B) by volume\nRelative humidity 85% max.\nDFT 2-3 mils per coat",
    ]),
  },
  reply: output({
    product: {
      name: "ShieldCoat 88 Polyurethane",
      manufacturer: "Northwind Coatings",
      mixRatio: "4:1 (A:B) by volume",
    },
    environmentals: {
      ambientTempMinF: 40,
      ambientTempMaxF: 95,
      dewPointSpreadMinF: 5,
      relativeHumidityMax: 85,
    },
    mixing: { ratio: "4:1 (A:B) by volume", potLife: "4 hours at 77°F" },
    installation: { filmThickness: "2-3 mils per coat" },
    provenance: [
      q("product.name", "ShieldCoat 88 Polyurethane"),
      q("product.manufacturer", "Northwind Coatings"),
      q("product.mixRatio", "Mix ratio 4:1 (A:B) by volume", 2),
      q("mixing.ratio", "Mix ratio 4:1 (A:B) by volume", 2),
      q("mixing.potLife", "Pot life 4 hours at 77°F", 2),
      // Claimed page is wrong on purpose: the gate must correct it to page 2.
      q("environmentals.ambientTempMinF", "Air temperature: 40°F to 95°F", 1),
      q("environmentals.ambientTempMaxF", "Air temperature: 40°F to 95°F", 2),
      q("environmentals.dewPointSpreadMinF", "Surface temperature must be 5°F above dew point", 2),
      q("environmentals.relativeHumidityMax", "Relative humidity 85% max.", 2),
      q("installation.filmThickness", "DFT 2-3 mils per coat", 2),
    ],
  }),
  expect: {
    "environmentals.ambientTempMinF": 40,
    "environmentals.ambientTempMaxF": 95,
    "environmentals.dewPointSpreadMinF": 5,
    "mixing.potLife": "4 hours at 77°F",
    "environmentals.substrateTempMinF": null,
  },
  expectPages: { "environmentals.ambientTempMinF": 2, "mixing.potLife": 2, "product.name": 1 },
};

// 3. Scanned image (TIFF): text only exists as Document Intelligence OCR; no page images are sent.
const scanned: Fixture = {
  name: "scanned image",
  fileName: "old-scan.tif",
  mimeType: "image/tiff",
  fileBase64: FAKE_TIFF,
  analyze: {
    pages: pagesFrom([
      "RUSTBLOCK PRIMER 12\nApply between 35 F and 110 F ambient.\nSubstrate temp min. 35 F\nRecoat after 6 hrs @ 70 F",
    ]),
  },
  reply: output({
    product: { name: "RUSTBLOCK PRIMER 12" },
    environmentals: { ambientTempMinF: 35, ambientTempMaxF: 110, substrateTempMinF: 35 },
    cure: { recoatMin: "6 hrs @ 70 F" },
    provenance: [
      q("product.name", "RUSTBLOCK PRIMER 12"),
      q("environmentals.ambientTempMinF", "Apply between 35 F and 110 F ambient."),
      q("environmentals.ambientTempMaxF", "Apply between 35 F and 110 F ambient."),
      q("environmentals.substrateTempMinF", "Substrate temp min. 35 F"),
      q("cure.recoatMin", "Recoat after 6 hrs @ 70 F"),
    ],
  }),
  expect: {
    "environmentals.ambientTempMinF": 35,
    "environmentals.ambientTempMaxF": 110,
    "environmentals.substrateTempMinF": 35,
    "cure.recoatMin": "6 hrs @ 70 F",
  },
};

// 4. Multi-product sheet: values must come from the title product only.
const multi: Fixture = {
  name: "multi-product sheet",
  fileName: "duo-system.pdf",
  mimeType: "application/pdf",
  fileBase64: FAKE_PDF,
  images: 1,
  analyze: {
    pages: pagesFrom([
      "DuoSystem Product Guide\nPRODUCT A: AquaPrime 10\nProduct A mix ratio: 2:1 by volume\nProduct A pot life: 2 hours at 75°F\nProduct A minimum air temperature 50°F\nPRODUCT B: AquaTop 20\nProduct B mix ratio: 1:1 by volume\nProduct B pot life: 6 hours at 75°F\nProduct B minimum air temperature 35°F",
    ]),
  },
  reply: output({
    product: { name: "AquaPrime 10", mixRatio: "2:1 by volume" },
    mixing: { ratio: "2:1 by volume", potLife: "6 hours at 75°F" },
    environmentals: { ambientTempMinF: 50 },
    provenance: [
      q("product.name", "PRODUCT A: AquaPrime 10"),
      q("product.mixRatio", "Product A mix ratio: 2:1 by volume"),
      q("mixing.ratio", "Product A mix ratio: 2:1 by volume"),
      // Cross-wired: B's pot life with a quote rewritten to say A. Not verbatim, so dropped.
      q("mixing.potLife", "Product A pot life: 6 hours at 75°F"),
      q("environmentals.ambientTempMinF", "Product A minimum air temperature 50°F"),
    ],
  }),
  expect: {
    "product.name": "AquaPrime 10",
    "mixing.ratio": "2:1 by volume",
    "mixing.potLife": "",
    "environmentals.ambientTempMinF": 50,
  },
  expectDropped: ["mixing.potLife"],
};

// 5. Carbomastic 615 (Carboline): one scored row, not the target.
const CARBO_P1 = `Carbomastic 615 — Product Data Sheet (Carboline)
SELECTION & SPECIFICATION DATA
Generic Type: Phenalkamine epoxy
Color: Standard 0200 (Tan), 0700 (Grey); special 0500 (Red), C900 (Black)
Dry Film Thickness: 5 - 10 mils (127 - 254 microns) per coat
VOC As Supplied: 1.44 lbs/gal (172 g/l)
SUBSTRATES & SURFACE PREPARATION
General: Clean per SSPC-SP 1.
Steel Immersion: NACE No. 2/SSPC-SP 10 with 2.0-3.0 mil (50-75 microns) profile.
Steel Non-Immersion: NACE No. 3/SSPC-SP 6 with 2.0-3.0 mil profile preferred; SSPC-SP 2, SP 3, NACE No. 4/SSPC-SP 7, NACE/SSPC WJ-1 to WJ-4, or SSPC-SP 14 also acceptable.
Concrete: NACE No. 6/SSPC SP 13; abrade to ICRI CSP for system.`;
const CARBO_P2 = `MIXING & THINNING
Ratio: 4:1 Part A to Part B by volume
Thinning: up to 12% by volume with Carboline Thinner #2
Pot Life: 1½ hours at 75°F (24°C)
APPLICATION CONDITIONS
Industry standards: substrate above dew point for immersion. Non-immersion: can tolerate damp substrates. Do not apply to ice.
CURING SCHEDULE (5.0-10.0 mil DFT)
Shelf Life: Part A and B 24 months @ 75°F in unopened containers
Storage: 40-100°F, 0-95% RH, indoors, keep dry`;

const carbo: Fixture = {
  name: "Carbomastic 615",
  fileName: "Carbomastic_615_PDS.pdf",
  mimeType: "application/pdf",
  fileBase64: FAKE_PDF,
  images: 2,
  analyze: {
    pages: pagesFrom([CARBO_P1, CARBO_P2]),
    tables: [
      tableFrom(
        [
          ["Condition", "Material", "Surface", "Ambient", "Humidity"],
          ["Minimum", "45°F (7°C)", "20°F (-7°C)", "20°F (-7°C)", "0%"],
          ["Maximum", "90°F (32°C)", "120°F (49°C)", "100°F (38°C)", "95%"],
        ],
        2,
      ),
      tableFrom(
        [
          ["Surface Temp", "Dry to Topcoat Min", "Max Recoat", "Min cure immersion"],
          ["20°F (-7°C)", "72 Hours", "45 Days", "7 Days"],
          ["75°F (24°C)", "2 Hours", "7 Days", "1 Hour"],
        ],
        2,
      ),
    ],
  },
  reply: output({
    confidence: "high",
    product: {
      name: "Carbomastic 615",
      manufacturer: "Carboline",
      productType: "Phenalkamine epoxy",
      voc: "1.44 lbs/gal (172 g/l)",
      mixRatio: "4:1 Part A to Part B by volume",
    },
    storage: { temperatureRange: "40-100°F" },
    shelfLife: { unopened: "24 months @ 75°F", mixedPotLife: "1½ hours at 75°F (24°C)" },
    surfacePrep: {
      prepGates: [
        {
          family: "steel-immersion",
          label: "Steel immersion",
          methods: ["NACE No. 2/SSPC-SP 10"],
          profile: "2.0-3.0 mil (50-75 microns)",
        },
        {
          family: "steel-non-immersion",
          label: "Steel non-immersion",
          methods: ["NACE No. 3/SSPC-SP 6"],
          profile: "2.0-3.0 mil",
        },
      ],
    },
    environmentals: {
      ambientTempMinF: 20,
      ambientTempMaxF: 100,
      substrateTempMinF: 20,
      substrateTempMaxF: 120,
      relativeHumidityMax: 95,
      relativeHumidityMin: 0,
      dewPointSpreadMinF: null,
      precipitationAllowed: false,
    },
    mixing: {
      ratio: "4:1 Part A to Part B by volume",
      potLife: "1½ hours at 75°F (24°C)",
      thinning: "up to 12% by volume with Carboline Thinner #2",
    },
    installation: { filmThickness: "5 - 10 mils (127 - 254 microns) per coat" },
    cure: { recoatMin: "2 Hours at 75°F", recoatMax: "7 Days at 75°F" },
    holdPoints: [
      {
        step: 1,
        name: "Prep",
        criteria: "NACE No. 2/SSPC-SP 10 with 2.0-3.0 mil (50-75 microns) profile",
        owner: "QC",
        timing: "Before prime",
        source: "stated",
      },
      {
        step: 2,
        name: "Ambient",
        criteria: "Surface 20-120°F",
        owner: "QC",
        timing: "Before mix",
        source: "stated",
      },
    ],
    provenance: [
      q("product.name", "Carbomastic 615 — Product Data Sheet (Carboline)"),
      q("product.manufacturer", "Carbomastic 615 — Product Data Sheet (Carboline)"),
      q("product.productType", "Generic Type: Phenalkamine epoxy"),
      q("product.voc", "VOC As Supplied: 1.44 lbs/gal (172 g/l)"),
      q("product.mixRatio", "Ratio: 4:1 Part A to Part B by volume", 2),
      q("storage.temperatureRange", "Storage: 40-100°F, 0-95% RH, indoors, keep dry", 2),
      q(
        "shelfLife.unopened",
        "Shelf Life: Part A and B 24 months @ 75°F in unopened containers",
        2,
      ),
      q("shelfLife.mixedPotLife", "Pot Life: 1½ hours at 75°F (24°C)", 2),
      q(
        "surfacePrep.prepGates.0.methods.0",
        "Steel Immersion: NACE No. 2/SSPC-SP 10 with 2.0-3.0 mil (50-75 microns) profile.",
      ),
      q(
        "surfacePrep.prepGates.0.profile",
        "Steel Immersion: NACE No. 2/SSPC-SP 10 with 2.0-3.0 mil (50-75 microns) profile.",
      ),
      q(
        "surfacePrep.prepGates.1.methods.0",
        "Steel Non-Immersion: NACE No. 3/SSPC-SP 6 with 2.0-3.0 mil profile preferred",
      ),
      q(
        "surfacePrep.prepGates.1.profile",
        "Steel Non-Immersion: NACE No. 3/SSPC-SP 6 with 2.0-3.0 mil profile preferred",
      ),
      q("environmentals.ambientTempMinF", "Ambient: 20°F (-7°C)", 2),
      q("environmentals.ambientTempMaxF", "Ambient: 100°F (38°C)", 2),
      q("environmentals.substrateTempMinF", "Surface: 20°F (-7°C)", 2),
      q("environmentals.substrateTempMaxF", "Surface: 120°F (49°C)", 2),
      q("environmentals.relativeHumidityMax", "Humidity: 95%", 2),
      q("environmentals.relativeHumidityMin", "Humidity: 0%", 2),
      q("mixing.ratio", "Ratio: 4:1 Part A to Part B by volume", 2),
      q("mixing.potLife", "Pot Life: 1½ hours at 75°F (24°C)", 2),
      q("mixing.thinning", "Thinning: up to 12% by volume with Carboline Thinner #2", 2),
      q(
        "installation.filmThickness",
        "Dry Film Thickness: 5 - 10 mils (127 - 254 microns) per coat",
      ),
      q("cure.recoatMin", "Surface Temp: 75°F (24°C) | Dry to Topcoat Min: 2 Hours", 2),
      q(
        "cure.recoatMax",
        "Surface Temp: 75°F (24°C) | Dry to Topcoat Min: 2 Hours | Max Recoat: 7 Days",
        2,
      ),
      q(
        "holdPoints.0.criteria",
        "Steel Immersion: NACE No. 2/SSPC-SP 10 with 2.0-3.0 mil (50-75 microns) profile.",
      ),
      q("holdPoints.1.criteria", "Surface: 120°F (49°C)", 2),
    ],
  }),
  expect: {
    "product.name": "Carbomastic 615",
    "product.mixRatio": "4:1 Part A to Part B by volume",
    "environmentals.ambientTempMinF": 20,
    "environmentals.ambientTempMaxF": 100,
    "environmentals.substrateTempMinF": 20,
    "environmentals.substrateTempMaxF": 120,
    "environmentals.relativeHumidityMax": 95,
    "environmentals.dewPointSpreadMinF": null,
    "surfacePrep.prepGates.0.profile": "2.0-3.0 mil (50-75 microns)",
    "mixing.potLife": "1½ hours at 75°F (24°C)",
    "cure.recoatMin": "2 Hours at 75°F",
  },
  expectPages: { "environmentals.substrateTempMaxF": 2, "surfacePrep.prepGates.0.profile": 1 },
  // "Surface 20-120°F" is a summary, not a line on the sheet: the gate drops it.
  expectDropped: ["holdPoints.1.criteria"],
};

export const FIXTURES: Fixture[] = [dense, brochure, scanned, multi, carbo];
