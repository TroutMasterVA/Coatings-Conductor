import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { shownForecast } from "./forecast-state.ts";

const good = { zip: "22201", days: ["go"] };

describe("D4: a failed, stale or missing forecast is never shown", () => {
  it("good load: shown", () => {
    assert.equal(shownForecast({ forecast: good, loadedZip: "22201", error: null }, "22201"), good);
  });
  it("good load, then a failed reload: nothing shown, even if the old forecast is still held", () => {
    const err = "Forecast unavailable: the weather services did not answer. This is not a GO. Plan later or check the site conditions by hand.";
    assert.equal(shownForecast({ forecast: good, loadedZip: "22201", error: err }, "22201"), null);
  });
  it("thrown reload (generic message): nothing shown", () => {
    assert.equal(shownForecast({ forecast: good, loadedZip: "22201", error: "Forecast failed" }, "22201"), null);
  });
  it("no forecast yet: nothing shown", () => {
    assert.equal(shownForecast({ forecast: null, loadedZip: null, error: null }, "22201"), null);
  });
  it("loaded for another ZIP (stale): nothing shown until it is loaded for this one", () => {
    assert.equal(shownForecast({ forecast: good, loadedZip: "22201", error: null }, "60601"), null);
    assert.equal(shownForecast({ forecast: good, loadedZip: "22201", error: null }, "2220"), null);
    assert.equal(shownForecast({ forecast: good, loadedZip: null, error: null }, "22201"), null);
  });
  it("a later good load after a failure shows again", () => {
    assert.equal(shownForecast({ forecast: good, loadedZip: "22201", error: null }, "22201"), good);
  });
});
