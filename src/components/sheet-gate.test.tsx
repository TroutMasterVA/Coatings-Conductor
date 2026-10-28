import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { FieldCardView } from "./field-card-view.tsx";
import { WeatherPanel } from "./weather-panel.tsx";
import { SAMPLES } from "../lib/samples.ts";
import {
  gatedForecast,
  hasStatedLimit,
  NO_SHEET_MESSAGE,
  SHEET_UNREADABLE_MESSAGE,
  sheetGate,
  type SheetGate,
} from "../lib/sheet-gate.ts";
import type { Environmentals, FieldCardData, ForecastBundle } from "../lib/types.ts";
import type { SiteContext } from "../lib/mitigations.ts";

const loaded = SAMPLES[0]!.card();
const EMPTY_ENV: Environmentals = {
  ...loaded.environmentals,
  ambientTempMinF: null,
  ambientTempMaxF: null,
  substrateTempMinF: null,
  substrateTempMaxF: null,
  relativeHumidityMax: null,
  relativeHumidityMin: null,
  dewPointSpreadMinF: null,
  windMaxMph: null,
};
/** What a text file named .pdf reads as on the device: a card with no product and no limits. */
const unreadable: FieldCardData = { ...loaded, environmentals: EMPTY_ENV };
const noop = () => {};
const site: SiteContext = { substrate: "bare_steel", mitigations: [] };
const forecast: ForecastBundle = {
  zip: "22201",
  city: "Arlington",
  state: "VA",
  lat: 38.9,
  lon: -77.1,
  timezone: "America/New_York",
  source: "NWS",
  issuedAt: "2026-10-28T15:00:00Z",
  headline: "UNIQUE-HEADLINE GO · 6 of 6 work hours GO",
  days: [
    { date: "2026-10-29", weekday: "Thu", dateLabel: "Oct 29", status: "go", goHours: 6, cautionHours: 0, nogoHours: 0, bestRange: "9 AM–3 PM", limiting: [], hours: [] },
    { date: "2026-10-30", weekday: "Fri", dateLabel: "Oct 30", status: "caution", goHours: 0, cautionHours: 4, nogoHours: 2, bestRange: "", limiting: [], hours: [] },
    { date: "2026-10-31", weekday: "Sat", dateLabel: "Oct 31", status: "nogo", goHours: 0, cautionHours: 0, nogoHours: 8, bestRange: "", limiting: [], hours: [] },
  ],
};

/** Renders what index.tsx renders for this gate: the weather panel and the card headline. */
function screen(card: FieldCardData | null, gate: SheetGate): string {
  const shown = gatedForecast(gate, forecast);
  const panel = renderToStaticMarkup(
    <WeatherPanel
      zip="22201"
      onZip={noop}
      forecast={shown}
      loading={false}
      error={null}
      onLoad={noop}
      disabled={!gate.ok}
      blocked={gate.ok ? undefined : gate.message}
      environmentals={card?.environmentals}
      onEnvironmentals={card ? noop : undefined}
      site={site}
      onSite={noop}
    />,
  );
  const head = card
    ? renderToStaticMarkup(<FieldCardView card={card} zip="22201" headline={gate.ok ? shown?.headline : gate.message} />)
    : "";
  return panel + head;
}

/** Any day-card, hourly-line or headline verdict. */
function assertNoVerdict(html: string) {
  assert.ok(!html.includes("UNIQUE-HEADLINE"), "no forecast headline");
  for (const day of ["Oct 29", "Oct 30", "Oct 31"]) assert.ok(!html.includes(day), `no day card for ${day}`);
  assert.doesNotMatch(html, /work hours|go-days|h go this week|reopened from no-go/i);
  assert.doesNotMatch(html, />\s*(GO|CAUTION|NO-GO|No-go|Caution|Go)\s*</, "no verdict label or legend");
}

describe("sheet gate: no verdict without a loaded sheet", () => {
  it("failed read -> 'Sheet couldn't be read', no GO/CAUTION/NO-GO anywhere (with or without a card)", () => {
    for (const card of [null, loaded, unreadable]) {
      const gate = sheetGate(card, true);
      assert.deepEqual(gate, { ok: false, reason: "unreadable", message: SHEET_UNREADABLE_MESSAGE });
      assert.equal(gatedForecast(gate, forecast), null);
      const html = screen(card, gate);
      assert.ok(html.includes("Sheet couldn&#x27;t be read") || html.includes(SHEET_UNREADABLE_MESSAGE), html.slice(0, 200));
      assertNoVerdict(html);
    }
  });

  it("text file named .pdf (read 'done' but no stated limits) -> 'Sheet couldn't be read', no verdict", () => {
    assert.equal(hasStatedLimit(EMPTY_ENV), false);
    const gate = sheetGate(unreadable, false);
    assert.equal(gate.ok, false);
    const html = screen(unreadable, gate);
    assert.ok(html.includes('data-testid="sheet-blocked"'));
    assertNoVerdict(html);
  });

  it("no sheet at all -> 'No sheet loaded', no scoring against default limits", () => {
    const gate = sheetGate(null, false);
    assert.deepEqual(gate, { ok: false, reason: "none", message: NO_SHEET_MESSAGE });
    assert.equal(gatedForecast(gate, forecast), null);
    const html = screen(null, gate);
    assert.ok(html.includes(NO_SHEET_MESSAGE));
    assertNoVerdict(html);
  });

  it("loaded sheet still scores normally", () => {
    assert.equal(hasStatedLimit(loaded.environmentals), true);
    const gate = sheetGate(loaded, false);
    assert.deepEqual(gate, { ok: true });
    assert.equal(gatedForecast(gate, forecast), forecast);
    const html = screen(loaded, gate);
    assert.ok(!html.includes('data-testid="sheet-blocked"'));
    assert.ok(html.includes("UNIQUE-HEADLINE"));
    for (const day of ["Oct 29", "Oct 30", "Oct 31"]) assert.ok(html.includes(day), `day card ${day}`);
    assert.ok(!html.includes(NO_SHEET_MESSAGE) && !html.includes("be read"));
  });
});
