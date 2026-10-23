import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import {
  fromPdfJsItems,
  groupRows,
  joinPages,
  pageLines,
  pageText,
  rowText,
  type PositionedItem,
} from "./pdf-lines.ts";

/** Synthetic item: ~0.5 pt per character at 10 pt. */
function item(str: string, x: number, y: number, h = 10): PositionedItem {
  return { str, x, y, width: str.length * 5, height: h };
}

function fixture(name: string): PositionedItem[] {
  return JSON.parse(
    readFileSync(new URL(`./fixtures/pdf-items/${name}.json`, import.meta.url), "utf8"),
  );
}

const maxLen = (lines: string[]) => Math.max(...lines.map((l) => l.length));

describe("rows and spacing", () => {
  it("groups by baseline, sorts by x, and keeps one line per row", () => {
    const rows = groupRows([
      item("ratio:", 60, 700.4),
      item("Mix", 40, 700),
      item("Pot life: 4 h", 40, 686),
    ]);
    assert.equal(rows.length, 2);
    assert.equal(rowText(rows[0]!.items), "Mix ratio:");
    assert.equal(
      pageText([item("Mix", 40, 700), item("ratio:", 60, 700), item("Pot life: 4 h", 40, 686)]),
      "Mix ratio:\nPot life: 4 h",
    );
  });
  it("adds a space only where the x gap warrants it", () => {
    // "Recoat" split into two items with no gap must not gain a space.
    assert.equal(
      rowText([item("Reco", 0, 0), item("at", 20, 0), item("4 h", 40, 0)]),
      "Recoat 4 h",
    );
  });
  it("superscripts join their line", () => {
    const t = pageText([
      item("(m", 0, 100),
      { str: "2", x: 10, y: 103, width: 3, height: 6 },
      item("/L)", 13, 100),
    ]);
    assert.equal(t, "(m2/L)");
  });
  it("drops duplicate copies drawn at the same spot", () => {
    const t = pageText([
      item("Published data", 0, 0),
      item("Published data", 0.2, 0.1),
      item("Published data", 0, 0),
    ]);
    assert.equal(t, "Published data");
  });
  it("never collapses newlines; pages join with a blank line", () => {
    assert.equal(
      joinPages([
        { page: 1, text: "a\nb" },
        { page: 2, text: "" },
        { page: 3, text: "c" },
      ]),
      "a\nb\n\nc",
    );
  });
});

describe("columns", () => {
  const left = [
    "Finish: Semi-Gloss on most colors",
    "Mix Ratio: 1:1 by volume always",
    "Volume Solids: 72% by volume mixed",
    "Shelf Life: 36 months when unopened",
  ];
  const right = [
    "Touch: 4-5 hours at seventy degrees",
    "Handle: 48 hours at seventy degrees",
    "Recoat minimum: 48 hours at seventy",
    "Pot Life: 10 hours at seventy degrees",
  ];
  const twoCol = left.flatMap((l, i) => [
    item(l, 40, 700 - i * 12),
    item(right[i]!, 320, 700 - i * 12),
  ]);

  it("two-column page: left column in full, then right; nothing interleaves", () => {
    const lines = pageLines(twoCol);
    assert.deepEqual(lines, [...left, ...right]);
  });
  it("full-width rows above and below stay in place", () => {
    const lines = pageLines([
      item("PRODUCT DATA SHEET — full-width heading that spans the gutter of the page", 40, 720),
      ...twoCol,
      item("SURFACE PREPARATION must be clean, dry, and sound across the full page width", 40, 640),
    ]);
    assert.equal(lines[0]?.startsWith("PRODUCT DATA SHEET"), true);
    assert.deepEqual(lines.slice(1, 9), [...left, ...right]);
    assert.equal(lines[9]?.startsWith("SURFACE PREPARATION"), true);
  });
  it("label/value table keeps each label with its value", () => {
    const rows = [
      ["Mix Ratio:", "6:1 by volume"],
      ["Pot Life:", "4 hours"],
      ["Volume Solids:", "57% ± 3%"],
      ["Flash Point:", "34°C (93°F)"],
    ];
    const lines = pageLines(
      rows.flatMap(([l, v], i) => [item(l!, 40, 700 - i * 12), item(v!, 260, 700 - i * 12)]),
    );
    assert.deepEqual(lines, [
      "Mix Ratio: 6:1 by volume",
      "Pot Life: 4 hours",
      "Volume Solids: 57% ± 3%",
      "Flash Point: 34°C (93°F)",
    ]);
  });
  it("temperature table keeps each row together", () => {
    const rows = [
      ["-5°C (23°F) 8 hours 60 hours", "60 hours Extended"],
      ["5°C (41°F) 5 hours 24 hours", "24 hours Extended"],
      ["15°C (59°F) 150 minutes 10 hours", "10 hours Extended"],
      ["25°C (77°F) 90 minutes 6 hours", "6 hours Extended"],
    ];
    const lines = pageLines(
      rows.flatMap(([l, v], i) => [item(l!, 40, 700 - i * 12), item(v!, 300, 700 - i * 12)]),
    );
    assert.equal(lines[0], "-5°C (23°F) 8 hours 60 hours 60 hours Extended");
    assert.equal(lines.length, 4);
  });
});

describe("QA sheets (item fixtures captured from the PDFs with pdf.js)", () => {
  it("Macropoxy 646 p1: labels and values on their own lines, columns not interleaved", () => {
    const lines = pageLines(fixture("sw_macropoxy646fc.p1"));
    assert.ok(maxLen(lines) <= 300, `longest line ${maxLen(lines)}`);
    for (const want of [
      "Finish: Semi-Gloss",
      "Mix Ratio: 1:1 by volume",
      "Volume Solids: 72% ± 2%, mixed, Mill White",
      "Dry mils (microns) 5.0* (125) 10.0 (250)",
      "Touch: 4-5 hours 2 hours 1.5 hours",
      "Pot Life: 10 hours 4 hours 2 hours",
    ]) {
      assert.ok(lines.includes(want), `missing line: ${want}`);
    }
    assert.ok(
      lines.indexOf("Mix Ratio: 1:1 by volume") <
        lines.indexOf("Touch: 4-5 hours 2 hours 1.5 hours"),
    );
    assert.equal(
      lines.some((l) => /Mix Ratio/.test(l) && /Touch|Recoat|Handle/.test(l)),
      false,
    );
  });
  it("Interthane 990 p1: drying + overcoat table rows stay whole", () => {
    const lines = pageLines(fixture("intl_interthane990.p1"));
    assert.ok(maxLen(lines) <= 300);
    assert.ok(lines.includes("Volume Solids 57% ± 3% (depends on colour)"));
    assert.ok(lines.some((l) => l.startsWith("-5°C (23°F) 8 hours 60 hours 60 hours")));
  });
  it("Tnemec 90-97 p1: label/value rows, no fake-bold run-ons", () => {
    const lines = pageLines(fixture("tnemec_90-97.p1"));
    assert.ok(maxLen(lines) <= 300);
    assert.ok(lines.includes("COLORS 90-97 Reddish-gray"));
    assert.ok(lines.includes("VOLUME SOLIDS 63.0 ± 2.0% (mixed)"));
    assert.ok(lines.includes("RECOMMENDED DFT 2.5 to 3.5 mils (65 to 90 microns) per coat."));
    assert.equal(
      lines.some((l) => l.includes("atPublished")),
      false,
    );
  });
});

const QA_PDFS = "/workspace/cc-qa/pds";
describe(
  "real PDFs through pdf.js (skipped when QA's sheets are not on this machine)",
  { skip: !existsSync(QA_PDFS) },
  () => {
    for (const name of ["sw_macropoxy646fc", "jotun_jotamastic87_us", "intl_interthane990"]) {
      it(`${name}: no line over 300 characters, newlines kept`, async () => {
        const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
        const data = new Uint8Array(readFileSync(`${QA_PDFS}/${name}.pdf`));
        const doc = await pdfjs.getDocument({ data, verbosity: 0 }).promise;
        for (let i = 1; i <= Math.min(doc.numPages, 12); i += 1) {
          const content = await (await doc.getPage(i)).getTextContent();
          const lines = pageLines(fromPdfJsItems(content.items));
          assert.ok(lines.length > 10, `page ${i} has ${lines.length} lines`);
          assert.ok(maxLen(lines) <= 300, `page ${i} longest line ${maxLen(lines)}`);
        }
      });
    }
  },
);

describe("size guards", () => {
  it("huge pages skip column detection and cap items, without throwing", async () => {
    const { MAX_PAGE_ITEMS, MAX_SPLIT_ITEMS, pageLines } = await import("./pdf-lines.ts");
    const items = [];
    // Two clean columns that would normally split, repeated past the split guard.
    for (let r = 0; r < MAX_SPLIT_ITEMS; r += 1) {
      items.push({
        str: "left column words here",
        x: 0,
        y: 100_000 - r * 12,
        width: 150,
        height: 10,
      });
      items.push({
        str: "right column words here",
        x: 300,
        y: 100_000 - r * 12,
        width: 150,
        height: 10,
      });
    }
    const lines = pageLines(items);
    assert.equal(lines[0], "left column words here right column words here");
    const many = Array.from({ length: MAX_PAGE_ITEMS + 500 }, (_, i) => ({
      str: `w${i}`,
      x: 0,
      y: 1_000_000 - i * 12,
      width: 20,
      height: 10,
    }));
    assert.equal(pageLines(many).length, MAX_PAGE_ITEMS);
  });
});
