import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { FieldCardView } from "./field-card-view.tsx";
import { WeatherPanel } from "./weather-panel.tsx";
import { heuristicExtract } from "../lib/heuristic-extract.ts";
import { productTitleFromText } from "../lib/sheet-title-film.ts";
import { LIMIT_LABEL, LIMIT_KEYS, notStatedFlag } from "../lib/limit-fields.ts";
import type { FieldCardData, ForecastBundle } from "../lib/types.ts";
import type { SiteContext } from "../lib/mitigations.ts";

// Generic data-sheet text (not from a real sheet): the big title is emitted LAST by the text layer,
// pot life is a temperature table with the unit in its own row heading.
const SHEET = [
  "Product Data/ Application Instructions • Tough satin finish • Low odor",
  "Typical Uses Duracoat 77X can be used as a topcoat over epoxy primers. Duracoat 77X is not recommended for immersion.",
  "Environmental conditions °F °C air and surface temp 30 to 110 -1 to 43",
  "Pot life (hours) F°/C° 90/32 70/21 50/10 3 5 8 Dry times F°/C° 90/32 70/21 50/10 touch (minutes) 10 30 90",
  "Recoat times F°/C° 90/32 70/21 50/10 minimum (hours) 2 4 10 maximum Unlimited*",
  "Page 1 of 2 Duracoat ® 77X 77 Series Satin topcoat",
].join("\n");

function card(): FieldCardData {
  return heuristicExtract(SHEET);
}

describe("job card (rendered component)", () => {
  it("shows the product name and every pot-life value on the card face", () => {
    const c = card();
    assert.equal(productTitleFromText(SHEET), "Duracoat 77X");
    const html = renderToStaticMarkup(<FieldCardView card={c} />);
    const face = html.slice(0, html.indexOf("Full sheet (advanced)"));
    assert.ok(face.includes("Duracoat 77X"), "product name on the card face");
    assert.ok(!face.includes("Unnamed product"));
    assert.ok(/Pot life/.test(face), "pot life row on the card face");
    for (const v of ["3 hours at 90°F", "5 hours at 70°F", "8 hours at 50°F"]) assert.ok(face.includes(v), `${v} on the card face`);
  });
  it("go gates line shows the check-the-sheet flag for every unstated limit", () => {
    const c = card();
    const html = renderToStaticMarkup(<FieldCardView card={c} />);
    const face = html.slice(0, html.indexOf("Full sheet (advanced)"));
    for (const k of LIMIT_KEYS) {
      if (c.environmentals[k] == null) assert.ok(face.includes(notStatedFlag(LIMIT_LABEL[k])), k);
    }
  });
  it("day card top line reads 'Best GO stretch', separate from 'Counted hours'", () => {
    const site: SiteContext = { substrate: "bare_steel", mitigations: [] };
    const forecast: ForecastBundle = {
      zip: "23219", city: "Richmond", state: "VA", lat: 37.5, lon: -77.4, timezone: "America/New_York", source: "NWS",
      issuedAt: "2026-10-27T12:00:00Z", headline: "H",
      days: [{ date: "2026-10-27", weekday: "Tue", dateLabel: "Oct 27", status: "nogo", goHours: 11, cautionHours: 0, nogoHours: 2,
        workHours: 13, workRange: "08:00–21:00", bestRange: "10:00–21:00", limiting: [], hours: [{ status: "go" } as never] }],
    } as ForecastBundle;
    const html = renderToStaticMarkup(
      <WeatherPanel zip="23219" onZip={() => {}} forecast={forecast} loading={false} error={null} onLoad={() => {}} site={site} onSite={() => {}} />,
    );
    assert.ok(html.includes("Best GO stretch 10:00–21:00"));
    assert.ok(html.includes("Counted hours 08:00–21:00"));
  });
});
