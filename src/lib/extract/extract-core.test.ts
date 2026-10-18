import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { checkRequest, runExtract, takeRateSlot, type RateStore } from "./extract-core.ts";
import { maxBase64Length, sniffFileType } from "./file-type.ts";
import { onDeviceProvider } from "./on-device-provider.ts";
import type { ExtractProvider, ExtractRequest, ExtractResult } from "./provider.ts";

const SHEET = `Product data sheet
Field Epoxy 100
Mix ratio: 1:1 by volume
DFT: 5-7 mils
Ambient air temperature: 50-90 F
Surface must be at least 5°F above the dew point.`;

const FIX = new URL("../../../tests/fixtures/extract/", import.meta.url);
const fixture = (name: string) => new Uint8Array(readFileSync(new URL(name, FIX)));
const b64 = (b: Uint8Array) => Buffer.from(b).toString("base64");

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]);
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46]);
const TIFF_LE = new Uint8Array([0x49, 0x49, 0x2a, 0x00, 8, 0, 0, 0]);
const TIFF_BE = new Uint8Array([0x4d, 0x4d, 0x00, 0x2a, 0, 0, 0, 8]);
const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

function fakeAzure(impl: (signal?: AbortSignal) => Promise<ExtractResult>, available = true): ExtractProvider {
  return { id: "azure", available: () => available, extract: (_i, s) => impl(s) };
}

async function okAzure(): Promise<ExtractResult> {
  const r = await onDeviceProvider.extract({ text: SHEET });
  return {
    ...r,
    provider: "azure",
    deployment: "gpt-4o",
    warnings: [],
    draft: false,
  };
}

function base(over: Partial<Parameters<typeof runExtract>[0]> = {}) {
  return {
    userId: "u1",
    input: { text: SHEET } as ExtractRequest,
    azure: null,
    onDevice: onDeviceProvider,
    rate: new Map() as RateStore,
    ...over,
  };
}

describe("runExtract (BE-3 contract)", () => {
  it("UNAUTHENTICATED without a user", async () => {
    const r = await runExtract(base({ userId: null }));
    assert.ok(!r.ok && r.error.code === "UNAUTHENTICATED");
  });

  it("FILE_TOO_LARGE when client text is over 40,000 characters", async () => {
    const r = await runExtract(base({ input: { text: "x".repeat(40_001) } }));
    assert.ok(!r.ok && r.error.code === "FILE_TOO_LARGE");
  });

  it("FILE_TOO_LARGE over MAX_UPLOAD_MB, with maxUploadMb and the limit in the message", async () => {
    const big = new Uint8Array(3 * 1024 * 1024 + 10);
    big.set(new TextEncoder().encode("%PDF-1.4\n"));
    const r = await runExtract(
      base({ input: { fileBase64: b64(big), mimeType: "application/pdf", fileName: "a.pdf" }, maxFileBytes: 3 * 1024 * 1024 }),
    );
    assert.ok(!r.ok);
    if (!r.ok) {
      assert.equal(r.error.code, "FILE_TOO_LARGE");
      assert.equal(r.error.maxUploadMb, 3);
      assert.equal(r.error.message, "File is over 3 MB, the upload limit on this copy.");
    }
  });

  it("rejects an over-long base64 string before decoding", () => {
    const max = 1000;
    const long = "A".repeat(maxBase64Length(max) + 300);
    const c = checkRequest({ fileBase64: long, mimeType: "application/pdf" }, max);
    assert.ok(!c.ok && c.code === "FILE_TOO_LARGE");
    assert.equal(maxBase64Length(10 * 1024 * 1024), Math.ceil((10 * 1024 * 1024 * 4) / 3) + 4);
  });

  it("UNSUPPORTED_FILE_TYPE for another type, a mismatch, garbage and bad base64", async () => {
    const cases: ExtractRequest[] = [
      { fileBase64: b64(PNG), mimeType: "image/gif" },
      { fileBase64: b64(PNG), mimeType: "application/pdf" },
      { fileBase64: b64(new TextEncoder().encode("just some bytes, nothing known")), mimeType: "application/pdf" },
      { fileBase64: "!!!not base64!!!", mimeType: "image/png" },
      { fileBase64: b64(new Uint8Array([0x50, 0x4b, 3, 4, 1, 2, 3])), mimeType: DOCX },
    ];
    for (const input of cases) {
      const r = await runExtract(base({ input }));
      assert.ok(!r.ok && r.error.code === "UNSUPPORTED_FILE_TYPE", JSON.stringify(input.mimeType));
    }
  });

  it("EXTRACT_FAILED with neither a file nor text", async () => {
    const r = await runExtract(base({ input: {} }));
    assert.ok(!r.ok && r.error.code === "EXTRACT_FAILED");
  });

  it("RATE_LIMITED on the 11th call in a minute, with retryAfterSec; other users unaffected", async () => {
    const rate: RateStore = new Map();
    let t = 1_000_000;
    const now = () => t;
    for (let i = 0; i < 10; i++) {
      const r = await runExtract(base({ rate, now }));
      assert.equal(r.ok, true, `call ${i + 1}`);
      t += 1000;
    }
    const r = await runExtract(base({ rate, now }));
    assert.ok(!r.ok && r.error.code === "RATE_LIMITED" && (r.error.retryAfterSec ?? 0) > 0);
    assert.equal((await runExtract(base({ rate, now, userId: "u2" }))).ok, true);
  });

  it("uses Azure when configured: provider 'azure' + deployment, extract.draft false", async () => {
    const r = await runExtract(base({ azure: fakeAzure(okAzure) }));
    assert.ok(r.ok);
    if (r.ok) {
      assert.equal(r.provider, "azure");
      assert.equal(r.deployment, "gpt-4o");
      assert.equal(r.draft, false);
      assert.equal("extract" in r, false);
    }
  });

  it("falls back to on-device with AZURE_FALLBACK when Azure throws; extract mirrors warnings", async () => {
    const r = await runExtract(base({ azure: fakeAzure(async () => { throw new Error("500"); }) }));
    assert.ok(r.ok);
    if (r.ok) {
      assert.equal(r.provider, "on-device");
      assert.equal(r.deployment, undefined);
      assert.ok(r.warnings.some((w) => w.code === "AZURE_FALLBACK"));
      assert.ok(Array.isArray(r.warnings));
      assert.equal(r.draft, true);
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

  for (const [name, bytes, mimeType] of [
    ["PNG", PNG, "image/png"],
    ["JPEG", JPEG, "image/jpeg"],
    ["TIFF", TIFF_LE, "image/tiff"],
  ] as const) {
    it(`${name} without Azure -> ok, all Not stated, IMAGE_ONLY_NEEDS_AZURE`, async () => {
      const r = await runExtract(base({ input: { fileBase64: b64(bytes), mimeType, fileName: `scan.${name}` } }));
      assert.ok(r.ok);
      if (r.ok) {
        assert.ok(r.warnings.some((w) => w.code === "IMAGE_ONLY_NEEDS_AZURE"));
        assert.equal(r.warnings.filter((w) => w.code === "IMAGE_ONLY_NEEDS_AZURE").length, 1);
        assert.equal(r.card.environmentals.ambientTempMinF, null);
        assert.equal(r.card.environmentals.dewPointSpreadMinF, null);
        assert.ok(Object.values(r.provenance).every((p) => p === "not-stated"));
      }
    });
  }

  it("Azure gets the file (any type) when configured", async () => {
    let seen: { mimeType?: string; fileBase64?: string } = {};
    const az: ExtractProvider = { id: "azure", available: () => true, extract: async (i) => { seen = i; return okAzure(); } };
    const r = await runExtract(base({ azure: az, input: { fileBase64: b64(JPEG), mimeType: "image/jpg" } }));
    assert.ok(r.ok && r.provider === "azure");
    assert.equal(seen.mimeType, "image/jpeg");
    assert.equal(seen.fileBase64, b64(JPEG));
  });

  it("PDF without client text -> server pdf.js reads it, with page numbers", async () => {
    const r = await runExtract(base({ input: { fileBase64: b64(fixture("text-layer.pdf")), mimeType: "application/pdf", fileName: "t.pdf" } }));
    assert.ok(r.ok, JSON.stringify(!r.ok && r.error));
    if (r.ok) {
      assert.ok(!r.warnings.some((w) => w.code === "IMAGE_ONLY_NEEDS_AZURE"));
      const dew = r.provenance["environmentals.dewPointSpreadMinF"];
      assert.equal(r.card.environmentals.dewPointSpreadMinF, 5);
      assert.ok(dew && dew !== "not-stated" && dew.page === 2);
    }
  });

  it("PDF with client text uses the client text", async () => {
    let pdfRead = false;
    const r = await runExtract(base({
      input: { fileBase64: b64(fixture("text-layer.pdf")), mimeType: "application/pdf", text: SHEET },
      readers: { pdf: async () => { pdfRead = true; return { text: "" }; }, docx: async () => ({ text: "" }) },
    }));
    assert.ok(r.ok);
    assert.equal(pdfRead, false);
  });

  it("PDF with no text layer -> IMAGE_ONLY_NEEDS_AZURE, nothing invented", async () => {
    const r = await runExtract(base({ input: { fileBase64: b64(fixture("no-text.pdf")), mimeType: "application/pdf" } }));
    assert.ok(r.ok);
    if (r.ok) {
      assert.ok(r.warnings.some((w) => w.code === "IMAGE_ONLY_NEEDS_AZURE"));
      assert.equal(r.card.environmentals.ambientTempMinF, null);
    }
  });

  it("DOCX is read on-device with mammoth", async () => {
    const r = await runExtract(base({ input: { fileBase64: b64(fixture("sheet.docx")), mimeType: DOCX, fileName: "s.docx" } }));
    assert.ok(r.ok, JSON.stringify(!r.ok && r.error));
    if (r.ok) {
      assert.equal(r.provider, "on-device");
      assert.equal(r.card.environmentals.dewPointSpreadMinF, 5);
      assert.ok(!r.warnings.some((w) => w.code === "IMAGE_ONLY_NEEDS_AZURE"));
    }
  });

  it("text-only (paste) input still works", async () => {
    const r = await runExtract(base({ input: { text: SHEET } }));
    assert.ok(r.ok && r.draft === true && typeof r.unverifiedTemps === "boolean");
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

describe("sniffFileType", () => {
  it("recognises each accepted type by its bytes", () => {
    assert.equal(sniffFileType(fixture("text-layer.pdf")), "application/pdf");
    assert.equal(sniffFileType(PNG), "image/png");
    assert.equal(sniffFileType(JPEG), "image/jpeg");
    assert.equal(sniffFileType(TIFF_LE), "image/tiff");
    assert.equal(sniffFileType(TIFF_BE), "image/tiff");
    assert.equal(sniffFileType(fixture("sheet.docx")), DOCX);
  });
  it("returns null for garbage and for a zip that is not a Word file", () => {
    assert.equal(sniffFileType(new TextEncoder().encode("GIF89a....")), null);
    assert.equal(sniffFileType(new Uint8Array([0x50, 0x4b, 3, 4, 0, 0])), null);
    assert.equal(sniffFileType(new Uint8Array()), null);
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
