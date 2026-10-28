import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { UploadStatusLine } from "./pds-intake.tsx";
import {
  classifyPick,
  NOT_SUPPORTED_MESSAGE,
  processPick,
  takePickedFile,
  uploadOutcome,
  type PickDeps,
  type UploadStatus,
} from "../lib/upload-sheet.ts";
import { extractUpload, GUEST_NEEDS_SIGN_IN, isPdf } from "../lib/extract-client.ts";
import { onDeviceProvider } from "../lib/extract/on-device-provider.ts";

const SHEET_TEXT = [
  "Duracoat 77X Product Data Sheet. Duracoat 77X is a satin topcoat.",
  "Application conditions: air and surface temperature 50°F to 110°F, relative humidity 85% maximum,",
  "surface at least 5°F above dew point. Pot life 4 hours at 77°F. Recoat minimum 4 hours at 77°F.",
].join(" ");
const PDF_BYTES = new TextEncoder().encode(`%PDF-1.7\n${SHEET_TEXT}\n%%EOF`);
const pdf = (name: string, type: string) => new File([PDF_BYTES], name, { type });

function harness(over: Partial<PickDeps> = {}) {
  const seen: UploadStatus[] = [];
  const uploads: Array<{ name: string; type: string; text: string }> = [];
  const deps: PickDeps = {
    setStatus: (s) => seen.push(s),
    onText: () => {},
    readPdf: async () => ({ pages: [SHEET_TEXT], text: SHEET_TEXT }),
    onUpload: async (f, text) => {
      uploads.push({ name: f.name, type: f.type, text });
      return { ok: true };
    },
    ...over,
  };
  return { deps, seen, uploads };
}

describe("upload sheet: change handler", () => {
  it("a picked PDF goes Uploading → Loaded and reaches the reader", async () => {
    const h = harness();
    const end = await processPick(pdf("carbozinc11.pdf", "application/pdf"), h.deps);
    assert.deepEqual(h.seen.map((s) => s.kind), ["uploading", "loaded"]);
    assert.equal(end.kind, "loaded");
    assert.equal(h.uploads.length, 1);
    assert.equal(h.uploads[0]!.text, SHEET_TEXT);
  });

  it("the same file picked twice is read twice (input value reset after each pick)", async () => {
    const h = harness();
    const file = pdf("carbozinc11.pdf", "application/pdf");
    const input = { files: [file] as ArrayLike<File>, value: "C:\\fakepath\\carbozinc11.pdf" };
    await processPick(takePickedFile(input), h.deps);
    assert.equal(input.value, "", "value cleared so the browser fires change for the same file");
    input.value = "C:\\fakepath\\carbozinc11.pdf";
    await processPick(takePickedFile(input), h.deps);
    assert.equal(input.value, "");
    assert.equal(h.uploads.length, 2);
    assert.deepEqual(h.seen.map((s) => s.kind), ["uploading", "loaded", "uploading", "loaded"]);
  });

  it("no file (picker cancelled) leaves no stuck spinner", async () => {
    const h = harness();
    assert.equal((await processPick(undefined, h.deps)).kind, "idle");
    assert.equal(h.uploads.length, 0);
  });
});

describe("upload sheet: PDF acceptance without relying on file.type", () => {
  it("empty MIME with a .pdf name is a PDF", async () => {
    assert.equal(await classifyPick(pdf("sheet.PDF", "")), "pdf");
    const h = harness();
    assert.equal((await processPick(pdf("sheet.pdf", ""), h.deps)).kind, "loaded");
    assert.equal(h.uploads[0]!.type, "application/pdf");
  });

  it("octet-stream with no extension is accepted by its %PDF magic bytes", async () => {
    assert.equal(await classifyPick(pdf("document", "application/octet-stream")), "pdf");
    const h = harness();
    assert.equal((await processPick(pdf("document", "application/octet-stream"), h.deps)).kind, "loaded");
    assert.equal(h.uploads[0]!.name, "document.pdf");
    assert.equal(isPdf(h.uploads[0]!), true, "downstream reader sees a PDF");
  });

  it("a non-PDF is rejected with a visible Failed message", async () => {
    const h = harness();
    const junk = new File([new TextEncoder().encode("GIF89a not a sheet")], "photo.gif", { type: "image/gif" });
    const end = await processPick(junk, h.deps);
    assert.equal(end.kind, "failed");
    assert.equal(h.uploads.length, 0);
    const html = renderToStaticMarkup(<UploadStatusLine status={end} />);
    assert.match(html, /role="alert"/);
    assert.ok(html.includes(`Failed: ${NOT_SUPPORTED_MESSAGE}`));
  });

  it("an empty file fails visibly", async () => {
    const end = await processPick(new File([], "sheet.pdf", { type: "application/pdf" }), harness().deps);
    assert.equal(end.kind, "failed");
  });
});

describe("upload sheet: never silent", () => {
  it("a hung on-device PDF read times out and still ends in a state", async () => {
    const h = harness({ readPdf: () => new Promise(() => {}), timeoutMs: 20 });
    const end = await processPick(pdf("sheet.pdf", "application/pdf"), h.deps);
    assert.equal(end.kind, "loaded");
    assert.equal(h.uploads.length, 1, "the reader still gets the file");
  });

  it("a reader that throws shows Failed with a reason", async () => {
    const h = harness({ onUpload: async () => { throw new Error("network down"); } });
    const end = await processPick(pdf("sheet.pdf", "application/pdf"), h.deps);
    assert.equal(end.kind, "failed");
    assert.match(statusOf(end), /^Failed: Couldn’t read sheet\.pdf: network down/);
  });

  it("a reader error is shown as Failed", async () => {
    const h = harness({ onUpload: async () => ({ ok: false, message: "The server reader couldn’t read this sheet." }) });
    const end = await processPick(pdf("sheet.pdf", "application/pdf"), h.deps);
    assert.equal(end.kind, "failed");
  });

  it("renders Uploading with a spinner and Loaded with the file name", () => {
    const up = renderToStaticMarkup(<UploadStatusLine status={{ kind: "uploading", name: "a.pdf" }} />);
    assert.match(up, /Uploading a\.pdf…/);
    assert.match(up, /animate-spin/);
    const ok = renderToStaticMarkup(<UploadStatusLine status={{ kind: "loaded", name: "a.pdf", chars: 1200 }} />);
    assert.match(ok, /Loaded a\.pdf \(1,200 characters\)\./);
  });
});

function statusOf(s: UploadStatus): string {
  return renderToStaticMarkup(<UploadStatusLine status={s} />).replace(/<[^>]+>/g, "");
}

describe("upload sheet: guest on a brand-new project", () => {
  // Guest = signedIn false, no server, no project id yet: the PDF is read on the device.
  const guestReader = (signedIn: boolean) => async (file: File, text: string, pages?: string[]) =>
    uploadOutcome(
      await extractUpload({
        file, text, pages, signedIn,
        onDevice: (input) => onDeviceProvider.extract(input),
        readBase64: async () => { throw new Error("guest must not read for the server"); },
        server: async () => { throw new Error("guest must not call the server"); },
      }),
      signedIn,
    );

  it("a guest PDF upload loads on-device with no server call", async () => {
    const h = harness({ onUpload: guestReader(false) });
    const end = await processPick(pdf("carbozinc11.pdf", ""), h.deps);
    assert.equal(end.kind, "loaded");
  });

  it("a guest PDF with octet-stream and no extension still loads", async () => {
    const h = harness({ onUpload: guestReader(false) });
    assert.equal((await processPick(pdf("IMG_0042", "application/octet-stream"), h.deps)).kind, "loaded");
  });

  it("a guest photo shows Failed with a Sign in button instead of nothing", async () => {
    const h = harness({ onUpload: guestReader(false) });
    const photo = new File([new Uint8Array([0xff, 0xd8, 0xff, 1, 2, 3])], "scan.jpg", { type: "image/jpeg" });
    const end = await processPick(photo, h.deps);
    assert.equal(end.kind, "failed");
    assert.equal(end.kind === "failed" && end.message, GUEST_NEEDS_SIGN_IN);
    const html = renderToStaticMarkup(<UploadStatusLine status={end} onSignIn={() => {}} />);
    assert.match(html, /Sign in to upload/);
  });

  it("signed-in session that expired shows Failed with sign-in", () => {
    assert.deepEqual(uploadOutcome({ kind: "unauthenticated" }, true).ok, false);
  });
});
