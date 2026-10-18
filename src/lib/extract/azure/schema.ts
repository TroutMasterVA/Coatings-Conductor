import { z } from "zod";

/** zod mirror of AZURE_CARD_SCHEMA (prompt.ts). Every model reply is validated against this. */
const s = z.string();
const ss = z.array(z.string());
const n = z.number().finite().nullable();

export const ModelOutputSchema = z.strictObject({
  confidence: z.enum(["high", "medium", "low"]),
  extractionNotes: ss,
  product: z.strictObject({
    name: s,
    manufacturer: s,
    productType: s,
    systemRole: s,
    revision: s,
    documentDate: s,
    voc: s,
    mixRatio: s,
    service: s,
    colors: ss,
  }),
  storage: z.strictObject({ temperatureRange: s, notes: s, conditions: ss }),
  shelfLife: z.strictObject({ unopened: s, opened: s, mixedPotLife: s, notes: s }),
  credentials: z.strictObject({ notes: s, required: ss }),
  surfacePrep: z.strictObject({
    substrates: ss,
    methods: ss,
    profile: s,
    cleanliness: s,
    moisture: s,
    notes: s,
    prepGates: z.array(
      z.strictObject({
        family: z.enum(["steel-immersion", "steel-non-immersion", "concrete", "non-ferrous"]),
        label: s,
        methods: ss,
        profile: s,
      }),
    ),
  }),
  environmentals: z.strictObject({
    ambientTempMinF: n,
    ambientTempMaxF: n,
    substrateTempMinF: n,
    substrateTempMaxF: n,
    relativeHumidityMax: n,
    relativeHumidityMin: n,
    dewPointSpreadMinF: n,
    precipitationAllowed: z.boolean(),
    windMaxMph: n,
    directSunNotes: s,
    notes: s,
    additional: ss,
  }),
  mixing: z.strictObject({
    components: s,
    ratio: s,
    inductionTime: s,
    potLife: s,
    thinning: s,
    notes: s,
  }),
  installation: z.strictObject({
    filmThickness: s,
    coverage: s,
    numberOfCoats: s,
    notes: s,
    methods: ss,
    sequence: ss,
  }),
  holdPoints: z.array(
    z.strictObject({
      step: z.number(),
      name: s,
      criteria: s,
      owner: s,
      timing: s,
      source: z.enum(["stated", "inferred"]),
    }),
  ),
  inspection: z.strictObject({ documentation: s, methods: ss, acceptance: ss }),
  cure: z.strictObject({
    touch: s,
    handle: s,
    recoatMin: s,
    recoatMax: s,
    fullCure: s,
    immersionService: s,
    temperatureDependence: s,
  }),
  safety: z.strictObject({ ventilation: s, ppe: ss, hazards: ss }),
  provenance: z.array(z.strictObject({ path: s, page: z.number().int().nullable(), quote: s })),
});

export type ModelOutput = z.infer<typeof ModelOutputSchema>;
