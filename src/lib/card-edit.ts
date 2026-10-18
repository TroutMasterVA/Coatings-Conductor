/**
 * Tap-to-edit a card value (FE-5). The browser only changes the card; it never writes `edited`
 * stamps (CONTRACT.md "Edit stamp (hand edits)": the server stamps `{ edited: { by, at }, sheetQuote? }`).
 * Pure helpers so node:test can load them.
 */

/** Single-string card fields that can be edited in place. Lists and combined lines are not. */
export const EDITABLE_PATHS = [
  "product.name",
  "storage.temperatureRange",
  "shelfLife.unopened",
  "shelfLife.opened",
  "shelfLife.mixedPotLife",
  "surfacePrep.profile",
  "surfacePrep.cleanliness",
  "surfacePrep.moisture",
  "mixing.components",
  "mixing.ratio",
  "mixing.inductionTime",
  "mixing.potLife",
  "mixing.thinning",
  "installation.filmThickness",
  "installation.coverage",
  "installation.numberOfCoats",
  "inspection.documentation",
  "cure.touch",
  "cure.handle",
  "cure.recoatMin",
  "cure.recoatMax",
  "cure.fullCure",
  "cure.immersionService",
  "safety.ventilation",
] as const;

export type EditablePath = (typeof EDITABLE_PATHS)[number];

export function isEditablePath(path: string): path is EditablePath {
  return (EDITABLE_PATHS as readonly string[]).includes(path);
}

/** What gets stored: trimmed; blank = "" (shows "Not stated"). */
export function normalizeEditValue(raw: string): string {
  return raw.replace(/\s+/g, " ").trim();
}

/**
 * New card with one field changed; the input is not mutated. Returns the same object when the
 * path is not editable or the value did not change, so no save is triggered.
 */
export function setCardValue<T extends object>(card: T, path: string, raw: string): T {
  if (!isEditablePath(path)) return card;
  const [group, key] = path.split(".") as [string, string];
  const section = (card as Record<string, unknown>)[group];
  if (!section || typeof section !== "object") return card;
  const prev = (section as Record<string, unknown>)[key];
  if (prev !== undefined && prev !== null && typeof prev !== "string") return card;
  const value = normalizeEditValue(raw);
  if ((prev ?? "") === value) return card;
  return { ...card, [group]: { ...(section as object), [key]: value } } as T;
}
