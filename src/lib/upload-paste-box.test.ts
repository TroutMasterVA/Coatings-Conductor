import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { pasteBoxAfterUpload } from "./upload-sheet.ts";

const SHEET = "MACROPOXY 646 FAST CURE EPOXY MASTIC … Material: 40°F";
const refused = { kind: "error" as const, message: "File is over 3 MB, the upload limit on this copy.", issue: "FILE_TOO_LARGE" as const };

describe("paste box after an upload (QA #55 D2)", () => {
  it("a refused oversize file does not fill an empty box (Build job card stays disabled)", () => {
    assert.equal(pasteBoxAfterUpload({ current: "", previousUploadText: null, pdfText: SHEET, state: refused }), "");
  });
  it("a failed upload clears text an earlier upload left in the box", () => {
    assert.equal(pasteBoxAfterUpload({ current: "OLD SHEET", previousUploadText: "OLD SHEET", pdfText: "", state: { kind: "error", message: "Nothing could be read" } }), "");
  });
  it("a failed upload keeps text the user typed or pasted", () => {
    assert.equal(pasteBoxAfterUpload({ current: "my own notes", previousUploadText: "OLD SHEET", pdfText: SHEET, state: refused }), "my own notes");
  });
  it("a finished read fills the box with the file's text", () => {
    assert.equal(pasteBoxAfterUpload({ current: "", previousUploadText: null, pdfText: SHEET, state: { kind: "done" } as never }), SHEET);
  });
  it("superseded (null) or sign-in needed: box untouched", () => {
    assert.equal(pasteBoxAfterUpload({ current: "x", previousUploadText: "x", pdfText: SHEET, state: null }), "x");
    assert.equal(pasteBoxAfterUpload({ current: "x", previousUploadText: "x", pdfText: SHEET, state: { kind: "unauthenticated" } }), "x");
  });
});

describe("processPick never fills the paste box for a refused PDF (QA #55 D2)", () => {
  it("the reader refuses: onText is not called with the file's text", async () => {
    const { processPick } = await import("./upload-sheet.ts");
    const texts: string[] = [];
    const file = new File([new TextEncoder().encode("%PDF-1.7 big sheet")], "big.pdf", { type: "application/pdf" });
    const end = await processPick(file, {
      setStatus: () => {},
      onText: (v) => texts.push(v),
      readPdf: async () => ({ pages: [SHEET.repeat(3)], text: SHEET.repeat(3) }),
      onUpload: async () => ({ ok: false, message: "File is over 3 MB, the upload limit on this copy." }),
    });
    assert.equal(end.kind, "failed");
    assert.deepEqual(texts, []);
  });
  it("no reader wired (onUpload returns nothing): the text still shows, as before", async () => {
    const { processPick } = await import("./upload-sheet.ts");
    const texts: string[] = [];
    const file = new File([new TextEncoder().encode("%PDF-1.7 sheet")], "s.pdf", { type: "application/pdf" });
    await processPick(file, {
      setStatus: () => {},
      onText: (v) => texts.push(v),
      readPdf: async () => ({ pages: [SHEET.repeat(3)], text: SHEET.repeat(3) }),
      onUpload: () => undefined,
    });
    assert.deepEqual(texts, [SHEET.repeat(3)]);
  });
});
