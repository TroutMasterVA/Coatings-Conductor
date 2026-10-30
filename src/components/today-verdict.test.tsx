import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { WeatherPanel } from "./weather-panel.tsx";
import { SAMPLES } from "../lib/samples.ts";
import { bundleDays } from "../lib/score-windows.ts";
import { NO_SHEET_MESSAGE, SHEET_UNREADABLE_MESSAGE, sheetGate, type SheetGate } from "../lib/sheet-gate.ts";
import { FINAL_CALL_LINE, NO_TODAY_ROW, siteDateKey, TODAY_LABEL, todayVerdict } from "../lib/today-verdict.ts";
import type { Environmentals, FieldCardData, ForecastBundle, HourWindow, WindowStatus } from "../lib/types.ts";
import type { SiteContext } from "../lib/mitigations.ts";

const loaded = SAMPLES[0]!.card();
const site: SiteContext = { substrate: "bare_steel", mitigations: [] };
const noop = () => {};
const TZ = "America/New_York";
/** Fri Oct 30, 11:00 AM at the site. */
const NOW = new Date("2026-10-30T15:00:00Z");

function hours(date: string, weekday: string, statuses: WindowStatus[]): HourWindow[] {
  return statuses.map((status, i) => ({
    startIso: `${date}T${String(10 + i).padStart(2, "0")}:00:00`,
    hour: 10 + i,
    weekday,
    dateLabel: `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}`,
    dateKey: date,
    status,
    reasons: status === "go" ? ["in window"] : status === "caution" ? ["RH near the sheet max"] : ["surface below the sheet min"],
    tempF: 60,
    rh: 50,
    dewpointF: 40,
    spreadF: 20,
    pop: 0,
    precipIn: 0,
    windMph: 3,
    shortForecast: "Sunny",
  }));
}

/** Days scored by the real day-row rule (bundleDays): today gets `today`, the days around it differ. */
function forecastWith(today: WindowStatus[], env: Environmentals = loaded.environmentals): ForecastBundle {
  const list = [
    ...hours("2026-10-29", "Thu", ["nogo", "go", "go"]),
    ...hours("2026-10-30", "Fri", today),
    ...hours("2026-10-31", "Sat", ["go", "go", "go"]),
  ];
  return bundleDays(
    list,
    { zip: "22201", city: "Arlington", state: "VA", lat: 38.9, lon: -77.1, timezone: TZ, source: "NWS", issuedAt: "2026-10-30T12:00:00Z" },
    env,
    site,
  );
}

function panel(forecast: ForecastBundle | null, gate: SheetGate, card: FieldCardData | null = loaded, now = NOW): string {
  return renderToStaticMarkup(
    <WeatherPanel
      zip="22201"
      onZip={noop}
      forecast={gate.ok ? forecast : null}
      loading={false}
      error={null}
      onLoad={noop}
      blocked={gate.ok ? undefined : gate.message}
      environmentals={card?.environmentals}
      onEnvironmentals={card ? noop : undefined}
      site={site}
      onSite={noop}
      now={now}
    />,
  );
}

function todaySection(html: string): string {
  const start = html.indexOf('data-testid="today-verdict"');
  assert.ok(start >= 0, "today line rendered");
  return html.slice(start, html.indexOf("</section>", start));
}

const OPEN: SheetGate = { ok: true };

describe("one plain verdict for today (go-live P1)", () => {
  for (const [want, today] of [
    ["go", ["go", "go", "go"]],
    ["caution", ["go", "caution", "go"]],
    ["nogo", ["go", "nogo", "caution"]],
  ] as const) {
    it(`today's line matches today's day row: ${TODAY_LABEL[want]}`, () => {
      const forecast = forecastWith([...today]);
      const row = forecast.days.find((d) => d.date === "2026-10-30")!;
      assert.equal(row.status, want, "day-row rule scored today");
      const v = todayVerdict({ forecast, gate: OPEN, now: NOW });
      assert.equal(v.kind, "verdict");
      if (v.kind !== "verdict") return;
      assert.equal(v.status, row.status);
      assert.equal(v.label, TODAY_LABEL[want]);
      assert.equal(v.day, row, "reads the same row object, no second rule");
      // Rendered at the top of the forecast, before the day cards, with the same status.
      const html = panel(forecast, OPEN);
      const section = todaySection(html);
      assert.match(section, new RegExp(`data-status="${want}"`));
      assert.match(section, new RegExp(`>${TODAY_LABEL[want]}<`));
      assert.match(section, /Fri/);
      assert.ok(html.indexOf('data-testid="today-verdict"') < html.indexOf("Thu"), "today line sits above the day rows");
      assert.ok(section.includes(FINAL_CALL_LINE), "person on site makes the final call");
      // Never the day-card count text (smoke counts those lines).
      assert.doesNotMatch(section, /work hours GO/);
    });
  }

  it("a different day's verdict never leaks into today's line", () => {
    const forecast = forecastWith(["go", "go", "go"]);
    assert.equal(forecast.days[0]!.status, "nogo");
    const v = todayVerdict({ forecast, gate: OPEN, now: NOW });
    assert.equal(v.kind === "verdict" && v.status, "go");
  });

  it("today is the job site's date (forecast time zone), not UTC", () => {
    // 10:00 PM Fri at the site is already Saturday in UTC.
    const late = new Date("2026-10-31T02:00:00Z");
    assert.equal(siteDateKey(TZ, late), "2026-10-30");
    const v = todayVerdict({ forecast: forecastWith(["go", "nogo", "go"]), gate: OPEN, now: late });
    assert.equal(v.kind === "verdict" && v.status, "nogo");
  });

  it("no sheet: no verdict, the sheet gate's message instead", () => {
    const gate = sheetGate(null, false);
    const v = todayVerdict({ forecast: forecastWith(["go", "go", "go"]), gate, now: NOW });
    assert.deepEqual(v, { kind: "none", reason: NO_SHEET_MESSAGE });
    const html = panel(forecastWith(["go", "go", "go"]), gate, null);
    assert.ok(!html.includes('data-testid="today-verdict"'));
    assert.doesNotMatch(html, />\s*(GO|CAUTION|NO-GO)\s*</);
  });

  it("unreadable sheet (read failed, or no stated limits): no verdict, 'Sheet couldn't be read'", () => {
    const failed = sheetGate(loaded, true);
    assert.deepEqual(todayVerdict({ forecast: forecastWith(["go", "go", "go"]), gate: failed, now: NOW }), {
      kind: "none",
      reason: SHEET_UNREADABLE_MESSAGE,
    });
    const blank: FieldCardData = {
      ...loaded,
      environmentals: {
        ...loaded.environmentals,
        ambientTempMinF: null,
        ambientTempMaxF: null,
        substrateTempMinF: null,
        substrateTempMaxF: null,
        relativeHumidityMax: null,
        relativeHumidityMin: null,
        dewPointSpreadMinF: null,
        windMaxMph: null,
      },
    };
    const noLimits = sheetGate(blank, false);
    assert.equal(todayVerdict({ forecast: forecastWith(["go", "go", "go"]), gate: noLimits, now: NOW }).kind, "none");
    const html = panel(forecastWith(["go", "go", "go"]), failed);
    assert.ok(!html.includes('data-testid="today-verdict"'));
    assert.ok(html.includes('data-testid="sheet-blocked"'));
  });

  it("an unstated limit shows 'Not stated — check the sheet for …' on today's line", () => {
    const env = { ...loaded.environmentals, windMaxMph: null };
    const forecast = forecastWith(["go", "go", "go"], env);
    const v = todayVerdict({ forecast, gate: OPEN, env, now: NOW });
    assert.ok(v.kind === "verdict" && v.notStated.includes("Not stated — check the sheet for spray wind max"));
    const section = todaySection(panel(forecast, OPEN, { ...loaded, environmentals: env }));
    assert.match(section, /Not stated — check the sheet for spray wind max/);
    assert.match(section, /data-testid="today-verdict-unstated"/);
  });

  it("no forecast row for today: no verdict, no guessing from another day", () => {
    const forecast = forecastWith(["go", "go", "go"]);
    const nextWeek = new Date("2026-11-06T15:00:00Z");
    assert.deepEqual(todayVerdict({ forecast, gate: OPEN, now: nextWeek }), { kind: "none", reason: NO_TODAY_ROW });
    const section = todaySection(panel(forecast, OPEN, loaded, nextWeek));
    assert.match(section, /data-status="none"/);
    assert.doesNotMatch(section, />\s*(GO|CAUTION|NO-GO)\s*</);
    assert.ok(section.includes("No verdict"));
  });

  it("today's hours unscored (unknown) or windows paused: no verdict", () => {
    const unknown = forecastWith(["unknown", "unknown", "unknown"]);
    assert.equal(todayVerdict({ forecast: unknown, gate: OPEN, now: NOW }).kind, "none");
    const paused = { ...forecastWith(["go", "go", "go"]), paused: { reason: "temperature limits not verified on the sheet" } };
    assert.deepEqual(todayVerdict({ forecast: paused, gate: OPEN, now: NOW }), {
      kind: "none",
      reason: "temperature limits not verified on the sheet",
    });
  });
});
