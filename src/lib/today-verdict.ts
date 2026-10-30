import { unstatedLimitFlags } from "./limit-fields.ts";
import type { SheetGate } from "./sheet-gate.ts";
import type { DayWindow, Environmentals, ForecastBundle } from "./types.ts";

/**
 * One plain verdict for today (go-live P1). It is NOT a second set of rules: it reads today's
 * day row (`DayWindow.status`, scored by `bundleDays` in score-windows.ts, the same row the day
 * card shows) and only decides whether there is a row to read.
 */

/** Always shown with a verdict: the model never makes the call on site. */
export const FINAL_CALL_LINE = "The person on site makes the final call.";
export const NO_TODAY_ROW = "No forecast for today yet. No verdict.";
export const TODAY_UNSCORED = "Today's hours couldn't be scored. No verdict.";

export const TODAY_LABEL = { go: "GO", caution: "CAUTION", nogo: "NO-GO" } as const;

export type TodayVerdict =
  | {
      kind: "verdict";
      status: keyof typeof TODAY_LABEL;
      label: (typeof TODAY_LABEL)[keyof typeof TODAY_LABEL];
      /** Today's day row: the verdict is its status, never recomputed. */
      day: DayWindow;
      /** "Not stated — check the sheet for …" for every limit the sheet doesn't state. */
      notStated: string[];
    }
  | { kind: "none"; reason: string };

/** The calendar date (YYYY-MM-DD) at the job site, in the forecast's time zone: the day rows' key. */
export function siteDateKey(timeZone: string, now: Date): string | null {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(now);
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
    const key = `${get("year")}-${get("month")}-${get("day")}`;
    return /^\d{4}-\d{2}-\d{2}$/.test(key) ? key : null;
  } catch {
    return null;
  }
}

export function todayVerdict(args: {
  forecast: ForecastBundle | null | undefined;
  gate: SheetGate;
  env?: Environmentals | null;
  now?: Date;
}): TodayVerdict {
  // Unreadable or missing sheet: the sheet gate's message, never a verdict.
  if (!args.gate.ok) return { kind: "none", reason: args.gate.message };
  const forecast = args.forecast;
  if (!forecast) return { kind: "none", reason: NO_TODAY_ROW };
  if (forecast.paused) return { kind: "none", reason: forecast.paused.reason };
  const key = siteDateKey(forecast.timezone, args.now ?? new Date());
  const day = key ? forecast.days.find((d) => d.date === key) : undefined;
  // No row for today: no guessing from another day.
  if (!day) return { kind: "none", reason: NO_TODAY_ROW };
  if (day.status === "unknown") return { kind: "none", reason: TODAY_UNSCORED };
  return {
    kind: "verdict",
    status: day.status,
    label: TODAY_LABEL[day.status],
    day,
    notStated: args.env ? unstatedLimitFlags(args.env) : [],
  };
}
