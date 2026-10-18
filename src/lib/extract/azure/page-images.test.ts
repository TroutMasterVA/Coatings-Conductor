import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { MAX_PAGES, pageImages, renderPdfPages } from "./page-images.ts";
import { FAKE_DOCX, FAKE_PNG, FAKE_TIFF } from "./__fixtures__/helpers.ts";

/** Minimal valid PDF with one line of Helvetica text per page. */
function makePdf(pages: string[]): Buffer {
  const objs: string[] = [];
  objs[1] = `<< /Type /Catalog /Pages 2 0 R >>`;
  objs[2] = `<< /Type /Pages /Kids [${pages.map((_, i) => `${4 + i * 2} 0 R`).join(" ")}] /Count ${pages.length} >>`;
  objs[3] = `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>`;
  pages.forEach((t, i) => {
    const content = `BT /F1 18 Tf 72 720 Td (${t}) Tj ET`;
    objs[4 + i * 2] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${5 + i * 2} 0 R >>`;
    objs[5 + i * 2] = `<< /Length ${content.length} >>\nstream\n${content}\nendstream`;
  });
  let out = "%PDF-1.4\n";
  const offs: number[] = [];
  for (let i = 1; i < objs.length; i++) {
    offs[i] = out.length;
    out += `${i} 0 obj\n${objs[i]}\nendobj\n`;
  }
  const xref = out.length;
  out += `xref\n0 ${objs.length}\n0000000000 65535 f \n`;
  for (let i = 1; i < objs.length; i++) out += `${String(offs[i]).padStart(10, "0")} 00000 n \n`;
  out += `trailer\n<< /Size ${objs.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, "latin1");
}

describe("page images", () => {
  it("renders PDF pages to PNG at ~150 dpi, capped at 12 pages", async () => {
    const pdf = makePdf(
      Array.from({ length: 14 }, (_, i) => `Page ${i + 1} Pot life 4 hours at 77 F`),
    );
    const imgs = await renderPdfPages(pdf);
    assert.equal(imgs.length, MAX_PAGES);
    assert.deepEqual(
      imgs.map((x) => x.page),
      Array.from({ length: 12 }, (_, i) => i + 1),
    );
    const png = Buffer.from(imgs[0]!.dataUrl.split(",")[1]!, "base64");
    assert.equal(png.subarray(1, 4).toString(), "PNG");
    assert.equal(png.readUInt32BE(16), Math.ceil((612 * 150) / 72)); // width 1275 px
  });

  it("passes photos through, sends nothing for TIFF or DOCX", async () => {
    assert.deepEqual(await pageImages(FAKE_PNG, "image/png"), [
      { page: 1, dataUrl: `data:image/png;base64,${FAKE_PNG}` },
    ]);
    assert.deepEqual(await pageImages(FAKE_TIFF, "image/tiff"), []);
    assert.deepEqual(
      await pageImages(
        FAKE_DOCX,
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ),
      [],
    );
  });
});
