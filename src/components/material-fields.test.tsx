import { beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";

// Item 5 UI: limits-panel material rows, the measured-material field (time + 4 h), the day / today
// lines, and a guest reload keeping all of it. Device store for the guest path.
const mem = new Map<string, string>();
(globalThis as Record<string, unknown>).window = globalThis;
(globalThis as Record<string, unknown>).localStorage = {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => void mem.set(k, v),
  removeItem: (k: string) => void mem.delete(k),
};

const { LimitsPanel } = await import("./limits-panel.tsx");
const { MaterialReadingField, WeatherPanel } = await import("./weather-panel.tsx");
const { TodayVerdictLine } = await import("./today-verdict.tsx");
const { editMaterialLimit, limitSource, USER_EDITED, FROM_SHEET } = await import("../lib/limit-source.ts");
const { extractPasted, extractForSave, savedExtractState } = await import("../lib/extract-client.ts");
const { onDeviceProvider } = await import("../lib/extract/on-device-provider.ts");
const { heuristicExtract } = await import("../lib/heuristic-extract.ts");
const { bundleDays, scoreHour } = await import("../lib/score-windows.ts");
const { FINAL_CALL_LINE } = await import("../lib/today-verdict.ts");
const { MEASURE_MATERIAL_LINE } = await import("../lib/material-temp.ts");
const gw = await import("../lib/guest-workspace.ts");
const { defaultSite } = await import("../lib/project-store.ts");
import type { Environmentals, FieldCardData } from "../lib/types.ts";
import type { SiteContext } from "../lib/mitigations.ts";
import type { RawHour } from "../lib/score-windows.ts";

const TZ = "America/New_York";
const NOW = new Date("2026-10-30T14:00:00Z"); // 10:00 AM ET
const AT = "2026-10-30T13:40:00Z"; // 9:40 AM ET
const SHEET =
  "Duracoat 77X epoxy. APPLICATION CONDITIONS Temperature: Air: 35°F (1.7°C) minimum, 120°F (49°C) maximum Surface*: 35°F (1.7°C) minimum, 250°F (120°C) maximum Material: 40°F (4.5°C) minimum At least 5°F (2.8°C) above dew point Relative humidity: 85% maximum. Pot life 2 hours at 77°F.";
const blank = (): FieldCardData => heuristicExtract(" ");
const ENV: Environmentals = {
  ...blank().environmentals,
  ambientTempMinF: 30, ambientTempMaxF: 110, substrateTempMinF: 30, substrateTempMaxF: 200,
  relativeHumidityMax: 85, dewPointSpreadMinF: 5, windMaxMph: 25, precipitationAllowed: false,
};
const MAT: Environmentals = { ...ENV, materialTempMinF: 40 };
const noop = () => {};

function forecast(env: Environmentals, s: SiteContext) {
  const raw: RawHour[] = ["2026-10-30", "2026-10-31"].flatMap((d) =>
    Array.from({ length: 6 }, (_, i) => ({
      startIso: new Date(`${d}T${String(14 + i).padStart(2, "0")}:00:00Z`).toISOString(),
      tempF: 65, rh: 50, dewpointF: 40, pop: 0, precipIn: 0, windMph: 4, shortForecast: "Cloudy", cloudCover: 100,
    })),
  );
  const meta = { zip: "22201", city: "Arlington", state: "VA", lat: 38.88, lon: -77.1, timezone: TZ, source: "test", issuedAt: NOW.toISOString() };
  return bundleDays(raw.map((r) => scoreHour(r, env, TZ, s, { now: NOW })), meta, env, s, { now: NOW });
}

describe("limits panel: material rows", () => {
  it("renders Material min / max rows; unstated shows the check-the-sheet flag", () => {
    const html = renderToStaticMarkup(<LimitsPanel card={{ ...blank(), environmentals: ENV }} onEnvironmentals={noop} />);
    for (const k of ["materialTempMinF", "materialTempMaxF"]) assert.ok(html.includes(`data-testid="limit-${k}"`), k);
    assert.match(html, /Material min °F/);
    assert.match(html, /Material max °F/);
    assert.ok(html.includes("Not stated — check the sheet for material min"));
    assert.ok(html.includes("Not stated — check the sheet for material max"));
    assert.ok(!html.includes('data-testid="material-normal"'));
  });
  it("a sheet value shows 'from sheet' with its quote; an edit shows user-edited", async () => {
    const read = await extractPasted(SHEET, (input) => onDeviceProvider.extract(input));
    assert.equal(read.kind, "done");
    if (read.kind !== "done") return;
    const card = read.result.card;
    assert.equal(card.environmentals.materialTempMinF, 40);
    const prov = read.result.provenance;
    let html = renderToStaticMarkup(<LimitsPanel card={card} asRead={card} provenance={prov} />);
    assert.match(html, new RegExp(`data-testid="limit-materialTempMinF-src" data-src="sheet">${FROM_SHEET}`));
    assert.match(html, /Material: 40°F \(4\.5°C\) minimum/);
    const edited = { ...card, environmentals: editMaterialLimit(card.environmentals, "materialTempMinF", "50") };
    assert.equal(edited.environmentals.materialTempMinF, 50);
    html = renderToStaticMarkup(<LimitsPanel card={edited} asRead={card} provenance={prov} />);
    assert.match(html, new RegExp(`data-testid="limit-materialTempMinF-src" data-src="edited">${USER_EDITED}`));
    assert.equal(editMaterialLimit(card.environmentals, "materialTempMinF", " ").materialTempMinF, null, "blank = Not stated");
  });
  it("the sheet's Normal material band is shown as info only", () => {
    const env = { ...ENV, materialTempMinF: 0, materialTempMaxF: 130, materialNormalTempMinF: 40, materialNormalTempMaxF: 95 };
    const html = renderToStaticMarkup(<LimitsPanel card={{ ...blank(), environmentals: env }} />);
    assert.match(html, /data-testid="material-normal">Sheet(&#x27;|')s normal material range 40–95°F \(info only, not scored\)/);
  });
});

describe("measured material temp field", () => {
  it("hidden when the sheet states no material limit", () => {
    assert.equal(renderToStaticMarkup(<MaterialReadingField environmentals={ENV} site={defaultSite()} onSite={noop} now={NOW} timeZone={TZ} />), "");
  });
  it("shows the reading's time and until when it counts (4 hours)", () => {
    const s = { ...defaultSite(), measuredMaterialTempF: 62, measuredMaterialAt: AT };
    const html = renderToStaticMarkup(<MaterialReadingField environmentals={MAT} site={s} onSite={noop} now={NOW} timeZone={TZ} />);
    assert.match(html, /Measured material temp \(°F\)/);
    assert.match(html, /value="62"/);
    assert.match(html, /data-testid="material-reading-time">Taken \d{1,2}:40 [AP]M · counts until \d{1,2}:40 [AP]M/);
    assert.match(html, /Sheet: at least 40°F\. A reading counts for 4 hours, today only\. Air is never used in its place\./);
  });
  it("an old reading says it no longer counts", () => {
    const s = { ...defaultSite(), measuredMaterialTempF: 62, measuredMaterialAt: "2026-10-30T08:00:00Z" };
    const html = renderToStaticMarkup(<MaterialReadingField environmentals={MAT} site={s} onSite={noop} now={NOW} timeZone={TZ} />);
    assert.match(html, /no longer counts, measure again/);
  });
  it("is part of the weather panel when a material limit is stated", () => {
    const card = { ...blank(), environmentals: MAT };
    const html = renderToStaticMarkup(
      <WeatherPanel zip="22201" onZip={noop} forecast={null} loading={false} error={null} onLoad={noop}
        environmentals={MAT} onEnvironmentals={noop} limitCard={card} onEditField={noop} site={defaultSite()} onSite={noop} now={NOW} />,
    );
    assert.ok(html.includes('data-testid="material-reading"'));
    assert.ok(html.includes('data-testid="limit-materialTempMinF"'));
  });
});

describe("day cards and today's line show the material lines", () => {
  it("no reading: today CAUTION with the reason and the measure line; tomorrow's card carries the measure line", () => {
    const f = forecast(MAT, defaultSite());
    const today = renderToStaticMarkup(<TodayVerdictLine forecast={f} gate={{ ok: true }} env={MAT} now={NOW} />);
    assert.match(today, /data-status="caution"/);
    assert.ok(today.includes("Material temp not measured today. Sheet: at least 40°F."));
    assert.match(today, new RegExp(`data-testid="today-material-line">${MEASURE_MATERIAL_LINE}<`));
    assert.ok(today.includes(FINAL_CALL_LINE));
    const panel = renderToStaticMarkup(
      <WeatherPanel zip="22201" onZip={noop} forecast={f} loading={false} error={null} onLoad={noop}
        environmentals={MAT} site={defaultSite()} onSite={noop} now={NOW} />,
    );
    assert.equal((panel.match(/data-testid="day-material-line"/g) ?? []).length, 2, "today and tomorrow");
  });
  it("fresh in-range reading: today has no measure line and reads the weather (GO)", () => {
    const s = { ...defaultSite(), measuredMaterialTempF: 62, measuredMaterialAt: AT };
    const f = forecast(MAT, s);
    const today = renderToStaticMarkup(<TodayVerdictLine forecast={f} gate={{ ok: true }} env={MAT} now={NOW} />);
    assert.match(today, /data-status="go"/);
    assert.ok(!today.includes('data-testid="today-material-line"'));
  });
  it("no material limit: no material lines, today's unstated list names material temp", () => {
    const f = forecast(ENV, defaultSite());
    const today = renderToStaticMarkup(<TodayVerdictLine forecast={f} gate={{ ok: true }} env={ENV} now={NOW} />);
    assert.ok(!today.includes("today-material-line"));
    assert.ok(today.includes("Not stated — check the sheet for material temp"));
  });
});

describe("guest reload keeps the material limit, its source and the reading", () => {
  beforeEach(() => mem.clear());
  it("sheet value, a hand edit and the site reading survive reopening the job", async () => {
    const read = await extractPasted(SHEET, (input) => onDeviceProvider.extract(input));
    if (read.kind !== "done") throw new Error("read failed");
    const p = gw.guestCreateProject("Tank M", "22201");
    gw.guestSaveProject({ id: p.id, card: read.result.card, extract: extractForSave(read) });
    const edited = { ...read.result.card, environmentals: editMaterialLimit(read.result.card.environmentals, "materialTempMaxF", "90") };
    const site = { ...defaultSite(), measuredMaterialTempF: 62, measuredMaterialAt: AT };
    gw.guestSaveProject({ id: p.id, card: edited, site });
    const full = gw.guestOpenProject(p.id);
    assert.equal(full.card!.environmentals.materialTempMinF, 40);
    assert.equal(full.card!.environmentals.materialTempMaxF, 90);
    assert.equal(full.site.measuredMaterialTempF, 62);
    assert.equal(full.site.measuredMaterialAt, AT);
    const st = savedExtractState(full);
    if (st.kind !== "done") throw new Error("no saved read");
    assert.equal(limitSource("environmentals.materialTempMinF", full.card, st.result.card, st.result.provenance).kind, "sheet");
    assert.equal(limitSource("environmentals.materialTempMaxF", full.card, st.result.card, st.result.provenance).kind, "edited");
  });
});
