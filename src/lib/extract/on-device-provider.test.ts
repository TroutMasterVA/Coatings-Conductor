import { toSavedExtract } from "./provider.ts";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { heuristicExtract } from "../heuristic-extract.ts";
import { onDeviceProvider } from "./on-device-provider.ts";

const SHEET = `
Product data sheet
Field Epoxy 100
Manufacturer: Example Coatings
Mix ratio: 1:1 by volume
Pot life: 2 hours at 75 F
DFT: 5-7 mils
Ambient: 50-90 F
Surface must be at least 5°F above the dew point.

Immersion Service
NACE No. 2 / SSPC-SP10 Near-White Metal Blast Cleaning.
Anchor profile 2-3 mils.
`;

describe("on-device extract provider", () => {
  it("returns card, provenance, provider and coded warnings", async () => {
    const r = await onDeviceProvider.extract({ text: SHEET });
    assert.equal(r.provider, "on-device");
    assert.ok(Array.isArray(r.warnings));
    assert.equal(r.draft, true);
    assert.equal(typeof r.unverifiedTemps, "boolean");
    assert.equal("extract" in r, false);
    const saved = toSavedExtract(r);
    assert.equal(saved.provider, "on-device");
    assert.equal(saved.draft, true);
    assert.deepEqual(saved.provenance, r.provenance);
    assert.ok(!Number.isNaN(Date.parse(saved.extractedAt)));
    for (const w of r.warnings) assert.match(w.code, /^[A-Z_]+$/);
    const dew = r.provenance["environmentals.dewPointSpreadMinF"];
    assert.ok(dew && dew !== "not-stated");
    assert.match(dew.quote, /5°F above the dew point/);
    assert.equal(dew.page, undefined, "no page numbers without real pages");
  });

  it("marks silent fields not-stated, never a number", async () => {
    const r = await onDeviceProvider.extract({ text: SHEET });
    assert.equal(r.card.environmentals.windMaxMph, null);
    assert.equal(r.provenance["environmentals.windMaxMph"], "not-stated");
    assert.equal(r.provenance["environmentals.relativeHumidityMax"], "not-stated");
  });

  it("ties the prep-gate profile to its own line", async () => {
    const r = await onDeviceProvider.extract({ text: SHEET });
    const i = r.card.surfacePrep.prepGates?.findIndex((g) => g.family === "steel-immersion") ?? -1;
    assert.ok(i >= 0);
    const p = r.provenance[`surfacePrep.prepGates.${i}.profile`];
    assert.ok(p && p !== "not-stated");
    assert.match(p.quote, /Anchor profile 2-3 mils/);
  });

  it("gives page numbers when pages are sent", async () => {
    const pages = [
      "Product data sheet Field Epoxy 100. Mix ratio: 1:1 by volume. Ambient: 50-90 F.",
      "Surface must be at least 5°F above the dew point.",
    ];
    const r = await onDeviceProvider.extract({ text: "", pages });
    const dew = r.provenance["environmentals.dewPointSpreadMinF"];
    assert.ok(dew && dew !== "not-stated");
    assert.equal(dew.page, 2);
  });

  it("never keeps an unquoted number: 'Minimum 50 Maximum 120' pins to its line or is dropped", async () => {
    const text = "Product data sheet\nField Epoxy 100\nMix ratio: 1:1 by volume\nApplication conditions\nMinimum 50 Maximum 120";
    const r = await onDeviceProvider.extract({ text });
    for (const [path, p] of Object.entries(r.provenance)) {
      if (p === "not-stated") continue;
      const v = path.split(".").reduce<unknown>((o, k) => (o as Record<string, unknown>)?.[k], r.card);
      if (typeof v === "number" || (typeof v === "string" && /\d/.test(v))) {
        assert.notEqual(p.quote, "", `${path}=${String(v)} has a number but no quote`);
      }
    }
    const amb = r.provenance["environmentals.ambientTempMinF"];
    if (r.card.environmentals.ambientTempMinF !== null) {
      assert.ok(amb && amb !== "not-stated" && /Minimum 50/.test(amb.quote));
    } else {
      assert.equal(amb, "not-stated");
      assert.ok(r.warnings.some((w) => w.code === "VALUES_DROPPED_UNQUOTED"));
      assert.equal(r.unverifiedTemps, true);
    }
  });

  it("does not flag ON_DEVICE_UNPINNED just for inferred hold points", async () => {
    const r = await onDeviceProvider.extract({ text: SHEET });
    const inferred = r.card.holdPoints.map((h, i) => [h, i] as const).filter(([h]) => h.source === "inferred");
    for (const [, i] of inferred) assert.equal(r.provenance[`holdPoints.${i}.criteria`], undefined);
    const unpinned = Object.entries(r.provenance).filter(([, p]) => p !== "not-stated" && p.quote === "");
    if (!unpinned.length) assert.ok(!r.warnings.some((w) => w.code === "ON_DEVICE_UNPINNED"));
    for (const [path] of unpinned) assert.ok(!path.startsWith("holdPoints."), path);
  });

  it("returns an all-Not-stated card with IMAGE_ONLY_NEEDS_AZURE when there is no text", async () => {
    const r = await onDeviceProvider.extract({ fileBase64: "iVBORw0KGgo=", mimeType: "image/png", fileName: "scan.png" });
    assert.ok(r.warnings.some((w) => w.code === "IMAGE_ONLY_NEEDS_AZURE"));
    assert.equal(r.card.environmentals.ambientTempMinF, null);
    assert.equal(r.card.environmentals.dewPointSpreadMinF, null);
    assert.ok(Object.values(r.provenance).every((p) => p === "not-stated"));
  });

  it("still refuses unreadable text", async () => {
    await assert.rejects(() => onDeviceProvider.extract({ text: "hello" }), /Could not read this sheet/);
  });
});

describe("dew-point spread is a temperature difference", () => {
  it("reads 3°C above dew point as 5°F, not 37°F", () => {
    const c = heuristicExtract("Product data sheet epoxy. Mix ratio 1:1. Substrate must be 3°C above dew point.");
    assert.equal(c.environmentals.dewPointSpreadMinF, 5);
  });
  it("uses the stated °F in 3°C (5°F) above the dew point", () => {
    const c = heuristicExtract("Product data sheet epoxy. Mix ratio 1:1. At least 3°C (5°F) above the dew point.");
    assert.equal(c.environmentals.dewPointSpreadMinF, 5);
  });
  it("keeps 5°F (3°C) as 5°F", () => {
    const c = heuristicExtract("Product data sheet epoxy. Mix ratio 1:1. At least 5°F (3°C) above the dew point.");
    assert.equal(c.environmentals.dewPointSpreadMinF, 5);
  });
});
