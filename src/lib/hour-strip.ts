import type { HourWindow } from "./types.ts";

/**
 * The day strip shows hour cells that START at 05:00 through 20:00 (day shift), or every hour
 * (night shift). Each cell is the hour [h, h+1), so the strip covers 05:00–21:00; a listed
 * window can end at 21:00 (the end of the 20:00 hour). The label names the covered span.
 */
export const STRIP_FIRST_HOUR = 5;
export const STRIP_LAST_HOUR = 20;

export function stripHours<T extends Pick<HourWindow, "hour">>(hours: T[], night?: boolean): T[] {
  return hours.filter((h) => inWorkWindow(h.hour, night));
}

const hh = (h: number) => `${String(h).padStart(2, "0")}:00`;

/** Label for the strip: first cell start to last cell end. */
export function stripLabel(night?: boolean): string {
  return night ? `Strip is ${hh(0)}–${hh(24)} (night shift)` : `Strip is ${hh(STRIP_FIRST_HOUR)}–${hh(STRIP_LAST_HOUR + 1)} local`;
}

/** Shown instead of a verdict for any hour outside the work window. */
export const OUTSIDE_WORK_WINDOW = "Outside work window";

/** The work window is the strip: day shift = hours starting 05..20; night shift = every hour. */
export function inWorkWindow(hour: number, night?: boolean): boolean {
  return Boolean(night) || (hour >= STRIP_FIRST_HOUR && hour <= STRIP_LAST_HOUR);
}

/** Local weekday + hour (0–23) of an ISO instant in an IANA zone. */
export function localHour(iso: string, timeZone: string): { weekday: string; hour: number } {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short", hour: "numeric", hourCycle: "h23" }).formatToParts(new Date(iso));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return { weekday: get("weekday"), hour: Number(get("hour")) % 24 };
}

export const hourText = (iso: string, timeZone: string) => {
  const l = localHour(iso, timeZone);
  return `${l.weekday} ${hh(l.hour)}`;
};

/**
 * Label for an hourly list, computed from the exact hours shown: first line's start to the last
 * line's end (end-exclusive, like the strip), plus the work window that gets GO/NO-GO.
 */
export function hourListLabel(isos: string[], timeZone: string, night?: boolean): string {
  if (!isos.length) return "No hours shown";
  const end = new Date(new Date(isos.at(-1)!).getTime() + 3_600_000).toISOString();
  const win = night ? "every hour (night shift)" : `${hh(STRIP_FIRST_HOUR)}–${hh(STRIP_LAST_HOUR + 1)} local`;
  return `Showing ${hourText(isos[0]!, timeZone)}–${hourText(end, timeZone)} (${isos.length} h) · GO/NO-GO only inside the work window, ${win}`;
}

/** Readings already in the fetched forecast hour: air temp, RH %, air − dew-point spread. */
export function hourReadings(h: { tempF: number | null; rh: number | null; dewpointF: number | null }): string {
  const spread = h.tempF != null && h.dewpointF != null ? Math.round((h.tempF - h.dewpointF) * 10) / 10 : null;
  return [
    `Air ${h.tempF ?? "—"}°F`,
    `RH ${h.rh ?? "—"}%`,
    `dew spread ${spread ?? "—"}°F`,
  ].join(" · ");
}
