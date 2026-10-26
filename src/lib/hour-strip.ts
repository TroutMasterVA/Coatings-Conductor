import type { HourWindow } from "./types.ts";

/**
 * The day strip shows hour cells that START at 05:00 through 20:00 (day shift), or every hour
 * (night shift). Each cell is the hour [h, h+1), so the strip covers 05:00–21:00; a listed
 * window can end at 21:00 (the end of the 20:00 hour). The label names the covered span.
 */
export const STRIP_FIRST_HOUR = 5;
export const STRIP_LAST_HOUR = 20;

export function stripHours<T extends Pick<HourWindow, "hour">>(hours: T[], night?: boolean): T[] {
  return night ? hours : hours.filter((h) => h.hour >= STRIP_FIRST_HOUR && h.hour <= STRIP_LAST_HOUR);
}

const hh = (h: number) => `${String(h).padStart(2, "0")}:00`;

/** Label for the strip: first cell start to last cell end. */
export function stripLabel(night?: boolean): string {
  return night ? `Strip is ${hh(0)}–${hh(24)} (night shift)` : `Strip is ${hh(STRIP_FIRST_HOUR)}–${hh(STRIP_LAST_HOUR + 1)} local`;
}
