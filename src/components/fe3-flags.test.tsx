import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { FieldCardView } from "./field-card-view.tsx";
import { WeatherPanel } from "./weather-panel.tsx";
import { DRAFT_BANNER, WINDOWS_PAUSED } from "../lib/extract-flags.ts";
import { SAMPLES } from "../lib/samples.ts";
import type { ForecastBundle } from "../lib/types.ts";
import type { SiteContext } from "../lib/mitigations.ts";

const card = SAMPLES[0]!.card();
const noop = () => {};
const site: SiteContext = { substrate: "bare_steel", mitigations: [] };
const forecast: ForecastBundle = {
  zip: "23219",
  city: "Richmond",
  state: "VA",
  lat: 37.5,
  lon: -77.4,
  timezone: "America/New_York",
  source: "NWS",
  issuedAt: "2026-10-18T19:00:00Z",
  headline: "UNIQUE-HEADLINE-TEXT",
  days: [
    {
      date: "2026-10-19",
      weekday: "Mon",
      dateLabel: "Oct 19",
      status: "go",
      goHours: 6,
      cautionHours: 0,
      nogoHours: 0,
      bestRange: "9 AM–3 PM",
      limiting: [],
      hours: [],
    },
  ],
};

/** Inner HTML of the element with this id (simple nesting-aware scan). */
function sectionById(html: string, id: string): string {
  const start = html.indexOf(`id="${id}"`);
  assert.ok(start >= 0, `#${id} rendered`);
  const open = html.lastIndexOf("<", start);
  const tag = /^<(\w+)/.exec(html.slice(open))![1]!;
  let depth = 0;
  const re = new RegExp(`<${tag}[\\s>]|</${tag}>`, "g");
  re.lastIndex = open;
  for (let m = re.exec(html); m; m = re.exec(html)) {
    depth += m[0].startsWith("</") ? -1 : 1;
    if (depth === 0) return html.slice(open, m.index);
  }
  return html.slice(open);
}

describe("FE-3 components", () => {
  it("draft banner renders inside #field-card-print (prints), role=status, not no-print", () => {
    const html = renderToStaticMarkup(<FieldCardView card={card} draft />);
    const print = sectionById(html, "field-card-print");
    assert.ok(print.includes(DRAFT_BANNER));
    const banner = /<p[^>]*data-testid="draft-banner"[^>]*>/.exec(print)![0];
    assert.match(banner, /role="status"/);
    assert.doesNotMatch(banner, /role="alert"|no-print/);
  });
  it("no banner without the draft flag (samples)", () => {
    assert.ok(!renderToStaticMarkup(<FieldCardView card={card} />).includes(DRAFT_BANNER));
  });
  const panel = (paused: boolean) =>
    renderToStaticMarkup(
      <WeatherPanel
        zip="23219"
        onZip={noop}
        forecast={forecast}
        loading={false}
        error={null}
        onLoad={noop}
        environmentals={card.environmentals}
        site={site}
        onSite={noop}
        paused={paused}
      />,
    );
  it("paused block replaces the windows/calendar", () => {
    const on = panel(true);
    assert.ok(on.includes('data-testid="windows-paused"'));
    assert.ok(on.includes(WINDOWS_PAUSED));
    assert.ok(!on.includes("UNIQUE-HEADLINE-TEXT"));
    assert.ok(!on.includes("Oct 19"));
    const off = panel(false);
    assert.ok(!off.includes('data-testid="windows-paused"'));
    assert.ok(off.includes("UNIQUE-HEADLINE-TEXT"));
  });
});
