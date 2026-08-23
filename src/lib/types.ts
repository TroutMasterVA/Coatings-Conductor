export type Confidence = "high" | "medium" | "low";

export type HoldPoint = {
  step: number;
  name: string;
  criteria: string;
  owner: string;
  timing: string;
  source: "stated" | "inferred";
};

export type Environmentals = {
  ambientTempMinF: number | null;
  ambientTempMaxF: number | null;
  substrateTempMinF: number | null;
  substrateTempMaxF: number | null;
  relativeHumidityMax: number | null;
  relativeHumidityMin: number | null;
  dewPointSpreadMinF: number | null;
  precipitationAllowed: boolean;
  windMaxMph: number | null;
  directSunNotes: string;
  notes: string;
  additional: string[];
};

export type FieldCardData = {
  id: string;
  extractedAt: string;
  confidence: Confidence;
  extractionNotes: string[];
  product: {
    name: string;
    manufacturer: string;
    productType: string;
    systemRole: string;
    revision: string;
    documentDate: string;
    voc: string;
    mixRatio: string;
    colors: string[];
    service: string;
  };
  storage: {
    temperatureRange: string;
    conditions: string[];
    notes: string;
  };
  shelfLife: {
    unopened: string;
    opened: string;
    mixedPotLife: string;
    notes: string;
  };
  credentials: {
    required: string[];
    notes: string;
  };
  surfacePrep: {
    substrates: string[];
    methods: string[];
    profile: string;
    cleanliness: string;
    moisture: string;
    notes: string;
  };
  environmentals: Environmentals;
  mixing: {
    components: string;
    ratio: string;
    inductionTime: string;
    potLife: string;
    thinning: string;
    notes: string;
  };
  installation: {
    methods: string[];
    filmThickness: string;
    coverage: string;
    numberOfCoats: string;
    sequence: string[];
    notes: string;
  };
  holdPoints: HoldPoint[];
  inspection: {
    methods: string[];
    acceptance: string[];
    documentation: string;
  };
  cure: {
    touch: string;
    handle: string;
    recoatMin: string;
    recoatMax: string;
    fullCure: string;
    immersionService: string;
    temperatureDependence: string;
  };
  safety: {
    ppe: string[];
    ventilation: string;
    hazards: string[];
  };
};

export type WindowStatus = "go" | "caution" | "nogo" | "unknown";

export type HourWindow = {
  startIso: string;
  hour: number;
  weekday: string;
  dateLabel: string;
  dateKey?: string;
  status: WindowStatus;
  reasons: string[];
  tempF: number | null;
  rh: number | null;
  dewpointF: number | null;
  spreadF: number | null;
  pop: number | null;
  precipIn: number | null;
  windMph: number | null;
  shortForecast: string;
  substrateF?: number | null;
  solarGainF?: number | null;
  inShift?: boolean;
};

export type DayWindow = {
  date: string;
  weekday: string;
  dateLabel: string;
  status: WindowStatus;
  goHours: number;
  cautionHours: number;
  nogoHours: number;
  bestRange: string | null;
  limiting: string[];
  hours: HourWindow[];
};

export type ForecastBundle = {
  zip: string;
  city: string;
  state: string;
  lat: number;
  lon: number;
  timezone: string;
  source: string;
  issuedAt: string;
  days: DayWindow[];
  headline: string;
  rawHours?: RawHourLite[];
};

export type RawHourLite = {
  startIso: string;
  tempF: number | null;
  rh: number | null;
  dewpointF: number | null;
  pop: number | null;
  precipIn: number | null;
  windMph: number | null;
  shortForecast: string;
  cloudCover?: number | null;
};

export type SavedCard = {
  id: string;
  savedAt: string;
  card: FieldCardData;
  zip: string;
};

export type Calibration = {
  master: number;
  solar: number;
  thermal: number;
  moisture: number;
  precip: number;
  wind: number;
  linked: boolean;
};

export type CustomMitigation = {
  id: string;
  label: string;
  summary: string;
  helps: string[];
  createdAt: string;
  samples: number;
  dAirF: number;
  dSubstrateF: number;
  dRh: number;
  dDewF: number;
  dWindMph: number;
  sunMul: number;
  notes: string;
};

export type FieldOutcome = {
  id: string;
  at: string;
  product: string;
  zip: string;
  substrate: string;
  mitigations: string[];
  predicted: WindowStatus | "mixed";
  actual: "correct" | "false_nogo" | "false_go";
  forecastAir: number | null;
  forecastSteel: number | null;
  measuredAir: number | null;
  measuredSteel: number | null;
  measuredRh: number | null;
  measuredDew: number | null;
  notes: string;
};

export const STEP_RAIL: { n: string; id: string; label: string }[] = [
  { n: "01", id: "store", label: "Store" },
  { n: "02", id: "creds", label: "Qualify" },
  { n: "03", id: "prep", label: "Prep" },
  { n: "04", id: "ambnt", label: "Ambient" },
  { n: "05", id: "mix", label: "Mix" },
  { n: "06", id: "apply", label: "Apply" },
  { n: "07", id: "hold", label: "Hold" },
  { n: "08", id: "insp", label: "Inspect" },
  { n: "09", id: "cure", label: "Cure" },
  { n: "10", id: "safe", label: "Safety" },
];
