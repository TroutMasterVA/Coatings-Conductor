import type { Limiter } from "./mitigations.ts";
import type { Calibration, CustomMitigation, FieldOutcome } from "./types.ts";

export type { Calibration, CustomMitigation, FieldOutcome } from "./types.ts";

const KEY = "fieldcard.learning.v1";

type LearningStore = {
  calibration: Calibration;
  outcomes: FieldOutcome[];
  custom: CustomMitigation[];
};

export const DEFAULT_CALIBRATION: Calibration = {
  master: 0.55,
  solar: 0.55,
  thermal: 0.55,
  moisture: 0.55,
  precip: 0.55,
  wind: 0.55,
  linked: true,
};

function clamp01(n: number) {
  return Math.min(1, Math.max(0, n));
}

export function lerp(a: number, b: number, t: number) {
  return a + (b - a) * clamp01(t);
}

export function axes(cal: Calibration): Omit<Calibration, "linked" | "master"> {
  if (cal.linked) {
    return { solar: cal.master, thermal: cal.master, moisture: cal.master, precip: cal.master, wind: cal.master };
  }
  return cal;
}

function empty(): LearningStore {
  return { calibration: { ...DEFAULT_CALIBRATION }, outcomes: [], custom: [] };
}

function read(): LearningStore {
  if (typeof window === "undefined") return empty();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty();
    const parsed = JSON.parse(raw) as Partial<LearningStore>;
    return {
      calibration: { ...DEFAULT_CALIBRATION, ...(parsed.calibration ?? {}) },
      outcomes: parsed.outcomes ?? [],
      custom: parsed.custom ?? [],
    };
  } catch {
    return empty();
  }
}

/** One-time lift of pre-project local learning into the first signed-in project. */
export function loadLegacyLearning(): LearningStore {
  return read();
}

export function tightnessLabel(v: number) {
  if (v < 0.28) return "Open — field judgment";
  if (v < 0.45) return "Lean open";
  if (v < 0.62) return "Balanced";
  if (v < 0.8) return "Lean spec-hard";
  return "Spec-hard";
}

export function dayGoHoursNeeded(master: number) {
  return Math.round(lerp(2, 5, master));
}

export type AxisId = "solar" | "thermal" | "moisture" | "precip" | "wind";

export type AxisImpact = {
  id: AxisId;
  label: string;
  why: string;
  live: string;
  left: string;
  right: string;
};

/** Live copy for an unlocked tightness slider — numbers match score-windows.ts. */
export function axisImpact(id: AxisId, v: number): AxisImpact {
  if (id === "solar") {
    const pct = Math.round(lerp(58, 118, v));
    return {
      id,
      label: "Solar on substrate",
      why: "NOAA is air at the ZIP. This scales how hot we model the workface in sun before checking the PDS surface-temp max.",
      live: `Steel in sun modeled at ${pct}% of catalog solar gain`,
      left: "Cooler workface — closer to air temp, more GO on hot days",
      right: "Full solar bake — hotter substrate, more heat NO-GOs",
    };
  }
  if (id === "thermal") {
    const hard = Math.round(lerp(10, 0, v));
    const soft = Math.round(lerp(8, 3, v));
    return {
      id,
      label: "Air / surface temp",
      why: "Does not change the PDS min/max. It changes how close air and substrate must be before the hour flips caution or no-go.",
      live:
        hard === 0
          ? `No-go at the PDS number · caution within ${soft}°F`
          : `No-go ${hard}°F past PDS min/max · caution starts ${soft}°F inside`,
      left: "Field pad — about 10°F past spec before a hard no-go",
      right: "Inspector-tight — no-go at the PDS temperature",
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
      live:
        rhPad === 0
          ? `RH no-go at PDS max · dew spread no-go at spec (${dewSoft}°F caution band)`
          : `RH no-go ${rhPad}% over max · dew can be ${dewHard}°F thinner than spec before no-go`,
      left: "Forgiving RH and a thinner dew-spread before stop",
      right: "NACE/SSPC tight — RH max and dew spread are exact",
    };
  }
  if (id === "precip") {
    const nogo = Math.round(lerp(68, 32, v));
    const soft = Math.round(lerp(42, 15, v));
    return {
      id,
      label: "Rain call",
      why: "When the PDS forbids precipitation. NOAA PoP is not a rain gauge — this is how sure we must be before we stop the hour.",
      live: `Rain no-go at ≥${nogo}% chance · caution at ≥${soft}%`,
      left: "Stop only on a likely wet hour (~68%+) or a wet wording",
      right: "Stop early — no-go around 32% PoP, caution from 15%",
    };
  }
  const hard = Math.round(lerp(10, 0, v));
  const soft = Math.round(lerp(6, 3, v));
  return {
    id: "wind",
    label: "Wind",
    why: "Spray, overspray, and solvent pop. Does not change the PDS wind max — only the pad around it.",
    live:
      hard === 0
        ? `No-go at the PDS wind max · caution within ${soft} mph`
        : `No-go ${hard} mph over PDS wind max · caution ${soft} mph inside`,
    left: "Field pad — about 10 mph over spec before a hard no-go",
    right: "No-go at the PDS wind number",
  };
}

export function applyOutcomeToCalibration(cal: Calibration, outcome: FieldOutcome): Calibration {
  const next = { ...cal };
  const step = 0.07;
  const bump = (key: keyof Omit<Calibration, "linked">, delta: number) => {
    next[key] = clamp01((next[key] as number) + delta);
  };

  if (outcome.actual === "false_nogo") {
    bump("master", -step);
    bump("thermal", -step);
  } else if (outcome.actual === "false_go") {
    bump("master", step);
    bump("thermal", step);
  }

  if (outcome.forecastSteel != null && outcome.measuredSteel != null && outcome.measuredAir != null) {
    const modeled = outcome.forecastSteel - (outcome.forecastAir ?? outcome.measuredAir);
    const seen = outcome.measuredSteel - outcome.measuredAir;
    if (Math.abs(modeled) > 2) {
      const ratio = seen / modeled;
      const solarDelta = clamp01(0.5 + (1 - ratio) * 0.35) - 0.5;
      bump("solar", solarDelta);
    }
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

export function recordOutcome(
  outcome: Omit<FieldOutcome, "id" | "at">,
  cal: Calibration,
  outcomes: FieldOutcome[],
) {
  const full: FieldOutcome = {
    ...outcome,
    id: crypto.randomUUID(),
    at: new Date().toISOString(),
  };
  const nextOutcomes = [full, ...outcomes].slice(0, 200);
  return {
    outcome: full,
    calibration: applyOutcomeToCalibration(cal, full),
    outcomes: nextOutcomes,
    count: nextOutcomes.length,
  };
}

export type CustomMitigationInput = {
  label: string;
  summary: string;
  helps: Limiter[];
  before: { air: number | null; steel: number | null; rh: number | null; dew: number | null; wind: number | null };
  after: { air: number | null; steel: number | null; rh: number | null; dew: number | null; wind: number | null };
  notes: string;
};

export function mergeCustomMitigation(list: CustomMitigation[], input: CustomMitigationInput) {
  const d = (a: number | null, b: number | null) => (a != null && b != null ? b - a : 0);
  const dAir = d(input.before.air, input.after.air);
  const dSteel = d(input.before.steel, input.after.steel);
  const dRh = d(input.before.rh, input.after.rh);
  const dDew = d(input.before.dew, input.after.dew);
  const dWind = d(input.before.wind, input.after.wind);
  let sunMul = 1;
  if (input.before.steel != null && input.before.air != null && input.after.steel != null && input.after.air != null) {
    const g0 = input.before.steel - input.before.air;
    const g1 = input.after.steel - input.after.air;
    if (g0 > 2) sunMul = Math.min(1.15, Math.max(0.05, g1 / g0));
  }

  const existing = list.find((c) => c.label.trim().toLowerCase() === input.label.trim().toLowerCase());
  if (existing) {
    const n = existing.samples + 1;
    const saved: CustomMitigation = {
      ...existing,
      samples: n,
      dAirF: existing.dAirF + (dAir - existing.dAirF) / n,
      dSubstrateF: existing.dSubstrateF + (dSteel - existing.dSubstrateF) / n,
      dRh: existing.dRh + (dRh - existing.dRh) / n,
      dDewF: existing.dDewF + (dDew - existing.dDewF) / n,
      dWindMph: existing.dWindMph + (dWind - existing.dWindMph) / n,
      sunMul: existing.sunMul + (sunMul - existing.sunMul) / n,
      summary: input.summary || existing.summary,
      notes: input.notes || existing.notes,
      helps: input.helps.length ? input.helps : existing.helps,
    };
    return { list: list.map((c) => (c.id === saved.id ? saved : c)), saved };
  }

  const created: CustomMitigation = {
    id: `c_${Date.now().toString(36)}`,
    label: input.label.trim(),
    summary: input.summary.trim() || "Field-learned mitigation",
    helps: input.helps,
    createdAt: new Date().toISOString(),
    samples: 1,
    dAirF: dAir,
    dSubstrateF: dSteel,
    dRh: dRh,
    dDewF: dDew,
    dWindMph: dWind,
    sunMul,
    notes: input.notes.trim(),
  };
  return { list: [created, ...list].slice(0, 40), saved: created };
}

export function catalogHelps(): Limiter[] {
  return ["heat", "solar", "cold", "rh", "dew", "rain", "wind"];
}

export function mitigationLabels(ids: string[], custom: CustomMitigation[], customIds: string[]) {
  return [...ids, ...custom.filter((c) => customIds.includes(c.id)).map((c) => c.label)];
}
