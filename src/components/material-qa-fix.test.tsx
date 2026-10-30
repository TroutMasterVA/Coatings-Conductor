import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";

// PR #54 QA fix round (Oct 30): D1 (the product's own temperature phrasing), D2 (the air line shows
// whenever it applies), D3 (a signed-in reading survives sign-out / sign-in). New tests only.
(globalThis as Record<string, unknown>).window = globalThis;
const { WeatherPanel } = await import("./weather-panel.tsx");
const { TodayVerdictLine } = await import("./today-verdict.tsx");
const { heuristicExtract, materialTempFromText } = await import("../lib/heuristic-extract.ts");
const { onDeviceProvider } = await import("../lib/extract/on-device-provider.ts");
const { quoteBacksValue } = await import("../lib/extract/provenance.ts");
const { bundleDays, scoreHour } = await import("../lib/score-windows.ts");
const { AIR_OUTSIDE_MATERIAL_LINE, MEASURE_MATERIAL_LINE } = await import("../lib/material-temp.ts");
const { savedSite } = await import("../lib/saved-site.ts");
import type { Environmentals } from "../lib/types.ts";
import type { SiteContext } from "../lib/mitigations.ts";
import type { RawHour } from "../lib/score-windows.ts";

const m = (t: string) => materialTempFromText(t);

describe("D1: 'temperature of the paint/material/product (itself)' is the material limit", () => {
  // pdf.js flat text of Hempadur 15570 around the line (QA sheet set).
  const HEMPADUR =
    "Hempadur 15570 epoxy coating. APPLICATION CONDITIONS Use only where application and curing can proceed at temperatures above: -10°C/14°F. At the freezing point and below be aware of the risk of ice on the surface, which will hinder adhesion. The temperature of paint itself should be 15°C/59°F or above. In confined spaces provide adequate ventilation during application and drying.";
  it("Hempadur 15570 → material min 59°F, with the line itself as the quote", async () => {
    assert.deepEqual(m(HEMPADUR), { minF: 59, maxF: null, normalMinF: null, normalMaxF: null });
    const r = await onDeviceProvider.extract({ pages: [HEMPADUR] });
    assert.equal(r.card.environmentals.materialTempMinF, 59);
    const p = r.provenance["environmentals.materialTempMinF"];
    assert.ok(p && typeof p === "object", "has a quote");
    if (p && typeof p === "object") {
      assert.ok(p.quote.includes("temperature of paint itself should be 15°C/59°F or above"), p.quote);
      assert.ok(quoteBacksValue("environmentals.materialTempMinF", 59, p.quote));
    }
    assert.equal(r.unverifiedTemps, false);
  });
  for (const [text, want] of [
    ["The temperature of the paint itself must be 50°F or higher.", { minF: 50, maxF: null }],
    ["Temperature of the material should be 10°C or above during application.", { minF: 50, maxF: null }],
    ["The temperature of the product itself should be 90°F or below.", { minF: null, maxF: 90 }],
    ["Temperature of the mixed product: 95°F or lower.", { minF: null, maxF: 95 }],
    ["Paint temperature must be 40°F (4.5°C) minimum.", { minF: 40, maxF: null }],
    ["Product temperature must be at least 55°F (13°C) when applied.", { minF: 55, maxF: null }],
  ] as const) {
    it(`general phrasing: "${text}"`, () => {
      const r = m(text);
      assert.deepEqual({ minF: r.minF, maxF: r.maxF }, want);
    });
  }
  it("the paint phrase leaves air and surface as they were", () => {
    const env = heuristicExtract(HEMPADUR).environmentals;
    assert.equal(env.materialTempMinF, 59);
    const base = heuristicExtract(HEMPADUR.replace("The temperature of paint itself should be 15°C/59°F or above. ", "")).environmentals;
    assert.deepEqual(
      [env.ambientTempMinF, env.ambientTempMaxF, env.substrateTempMinF, env.substrateTempMaxF],
      [base.ambientTempMinF, base.ambientTempMaxF, base.substrateTempMinF, base.substrateTempMaxF],
    );
  });
});

describe("D1 negatives: storage, conditioning and bare 'paint' are still not material limits", () => {
  for (const [name, text] of [
    ["storage of the paint itself", "Store the paint itself at 40°F or above in a dry place."],
    ["storage temperature of the product", "Keep the temperature of the product at 41°F or above during storage."],
    ["shipping", "Ship so the temperature of the material stays 35°F or above."],
    ["conditioning advice", "Condition the temperature of the paint to 65°F or above before mixing for best workability."],
    ["recommended (advice)", "Recommended temperature of the paint itself: 70°F or above."],
    ["bare 'paint' (the application, not the product)", "Paint should not be applied when the temperature is 50°F or below."],
    ["'this paint' prose", "This paint can be applied at 40°F or above."],
    ["pot-life table row", "Paint temperature 73 °F Pot life 2 h"],
    ["no qualifier", "The temperature of paint itself 15°C/59°F."],
    ["no unit", "The temperature of paint itself should be 59 or above."],
    ["cure condition", "If the temperature of the paint itself is 50°F or below, cure time is longer."],
  ] as const) {
    it(name, () => {
      const r = m(text);
      assert.equal(r.minF, null, `${name}: min`);
      assert.equal(r.maxF, null, `${name}: max`);
    });
  }
});

// D2: Macropoxy-style limits (air 35–120, material min 40), no reading, forecast air 38°F.
const TZ = "America/New_York";
const NOW = new Date("2026-10-30T14:00:00Z"); // Fri Oct 30, 10:00 AM ET
const MACRO: Environmentals = {
  ...heuristicExtract(" ").environmentals,
  ambientTempMinF: 35, ambientTempMaxF: 120, substrateTempMinF: 35, substrateTempMaxF: 250,
  relativeHumidityMax: 85, dewPointSpreadMinF: 5, windMaxMph: 25, precipitationAllowed: false,
  materialTempMinF: 40,
};
const HEMPEL_MULTI: Environmentals = { ...MACRO, ambientTempMinF: 41, substrateTempMinF: 50, materialTempMinF: 59 };
const site = (over: Partial<SiteContext> = {}): SiteContext => ({ substrate: "bare_steel", mitigations: [], ...over });
const noop = () => {};
function forecast(env: Environmentals, s: SiteContext, airF: number) {
  const raw: RawHour[] = ["2026-10-30", "2026-10-31"].flatMap((d) =>
    Array.from({ length: 6 }, (_, i) => ({
      startIso: new Date(`${d}T${String(14 + i).padStart(2, "0")}:00:00Z`).toISOString(),
      tempF: airF, rh: 50, dewpointF: 20, pop: 0, precipIn: 0, windMph: 4, shortForecast: "Cloudy", cloudCover: 100,
    })),
  );
  const meta = { zip: "22201", city: "Arlington", state: "VA", lat: 38.88, lon: -77.1, timezone: TZ, source: "test", issuedAt: NOW.toISOString() };
  return bundleDays(raw.map((r) => scoreHour(r, env, TZ, s, { now: NOW })), meta, env, s, { now: NOW });
}
const count = (html: string, id: string) => (html.match(new RegExp(`data-testid="${id}"`, "g")) ?? []).length;

describe("D2: the air line shows whenever it applies, next to the first reason", () => {
  it("Macropoxy at 38°F air, no reading: today and both day cards show the air line (never NO-GO for it)", () => {
    const f = forecast(MACRO, site(), 38);
    for (const d of f.days) {
      assert.equal(d.airMaterialLine, AIR_OUTSIDE_MATERIAL_LINE, d.date);
      assert.notEqual(d.status, "nogo", d.date);
      assert.notEqual(d.status, "go", d.date);
    }
    const today = renderToStaticMarkup(<TodayVerdictLine forecast={f} gate={{ ok: true }} env={MACRO} now={NOW} />);
    assert.ok(today.includes(AIR_OUTSIDE_MATERIAL_LINE), "today shows the air line");
    assert.ok(today.includes("Material temp not measured today") || today.includes("Air 38°F"), "the first reason still shows");
    assert.ok(today.includes(MEASURE_MATERIAL_LINE));
    const panel = renderToStaticMarkup(
      <WeatherPanel zip="22201" onZip={noop} forecast={f} loading={false} error={null} onLoad={noop} environmentals={MACRO} site={site()} onSite={noop} now={NOW} />,
    );
    // Each day card shows it once: as its first reason or as the extra line, never hidden.
    for (const d of f.days) assert.ok(d.limiting[0] === AIR_OUTSIDE_MATERIAL_LINE || d.airMaterialLine === AIR_OUTSIDE_MATERIAL_LINE);
    assert.ok((panel.split(AIR_OUTSIDE_MATERIAL_LINE).length - 1) >= 2, "both day cards");
  });
  it("Hempel multi (material min 59) at 56°F air, no reading: today shows 'not measured' AND the air line", () => {
    const f = forecast(HEMPEL_MULTI, site(), 56);
    const today = renderToStaticMarkup(<TodayVerdictLine forecast={f} gate={{ ok: true }} env={HEMPEL_MULTI} now={NOW} />);
    assert.match(today, /data-status="caution"/);
    assert.ok(today.includes("Material temp not measured today. Sheet: at least 59°F."));
    assert.equal(count(today, "today-air-material-line"), 1);
    assert.ok(today.includes(AIR_OUTSIDE_MATERIAL_LINE));
  });
  it("shown once per card: the extra line only where the air line is not already the first reason", () => {
    const f = forecast(HEMPEL_MULTI, site(), 56);
    const panel = renderToStaticMarkup(
      <WeatherPanel zip="22201" onZip={noop} forecast={f} loading={false} error={null} onLoad={noop} environmentals={HEMPEL_MULTI} site={site()} onSite={noop} now={NOW} />,
    );
    const extra = f.days.filter((d) => d.airMaterialLine && d.limiting[0] !== d.airMaterialLine).length;
    assert.ok(extra >= 1, "today's first reason is 'not measured', so today's card needs the extra line");
    assert.equal(count(panel, "day-air-material-line"), extra);
  });
  it("does not show when it doesn't apply: air inside the range, or a fresh in-range reading today", () => {
    for (const d of forecast(MACRO, site(), 65).days) assert.equal(d.airMaterialLine, undefined, d.date);
    const fresh = site({ measuredMaterialTempF: 60, measuredMaterialAt: "2026-10-30T13:40:00Z" });
    const f = forecast(MACRO, fresh, 38);
    assert.equal(f.days.find((d) => d.date === "2026-10-30")!.airMaterialLine, undefined, "today has a valid reading");
    assert.equal(f.days.find((d) => d.date === "2026-10-31")!.airMaterialLine, AIR_OUTSIDE_MATERIAL_LINE, "the reading never counts for tomorrow");
  });
  it("no material limit on the sheet: never an air line", () => {
    const env = { ...MACRO };
    delete (env as Partial<Environmentals>).materialTempMinF;
    for (const d of forecast(env, site(), 38).days) assert.equal(d.airMaterialLine, undefined);
  });
});

describe("D3: a signed-in job keeps the material reading and its time", () => {
  it("savedSite keeps measuredMaterialTempF + measuredMaterialAt and the existing fields", () => {
    const s = savedSite({ substrate: "concrete", mitigations: ["canopy"], customMitigationIds: ["c1"], measuredMaterialTempF: 55, measuredMaterialAt: "2026-10-30T14:52:00Z" } as Partial<SiteContext>);
    assert.equal(s.substrate, "concrete");
    assert.deepEqual(s.mitigations, ["canopy"]);
    assert.deepEqual(s.customMitigationIds, ["c1"]);
    assert.equal(s.measuredMaterialTempF, 55);
    assert.equal(s.measuredMaterialAt, "2026-10-30T14:52:00Z");
    // Round-trip through site_json as the server stores it.
    const back = savedSite(JSON.parse(JSON.stringify(s)));
    assert.equal(back.measuredMaterialTempF, 55);
    assert.equal(back.measuredMaterialAt, "2026-10-30T14:52:00Z");
  });
  it("defaults as before; a reading with no valid time is dropped (it could never count)", () => {
    assert.deepEqual(JSON.parse(JSON.stringify(savedSite({}))), { substrate: "bare_steel", mitigations: [], customMitigationIds: [] });
    for (const bad of [{ measuredMaterialTempF: 55 }, { measuredMaterialTempF: 55, measuredMaterialAt: "not a time" }, { measuredMaterialTempF: Number.NaN, measuredMaterialAt: "2026-10-30T14:52:00Z" }]) {
      const s = savedSite(bad as Partial<SiteContext>);
      assert.equal(s.measuredMaterialTempF, undefined);
      assert.equal(s.measuredMaterialAt, undefined);
    }
  });
  it("the surface gauge reading is left as before (known issue, out of scope)", () => {
    assert.equal(savedSite({ measuredSurfaceTempF: 70 } as Partial<SiteContext>).measuredSurfaceTempF, undefined);
  });
});
