import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { runExtract, takeRateSlot, type RateStore } from "./extract-core.ts";
import { onDeviceProvider } from "./on-device-provider.ts";
import type { ExtractProvider, ExtractResult } from "./provider.ts";

const SHEET = `Product data sheet
Field Epoxy 100
Mix ratio: 1:1 by volume
DFT: 5-7 mils
Ambient: 50-90 F
Surface must be at least 5°F above the dew point.`;

function fakeAzure(impl: (signal?: AbortSignal) => Promise<ExtractResult>, available = true): ExtractProvider {
  return { id: "azure", available: () => available, extract: (_i, s) => impl(s) };
}

async function okAzure(): Promise<ExtractResult> {
  const r = await onDeviceProvider.extract({ text: SHEET });
  return { ...r, provider: "azure:gpt-4o", warnings: [] };
}

function base(over: Partial<Parameters<typeof runExtract>[0]> = {}) {
  return { userId: "u1", input: { text: SHEET }, azure: null, onDevice: onDeviceProvider, rate: new Map() as RateStore, ...over };
}

describe("runExtract (BE-3 contract)", () => {
  it("UNAUTHENTICATED without a user", async () => {
    const r = await runExtract(base({ userId: null }));
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.error.code, "UNAUTHENTICATED");
  });

  it("FILE_TOO_LARGE over 40,000 characters", async () => {
    const r = await runExtract(base({ input: { text: "x".repeat(40_001) } }));
    assert.ok(!r.ok && r.error.code === "FILE_TOO_LARGE");
  });

  it("FILE_TOO_LARGE over the PDF cap", async () => {
    const r = await runExtract(base({ input: { text: SHEET, pdfBase64: "A".repeat(2000) }, maxFileBytes: 1000 }));
    assert.ok(!r.ok && r.error.code === "FILE_TOO_LARGE");
  });

  it("RATE_LIMITED on the 11th call in a minute, with retryAfterSec", async () => {
    const rate: RateStore = new Map();
    let t = 1_000_000;
    const now = () => t;
    for (let i = 0; i < 10; i++) {
      const r = await runExtract(base({ rate, now }));
      assert.equal(r.ok, true, `call ${i + 1}`);
      t += 1000;
    }
    const r = await runExtract(base({ rate, now }));
    assert.ok(!r.ok && r.error.code === "RATE_LIMITED");
    if (!r.ok) assert.ok((r.error.retryAfterSec ?? 0) > 0);
    // a different user is not limited
    const other = await runExtract(base({ rate, now, userId: "u2" }));
    assert.equal(other.ok, true);
  });

  it("uses Azure when configured", async () => {
    const r = await runExtract(base({ azure: fakeAzure(okAzure) }));
    assert.ok(r.ok && r.provider === "azure:gpt-4o");
  });

  it("falls back to on-device with AZURE_FALLBACK when Azure throws", async () => {
    const r = await runExtract(base({ azure: fakeAzure(async () => { throw new Error("500"); }) }));
    assert.ok(r.ok);
    if (r.ok) {
      assert.equal(r.provider, "on-device");
      assert.ok(r.warnings.some((w) => w.code === "AZURE_FALLBACK"));
    }
  });

  it("falls back on Azure timeout and aborts the Azure call", async () => {
    let aborted = false;
    const slow = fakeAzure((signal) => new Promise((_res, rej) => {
      signal?.addEventListener("abort", () => { aborted = true; rej(new Error("aborted")); });
    }));
    const r = await runExtract(base({ azure: slow, timeoutMs: 3_200 }));
    assert.ok(r.ok && r.warnings.some((w) => w.code === "AZURE_FALLBACK" && /timed out/.test(w.message)));
    assert.equal(aborted, true);
  });

  it("AZURE_NOT_CONFIGURED when Azure env is missing", async () => {
    const r = await runExtract(base({ azure: fakeAzure(okAzure, false) }));
    assert.ok(r.ok && r.provider === "on-device" && r.warnings.some((w) => w.code === "AZURE_NOT_CONFIGURED"));
  });

  it("IMAGE_ONLY_NEEDS_AZURE for a scan with no text layer and no Azure; nothing invented", async () => {
    const r = await runExtract(base({ input: { text: "", pdfBase64: "JVBERi0xLjQK" } }));
    assert.ok(r.ok);
    if (r.ok) {
      assert.ok(r.warnings.some((w) => w.code === "IMAGE_ONLY_NEEDS_AZURE"));
      assert.equal(r.card.environmentals.dewPointSpreadMinF, null);
      assert.equal(r.card.environmentals.ambientTempMinF, null);
    }
  });

  it("EXTRACT_FAILED for unreadable text", async () => {
    const r = await runExtract(base({ input: { text: "hello there, nothing useful" } }));
    assert.ok(!r.ok && r.error.code === "EXTRACT_FAILED");
  });

  it("logs provider, outcome and latency, never the text", async () => {
    const lines: string[] = [];
    await runExtract(base({ log: (e) => lines.push(JSON.stringify(e)) }));
    assert.equal(lines.length, 1);
    assert.match(lines[0]!, /"outcome":"ok"/);
    assert.ok(!lines[0]!.includes("Field Epoxy"));
  });
});

describe("takeRateSlot", () => {
  it("frees slots after the window", () => {
    const s: RateStore = new Map();
    for (let i = 0; i < 10; i++) assert.ok(takeRateSlot(s, "u", 0).ok);
    assert.equal(takeRateSlot(s, "u", 59_999).ok, false);
    assert.equal(takeRateSlot(s, "u", 60_000).ok, true);
  });
});
