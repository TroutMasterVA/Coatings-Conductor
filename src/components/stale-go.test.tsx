import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { WeatherPanel } from "./weather-panel.tsx";
import { SAMPLES } from "../lib/samples.ts";
import { bundleDays } from "../lib/score-windows.ts";
import { shownForecast } from "../lib/forecast-state.ts";
import { FORECAST_UNAVAILABLE_MESSAGE } from "../lib/forecast-sources.ts";
import type { ForecastBundle, HourWindow } from "../lib/types.ts";
import type { SiteContext } from "../lib/mitigations.ts";

const card = SAMPLES[0]!.card();
const site: SiteContext = { substrate: "bare_steel", mitigations: [] };
const noop = () => {};
const NOW = new Date("2026-10-30T15:00:00Z");

function goHours(date: string, weekday: string): HourWindow[] {
  return [10, 11, 12, 13].map((hour) => ({
    startIso: `${date}T${hour}:00:00`,
    hour,
    weekday,
    dateLabel: `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}`,
    dateKey: date,
    status: "go",
    reasons: ["in window"],
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

const GOOD: ForecastBundle = bundleDays(
  [...goHours("2026-10-30", "Fri"), ...goHours("2026-10-31", "Sat")],
  { zip: "22201", city: "Arlington", state: "VA", lat: 38.9, lon: -77.1, timezone: "America/New_York", source: "NWS", issuedAt: "2026-10-30T12:00:00Z" },
  card.environmentals,
  site,
);

function render(forecast: ForecastBundle | null, error: string | null): string {
  return renderToStaticMarkup(
    <WeatherPanel
      zip="22201"
      onZip={noop}
      forecast={forecast}
      loading={false}
      error={error}
      onLoad={noop}
      environmentals={card.environmentals}
      onEnvironmentals={noop}
      site={site}
      onSite={noop}
      now={NOW}
    />,
  );
}

describe("D4: good load, then a failed reload, shows no GO anywhere", () => {
  it("good load shows GO (baseline)", () => {
    const html = render(shownForecast({ forecast: GOOD, loadedZip: "22201", error: null }, "22201"), null);
    assert.match(html, /data-testid="today-verdict"/);
    assert.match(html, />GO</);
  });
  it("failed reload: the error, no today line, no day rows, no GO", () => {
    const view = { forecast: GOOD, loadedZip: "22201", error: FORECAST_UNAVAILABLE_MESSAGE };
    const html = render(shownForecast(view, "22201"), view.error);
    assert.ok(html.includes("This is not a GO"));
    assert.doesNotMatch(html, /data-testid="today-verdict"/);
    assert.doesNotMatch(html.replaceAll("This is not a GO", ""), />GO</);
  });
  it("even if the old forecast were still passed in, the panel lets the error win", () => {
    const html = render(GOOD, FORECAST_UNAVAILABLE_MESSAGE);
    assert.doesNotMatch(html, /data-testid="today-verdict"/);
    assert.doesNotMatch(html.replaceAll("This is not a GO", ""), />GO</);
  });
  it("forecast for another ZIP (stale): no GO", () => {
    const html = render(shownForecast({ forecast: GOOD, loadedZip: "60601", error: null }, "22201"), null);
    assert.doesNotMatch(html, /data-testid="today-verdict"/);
    assert.doesNotMatch(html, />GO</);
  });
});
