/**
 * One way to print a temperature limit pair. Never a dangling dash:
 * both -> "50–120°F", min only -> "at least 50°F", max only -> "up to 120°F", neither -> "Not stated".
 * FE can import this for chips (field-card-view.tsx) so every surface reads the same.
 */
export const TEMP_NOT_STATED = "Not stated";

export function formatTempRange(
  min: number | null | undefined,
  max: number | null | undefined,
  unit = "°F",
): string {
  const lo = typeof min === "number" && Number.isFinite(min) ? min : null;
  const hi = typeof max === "number" && Number.isFinite(max) ? max : null;
  if (lo !== null && hi !== null) return `${lo}\u2013${hi}${unit}`;
  if (lo !== null) return `at least ${lo}${unit}`;
  if (hi !== null) return `up to ${hi}${unit}`;
  return TEMP_NOT_STATED;
}
