import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { jsPDF } from "jspdf";
import { readPdfText } from "./server-read.ts";

function pdf(lines: [string, number, number][]): Uint8Array {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  doc.setFontSize(10);
  for (const [s, x, y] of lines) doc.text(s, x, y);
  return new Uint8Array(doc.output("arraybuffer"));
}

describe("server PDF read keeps line structure (same rebuild as the browser, pdf-lines.ts)", () => {
  it("one line per printed row, not one line per page", async () => {
    const bytes = pdf([
      ["Temperature:", 72, 100],
      ["Air: 35°F minimum, 120°F maximum", 72, 114],
      ["Relative humidity: 85% maximum", 72, 128],
    ]);
    const r = await readPdfText(bytes);
    assert.deepEqual(r.pages, ["Temperature:\nAir: 35°F minimum, 120°F maximum\nRelative humidity: 85% maximum"]);
    assert.equal(r.text, r.pages![0]);
  });

  it("pages stay separate and are joined by a blank line", async () => {
    const doc = new jsPDF({ unit: "pt", format: "letter" });
    doc.text("Page one line", 72, 100);
    doc.addPage();
    doc.text("Page two line", 72, 100);
    const r = await readPdfText(new Uint8Array(doc.output("arraybuffer")));
    assert.deepEqual(r.pages, ["Page one line", "Page two line"]);
    assert.equal(r.text, "Page one line\n\nPage two line");
  });
});
