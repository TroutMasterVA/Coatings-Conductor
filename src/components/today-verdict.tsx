import { FINAL_CALL_LINE, todayVerdict } from "../lib/today-verdict.ts";
import type { SheetGate } from "../lib/sheet-gate.ts";
import type { Environmentals, ForecastBundle } from "../lib/types.ts";
import { cn } from "../lib/utils.ts";

const TONE = {
  go: "border-go text-go",
  caution: "border-caution text-caution",
  nogo: "border-nogo text-nogo",
} as const;

/** The one plain line for today, at the top of the forecast. Reads today's day row only. */
export function TodayVerdictLine({
  forecast,
  gate,
  env,
  now,
}: {
  forecast: ForecastBundle | null;
  gate: SheetGate;
  env?: Environmentals;
  now?: Date;
}) {
  const v = todayVerdict({ forecast, gate, env, now });
  if (v.kind === "none") {
    return (
      <section
        data-testid="today-verdict"
        data-status="none"
        aria-label="Today's verdict"
        className="rounded-xl bg-surface px-4 py-3 shadow-[0_0_0_1px_rgba(255,255,255,0.08)]"
      >
        <p className="text-xs font-medium uppercase tracking-wide text-muted">Today</p>
        <p className="mt-1 text-sm font-semibold text-fg">{v.reason}</p>
      </section>
    );
  }
  const reason = v.status === "go" ? null : v.day.limiting[0];
  return (
    <section
      data-testid="today-verdict"
      data-status={v.status}
      aria-label="Today's verdict"
      className={cn("rounded-xl border-l-4 bg-surface px-4 py-3 shadow-[0_0_0_1px_rgba(255,255,255,0.08)]", TONE[v.status])}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-muted">
        Today · {v.day.weekday} {v.day.dateLabel}
      </p>
      <p className="mt-1 text-2xl font-bold leading-tight" data-testid="today-verdict-label">
        {v.label}
      </p>
      {reason ? <p className="mt-1 break-words text-sm text-fg">{reason}</p> : null}
      {v.day.materialLine ? (
        <p className="mt-1 text-sm font-medium text-caution" data-testid="today-material-line">
          {v.day.materialLine}
        </p>
      ) : null}
      {v.notStated.length ? (
        <ul className="mt-2 space-y-0.5 text-xs text-caution" data-testid="today-verdict-unstated">
          {v.notStated.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
      ) : null}
      <p className="mt-2 text-xs text-muted">Same rules as today's day row below. {FINAL_CALL_LINE}</p>
    </section>
  );
}
