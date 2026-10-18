import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  bytesToBase64,
  callServer,
  describeProvenance,
  displayWarnings,
  extractPasted,
  extractUpload,
  IMAGE_ONLY_NOTICE,
  mapServerResponse,
  MAX_FILE_BYTES,
  mimeTypeFor,
  needsAzureReader,
  precheckFile,
  provenanceRows,
  providerLabel,
  usedOnDeviceFallback,
  type DoneState,
  type ExtractResult,
  type ExtractSheetInput,
  type ExtractSheetResponse,
  type ExtractState,
} from "./extract-client.ts";
import { buildCardFromPds } from "./on-device-extract.ts";
import { SAMPLE_PDS_TEXT } from "./samples.ts";

const sampleText = Object.values(SAMPLE_PDS_TEXT).find((t) => t && t.length > 200) ?? "";
const card = buildCardFromPds(sampleText);

function result(over: Partial<ExtractResult> = {}): ExtractResult {
  return {
    card,
    provenance: {
      "product.name": { page: 1, quote: "Carbomastic 615" },
      "environmentals.windMaxMph": "not-stated",
    },
    provider: "azure",
    warnings: [],
    ...over,
  };
}
const ok = (over: Partial<ExtractResult> = {}): ExtractSheetResponse => ({
  ok: true,
  ...result(over),
});
const fail = (code: string, retryAfterSec?: number): ExtractSheetResponse => ({
  ok: false,
  error: { code, message: "x", ...(retryAfterSec ? { retryAfterSec } : {}) },
});

const pdf = { name: "sheet.pdf", type: "application/pdf", size: 1000 };
const png = { name: "scan.png", type: "image/png", size: 1000 };
const docx = { name: "spec.docx", type: "", size: 1000 };

function upload(
  file: { name: string; type?: string; size: number },
  res: ExtractSheetResponse | null | Error,
  extra: Partial<Parameters<typeof extractUpload>[0]> = {},
) {
  const seen: ExtractSheetInput[] = [];
  const p = extractUpload({
    file,
    text: file === pdf ? sampleText : "",
    signedIn: true,
    onDevice: buildCardFromPds,
    readBase64: async () => "QUJD",
    server: async (input) => {
      seen.push(input);
      if (res instanceof Error) throw res;
      return res;
    },
    ...extra,
  });
  return { p, seen };
}

const done = (s: ExtractState): DoneState => {
  assert.equal(s.kind, "done");
  return s as DoneState;
};

describe("error-code mapping", () => {
  for (const code of [
    "UNAUTHENTICATED",
    "RATE_LIMITED",
    "EXTRACT_TIMEOUT",
    "EXTRACT_FAILED",
    "FILE_TOO_LARGE",
    "UNSUPPORTED_FILE_TYPE",
  ]) {
    it(`maps ${code}`, () => {
      assert.deepEqual(mapServerResponse(fail(code)), { ok: false, code });
    });
  }
  it("unknown code or junk is EXTRACT_FAILED; retryAfterSec carried", () => {
    assert.deepEqual(mapServerResponse(fail("NOPE")), { ok: false, code: "EXTRACT_FAILED" });
    assert.deepEqual(mapServerResponse(null), { ok: false, code: "EXTRACT_FAILED" });
    assert.deepEqual(mapServerResponse(fail("RATE_LIMITED", 42)), {
      ok: false,
      code: "RATE_LIMITED",
      retryAfterSec: 42,
    });
  });
  it("accepts a documented success and rejects string warnings / bad provenance", () => {
    assert.equal(mapServerResponse(ok()).ok, true);
    assert.equal(mapServerResponse({ ...ok(), warnings: ["AZURE_FALLBACK: x"] }).ok, false);
    assert.equal(mapServerResponse({ ...ok(), provenance: { a: { quote: 3 } } }).ok, false);
  });
  it("adapter null = unavailable, thrown Unauthorized = UNAUTHENTICATED, slow = timeout", async () => {
    const input = { fileBase64: "", mimeType: "application/pdf", fileName: "a.pdf" };
    assert.deepEqual(await callServer(async () => null, input), {
      ok: false,
      code: "SERVER_UNAVAILABLE",
    });
    assert.deepEqual(
      await callServer(async () => {
        throw new Error("Unauthorized");
      }, input),
      { ok: false, code: "UNAUTHENTICATED" },
    );
    assert.deepEqual(await callServer(() => new Promise(() => {}), input, 5), {
      ok: false,
      code: "EXTRACT_TIMEOUT",
    });
  });
});

describe("file type and size pre-check", () => {
  it("allowed types by extension; obvious misses pre-rejected", () => {
    assert.equal(mimeTypeFor(pdf), "application/pdf");
    assert.equal(mimeTypeFor({ name: "a.TIF" }), "image/tiff");
    assert.equal(
      mimeTypeFor(docx),
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
    assert.equal(precheckFile({ name: "a.exe", size: 1 }), "UNSUPPORTED_FILE_TYPE");
    assert.equal(precheckFile({ ...pdf, size: MAX_FILE_BYTES + 1 }), "FILE_TOO_LARGE");
    assert.equal(precheckFile({ ...pdf, size: MAX_FILE_BYTES }), null);
  });
  it("unsupported type and oversize never call the server", async () => {
    const a = upload({ name: "a.xlsx", size: 1 }, ok());
    const s = await a.p;
    assert.equal(s.kind === "error" && s.issue, "UNSUPPORTED_FILE_TYPE");
    assert.match(
      s.kind === "error" ? s.message : "",
      /PDF, photo or scan \(PNG, JPG, TIFF\), or Word \(\.docx\)/,
    );
    const b = upload({ ...pdf, size: MAX_FILE_BYTES + 1 }, ok());
    assert.equal(((await b.p) as { issue?: string }).issue, "FILE_TOO_LARGE");
    assert.equal(a.seen.length + b.seen.length, 0);
  });
  it("server UNSUPPORTED_FILE_TYPE shows the error, no fallback", async () => {
    const s = await upload(pdf, fail("UNSUPPORTED_FILE_TYPE")).p;
    assert.equal(s.kind, "error");
  });
});

describe("payload", () => {
  it("PDF sends pdf.js text; other types send the file only", async () => {
    const a = upload(pdf, ok());
    await a.p;
    assert.deepEqual(a.seen[0], {
      fileBase64: "QUJD",
      mimeType: "application/pdf",
      fileName: "sheet.pdf",
      text: sampleText,
    });
    const b = upload(png, ok());
    await b.p;
    assert.equal("text" in b.seen[0]!, false);
    assert.equal(b.seen[0]!.mimeType, "image/png");
  });
  it("base64 encodes bytes", () => {
    assert.equal(bytesToBase64(new Uint8Array([65, 66, 67])), "QUJD");
  });
});

describe("fallback", () => {
  it("server success", async () => {
    const s = done(await upload(pdf, ok()).p);
    assert.equal(s.source, "server");
    assert.equal(usedOnDeviceFallback(s), false);
    assert.equal(providerLabel(s), "Azure reader.");
  });
  for (const code of ["EXTRACT_FAILED", "EXTRACT_TIMEOUT", "RATE_LIMITED"]) {
    it(`PDF falls back on-device in the browser on ${code}`, async () => {
      const s = done(await upload(pdf, fail(code, code === "RATE_LIMITED" ? 30 : undefined)).p);
      assert.equal(s.source, "client-fallback");
      assert.equal(s.issue, code);
      assert.equal(usedOnDeviceFallback(s), true);
      if (code === "RATE_LIMITED") assert.equal(s.retryAfterSec, 30);
    });
  }
  it("PDF falls back when the server fn is missing", async () => {
    assert.equal(done(await upload(pdf, null).p).issue, "SERVER_UNAVAILABLE");
  });
  for (const f of [png, docx]) {
    it(`${f.name}: no client fallback, error state instead of a fake card`, async () => {
      const s = await upload(f, null).p;
      assert.equal(s.kind, "error");
      const r = await upload(f, fail("RATE_LIMITED", 12)).p;
      assert.equal(r.kind, "error");
      assert.match(r.kind === "error" ? r.message : "", /Try again in 12 s\./);
    });
  }
  it("UNAUTHENTICATED returns to login", async () => {
    assert.equal((await upload(pdf, fail("UNAUTHENTICATED")).p).kind, "unauthenticated");
    assert.equal((await upload(png, new Error("Unauthorized")).p).kind, "unauthenticated");
  });
  it("server-side AZURE_FALLBACK shows the fallback note; AZURE_NOT_CONFIGURED is a quiet note", async () => {
    const fb = done(
      await upload(
        pdf,
        ok({
          provider: "on-device",
          warnings: [{ code: "AZURE_FALLBACK", message: "Azure timed out" }],
        }),
      ).p,
    );
    assert.equal(usedOnDeviceFallback(fb), true);
    assert.match(providerLabel(fb), /on-device reader/);
    assert.deepEqual(displayWarnings(fb.result), []);
    const nc = done(
      await upload(
        pdf,
        ok({ provider: "on-device", warnings: [{ code: "AZURE_NOT_CONFIGURED", message: "m" }] }),
      ).p,
    );
    assert.equal(usedOnDeviceFallback(nc), false);
    assert.equal(providerLabel(nc), "On-device reader.");
  });
  it("guests: PDF reads on-device without the server; photos ask to sign in", async () => {
    const a = upload(pdf, ok(), { signedIn: false });
    assert.equal(done(await a.p).source, "on-device");
    const b = upload(png, ok(), { signedIn: false });
    assert.equal((await b.p).kind, "error");
    assert.equal(a.seen.length + b.seen.length, 0);
  });
  it("error when server and on-device both fail; pasted text reads on-device", async () => {
    const s = await upload(pdf, fail("EXTRACT_FAILED"), { text: "" }).p;
    assert.equal(s.kind, "error");
    assert.equal(done(extractPasted(sampleText, buildCardFromPds)).source, "on-device");
  });
});

describe("image-only needs Azure", () => {
  it("triggers only on the server's warning code, not prose", () => {
    assert.equal(
      needsAzureReader(result({ warnings: [{ code: "IMAGE_ONLY_NEEDS_AZURE", message: "scan" }] })),
      true,
    );
    assert.equal(
      needsAzureReader(
        result({
          warnings: [{ code: "OTHER", message: "IMAGE_ONLY_NEEDS_AZURE scanned, needs Azure" }],
        }),
      ),
      false,
    );
    assert.equal(needsAzureReader(result()), false);
    assert.equal(
      IMAGE_ONLY_NOTICE,
      "This sheet needs the Azure reader. Showing what could be read on-device.",
    );
  });
  it("card still shows with Not stated blanks; code not repeated as prose", async () => {
    const s = done(
      await upload(
        png,
        ok({
          provider: "on-device",
          provenance: { "product.name": "not-stated" },
          warnings: [
            { code: "IMAGE_ONLY_NEEDS_AZURE", message: "scan" },
            { code: "X", message: "Check the mix ratio." },
          ],
        }),
      ).p,
    );
    assert.equal(needsAzureReader(s.result), true);
    assert.ok(s.result.card.product);
    assert.equal(provenanceRows(s.result.provenance)[0]?.text, "Not stated");
    assert.deepEqual(displayWarnings(s.result), ["Check the mix ratio."]);
  });
});

describe("provenance rendering helper", () => {
  it("quote with page, quote without page, and not-stated", () => {
    assert.equal(describeProvenance({ page: 2, quote: "4–6 mils DFT" }), "p. 2 — “4–6 mils DFT”");
    assert.equal(describeProvenance({ quote: "Mix 1:1" }), "“Mix 1:1”");
    assert.equal(describeProvenance("not-stated"), "Not stated");
  });
  it("rows sorted with readable labels and a stated flag", () => {
    assert.deepEqual(
      provenanceRows(result().provenance).map((r) => [r.fieldPath, r.label, r.stated]),
      [
        ["environmentals.windMaxMph", "Environmentals › Wind Max Mph", false],
        ["product.name", "Product › Name", true],
      ],
    );
  });
});
