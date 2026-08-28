import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  FORECAST_MAX_PER_WINDOW,
  forecastCacheFresh,
  takeForecastSlot,
} from "./forecast-cap.ts";

describe("loadForecast spend cap", () => {
  it("allows up to the window max then refuses", () => {
    let stamps: number[] = [];
    const start = 1_000_000;
    for (let i = 0; i < FORECAST_MAX_PER_WINDOW; i += 1) {
      const slot = takeForecastSlot(start + i, stamps);
      assert.equal(slot.ok, true);
      stamps = slot.stamps;
    }
    const blocked = takeForecastSlot(start + FORECAST_MAX_PER_WINDOW, stamps);
    assert.equal(blocked.ok, false);
    assert.equal(blocked.stamps.length, FORECAST_MAX_PER_WINDOW);
  });

  it("opens a new slot after the window", () => {
    const prior = [1_000_000];
    const later = takeForecastSlot(1_000_000 + 60_000, prior, 1, 60_000);
    assert.equal(later.ok, true);
    assert.deepEqual(later.stamps, [1_060_000]);
  });

  it("reuses a ZIP cache inside the ttl", () => {
    assert.equal(forecastCacheFresh(100, 100 + 14 * 60 * 1000), true);
    assert.equal(forecastCacheFresh(100, 100 + 16 * 60 * 1000), false);
    assert.equal(forecastCacheFresh(undefined, 100), false);
  });
});
