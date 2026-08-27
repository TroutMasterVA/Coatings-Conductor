import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { heuristicExtract, insertSectionBreaks } from "./heuristic-extract.ts";
import { reconstructPdfLines } from "./pdf-text.ts";
import { SAMPLE_PDS_TEXT } from "./samples.ts";

describe("local PDS parser — Macropoxy", () => {
  const card = heuristicExtract(SAMPLE_PDS_TEXT.macropoxy);

  it("identifies product and maker", () => {
    assert.match(card.product.name, /Macropoxy 646/i);
    assert.match(card.product.manufacturer, /Sherwin-Williams/i);
    assert.match(card.product.mixRatio, /1\s*:\s*1/);
    assert.equal(card.product.voc, "");
  });

  it("fills environmentals", () => {
    assert.equal(card.environmentals.ambientTempMinF, 35);
    assert.equal(card.environmentals.ambientTempMaxF, 120);
    assert.equal(card.environmentals.dewPointSpreadMinF, 5);
    assert.equal(card.environmentals.precipitationAllowed, false);
    assert.equal(card.environmentals.windMaxMph, 25);
  });

  it("fills prep, mix, install without leaking neighboring fields", () => {
    assert.ok(card.surfacePrep.methods.some((m) => /SSPC-SP6/i.test(m)));
    assert.ok(card.surfacePrep.methods.some((m) => /SSPC-SP10/i.test(m)));
    assert.ok(!card.surfacePrep.methods.includes("NACE No. 3"));
    assert.match(card.surfacePrep.profile, /1\.5/);
    assert.ok(card.surfacePrep.substrates.some((s) => /carbon steel/i.test(s)));
    assert.match(card.mixing.potLife, /2 hour/i);
    assert.match(card.mixing.thinning, /10%/);
    assert.match(card.mixing.inductionTime, /no induction/i);
    assert.match(card.installation.filmThickness, /5\s*[–-]\s*10/i);
    assert.ok(card.holdPoints.length >= 7);
    assert.ok(card.holdPoints.some((h) => /stripe/i.test(h.name)));
    assert.ok(card.holdPoints.some((h) => /WFT/i.test(h.name) || /WFT/i.test(h.criteria)));
    assert.equal(card.confidence, "high");
    assert.ok(!/job spec/i.test(card.product.voc));
    assert.ok(!/unopened/i.test(card.shelfLife.opened));
  });

  it("isolates cure clocks so Touch does not swallow Handle", () => {
    assert.match(card.cure.touch, /2 hour/i);
    assert.ok(!/handle/i.test(card.cure.touch));
    assert.match(card.cure.handle, /5 hour/i);
    assert.ok(!/recoat/i.test(card.cure.handle));
    assert.match(card.cure.recoatMin, /3\.5/);
    assert.match(card.cure.recoatMax, /14 day/i);
    assert.match(card.cure.fullCure, /7 day/i);
    assert.ok(!/immersion/i.test(card.cure.fullCure));
    assert.match(card.cure.immersionService, /7\s*[–-]\s*14 day/i);
  });
});

describe("local PDS parser — Sikadur", () => {
  const card = heuristicExtract(SAMPLE_PDS_TEXT.sikadur);

  it("identifies adhesive and window", () => {
    assert.match(card.product.name, /Sikadur-31/i);
    assert.match(card.product.manufacturer, /Sika/i);
    assert.equal(card.environmentals.ambientTempMinF, 40);
    assert.equal(card.environmentals.ambientTempMaxF, 95);
    assert.equal(card.environmentals.dewPointSpreadMinF, 5);
    assert.match(card.mixing.ratio, /1\s*:\s*1/);
    assert.match(card.mixing.thinning, /do not thin/i);
    assert.ok(card.surfacePrep.substrates.some((s) => /concrete/i.test(s)));
    assert.ok(card.surfacePrep.substrates.some((s) => /steel/i.test(s)));
    assert.match(card.installation.filmThickness, /bond-line|1\/32/i);
    assert.ok(card.holdPoints.some((h) => /cure before load/i.test(h.name)));
    assert.ok(!card.surfacePrep.substrates.some((s) => /temperature/i.test(s)));
  });

  it("fills Sikadur cure without paragraph leak", () => {
    assert.match(card.cure.touch, /1\s*[–-]\s*2 hour/i);
    assert.ok(!/initial set/i.test(card.cure.touch));
    assert.match(card.cure.handle, /2\s*[–-]\s*3 hour/i);
    assert.match(card.cure.fullCure, /3 day/i);
    assert.equal(card.confidence, "high");
  });
});

describe("local PDS parser — Dymonic", () => {
  const card = heuristicExtract(SAMPLE_PDS_TEXT.dymonic);

  it("identifies sealant and window", () => {
    assert.match(card.product.name, /Dymonic 100/i);
    assert.match(card.product.manufacturer, /Tremco/i);
    assert.equal(card.environmentals.ambientTempMinF, 40);
    assert.equal(card.environmentals.ambientTempMaxF, 120);
    assert.match(card.shelfLife.unopened, /12 month/i);
    assert.ok(card.surfacePrep.substrates.some((s) => /concrete/i.test(s)));
    assert.match(card.mixing.components, /single/i);
    assert.match(card.product.mixRatio, /single/i);
    assert.match(card.installation.filmThickness, /joint|¼|1\/4/i);
    assert.ok(card.surfacePrep.substrates.every((s) => !/joints clean|frost-free|laitance/i.test(s)));
  });

  it("fills Dymonic skin / tack / full cure", () => {
    assert.match(card.cure.touch, /2\s*[–-]\s*4 hour/i);
    assert.match(card.cure.handle, /24 hour/i);
    assert.match(card.cure.fullCure, /7 day/i);
    assert.ok(card.confidence === "high" || card.confidence === "medium");
  });
});

describe("local PDS parser — flattened PDF-style blob", () => {
  it("still recovers Macropoxy windows when newlines are stripped", () => {
    const blob = SAMPLE_PDS_TEXT.macropoxy.replace(/\n+/g, " ");
    const card = heuristicExtract(blob);
    assert.match(card.product.name, /Macropoxy 646/i);
    assert.equal(card.environmentals.ambientTempMinF, 35);
    assert.equal(card.environmentals.ambientTempMaxF, 120);
    assert.equal(card.environmentals.dewPointSpreadMinF, 5);
    assert.match(card.product.mixRatio, /1\s*:\s*1/);
    assert.match(card.installation.filmThickness, /5\s*[–-]\s*10/i);
    assert.match(card.cure.touch, /2 hour/i);
    assert.ok(!/handle/i.test(card.cure.touch));
    assert.match(card.cure.recoatMin, /3\.5/);
  });
});

describe("local PDS parser — table-style PDS without pretty headings", () => {
  it("reads min/max, dew, mix, DFT, and cure from a compact dump", () => {
    const text = `PRODUCT DATA SHEET — Carbozinc 859
Manufacturer: Carboline
Generic Type: Organic zinc-rich epoxy
Service: Primer on blasted structural steel

Air and Surface: 40°F minimum, 110°F maximum. Surface 5°F above dew point.
Relative Humidity 85% maximum. Do not apply if rain is imminent.

SURFACE PREPARATION
SSPC-SP10 / NACE No. 2 near-white. Anchor profile: 1.5–2.5 mils.

MIXING
Mix ratio 4:1 by volume. Pot life 4 hours at 75°F. Do not thin.

INSTALLATION
Airless spray. Typical DFT 3–5 mils.

CURE
Dry to touch 30 minutes. Handle: 2 hours. Recoat minimum: 2 hours. Recoat maximum: 30 days. Full cure: 7 days.
`;
    const card = heuristicExtract(text);
    assert.match(card.product.name, /Carbozinc 859/i);
    assert.match(card.product.manufacturer, /Carboline/i);
    assert.equal(card.environmentals.ambientTempMinF, 40);
    assert.equal(card.environmentals.ambientTempMaxF, 110);
    assert.equal(card.environmentals.dewPointSpreadMinF, 5);
    assert.equal(card.environmentals.relativeHumidityMax, 85);
    assert.match(card.product.mixRatio, /4\s*:\s*1/);
    assert.match(card.installation.filmThickness, /3\s*[–-]\s*5/i);
    assert.match(card.cure.touch, /30 min/i);
    assert.match(card.cure.recoatMax, /30 day/i);
    assert.match(card.surfacePrep.profile, /1\.5/);
    assert.ok(card.confidence === "high" || card.confidence === "medium");
  });
});

describe("PDF line reconstruction", () => {
  it("groups items on the same y into a line", () => {
    const text = reconstructPdfLines([
      { str: "STORAGE", transform: [1, 0, 0, 1, 10, 200], width: 40 },
      { str: "Store", transform: [1, 0, 0, 1, 10, 180], width: 24 },
      { str: "indoors", transform: [1, 0, 0, 1, 38, 180], width: 30 },
      { str: "MIXING", transform: [1, 0, 0, 1, 10, 140], width: 36 },
    ]);
    assert.match(text, /STORAGE/);
    assert.match(text, /Store\s+indoors/);
    assert.match(text, /MIXING/);
    assert.ok(text.indexOf("STORAGE") < text.indexOf("MIXING"));
  });

  it("inserts section breaks before ALL-CAPS banners in a blob", () => {
    const broken = insertSectionBreaks("FIFO. STORAGE Store indoors MIXING Two components CURE Touch: 2 hours");
    assert.match(broken, /\nSTORAGE/);
    assert.match(broken, /\nMIXING/);
    assert.match(broken, /\nCURE/);
  });
});
