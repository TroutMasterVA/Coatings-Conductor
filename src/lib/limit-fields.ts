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

/** Panel label and unit for each numeric limit (one row per LimitKey, in this order). */
export const LIMIT_FIELDS: ReadonlyArray<{ key: LimitKey; label: string; unit: string }> = [
  { key: "substrateTempMinF", label: "Surface (substrate) min", unit: "°F" },
  { key: "substrateTempMaxF", label: "Surface (substrate) max", unit: "°F" },
  { key: "ambientTempMinF", label: "Air min", unit: "°F" },
  { key: "ambientTempMaxF", label: "Air max", unit: "°F" },
  { key: "relativeHumidityMin", label: "RH min", unit: "%" },
  { key: "relativeHumidityMax", label: "RH max", unit: "%" },
  { key: "dewPointSpreadMinF", label: "Dew-point margin", unit: "°F" },
  { key: "windMaxMph", label: "Wind max", unit: "mph" },
];

/** Text limits from the sheet (card paths), shown and editable in the panel; not scored. */
export const TEXT_LIMIT_FIELDS = [
  { path: "mixing.inductionTime", label: "Induction / sweat-in" },
  { path: "mixing.potLife", label: "Pot life (by temperature)" },
  { path: "cure.touch", label: "Dry to touch" },
  { path: "cure.handle", label: "Dry to handle" },
  { path: "cure.recoatMin", label: "Recoat min (by temperature)" },
  { path: "cure.recoatMax", label: "Recoat max (by temperature)" },
  { path: "cure.fullCure", label: "Full cure" },
  { path: "installation.filmThickness", label: "DFT / WFT range" },
  { path: "mixing.thinning", label: "Thinning max" },
] as const;
