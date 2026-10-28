import type { HourCheck } from "./noaa.ts";
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

/**
 * Readings already in the fetched forecast hour: air temp, RH %, and the dew-point spread the
 * verdict USED with its basis (pass the dew check's spread/basis); else air − dew point.
 */
export function hourReadings(
  h: { tempF: number | null; rh: number | null; dewpointF: number | null },
  used?: { spreadF?: number; basis?: string },
): string {
  const air = h.tempF != null && h.dewpointF != null ? Math.round((h.tempF - h.dewpointF) * 10) / 10 : null;
  const spread = used?.spreadF ?? air;
  const basis = used?.spreadF != null ? used.basis ?? "air" : "air";
  return [
    `Air ${h.tempF ?? "—"}°F`,
    `RH ${h.rh ?? "—"}%`,
    `dew spread ${spread ?? "—"}°F${spread != null ? ` (${basis})` : ""}`,
  ].join(" · ");
}

/**
 * Range of the hours a day card counts, from that same list: first counted hour start to last
 * counted hour end (end-exclusive). Wraps for night shift (the largest gap is the off period).
 */
export function countedRange(hours: Array<{ hour: number }>): string | null {
  const hs = [...new Set(hours.map((h) => h.hour))].sort((a, b) => a - b);
  if (!hs.length) return null;
  let start = hs[0]!;
  let end = hs.at(-1)! + 1;
  let widest = 24 - end + start; // gap wrapping past midnight
  for (let i = 1; i < hs.length; i++) {
    const gap = hs[i]! - hs[i - 1]! - 1;
    if (gap > widest) {
      widest = gap;
      start = hs[i]!;
      end = hs[i - 1]! + 1;
    }
  }
  return `${hh(start)}–${hh(end === 0 ? 24 : end)}`;
}

/** Index the day cards' per-hour classification by hour start (same instant key as the sheet list). */
export function dayHourIndex(days: Array<{ hours?: HourWindow[] }>): Map<string, HourWindow> {
  const m = new Map<string, HourWindow>();
  for (const d of days) for (const h of d.hours ?? []) m.set(new Date(h.startIso).toISOString(), h);
  return m;
}

export type HourLine = { text: string; variant: "go" | "caution" | "nogo" | "default"; caution: boolean };

const LINE_TEXT: Record<HourCheck["verdict"], string> = { go: "GO", nogo: "NO-GO", unavailable: "Unavailable", outside: OUTSIDE_WORK_WINDOW };

/**
 * Label for one hourly line. A line the day card counts as caution never reads plain GO: it shows
 * "GO · CAUTION — <reason>", the reason coming from the same per-hour classification the card used.
 */
export function hourLine(check: HourCheck, dayHour: HourWindow | undefined): HourLine {
  if (check.verdict === "go" && dayHour?.status === "caution") {
    const reason = dayHour.reasons[0];
    return { text: `GO · CAUTION${reason ? ` — ${reason}` : ""}`, variant: "caution", caution: true };
  }
  const variant = check.verdict === "go" ? "go" : check.verdict === "nogo" ? "nogo" : "default";
  return { text: LINE_TEXT[check.verdict], variant, caution: false };
}

/** Top line of a day card: the best stretch, labelled as such (distinct from "Counted hours"). */
export function bestStretchLabel(day: { bestRange: string | null; hours?: Array<{ status: string }> }): string {
  if (!day.bestRange) return "No GO stretch";
  const anyGo = (day.hours ?? []).some((h) => h.status === "go");
  const what = anyGo || !day.hours?.length ? "Best GO stretch" : "Best caution stretch";
  return day.bestRange === "All day" ? `${what}: all day` : `${what} ${day.bestRange}`;
}
