import { beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";

// Minimal browser storage for the guest (device-local) project store.
const mem = new Map<string, string>();
(globalThis as Record<string, unknown>).window = globalThis;
(globalThis as Record<string, unknown>).localStorage = {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => void mem.set(k, v),
  removeItem: (k: string) => void mem.delete(k),
};

const { LimitsPanel } = await import("./limits-panel.tsx");
const { WeatherPanel } = await import("./weather-panel.tsx");
const { LIMIT_FIELDS, LIMIT_KEYS, LIMIT_LABEL, TEXT_LIMIT_FIELDS, notStatedFlag } = await import("../lib/limit-fields.ts");
const { editLimit, FROM_SHEET, limitSource, SSPC_DEW_DEFAULT_TEXT, USER_EDITED } = await import("../lib/limit-source.ts");
const { heuristicExtract } = await import("../lib/heuristic-extract.ts");
const { checkHour } = await import("../lib/noaa.ts");
const { bundleDays, scoreHour } = await import("../lib/score-windows.ts");
const { extractPasted, savedExtractState, toSavedExtract } = await import("../lib/extract-client.ts");
const { onDeviceProvider } = await import("../lib/extract/on-device-provider.ts");
const gw = await import("../lib/guest-workspace.ts");
const { defaultSite } = await import("../lib/project-store.ts");
import type { Environmentals, FieldCardData } from "../lib/types.ts";
import type { RawHour } from "../lib/score-windows.ts";
import type { WxHour } from "../lib/noaa.ts";

const blankCard = (): FieldCardData => heuristicExtract(" ");
const baseEnv = (): Environmentals => ({
  ...blankCard().environmentals,
  ambientTempMinF: 35, ambientTempMaxF: 110, substrateTempMinF: 30, substrateTempMaxF: 120,
  relativeHumidityMax: 85, relativeHumidityMin: 20, dewPointSpreadMinF: 5, windMaxMph: 25, precipitationAllowed: false,
});

// 06:00 UTC: inside the work window, before any sun gain.
const RAW = (over: Partial<RawHour> = {}): RawHour => ({
  startIso: "2026-10-26T06:00:00Z", tempF: 45, rh: 60, dewpointF: 30, pop: 0, precipIn: 0, windMph: 3,
  shortForecast: "Clear", cloudCover: 0, ...over,
});
const WX = (r: RawHour): WxHour => ({
  startIso: r.startIso, tempF: r.tempF, rh: r.rh, dewpointF: r.dewpointF, windMph: r.windMph, gustMph: null,
  skyCover: 0, pop: 0, source: "nws" as never,
});
const BUNDLE = { zip: "00000", city: "X", state: "VA", source: "t", timezone: "UTC" } as never;

/** Day card + hourly list verdict for one hour under `env` (the same calls the app makes). */
function verdicts(env: Environmentals, raw: RawHour) {
  const hour = scoreHour(raw, env, "UTC");
  const day = bundleDays([hour], BUNDLE, env).days[0]!;
  const list = checkHour(WX(raw), env, hour.substrateF != null ? { valueF: hour.substrateF, kind: "estimate" } : null);
  return { hour: hour.status, day: day.status, list: list.verdict };
}

describe("limits panel: every limiting attribute has a field", () => {
  it("renders one field per numeric limit (incl. surface min) and per text limit", () => {
    const card = { ...blankCard(), environmentals: baseEnv() };
    const html = renderToStaticMarkup(<LimitsPanel card={card} onEnvironmentals={() => {}} onEditField={() => {}} />);
    assert.deepEqual(LIMIT_FIELDS.map((f) => f.key).sort(), [...LIMIT_KEYS].sort(), "panel list covers limit-fields.ts");
    for (const { key } of LIMIT_FIELDS) assert.ok(html.includes(`data-testid="limit-${key}"`), key);
    assert.match(html, /Surface \(substrate\) min °F/);
    for (const { path } of TEXT_LIMIT_FIELDS) assert.ok(html.includes(`data-testid="limit-${path.replace(".", "-")}"`), path);
  });

  it("the weather panel shows the substrate-min field when a card is loaded", () => {
    const card = { ...blankCard(), environmentals: baseEnv() };
    const html = renderToStaticMarkup(
      <WeatherPanel zip="22902" onZip={() => {}} forecast={null} loading={false} error={null} onLoad={() => {}}
        environmentals={card.environmentals} onEnvironmentals={() => {}} limitCard={card} onEditField={() => {}}
        site={defaultSite()} onSite={() => {}} />,
    );
    assert.ok(html.includes('data-testid="limit-substrateTempMinF"'));
  });

  it("an unstated limit shows the check-the-sheet flag; dew margin shows the SSPC 5°F default", () => {
    const env = { ...baseEnv(), substrateTempMinF: null, relativeHumidityMax: null, windMaxMph: null, dewPointSpreadMinF: null };
    const html = renderToStaticMarkup(<LimitsPanel card={{ ...blankCard(), environmentals: env }} />);
    for (const k of ["substrateTempMinF", "relativeHumidityMax", "windMaxMph", "dewPointSpreadMinF"] as const) {
      assert.ok(html.includes(notStatedFlag(LIMIT_LABEL[k])), k);
    }
    assert.ok(html.includes(`Using ${SSPC_DEW_DEFAULT_TEXT}`));
    assert.ok(html.includes(notStatedFlag("pot life (by temperature)")), "blank text limit flagged too");
  });

  it("marks values from the sheet (with the quote) vs user-edited", () => {
    const asRead = { ...blankCard(), environmentals: baseEnv() };
    const prov = {
      "environmentals.substrateTempMinF": { page: 1, quote: "Surface temperature minimum 30°F" },
      "environmentals.ambientTempMinF": { page: 1, quote: "Surface temperature minimum 40°F" },
    } as never;
    assert.equal(limitSource("environmentals.substrateTempMinF", asRead, asRead, prov).kind, "sheet");
    const edited = { ...asRead, environmentals: editLimit(asRead.environmentals, "substrateTempMinF", "50") };
    assert.equal(limitSource("environmentals.substrateTempMinF", edited, asRead, prov).kind, "edited");
    const html = renderToStaticMarkup(<LimitsPanel card={edited} asRead={asRead} provenance={prov} />);
    assert.match(html, new RegExp(`data-testid="limit-substrateTempMinF-src" data-src="edited">${USER_EDITED}`));
    assert.match(html, new RegExp(`data-testid="limit-ambientTempMinF-src" data-src="sheet">${FROM_SHEET}`));
    assert.ok(html.includes("Surface temperature minimum 40°F"), "sheet quote shown");
  });
});

describe("limits panel edits drive every verdict (day card, hour, hourly list)", () => {
  it("raising surface min above the surface turns GO into NO-GO", () => {
    const env = baseEnv();
    const before = verdicts(env, RAW());
    assert.deepEqual(before, { hour: "go", day: "go", list: "go" });
    const after = verdicts(editLimit(env, "substrateTempMinF", "50"), RAW());
    assert.deepEqual(after, { hour: "nogo", day: "nogo", list: "nogo" });
  });

  it("lowering RH max below the forecast RH turns GO into NO-GO", () => {
    const env = baseEnv();
    assert.equal(verdicts(env, RAW({ rh: 70 })).day, "go");
    assert.deepEqual(verdicts(editLimit(env, "relativeHumidityMax", "65"), RAW({ rh: 70 })), { hour: "nogo", day: "nogo", list: "nogo" });
  });

  it("an RH min entered in the panel is enforced", () => {
    const env = baseEnv();
    assert.equal(verdicts(env, RAW({ rh: 30, dewpointF: 15 })).day, "go");
    const after = verdicts(editLimit(env, "relativeHumidityMin", "40"), RAW({ rh: 30, dewpointF: 15 }));
    assert.deepEqual(after, { hour: "nogo", day: "nogo", list: "nogo" });
  });

  it("lowering wind max below the forecast wind removes the GO", () => {
    const env = baseEnv();
    assert.equal(verdicts(env, RAW({ windMph: 15 })).day, "go");
    const after = verdicts(editLimit(env, "windMaxMph", "10"), RAW({ windMph: 15 }));
    assert.notEqual(after.hour, "go");
    assert.notEqual(after.day, "go");
    assert.equal(after.list, "nogo");
  });
});

describe("limits panel edits persist per project", () => {
  beforeEach(() => mem.clear());
  it("a guest's edited surface min is saved with that project only and reads user-edited after reopening", async () => {
    const read = await extractPasted(
      "Duracoat 77X topcoat. Application conditions: surface temperature minimum 40°F, maximum 120°F. Relative humidity 85% maximum.",
      (input) => onDeviceProvider.extract(input),
    );
    assert.equal(read.kind, "done");
    if (read.kind !== "done") return;
    const a = gw.guestCreateProject("Tank A", "22902");
    const b = gw.guestCreateProject("Tank B", "22902");
    for (const id of [a.id, b.id]) gw.guestSaveProject({ id, card: read.result.card, extract: toSavedExtract(read) });
    const edited = { ...read.result.card, environmentals: editLimit(read.result.card.environmentals, "substrateTempMinF", "55") };
    gw.guestSaveProject({ id: a.id, card: edited });

    const openA = gw.guestOpenProject(a.id);
    const openB = gw.guestOpenProject(b.id);
    assert.equal(openA.card?.environmentals.substrateTempMinF, 55);
    assert.equal(openB.card?.environmentals.substrateTempMinF, read.result.card.environmentals.substrateTempMinF);
    const st = savedExtractState(openA);
    assert.equal(st.kind, "done");
    if (st.kind !== "done") return;
    const src = limitSource("environmentals.substrateTempMinF", openA.card, st.result.card, st.result.provenance);
    assert.equal(src.kind, "edited");
    const html = renderToStaticMarkup(<LimitsPanel card={openA.card!} asRead={st.result.card} provenance={st.result.provenance} />);
    assert.match(html, new RegExp(`limit-substrateTempMinF-src" data-src="edited">${USER_EDITED}`));
    const stB = savedExtractState(openB);
    if (stB.kind === "done")
      assert.notEqual(limitSource("environmentals.substrateTempMinF", openB.card, stB.result.card, stB.result.provenance).kind, "edited");
  });
});
