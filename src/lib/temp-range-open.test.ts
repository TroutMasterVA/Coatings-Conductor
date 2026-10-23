import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { formatTempRange } from "./temp-range.ts";
import { onDeviceProvider } from "./extract/on-device-provider.ts";

// QA item 6: a one-sided air range ("Minimum 50°F", no maximum) reads as an open range end to end.
// Real sheets in the 10-sheet set with a one-sided range: hempel_hempadur15570 (air min 14°F / -10°C,
// no max) and hempel_multi_us (surface min 50°F, no max). This fixture is synthetic.
describe("open temperature range from the sheet", () => {
  const sheet = [
    "ACME 100 EPOXY PRIMER",
    "APPLICATION CONDITIONS",
    "Air temperature: Minimum 50°F (10°C)",
    "Relative humidity: 85% maximum",
  ].join("\n");
  it("air min 50°F is read and quoted; air max is Not stated; the chip reads 'at least 50°F'", async () => {
    const r = await onDeviceProvider.extract({ text: sheet });
    const env = r.card.environmentals;
    assert.equal(env.ambientTempMinF, 50);
    assert.equal(env.ambientTempMaxF, null);
    assert.equal(r.provenance["environmentals.ambientTempMaxF"], "not-stated");
    const q = r.provenance["environmentals.ambientTempMinF"];
    assert.ok(q && q !== "not-stated" && /50°F/.test(q.quote));
    assert.equal(formatTempRange(env.ambientTempMinF, env.ambientTempMaxF), "at least 50°F");
  });
});
