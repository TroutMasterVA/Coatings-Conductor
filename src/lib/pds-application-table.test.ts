import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { dewSpread, micronsToMilsRange, parseApplicationTable } from "./pds-application-table.ts";

const CM615_SNIP = `
APPLICATION CONDITIONS
       Condition                  Material                    Surface                   Ambient                    Humidity
       Minimum                   7°C (45°F)                 -7°C (19°F)                -7°C (19°F)                   0%
       Maximum                   32°C (90°F)               49°C (120°F)               38°C (100°F)                   95%

Industry standards are for substrate temperatures to be maintained at a minimum of 3°C above the measured dew point, prior to
and during coating application. Where approved and/or specified by Technical Services, this product may be applied at or near the
dew point, subject to manufacturer guidelines.
`;

describe("Carbomastic 615 application table", () => {
  it("reads material / steel / air / RH columns", () => {
    const w = parseApplicationTable(CM615_SNIP);
    assert.ok(w);
    assert.equal(w!.materialMinF, 45);
    assert.equal(w!.materialMaxF, 90);
    assert.equal(w!.surfaceMinF, 19);
    assert.equal(w!.surfaceMaxF, 120);
    assert.equal(w!.ambientMinF, 19);
    assert.equal(w!.ambientMaxF, 100);
    assert.equal(w!.rhMin, 0);
    assert.equal(w!.rhMax, 95);
  });

  it("converts 3°C dew spread to 5°F, not 37°F", () => {
    assert.equal(dewSpread(CM615_SNIP), 5);
    assert.equal(dewSpread("Surface must be at least 5°F above the dew point."), 5);
    assert.equal(dewSpread("substrate 3°C above the measured dew point"), 5);
  });

  it("converts 125-250 microns to 5-10 mils", () => {
    assert.match(micronsToMilsRange("Film Build 125 - 250 microns dry per coat"), /5–10 mils/);
  });

  it("still works when newlines are flattened", () => {
    const w = parseApplicationTable(CM615_SNIP.replace(/\n+/g, " "));
    assert.ok(w);
    assert.equal(w!.ambientMinF, 19);
    assert.equal(w!.ambientMaxF, 100);
    assert.equal(w!.surfaceMaxF, 120);
  });
});
