import type { Environmentals } from "./types.ts";

/** Every numeric limit on the card, taken from the Environmentals type (a new numeric field is a type error until labelled here). */
export type LimitKey = {
  [K in keyof Environmentals]-?: Environmentals[K] extends number | null ? K : never;
}[keyof Environmentals];

/** Plain-words name of each limit, as used in the "check the sheet" flag. */
export const LIMIT_LABEL = {
  ambientTempMinF: "air min",
  ambientTempMaxF: "air max",
  substrateTempMinF: "surface min",
  substrateTempMaxF: "surface max",
  relativeHumidityMax: "max RH",
  relativeHumidityMin: "min RH",
  dewPointSpreadMinF: "dew-point spread",
  windMaxMph: "spray wind max",
} satisfies Record<LimitKey, string>;

/** Visible flag on any view where a sheet limit is not stated (Isaiah, Oct 23). */
export function notStatedFlag(limit: string): string {
  return `Not stated — check the sheet for ${limit}`;
}

export const LIMIT_KEYS = Object.keys(LIMIT_LABEL) as LimitKey[];

/** The ONE place that decides which limits are unstated. Every view renders from this. */
export function unstatedLimitKeys(env: Pick<Environmentals, LimitKey>): LimitKey[] {
  return LIMIT_KEYS.filter((k) => env[k] == null);
}

export function unstatedLimitFlags(env: Pick<Environmentals, LimitKey>): string[] {
  return unstatedLimitKeys(env).map((k) => notStatedFlag(LIMIT_LABEL[k]));
}
