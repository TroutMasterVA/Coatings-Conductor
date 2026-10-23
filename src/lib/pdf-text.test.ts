import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { flatPageText, readLoadedPdf, readPagesThenDestroy, type PdfDocLike } from "./pdf-text.ts";

function stubDoc(numPages: number, failOn?: number) {
  const log = { destroyed: 0, cleaned: [] as number[], read: [] as number[] };
  const doc: PdfDocLike = {
    numPages,
    async getPage(n) {
      return {
        async getTextContent() {
          if (n === failOn) throw new Error(`page ${n} broke`);
          log.read.push(n);
          return { items: [{ str: `p${n}` }, { str: " text " }, { hasEOL: true }] };
        },
        cleanup() {
          log.cleaned.push(n);
        },
      };
    },
    async destroy() {
      log.destroyed += 1;
    },
  };
  return { doc, log };
}

describe("readPagesThenDestroy (pdf.js leak)", () => {
  it("destroys the document and cleans every page after a good read", async () => {
    const { doc, log } = stubDoc(3);
    const pages = await readPagesThenDestroy(doc);
    assert.deepEqual(pages.map((p) => p.page), [1, 2, 3]);
    assert.equal(log.destroyed, 1);
    assert.deepEqual(log.cleaned, [1, 2, 3]);
  });

  it("still destroys the document when getTextContent throws", async () => {
    const { doc, log } = stubDoc(3, 2);
    await assert.rejects(readPagesThenDestroy(doc), /page 2 broke/);
    assert.equal(log.destroyed, 1);
    assert.deepEqual(log.cleaned, [1, 2]);
  });

  it("reads at most 12 pages and still destroys", async () => {
    const { doc, log } = stubDoc(30);
    const pages = await readPagesThenDestroy(doc);
    assert.equal(pages.length, 12);
    assert.equal(log.destroyed, 1);
  });

  it("two reads in a row leave nothing alive", async () => {
    const a = stubDoc(2);
    const b = stubDoc(2);
    await readPagesThenDestroy(a.doc);
    await readPagesThenDestroy(b.doc);
    assert.equal(a.log.destroyed + b.log.destroyed, 2);
  });
});

describe("flatPageText", () => {
  it("joins item strings with spaces and collapses whitespace", () => {
    assert.equal(flatPageText([{ str: "Air" }, { str: " 50-120°F  " }, { hasEOL: true }, { str: "\nDew" }]), "Air 50-120°F Dew");
    assert.equal(flatPageText([]), "");
  });
  it("is what readPagesThenDestroy returns per page", async () => {
    const { doc } = stubDoc(2);
    assert.deepEqual(await readPagesThenDestroy(doc), [
      { page: 1, text: "p1 text" },
      { page: 2, text: "p2 text" },
    ]);
  });
});

describe("readLoadedPdf (real pdf.js, no AI config)", () => {
  it("returns the text layer of a real PDF and frees the loading task", async () => {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const data = new Uint8Array(readFileSync(new URL("../../tests/fixtures/extract/text-layer.pdf", import.meta.url)));
    const task = pdfjs.getDocument({ data, disableFontFace: true, verbosity: 0 });
    let destroyed = 0;
    const realDestroy = task.destroy.bind(task);
    const pages = await readLoadedPdf({ promise: task.promise, destroy: () => ((destroyed += 1), realDestroy()) });
    assert.ok(pages.length >= 1);
    assert.ok(pages.map((p) => p.text).join(" ").trim().length > 0, "text layer must not come back empty");
    assert.equal(destroyed, 1);
  });
});
