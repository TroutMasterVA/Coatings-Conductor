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
  MAX_UPLOAD_BYTES,
  SESSION_EDIT_TEXT,
  SHEET_QUOTE_LABEL,
  EDITED_AT_UNKNOWN,
  formatEditedAt,
  toSavedExtract,
  extractForSave,
  fileTooLargeMessage,
  mimeTypeFor,
  normalizeProvider,
  savedExtractState,
  UNPINNED_TEXT,
  VALUES_DROPPED_NOTE,
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
import { flagsForResult, flagsForSaved } from "./extract-flags.ts";
import { buildCardFromPds } from "./on-device-extract.ts";
import { parseSavedExtract } from "./job-extract.ts";
import { onDeviceProvider } from "./extract/on-device-provider.ts";
import { checkRequest } from "./extract/extract-core.ts";
import type { ExtractInput } from "./extract/provider.ts";
import { SAMPLE_PDS_TEXT } from "./samples.ts";

const sampleText = Object.values(SAMPLE_PDS_TEXT).find((t) => t && t.length > 200) ?? "";
const card = buildCardFromPds(sampleText);

type Over = Partial<Omit<ExtractResult, "warnings">> & {
  warnings?: { code: string; message: string }[];
};
function result(over: Over = {}): ExtractResult {
  const base = {
    card,
    provenance: {
      "product.name": { page: 1, quote: "Carbomastic 615" },
      "environmentals.windMaxMph": "not-stated",
    },
    provider: "azure",
    warnings: [],
    ...over,
  } as ExtractResult;
  return base;
}
/** Contract shape (CONTRACT.md on #24): flat { ok, card, provenance, provider, deployment?, warnings, draft?, unverifiedTemps? }. */
const ok = (over: Over = {}): Record<string, unknown> => ({ ok: true, ...result(over) });
const fail = (code: string, retryAfterSec?: number): ExtractSheetResponse => ({
  ok: false,
  error: { code, message: "x", ...(retryAfterSec ? { retryAfterSec } : {}) },
});
const onDevice = (input: ExtractInput) => onDeviceProvider.extract(input);
const throwing = async (): Promise<never> => {
  throw new Error("Could not read this sheet.");
};

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
    onDevice,
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
      assert.deepEqual(mapServerResponse(fail(code)), { ok: false, code, message: "x" });
    });
  }
  it("unknown code or junk is EXTRACT_FAILED; retryAfterSec carried", () => {
    assert.deepEqual(mapServerResponse(fail("NOPE")), {
      ok: false,
      code: "EXTRACT_FAILED",
      message: "x",
    });
    assert.deepEqual(mapServerResponse(null), { ok: false, code: "EXTRACT_FAILED" });
    assert.deepEqual(mapServerResponse(fail("RATE_LIMITED", 42)), {
      ok: false,
      code: "RATE_LIMITED",
      message: "x",
      retryAfterSec: 42,
    });
  });
  it("accepts a documented success, ignores string warnings, rejects bad provenance", () => {
    assert.equal(mapServerResponse(ok()).ok, true);
    const strWarn = mapServerResponse({ ...ok(), warnings: ["AZURE_FALLBACK: x"] });
    assert.equal(strWarn.ok && strWarn.result.warnings.length, 0);
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
    assert.equal(precheckFile({ ...pdf, size: MAX_UPLOAD_BYTES + 1 }), "FILE_TOO_LARGE");
    assert.equal(precheckFile({ ...pdf, size: MAX_UPLOAD_BYTES }), null);
    // getExtractLimits() lower than the ceiling wins; higher never lifts the 10 MB ceiling.
    assert.equal(precheckFile({ ...pdf, size: 4_000_001 }, 4_000_000), "FILE_TOO_LARGE");
    assert.equal(
      precheckFile({ ...pdf, size: MAX_UPLOAD_BYTES + 1 }, 50 * 1024 * 1024),
      "FILE_TOO_LARGE",
    );
  });
  it("unsupported type and oversize never call the server", async () => {
    const a = upload({ name: "a.xlsx", size: 1 }, ok());
    const s = await a.p;
    assert.equal(s.kind === "error" && s.issue, "UNSUPPORTED_FILE_TYPE");
    assert.match(
      s.kind === "error" ? s.message : "",
      /PDF, photo or scan \(PNG, JPG, TIFF\), or Word \(\.docx\)/,
    );
    const b = upload({ ...pdf, size: MAX_UPLOAD_BYTES + 1 }, ok());
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
    const s = await upload(pdf, fail("EXTRACT_FAILED"), { onDevice: throwing }).p;
    assert.equal(s.kind, "error");
    assert.equal(done(await extractPasted(sampleText, onDevice)).source, "on-device");
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
          warnings: [
            { code: "OTHER" as never, message: "IMAGE_ONLY_NEEDS_AZURE scanned, needs Azure" },
          ],
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
            { code: "X" as never, message: "Check the mix ratio." },
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

describe("LEAD rulings: provider, pages, new warnings, reopen", () => {
  it("provider normalizes; azure:<x> is tolerated; deployment is display-only", async () => {
    assert.deepEqual(normalizeProvider("azure"), { provider: "azure" });
    assert.deepEqual(normalizeProvider("azure", "gpt4o-prod"), {
      provider: "azure",
      deployment: "gpt4o-prod",
    });
    assert.deepEqual(normalizeProvider("azure:gpt4o"), { provider: "azure", deployment: "gpt4o" });
    assert.deepEqual(normalizeProvider("on-device"), { provider: "on-device" });
    assert.deepEqual(normalizeProvider("weird"), { provider: "on-device" });
    const s = done(await upload(pdf, ok({ provider: "azure:gpt4o" as never })).p);
    assert.equal(s.result.provider, "azure");
    assert.equal(providerLabel(s), "Azure reader (gpt4o).");
  });
  it("PDF sends per-page text; dropped with text over 40k; never for images", async () => {
    const pages = ["page one text", "", "page three"];
    const a = upload(pdf, ok(), { pages });
    await a.p;
    assert.deepEqual(a.seen[0]!.pages, pages);
    const long = "x".repeat(40_001);
    const b = upload(pdf, ok(), { text: long, pages: [long] });
    await b.p;
    assert.equal("text" in b.seen[0]!, false);
    assert.equal("pages" in b.seen[0]!, false);
    const c = upload(png, ok(), { pages });
    await c.p;
    assert.equal("pages" in c.seen[0]!, false);
  });
  it("VALUES_DROPPED_UNQUOTED shows our note; ON_DEVICE_UNPINNED quote '' shows the no-exact-line text", () => {
    const r = result({
      provider: "on-device",
      provenance: { "mixing.ratio": { quote: "" }, "product.name": { page: 1, quote: "X" } },
      warnings: [
        { code: "VALUES_DROPPED_UNQUOTED", message: "server prose" },
        { code: "ON_DEVICE_UNPINNED", message: "server prose 2" },
      ],
    });
    assert.deepEqual(displayWarnings(r), [VALUES_DROPPED_NOTE]);
    assert.equal(provenanceRows(r.provenance)[0]?.text, UNPINNED_TEXT);
    assert.equal(UNPINNED_TEXT, "Found on the sheet, no exact line.");
  });
  it("unknown or malformed warnings never crash; unknown messages show plainly", () => {
    const out = mapServerResponse({
      ...ok(),
      warnings: [
        { code: "NEW_THING", message: "Heads up." },
        { code: 5 },
        null,
        "str",
        { code: "NO_MSG" },
      ],
    });
    assert.equal(out.ok, true);
    if (!out.ok) return;
    assert.deepEqual(displayWarnings(out.result), ["Heads up."]);
  });
  it("prepGates dot-index paths get readable labels", () => {
    const rows = provenanceRows({ "surfacePrep.prepGates.0.profile": { quote: "2-3 mils" } });
    assert.equal(rows[0]?.label, "Surface Prep › Prep Gates › #1 › Profile");
  });
  it("reopen shows saved provenance + provider; nothing saved = idle", () => {
    const extract = {
      provider: "azure",
      deployment: "gpt4o",
      provenance: { "product.name": { page: 2, quote: "Carbomastic 615" } },
      warnings: [{ code: "VALUES_DROPPED_UNQUOTED", message: "m" }],
      extractedAt: "2026-10-18T19:00:00Z",
      draft: false,
      unverifiedTemps: false,
    };
    const d = done(savedExtractState({ card, extract }));
    assert.equal(d.source, "saved");
    assert.equal(providerLabel(d), "Azure reader (gpt4o).");
    assert.equal(provenanceRows(d.result.provenance)[0]?.text, "p. 2 — “Carbomastic 615”");
    assert.deepEqual(displayWarnings(d.result), [VALUES_DROPPED_NOTE]);
    // Reopened: omit `extract` on save so the server keeps it (CONTRACT keep/clear/replace).
    assert.equal(toSavedExtract(d), undefined);
    assert.deepEqual(d.saved, extract);
    assert.deepEqual(savedExtractState({ card }), { kind: "idle" });
    assert.deepEqual(savedExtractState({ card: null, extract }), { kind: "idle" });
    assert.deepEqual(
      savedExtractState({ card, extract: { ...extract, provenance: { a: { quote: 1 } } } }),
      { kind: "idle" },
    );
  });
  it("flat response: save uses #24's toSavedExtract; flags read top-level, missing = false", async () => {
    const s = done(await upload(pdf, ok({ deployment: "gpt4o", draft: true })).p);
    const saved = toSavedExtract(s)!;
    assert.equal(saved.provider, "azure");
    assert.equal(saved.deployment, "gpt4o");
    assert.equal(saved.draft, true);
    assert.equal(saved.unverifiedTemps, false);
    assert.ok(!Number.isNaN(Date.parse(saved.extractedAt)));
    assert.deepEqual(flagsForResult(s.result), { draft: true, unverifiedTemps: false });
    assert.deepEqual(flagsForResult(done(await upload(pdf, ok()).p).result), {
      draft: false,
      unverifiedTemps: false,
    });
  });
  it("reopen: flags from extract.draft/.unverifiedTemps; saved extract kept (not re-sent)", () => {
    const extract = {
      provider: "on-device",
      provenance: { "product.name": { quote: "X" } },
      warnings: [],
      extractedAt: "2026-10-18T18:00:00Z",
      draft: true,
      unverifiedTemps: true,
    };
    const d = done(savedExtractState({ card, extract }));
    assert.deepEqual(flagsForSaved({ extract: d.saved }), { draft: true, unverifiedTemps: true });
    assert.equal(d.saved!.extractedAt, "2026-10-18T18:00:00Z");
    assert.equal(toSavedExtract(d), undefined);
    const old = done(
      savedExtractState({
        card,
        extract: { ...extract, draft: undefined, unverifiedTemps: undefined },
      }),
    );
    // #32 rule: a non-Azure saved extract is always a draft; missing temps flag = false.
    assert.deepEqual(flagsForSaved({ extract: old.saved }), { draft: true, unverifiedTemps: false });
  });
  it("FILE_TOO_LARGE from the server shows its message verbatim", async () => {
    const msg = "This file is 6.1 MB. The limit on this deploy is 4 MB.";
    const s = await upload(png, {
      ok: false,
      error: { code: "FILE_TOO_LARGE", message: msg, maxUploadMb: 4 },
    }).p;
    assert.equal(s.kind === "error" && s.message, msg);
  });
  it("on-device paths go through onDeviceProvider (provenance + warnings)", async () => {
    const s = done(await upload(pdf, fail("EXTRACT_FAILED"), { pages: [sampleText] }).p);
    assert.equal(s.result.provider, "on-device");
    assert.ok(Object.keys(s.result.provenance).length > 0);
  });
});

describe("hand-edited fields", () => {
  it("server-stamped edit renders 'Edited by [user], [time]'", () => {
    const rows = provenanceRows({
      "product.name": { edited: { by: "Isaiah Chester", at: "2026-10-18T19:30:00Z" } },
    });
    assert.equal(rows[0]?.edited, true);
    assert.match(rows[0]!.text, /^Edited by Isaiah Chester, Oct 18, 2026/);
  });
  it("saved extract with a stamped edit still reopens", () => {
    const d = done(
      savedExtractState({
        card,
        extract: {
          provider: "azure",
          provenance: {
            "product.name": {
              edited: { by: "Isaiah Chester", at: "2026-10-18T19:30:00Z" },
              sheetQuote: { page: 1, quote: "X" },
            },
          },
          warnings: [],
          extractedAt: "2026-10-18T19:00:00Z",
          draft: false,
          unverifiedTemps: false,
        },
      }),
    );
    assert.match(provenanceRows(d.result.provenance)[0]!.text, /^Edited by Isaiah Chester/);
    // Never re-sent from the browser: the server keeps the stored stamps.
    assert.equal(toSavedExtract(d), undefined);
  });
  it("stamp with sheetQuote: 'Edited by' line, original quote (with page) beneath", () => {
    const [row] = provenanceRows({
      "environmentals.ambientTempMinF": {
        edited: { by: "Isaiah Chester", at: "2026-10-18T19:30:00Z" },
        sheetQuote: { page: 2, quote: "Minimum 50°F" },
      },
    });
    assert.equal(row!.edited, true);
    assert.equal(row!.stated, true);
    assert.match(row!.text, /^Edited by Isaiah Chester, Oct 18, 2026, \d{1,2}:30 [AP]M/);
    assert.doesNotMatch(row!.text, /Minimum 50/);
    assert.equal(row!.sheetQuote, "p. 2 — “Minimum 50°F”");
    assert.equal(SHEET_QUOTE_LABEL, "Original sheet quote (before the edit)");
  });
  it("stamp without sheetQuote: 'Edited by' only, no quote line; email fallback renders as given", () => {
    const [row] = provenanceRows({
      "product.name": { edited: { by: "isaiah@example.com", at: "2026-10-18T19:30:00.000Z" } },
    });
    assert.match(row!.text, /^Edited by isaiah@example\.com, Oct 18, 2026/);
    assert.equal(row!.sheetQuote, undefined);
    const [noPage] = provenanceRows({
      a: { edited: { by: "I", at: "2026-10-18T19:30:00Z" }, sheetQuote: { quote: "Q" } },
    });
    assert.equal(noPage!.sheetQuote, "“Q”");
  });
  it("invalid or missing `at` (and missing `by`) never crash; the stamp still shows", () => {
    for (const edited of [
      { by: "Isaiah Chester", at: "not a date" },
      { by: "Isaiah Chester" },
      { by: "Isaiah Chester", at: 12345 },
      { at: "2026-10-18T19:30:00Z" },
    ]) {
      const s = mapServerResponse(ok({ provenance: { "product.name": { edited } } as never }));
      assert.equal(s.ok, true, JSON.stringify(edited));
      const rows = provenanceRows(s.ok ? s.result.provenance : {});
      assert.match(rows[0]!.text, /^Edited by /);
    }
    assert.equal(
      describeProvenance({ edited: { by: "I", at: "nope" } }),
      `Edited by I, ${EDITED_AT_UNKNOWN}`,
    );
    assert.equal(formatEditedAt(undefined), EDITED_AT_UNKNOWN);
    assert.equal(formatEditedAt(""), EDITED_AT_UNKNOWN);
    const reopened = done(
      savedExtractState({
        card,
        extract: {
          provider: "azure",
          provenance: { "product.name": { edited: { by: "I" } } },
          warnings: [],
          extractedAt: "2026-10-18T19:00:00Z",
        },
      }),
    );
    assert.equal(
      provenanceRows(reopened.result.provenance)[0]!.text,
      `Edited by I, ${EDITED_AT_UNKNOWN}`,
    );
  });
  it("a session change over an old stamp shows only the session text (no stale stamp or quote)", () => {
    const prov = {
      "product.name": {
        edited: { by: "Isaiah Chester", at: "2026-10-18T19:30:00Z" },
        sheetQuote: { page: 1, quote: "Carbomastic 615" },
      },
    };
    const now = { ...card, product: { ...card.product, name: "Typed again" } };
    const [row] = provenanceRows(prov, { current: now, asRead: card });
    assert.equal(row!.text, SESSION_EDIT_TEXT);
    assert.equal(row!.sheetQuote, undefined);
  });
  it("browser-side save never includes `edited`, even if a fresh response carried one", async () => {
    const s = done(
      await upload(
        pdf,
        ok({
          provenance: {
            "product.name": {
              edited: { by: "x", at: "2026-10-18T19:30:00Z" },
              sheetQuote: { page: 1, quote: "Carbomastic 615" },
            },
            "environmentals.windMaxMph": { edited: { by: "x", at: "2026-10-18T19:30:00Z" } },
          } as never,
        }),
      ).p,
    );
    const saved = toSavedExtract(s)!;
    assert.doesNotMatch(JSON.stringify(saved), /edited/);
    assert.deepEqual(saved.provenance["product.name"], { page: 1, quote: "Carbomastic 615" });
    assert.equal(saved.provenance["environmentals.windMaxMph"], "not-stated");
    // What the browser sends must pass the server's own validator (#26 parseSavedExtract).
    assert.ok(parseSavedExtract(saved));
  });
  it("no stamp yet: a field changed this session reads the session text; unchanged keep the quote", () => {
    const prov = result().provenance;
    const edited = { ...card, product: { ...card.product, name: "Hand typed" } };
    const rows = provenanceRows(prov, { current: edited, asRead: card });
    const name = rows.find((r) => r.fieldPath === "product.name")!;
    assert.equal(name.text, SESSION_EDIT_TEXT);
    assert.equal(name.edited, true);
    assert.equal(SESSION_EDIT_TEXT, "Edited in this session — not from the sheet");
    const wind = rows.find((r) => r.fieldPath === "environmentals.windMaxMph")!;
    assert.equal(wind.text, "Not stated");
    assert.equal(wind.edited, false);
  });
  it("session edits never write a user/time into the saved extract", async () => {
    const s = done(await upload(pdf, ok()).p);
    const before = JSON.stringify(toSavedExtract(s));
    provenanceRows(s.result.provenance, { current: { ...card, product: {} }, asRead: card });
    assert.equal(JSON.stringify(toSavedExtract(s)), before);
    assert.doesNotMatch(before, /edited/);
  });
});

describe("save payload: extract keep / clear / replace (LEAD blocker 1)", () => {
  const savedRecord = {
    provider: "azure",
    provenance: {
      "product.name": {
        edited: { by: "Isaiah Chester", at: "2026-10-18T19:30:00Z" },
        sheetQuote: { page: 1, quote: "X" },
      },
    },
    warnings: [],
    extractedAt: "2026-10-18T19:00:00Z",
    draft: false,
    unverifiedTemps: false,
  };
  it("idle → omitted (not null)", () => {
    assert.equal(extractForSave({ kind: "idle" }), undefined);
  });
  it("still reading → omitted", () => {
    assert.equal(extractForSave({ kind: "loading" }), undefined);
  });
  it("failed read (old card still on screen) → omitted, stored quotes and stamps kept", async () => {
    const s = await upload(png, fail("UNSUPPORTED_FILE_TYPE")).p;
    assert.equal(s.kind, "error");
    assert.equal(extractForSave(s), undefined);
    assert.equal(extractForSave({ kind: "unauthenticated" }), undefined);
  });
  it("unparseable saved extract reopens idle → omitted", () => {
    const s = savedExtractState({ card, extract: { provider: "nope", provenance: 7 } });
    assert.deepEqual(s, { kind: "idle" });
    assert.equal(extractForSave(s), undefined);
  });
  it("reopened job with no new read → omitted", () => {
    const d = done(savedExtractState({ card, extract: savedRecord }));
    assert.equal(extractForSave(d), undefined);
  });
  it("fresh successful read → the object once, with `edited` stripped; omitted once stored", async () => {
    const s = done(
      await upload(
        pdf,
        ok({
          provenance: {
            "product.name": {
              edited: { by: "x", at: "2026-10-18T19:30:00Z" },
              sheetQuote: { quote: "Q" },
            },
          } as unknown as ExtractResult["provenance"],
        }),
      ).p,
    );
    const out = extractForSave(s);
    assert.ok(out && typeof out === "object");
    assert.ok(!JSON.stringify(out).includes('"edited"'));
    assert.equal(extractForSave(s, { alreadyStored: true }), undefined);
  });
  it("explicit new card or sample (no read) → null, only then", () => {
    assert.equal(extractForSave({ kind: "idle" }, { cardReplaced: true }), null);
    // A fresh read after the replacement wins over the pending clear.
    const d = done(savedExtractState({ card, extract: savedRecord }));
    assert.equal(extractForSave(d, { cardReplaced: true }), undefined);
  });
});

describe("FILE_TOO_LARGE caught in the browser (LEAD blocker 2)", () => {
  it("uses the server's limit message, same text as extract-core", async () => {
    const limit = 3 * 1024 * 1024;
    const s = await upload({ ...pdf, size: limit + 1 }, ok(), { maxUploadBytes: limit }).p;
    assert.equal(s.kind, "error");
    assert.equal(
      s.kind === "error" && s.message,
      "File is over 3 MB, the upload limit on this copy.",
    );
    const server = checkRequest(
      { fileBase64: "A".repeat(limit * 2), mimeType: "application/pdf", fileName: "a.pdf" },
      limit,
    );
    assert.ok(!server.ok);
    assert.equal(!server.ok && server.message, fileTooLargeMessage(limit));
  });
  it("unknown limit falls back to the 10 MB ceiling copy", () => {
    assert.equal(fileTooLargeMessage(), "File is over 10 MB, the upload limit on this copy.");
  });
});

describe("signed read (CONTRACT 'Signed extract read')", () => {
  const serverRead = Object.freeze({
    id: "read-123",
    sig: "c2lnLW9wYXF1ZQ",
    fields: Object.freeze({ "product.name": "Zm9v", "installation.filmThickness": "YmFy" }),
  });
  it("fresh-read save sends serverRead back untouched (same object); only `edited` is stripped", async () => {
    const before = JSON.stringify(serverRead);
    const s = done(
      await upload(
        pdf,
        ok({
          serverRead,
          provenance: {
            "product.name": {
              edited: { by: "x", at: "2026-10-18T19:30:00Z" },
              sheetQuote: { quote: "Q" },
            },
          } as unknown as ExtractResult["provenance"],
        } as Over),
      ).p,
    );
    const out = extractForSave(s);
    assert.ok(out && typeof out === "object");
    assert.equal(out.serverRead, serverRead);
    assert.equal(JSON.stringify(out.serverRead), before);
    assert.ok(!JSON.stringify(out.provenance).includes('"edited"'));
  });
  it("no serverRead from the server → none invented", async () => {
    const out = extractForSave(done(await upload(pdf, ok()).p));
    assert.ok(out && !("serverRead" in out));
  });
  it("on-device read never carries a serverRead", async () => {
    const s = done(await extractPasted(sampleText, onDevice));
    const out = extractForSave(s);
    assert.ok(out && !("serverRead" in out));
  });
  it("autosave without a fresh read omits `extract` (already stored, reopened, idle)", async () => {
    const s = done(await upload(pdf, ok({ serverRead } as Over)).p);
    assert.equal(extractForSave(s, { alreadyStored: true }), undefined);
    assert.equal(extractForSave({ kind: "idle" }), undefined);
    const reopened = savedExtractState({
      card,
      extract: {
        provider: "azure",
        provenance: {},
        warnings: [],
        extractedAt: "2026-10-18T19:00:00Z",
      },
    });
    assert.equal(extractForSave(reopened), undefined);
  });
});
