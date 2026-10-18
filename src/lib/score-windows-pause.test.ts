import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  bundleDays,
  detectLimiters,
  goHourCount,
  rescoreForecast,
  scoreHour,
  TEMPS_UNVERIFIED_HEADLINE,
  TEMPS_UNVERIFIED_REASON,
  type RawHour,
} from "./score-windows.ts";
import type { SiteContext } from "./mitigations.ts";
import type { Environmentals, ForecastBundle } from "./types.ts";

const env: Environmentals = {
  ambientTempMinF: 50,
  ambientTempMaxF: 90,
  substrateTempMinF: 50,
  substrateTempMaxF: 90,
  relativeHumidityMax: 85,
  relativeHumidityMin: null,
  dewPointSpreadMinF: 5,
  precipitationAllowed: false,
  windMaxMph: null,
  directSunNotes: "",
  notes: "",
  additional: [],
};

const hour = (h: number): RawHour & { cloudCover: number } => ({
  startIso: `2026-10-20T${String(h).padStart(2, "0")}:00:00`,
  tempF: 70,
  rh: 45,
  dewpointF: 45,
  pop: 0,
  precipIn: 0,
  windMph: 4,
  // Overcast so solar gain on bare steel does not move the baseline.
  shortForecast: "Cloudy",
  cloudCover: 100,
});

const hours = Array.from({ length: 12 }, (_, i) => hour(8 + i));
const meta = {
  zip: "23219",
  city: "Richmond",
  state: "VA",
  lat: 37.5,
  lon: -77.4,
  timezone: "America/New_York",
  source: "test",
  issuedAt: "2026-10-18T19:00:00Z",
  rawHours: hours,
};
const site = { mitigations: [] } as unknown as SiteContext;

describe("weather scoring pauses when temperature limits are unverified", () => {
  it("scores normally without the option (additive API)", () => {
    const h = scoreHour(hours[4], env, "America/New_York");
    assert.equal(h.status, "go");
  });

  it("scoreHour returns unknown with the reason", () => {
    const h = scoreHour(hours[4], env, "America/New_York", undefined, { unverifiedTemps: true });
    assert.equal(h.status, "unknown");
    assert.deepEqual(h.reasons, [TEMPS_UNVERIFIED_REASON]);
    assert.equal(h.tempF, 70);
  });

  it("unverifiedTemps: false scores as before", () => {
    const a = scoreHour(hours[4], env, "America/New_York");
    const b = scoreHour(hours[4], env, "America/New_York", undefined, { unverifiedTemps: false });
    assert.deepEqual(b, a);
  });

  it("bundleDays: paused bundle, no go/caution/no-go days, no best window", () => {
    const scored = hours.map((h) =>
      scoreHour(h, env, meta.timezone, undefined, { unverifiedTemps: true }),
    );
    const b = bundleDays(scored, meta, env, undefined, { unverifiedTemps: true });
    assert.deepEqual(b.paused, { reason: TEMPS_UNVERIFIED_REASON });
    assert.equal(
      b.headline,
      "Weather windows paused: temperature limits not verified on the sheet.",
    );
    assert.equal(b.headline, TEMPS_UNVERIFIED_HEADLINE);
    for (const d of b.days) {
      assert.equal(d.status, "unknown");
      assert.equal(d.goHours, 0);
      assert.equal(d.bestRange, null);
    }
  });

  it("even pre-scored go hours do not leak a window when paused", () => {
    const scored = hours.map((h) => scoreHour(h, env, meta.timezone));
    assert.ok(scored.some((h) => h.status === "go"));
    const b = bundleDays(scored, meta, env, undefined, { unverifiedTemps: true });
    assert.ok(b.days.every((d) => d.status === "unknown" && d.bestRange === null));
  });

  it("rescoreForecast / goHourCount / detectLimiters respect the pause", () => {
    const base: ForecastBundle = { ...meta, days: [], headline: "" };
    const live = rescoreForecast(base, env, site);
    assert.equal(live.paused, undefined);
    assert.ok(goHourCount(base, env, site) > 0);

    const paused = rescoreForecast(base, env, site, { unverifiedTemps: true });
    assert.deepEqual(paused.paused, { reason: TEMPS_UNVERIFIED_REASON });
    assert.equal(goHourCount(base, env, site, { unverifiedTemps: true }), 0);
    assert.deepEqual(detectLimiters(base, env, site, { unverifiedTemps: true }), []);
  });

  it("a forecast with no raw hours still reports the pause", () => {
    const empty: ForecastBundle = { ...meta, rawHours: [], days: [], headline: "x" };
    assert.equal(rescoreForecast(empty, env, site).headline, "x");
    assert.equal(
      rescoreForecast(empty, env, site, { unverifiedTemps: true }).headline,
      TEMPS_UNVERIFIED_HEADLINE,
    );
  });
});
