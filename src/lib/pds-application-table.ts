/** Parse Carboline-style APPLICATION CONDITIONS tables and dew-point deltas. */

export function toDeltaF(value: number, unit?: string | null): number {
  if (!Number.isFinite(value)) return value;
  if (unit && /^c/i.test(unit)) return Math.round((value * 9) / 5);
  return Math.round(value);
}

export function toTempF(value: number, unit?: string | null): number {
  if (!Number.isFinite(value)) return value;
  if (unit && /^c/i.test(unit)) return Math.round((value * 9) / 5 + 32);
  return Math.round(value);
}

/** 3°C above dew point is a 5°F spread — never convert the 3 as if it were a thermometer reading. */
export function dewSpread(text: string): number | null {
  const above = text.match(
    /(-?\d+(?:\.\d+)?)\s*°?\s*([CF])?\s*(?:above|over|higher than|greater than)\s+(?:the\s+)?(?:measured\s+)?dew/i,
  );
  if (above?.[1]) return toDeltaF(Number(above[1]), above[2]);
  const minAbove = text.match(
    /(?:at least|minimum|min\.?|≥|>=)\s*(-?\d+(?:\.\d+)?)\s*°?\s*([CF])?\s*(?:above|over).{0,24}dew/i,
  );
  if (minAbove?.[1]) return toDeltaF(Number(minAbove[1]), minAbove[2]);
  if (/dew\s*point/i.test(text) || /above dew/i.test(text) || /no condensation/i.test(text)) return 5;
  return null;
}

export type AppWindow = {
  materialMinF: number | null;
  materialMaxF: number | null;
  surfaceMinF: number | null;
  surfaceMaxF: number | null;
  ambientMinF: number | null;
  ambientMaxF: number | null;
  rhMin: number | null;
  rhMax: number | null;
};

function fTemps(line: string): number[] {
  const parenF = [...line.matchAll(/\((-?\d+(?:\.\d+)?)\s*°?\s*F\)/gi)].map((m) => Number(m[1]));
  if (parenF.length >= 2) return parenF;
  const labeled = [...line.matchAll(/(-?\d+(?:\.\d+)?)\s*°\s*([CF])/gi)].map((m) => toTempF(Number(m[1]), m[2]));
  return labeled;
}

function percents(line: string): number[] {
  return [...line.matchAll(/(\d+(?:\.\d+)?)\s*%/g)].map((m) => Number(m[1]));
}

export function parseApplicationTable(text: string): AppWindow | null {
  const minLine = text.split(/\n/).find((l) => /^\s*minimum\b/i.test(l.trim()));
  const maxLine = text.split(/\n/).find((l) => /^\s*maximum\b/i.test(l.trim()));
  if (!minLine || !maxLine) {
    const flatMin = text.match(/minimum\b([^]{0,180}?)(?=maximum\b)/i);
    const flatMax = text.match(/maximum\b([^]{0,180}?)(?=industry standards|these times|curing|surface temp|$)/i);
    if (!flatMin || !flatMax) return null;
    return fromMinMax(flatMin[1], flatMax[1]);
  }
  return fromMinMax(minLine, maxLine);
}

function fromMinMax(minChunk: string, maxChunk: string): AppWindow | null {
  const mins = fTemps(minChunk);
  const maxs = fTemps(maxChunk);
  if (mins.length < 3 || maxs.length < 3) return null;
  const rhMins = percents(minChunk);
  const rhMaxs = percents(maxChunk);
  return {
    materialMinF: mins[0] ?? null,
    materialMaxF: maxs[0] ?? null,
    surfaceMinF: mins[1] ?? null,
    surfaceMaxF: maxs[1] ?? null,
    ambientMinF: mins[2] ?? null,
    ambientMaxF: maxs[2] ?? null,
    rhMin: rhMins[0] ?? null,
    rhMax: rhMaxs[0] ?? null,
  };
}

export function micronsToMilsRange(text: string): string {
  const m = text.match(/(\d+)\s*[–-]\s*(\d+)\s*microns/i);
  if (!m) return "";
  const a = Math.round(Number(m[1]) / 25.4);
  const b = Math.round(Number(m[2]) / 25.4);
  return `${a}–${b} mils (${m[1]}–${m[2]} µm)`;
}

type Env = {
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

type CardLike = {
  environmentals: Env;
  installation: { filmThickness: string; [k: string]: unknown };
  [k: string]: unknown;
};

export function refineExtractedCard<T extends CardLike>(card: T, raw: string): T {
  const table = parseApplicationTable(raw);
  const env = { ...card.environmentals };
  if (table) {
    env.ambientTempMinF = table.ambientMinF ?? env.ambientTempMinF;
    env.ambientTempMaxF = table.ambientMaxF ?? env.ambientTempMaxF;
    env.substrateTempMinF = table.surfaceMinF ?? env.substrateTempMinF;
    env.substrateTempMaxF = table.surfaceMaxF ?? env.substrateTempMaxF;
    env.relativeHumidityMin = table.rhMin ?? env.relativeHumidityMin;
    env.relativeHumidityMax = table.rhMax ?? env.relativeHumidityMax;
  }
  const dew = dewSpread(raw);
  if (dew != null) env.dewPointSpreadMinF = dew;
  const mils = micronsToMilsRange(raw);
  const film = card.installation.filmThickness || "";
  const installation =
    mils && !/\bmil/i.test(film) ? { ...card.installation, filmThickness: mils } : card.installation;
  return { ...card, environmentals: env, installation };
}
