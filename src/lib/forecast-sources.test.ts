import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  FORECAST_UNAVAILABLE_MESSAGE,
  ForecastUnavailableError,
  fetchWithTimeout,
  hourlyWithBackup,
  usableHours,
  type FetchLike,
} from "./forecast-sources.ts";

/** A fetch that never answers unless aborted (a hung weather service). */
// (AbortSignal.timeout's timer is unref'd, so hold the event loop open until the abort fires.)
const hangingFetch: FetchLike = (_url, init) =>
  new Promise((_, reject) => {
    const keepAlive = setTimeout(() => {}, 10_000);
    init?.signal?.addEventListener("abort", () => {
      clearTimeout(keepAlive);
      reject(init.signal!.reason);
    });
  });

const hour = (i: number, over: Record<string, unknown> = {}) => ({
  startIso: `2026-10-24T${String(i % 24).padStart(2, "0")}:00:00`,
  tempF: 60, rh: 50, dewpointF: 40, pop: 0, precipIn: 0, windMph: 3, shortForecast: "Clear", ...over,
});
const pack = (n: number) => ({ hours: Array.from({ length: n }, (_, i) => hour(i)), source: "s", timezone: "UTC" });

describe("weather hardening", () => {
  it("a weather call that times out -> Forecast unavailable, never a GO window", async () => {
    const nws = async () => {
      await fetchWithTimeout("https://api.weather.gov/points/1,1", {}, 20, hangingFetch);
      return pack(24);
    };
    const meteo = async () => {
      await fetchWithTimeout("https://api.open-meteo.com/v1/forecast", {}, 20, hangingFetch);
      return pack(24);
    };
    await assert.rejects(hourlyWithBackup([nws, meteo]), (err: unknown) => {
      assert.ok(err instanceof ForecastUnavailableError);
      assert.equal((err as Error).message, FORECAST_UNAVAILABLE_MESSAGE);
      assert.match((err as Error).message, /not a GO/);
      return true;
    });
  });

  it("uses the backup when weather.gov times out", async () => {
    const nws = async () => {
      await fetchWithTimeout("https://api.weather.gov/points/1,1", {}, 20, hangingFetch);
      return pack(24);
    };
    const got = await hourlyWithBackup([nws, async () => ({ ...pack(24), source: "open-meteo" })]);
    assert.equal(got.source, "open-meteo");
  });

  it("drops hours with missing weather so they cannot score GO", () => {
    const hours = [hour(1), hour(2, { tempF: null }), hour(3, { rh: null }), hour(4, { dewpointF: null })];
    assert.equal(usableHours(hours as never).length, 1);
  });
});
