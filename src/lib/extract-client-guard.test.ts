import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  extractUpload,
  ISSUE_COPY,
  NOTHING_READ_MESSAGE,
  NOTHING_READ_NOTE,
  noEmptyDraft,
  type DoneState,
  type ExtractResult,
  type ExtractSheetResponse,
} from "./extract-client.ts";
import { onDeviceProvider } from "./extract/on-device-provider.ts";
import type { ExtractInput } from "./extract/provider.ts";
import { SAMPLE_PDS_TEXT } from "./samples.ts";
import { buildCardFromPds } from "./on-device-extract.ts";

const sampleText = Object.values(SAMPLE_PDS_TEXT).find((t) => t && t.length > 200) ?? "";
const card = buildCardFromPds(sampleText);
const onDevice = (input: ExtractInput) => onDeviceProvider.extract(input);
/** What a corrupt / truncated PDF gives the on-device reader: pdf.js finds no text. */
const emptyOnDevice = async () => ({
  ok: true as const,
  card,
  provenance: { "product.name": "not-stated" as const, "environmentals.windMaxMph": "not-stated" as const },
  provider: "on-device" as const,
  warnings: [{ code: "IMAGE_ONLY_NEEDS_AZURE" as const, message: "scan" }],
});
const pdf = { name: "corrupt_truncated.pdf", type: "application/pdf", size: 60_000 };

function run(opts: { signedIn: boolean; text?: string; server?: unknown; empty?: boolean; file?: typeof pdf }) {
  let calls = 0;
  const p = extractUpload({
    file: opts.file ?? pdf,
    text: opts.text ?? "",
    signedIn: opts.signedIn,
    onDevice: (opts.empty ? emptyOnDevice : onDevice) as never,
    readBase64: async () => "QUJD",
    server: async () => {
      calls++;
      return opts.server as ExtractSheetResponse;
    },
  });
  return { p, calls: () => calls };
}

describe("one no-empty-draft guard on every upload path (QA #55 D1)", () => {
  it("guest, corrupt PDF (on-device finds nothing): clear error, no draft, no server call", async () => {
    const r = run({ signedIn: false, empty: true });
    const s = await r.p;
    assert.equal(s.kind, "error");
    assert.equal(s.kind === "error" && s.message, NOTHING_READ_MESSAGE);
    assert.equal(r.calls(), 0);
  });
  it("guest, corrupt PDF with the real on-device reader and no text: still an error", async () => {
    const s = await run({ signedIn: false, text: "" }).p;
    assert.equal(s.kind, "error");
  });
  it("guest, readable PDF: the draft is made as before", async () => {
    const s = await run({ signedIn: false, text: sampleText }).p;
    assert.equal(s.kind, "done");
    assert.equal((s as DoneState).source, "on-device");
  });
  it("signed in, server answers with nothing read (not image-only): error, no draft", async () => {
    const server = {
      ok: true,
      card,
      provenance: { "product.name": "not-stated", "environmentals.windMaxMph": "not-stated" },
      provider: "on-device",
      warnings: [],
    };
    const s = await run({ signedIn: true, server }).p;
    assert.equal(s.kind === "error" && s.message, NOTHING_READ_MESSAGE);
  });
  it("signed in, server says image-only: the documented card with its notice stays", async () => {
    const server = {
      ok: true,
      card,
      provenance: { "product.name": "not-stated" },
      provider: "on-device",
      warnings: [{ code: "IMAGE_ONLY_NEEDS_AZURE", message: "scan" }],
    };
    const s = await run({ signedIn: true, server }).p;
    assert.equal(s.kind, "done");
  });
  it("signed in, server failed and the fallback found nothing: both named (unchanged copy)", async () => {
    const s = await run({ signedIn: true, empty: true, server: { ok: false, error: { code: "EXTRACT_FAILED", message: "x" } } }).p;
    assert.equal(s.kind === "error" && s.message, `${ISSUE_COPY.EXTRACT_FAILED} ${NOTHING_READ_NOTE}`);
  });
  it("noEmptyDraft leaves errors, loading and real reads alone", () => {
    const real = { kind: "done", source: "on-device", result: { card, provenance: { "product.name": { quote: "x" } }, provider: "on-device", warnings: [] } as unknown as ExtractResult } as DoneState;
    assert.equal(noEmptyDraft(real), real);
    const err = { kind: "error" as const, message: "m" };
    assert.equal(noEmptyDraft(err), err);
    assert.deepEqual(noEmptyDraft({ kind: "loading" }), { kind: "loading" });
  });
});
