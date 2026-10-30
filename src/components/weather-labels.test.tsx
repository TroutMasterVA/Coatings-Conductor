import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { WeatherPanel } from "./weather-panel.tsx";
import { SAMPLES } from "../lib/samples.ts";
import type { SheetWindow } from "../lib/noaa.ts";
import type { ForecastBundle } from "../lib/types.ts";
import type { SiteContext } from "../lib/mitigations.ts";

const loaded = SAMPLES[0]!.card();
const site: SiteContext = { substrate: "bare_steel", mitigations: [] };
const noop = () => {};
const source = { label: "NWS hourly" } as unknown as SheetWindow["source"];

const sheet: SheetWindow = {
  source,
  timezone: "UTC",
  backup: false,
  now: null,
  hours: [
    {
      startIso: "2026-10-30T12:00:00Z",
      verdict: "go",
      hour: { startIso: "2026-10-30T12:00:00Z", tempF: 60, rh: 50, dewpointF: 40, windMph: 3, gustMph: null, skyCover: 10, pop: 0, source },
      checks: [
        { name: "Air temp", status: "pass", reason: "Air 60°F within sheet range" },
        { name: "Spray wind", status: "not-stated", reason: "Not stated — check the sheet for spray wind limit" },
        { name: "Surface temp", status: "not-stated", reason: "Surface temp: Not stated on the sheet" },
      ],
    },
  ],
};

const forecast: ForecastBundle = {
  zip: "22201",
  city: "Arlington",
  state: "VA",
  lat: 38.9,
  lon: -77.1,
  timezone: "UTC",
  source: "NWS",
  issuedAt: "2026-10-30T12:00:00Z",
  headline: "x",
  sheet,
  days: [
    { date: "2026-10-30", weekday: "Fri", dateLabel: "10/30", status: "nogo", goHours: 0, cautionHours: 0, nogoHours: 8, workHours: 8, bestRange: null, limiting: [], hours: [] },
  ],
};

function html(): string {
  return renderToStaticMarkup(
    <WeatherPanel
      zip="22201"
      onZip={noop}
      forecast={forecast}
      loading={false}
      error={null}
      onLoad={noop}
      environmentals={loaded.environmentals}
      site={site}
      onSite={noop}
      now={new Date("2026-10-30T12:00:00Z")}
    />,
  );
}

describe("weather panel display text (BUG-51-2, hourly Not stated)", () => {
  it("the day-row badge reads NO-GO (shown uppercase), never NOGO", () => {
    const out = html();
    assert.match(out, />no-go<\/(span|div)>/);
    assert.doesNotMatch(out, />nogo</i);
  });
  it("an unstated limit on an hourly line says 'Not stated' once, not 'Not stated: Not stated'", () => {
    const out = html();
    assert.doesNotMatch(out, /Not stated: /);
    assert.ok(out.includes("Not stated — check the sheet for spray wind limit"));
    assert.ok(out.includes("Surface temp: Not stated on the sheet"));
    // Other checks keep their prefix.
    assert.ok(out.includes("pass: Air 60°F within sheet range"));
  });
});
