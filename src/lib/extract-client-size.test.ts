import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  callServer,
  extractUpload,
  fileTooLargeMessage,
  ISSUE_COPY,
  mapServerResponse,
  mapThrown,
  NOTHING_READ_NOTE,
  nothingRead,
  providerLabel,
  sizeRefusalHint,
  displayWarnings,
  type DoneState,
  type ExtractResult,
  type ExtractSheetResponse,
  type ExtractState,
} from "./extract-client.ts";
import { onDeviceProvider } from "./extract/on-device-provider.ts";
import type { ExtractInput } from "./extract/provider.ts";
import { SAMPLE_PDS_TEXT } from "./samples.ts";
import { buildCardFromPds } from "./on-device-extract.ts";

/** What Vercel answers before our function runs when the request body is over 4.5 MB. */
const VERCEL_413_JSON = { error: { code: "413", message: "Request Entity Too Large" } };
const VERCEL_413_TEXT = "Request Entity Too Large\n\nFUNCTION_PAYLOAD_TOO_LARGE\n\niad1::zvdmj-1793371473074-bf0253dc7200\n";

const sampleText = Object.values(SAMPLE_PDS_TEXT).find((t) => t && t.length > 200) ?? "";
const onDevice = (input: ExtractInput) => onDeviceProvider.extract(input);
const LIMIT = 3 * 1024 * 1024;
const pdf = (size = 3_400_000) => ({ name: "sheet.pdf", type: "application/pdf", size });

function upload(
  res: unknown,
  opts: { text?: string; maxUploadBytes?: number; file?: { name: string; type?: string; size: number } } = {},
) {
  let calls = 0;
  const p = extractUpload({
    file: opts.file ?? pdf(),
    text: opts.text ?? "",
    signedIn: true,
    onDevice,
    readBase64: async () => "QUJD",
    server: async () => {
      calls++;
      if (res instanceof Error) throw res;
      return res as ExtractSheetResponse;
    },
    ...(opts.maxUploadBytes ? { maxUploadBytes: opts.maxUploadBytes } : {}),
  });
  return { p, calls: () => calls };
}

describe("host 413 is a size refusal, never a silent empty draft", () => {
  it("Vercel's JSON 413 maps to FILE_TOO_LARGE", () => {
    assert.deepEqual(mapServerResponse(VERCEL_413_JSON), { ok: false, code: "FILE_TOO_LARGE" });
  });
  it("Vercel's text 413 (thrown by the server-fn client) maps to FILE_TOO_LARGE", async () => {
    assert.equal(mapThrown(new Error(VERCEL_413_TEXT)), "FILE_TOO_LARGE");
    const out = await callServer(async () => {
      throw new Error(VERCEL_413_TEXT);
    }, { fileBase64: "", mimeType: "application/pdf", fileName: "a.pdf" });
    assert.deepEqual(out, { ok: false, code: "FILE_TOO_LARGE" });
  });
  for (const [label, res] of [
    ["JSON", VERCEL_413_JSON],
    ["text", new Error(VERCEL_413_TEXT)],
  ] as const) {
    it(`${label} 413 on a PDF: error with this copy's limit, no on-device draft`, async () => {
      const s = await upload(res, { text: sampleText, maxUploadBytes: LIMIT }).p;
      assert.equal(s.kind, "error");
      if (s.kind === "error") {
        assert.equal(s.issue, "FILE_TOO_LARGE");
        assert.equal(s.message, fileTooLargeMessage(LIMIT));
        assert.equal(s.message, "File is over 3 MB, the upload limit on this copy.");
      }
    });
  }
  it("413 with the limit unknown: the generic size copy, still an error", async () => {
    const s = await upload(VERCEL_413_JSON, { text: sampleText }).p;
    assert.equal(s.kind === "error" && s.message, ISSUE_COPY.FILE_TOO_LARGE);
  });
  it("413 on a photo is the same size error", async () => {
    const s = await upload(VERCEL_413_JSON, { file: { name: "scan.png", type: "image/png", size: 3_400_000 }, maxUploadBytes: LIMIT }).p;
    assert.equal(s.kind === "error" && s.issue, "FILE_TOO_LARGE");
  });
  it("over the host limit in the browser: refused before any request", async () => {
    const u = upload({ ok: true }, { file: pdf(LIMIT + 1), maxUploadBytes: LIMIT });
    const s = await u.p;
    assert.equal(s.kind === "error" && s.message, "File is over 3 MB, the upload limit on this copy.");
    assert.equal(u.calls(), 0);
  });
});

describe("a failed server read that finds nothing on-device is an error, not a blank draft", () => {
  it("EXTRACT_FAILED + no text: error naming both, no draft", async () => {
    const s = await upload({ ok: false, error: { code: "EXTRACT_FAILED", message: "x" } }, { text: "" }).p;
    assert.equal(s.kind, "error");
    if (s.kind === "error") {
      assert.equal(s.issue, "EXTRACT_FAILED");
      assert.equal(s.message, `${ISSUE_COPY.EXTRACT_FAILED} ${NOTHING_READ_NOTE}`);
    }
  });
  it("server unreachable + no text: error, not a draft", async () => {
    const s = await upload(new Error("fetch failed"), { text: "" }).p;
    assert.equal(s.kind === "error" && s.issue, "SERVER_UNAVAILABLE");
  });
  it("a fallback that did read something still gives the draft with its notice", async () => {
    const s = await upload({ ok: false, error: { code: "EXTRACT_FAILED", message: "x" } }, { text: sampleText }).p;
    assert.equal(s.kind, "done");
    assert.equal((s as DoneState).source, "client-fallback");
    assert.equal((s as DoneState).issue, "EXTRACT_FAILED");
  });
  it("nothingRead: all not-stated (or none) only", () => {
    const card = buildCardFromPds(sampleText);
    const base = { card, provider: "on-device", warnings: [] } as unknown as ExtractResult;
    assert.equal(nothingRead({ ...base, provenance: {} }), true);
    assert.equal(nothingRead({ ...base, provenance: { a: "not-stated", b: "not-stated" } }), true);
    assert.equal(nothingRead({ ...base, provenance: { a: "not-stated", b: { quote: "50°F" } } }), false);
  });
});

describe("size refusal hint", () => {
  it("adds what to do under a message that names the limit", () => {
    const e: ExtractState = { kind: "error", issue: "FILE_TOO_LARGE", message: fileTooLargeMessage(LIMIT) };
    assert.equal(sizeRefusalHint(e), ISSUE_COPY.FILE_TOO_LARGE);
    assert.match(sizeRefusalHint(e)!, /too large for the reader/);
  });
  it("none when the message already is the advice, or for other errors", () => {
    assert.equal(sizeRefusalHint({ kind: "error", issue: "FILE_TOO_LARGE", message: ISSUE_COPY.FILE_TOO_LARGE }), null);
    assert.equal(sizeRefusalHint({ kind: "error", issue: "EXTRACT_FAILED", message: "m" }), null);
    assert.equal(sizeRefusalHint({ kind: "idle" }), null);
  });
});

describe("SERVER_READER_OFF (neutral network code) reads like AZURE_NOT_CONFIGURED", () => {
  it("quiet on-device label, no extra note", () => {
    const card = buildCardFromPds(sampleText);
    const result = {
      card,
      provenance: { "product.name": { quote: "x" } },
      provider: "on-device",
      warnings: [{ code: "SERVER_READER_OFF", message: "The server reader is off on this copy; showing the on-device read." }],
    } as unknown as ExtractResult;
    const state: DoneState = { kind: "done", result, source: "server" };
    assert.equal(providerLabel(state), "On-device reader.");
    assert.deepEqual(displayWarnings(result), []);
  });
});
