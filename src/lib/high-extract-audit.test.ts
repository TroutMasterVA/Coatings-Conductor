import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { heuristicExtract } from "./heuristic-extract.ts";
import { buildCardFromPds } from "./on-device-extract.ts";
import {
  PITT_THERM_PDS,
  smashPds,
  ZINC_PRIMER_PDS,
  POLYUREA_PDS,
  PFP_EPOXY_PDS,
  MCU_PDS,
  JOTUN_PDS,
  HEMPEL_PDS,
  TNEMEC_PDS,
  INTERZINC_PDS,
  ALKYD_PDS,
} from "./pds-fixtures.ts";
import { SAMPLE_PDS_TEXT } from "./samples.ts";
import type { FieldCardData } from "./types.ts";

type Check = { id: string; ok: (card: FieldCardData) => boolean };

async function extractPdfJsText(pdfPath: string): Promise<string> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs").catch(() => import("pdfjs-dist"));
  const data = new Uint8Array(fs.readFileSync(pdfPath));
  const doc = await pdfjs.getDocument({ data, disableWorker: true }).promise;
  const pages: string[] = [];
  const max = Math.min(doc.numPages, 12);
  for (let i = 1; i <= max; i += 1) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const items: { str: string; x: number; y: number }[] = [];
    for (const raw of content.items as Array<{ str?: string; transform?: number[] }>) {
      const str = raw.str ?? "";
      if (!str.trim()) continue;
      const t = raw.transform ?? [1, 0, 0, 1, 0, 0];
      items.push({ str, x: t[4] ?? 0, y: t[5] ?? 0 });
    }
    items.sort((a, b) => b.y - a.y || a.x - b.x);
    const lines: { y: number; parts: { x: number; str: string }[] }[] = [];
    const yTol = 3.5;
    for (const it of items) {
      const last = lines[lines.length - 1];
      if (last && Math.abs(last.y - it.y) <= yTol) last.parts.push({ x: it.x, str: it.str });
      else lines.push({ y: it.y, parts: [{ x: it.x, str: it.str }] });
    }
    const text = lines
      .map((l) =>
        l.parts
          .sort((a, b) => a.x - b.x)
          .map((p) => p.str)
          .join(" ")
          .replace(/\s+/g, " ")
          .trim(),
      )
      .filter(Boolean)
      .join("\n");
    if (text) pages.push(text);
  }
  return pages.join("\n\n");
}

function runAudit(label: string, text: string, checks: Check[]) {
  const card = heuristicExtract(text);
  const failed = checks.filter((c) => !c.ok(card)).map((c) => c.id);
  assert.equal(failed.length, 0, `${label} ${failed.length}/${checks.length} failed: ${failed.join(" | ")}`);
  assertCardTracesToSheet(label, text, card);
  return card;
}

/** Every filled card fact must be findable on the sheet — no invented numbers. */
function assertCardTracesToSheet(label: string, text: string, card: FieldCardData) {
  const n = text.replace(/\s+/g, " ");
  const nameBits = card.product.name
    .split(/[\s/]+/)
    .filter((w) => w.length > 3 && !/product|data|sheet|unnamed/i.test(w));
  for (const tok of nameBits.slice(0, 3)) {
    assert.match(n, new RegExp(tok.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"), `${label} name token missing: ${tok}`);
  }
  if (card.environmentals.dewPointSpreadMinF != null) {
    const d = card.environmentals.dewPointSpreadMinF;
    const ok = n.includes(String(d)) || (d === 5 && /3\s*°?\s*C/i.test(n));
    assert.equal(ok, true, `${label} dew ${d} not on sheet`);
  }
  if (card.environmentals.relativeHumidityMax != null) {
    assert.match(n, new RegExp(String(card.environmentals.relativeHumidityMax) + "\\s*%"), `${label} RH not on sheet`);
  }
  if (card.environmentals.ambientTempMinF != null) {
    const f = card.environmentals.ambientTempMinF;
    const c = Math.round(((f - 32) * 5) / 9);
    assert.equal(
      n.includes(String(f)) || n.includes(String(c)),
      true,
      `${label} apply min ${f} not on sheet`,
    );
  }
  if (card.product.mixRatio) {
    const ratio = card.product.mixRatio.match(/(\d+(?:\.\d+)?)\s*:\s*(\d+(?:\.\d+)?)/);
    if (ratio) {
      const compact = n.replace(/\s/g, "");
      const colon = `${ratio[1]}:${ratio[2]}`;
      const parts = new RegExp(`${ratio[1]}\\s*parts?[\\s\\S]{0,40}${ratio[2]}\\s*parts?`, "i");
      assert.equal(
        compact.includes(colon) || parts.test(n),
        true,
        `${label} mix ${colon} not on sheet`,
      );
    } else if (/single/i.test(card.product.mixRatio)) {
      assert.match(n, /single[- ]component|no mixing/i, `${label} single-component not on sheet`);
    }
  }
  assert.notEqual(card.environmentals.dewPointSpreadMinF, 37, `${label} invented 37°F dew`);
  if (!/above(?: the)? dew/i.test(n) && !/\bdew point\b/i.test(n)) {
    assert.equal(card.environmentals.dewPointSpreadMinF, null, `${label} invented dew when sheet is silent`);
  }
}

const PITT_GOLD: Check[] = [
  { id: "name", ok: (c) => /PITT-THERM\s*1000\s*FX/i.test(c.product.name) },
  { id: "name-not-header", ok: (c) => !/data sheet/i.test(c.product.name) },
  { id: "manufacturer", ok: (c) => /PPG/i.test(c.product.manufacturer) },
  { id: "type-epoxy-insulation", ok: (c) => /epoxy/i.test(c.product.productType) && /insulation|thermal/i.test(c.product.productType) },
  { id: "two-component-type", ok: (c) => /two-component/i.test(c.product.productType) },
  { id: "solids-100", ok: (c) => /100%\s*solids/i.test(c.product.productType) || /100%/.test(c.mixing.notes) },
  { id: "color-green", ok: (c) => c.product.colors.some((x) => /green/i.test(x)) },
  { id: "voc-zero", ok: (c) => /0\.0\s*g\/l/i.test(c.product.voc) },
  { id: "mix-volume-1-1", ok: (c) => /1\s*:\s*1/.test(c.product.mixRatio) && /volume/i.test(c.product.mixRatio) },
  { id: "mix-weight-1.16", ok: (c) => /1\.16\s*:\s*1/.test(c.product.mixRatio) && /weight/i.test(c.product.mixRatio) },
  { id: "date-2025", ok: (c) => /January\s+15\s+2025/i.test(c.product.documentDate) },
  { id: "service-not-apply-window", ok: (c) => /thermal|insulation|barrier|-60|125/i.test(c.product.service) },
  { id: "dew-5-not-37", ok: (c) => c.environmentals.dewPointSpreadMinF === 5 },
  { id: "rh-85", ok: (c) => c.environmentals.relativeHumidityMax === 85 },
  { id: "rain-false", ok: (c) => c.environmentals.precipitationAllowed === false },
  { id: "apply-min-41", ok: (c) => c.environmentals.ambientTempMinF === 41 },
  { id: "sub-min-41", ok: (c) => c.environmentals.substrateTempMinF === 41 },
  { id: "no-service-neg76", ok: (c) => c.environmentals.ambientTempMinF !== -76 && c.environmentals.ambientTempMaxF !== 257 },
  { id: "no-apply-max-50", ok: (c) => c.environmentals.ambientTempMaxF !== 50 && c.environmentals.ambientTempMaxF !== 257 },
  { id: "storage-32-95", ok: (c) => /32/.test(c.storage.temperatureRange) && /95/.test(c.storage.temperatureRange) },
  { id: "storage-dry-sun", ok: (c) => c.storage.conditions.some((x) => /dry|sunlight/i.test(x)) },
  { id: "shelf-12-months", ok: (c) => /12\s*months/i.test(c.shelfLife.unopened) },
  { id: "pot-1h-73", ok: (c) => /1\s*hour/i.test(c.mixing.potLife) && /73/.test(c.mixing.potLife) },
  { id: "pot-30m-86", ok: (c) => /30\s*min/i.test(c.mixing.potLife) },
  { id: "no-thinner", ok: (c) => /no thinner/i.test(c.mixing.thinning) },
  { id: "mix-components-two", ok: (c) => /two/i.test(c.mixing.components) },
  { id: "mix-tolerance", ok: (c) => /10%/.test(c.mixing.notes) },
  { id: "dft-78.7-1181", ok: (c) => /78\.7/.test(c.installation.filmThickness) && /1181/.test(c.installation.filmThickness) },
  { id: "method-airless", ok: (c) => c.installation.methods.some((m) => /airless/i.test(m)) },
  { id: "method-plural", ok: (c) => c.installation.methods.some((m) => /plural/i.test(m)) },
  { id: "method-trowel", ok: (c) => c.installation.methods.some((m) => /trowel/i.test(m)) },
  { id: "method-roller", ok: (c) => c.installation.methods.some((m) => /roller/i.test(m)) },
  { id: "cleaner-91-92", ok: (c) => /91-92/.test(c.installation.notes) },
  { id: "methods-unique", ok: (c) => new Set(c.installation.methods.map((m) => m.toLowerCase())).size === c.installation.methods.length },
  { id: "service-full-barrier", ok: (c) => /thermal barrier/i.test(c.product.service) && /stand-alone thermal insulation/i.test(c.product.service) && !/PRINCIPAL CHARACTERISTICS/i.test(c.product.service) },
  { id: "cure-touch-8h", ok: (c) => /^8\s*hours/i.test(c.cure.touch) },
  { id: "cure-handle-30h", ok: (c) => /30\s*hours/i.test(c.cure.handle) },
  { id: "cure-full-48h", ok: (c) => /48\s*hours/i.test(c.cure.fullCure) },
  { id: "cure-ceases-5c", ok: (c) => /ceases below 5/i.test(c.cure.temperatureDependence) },
  { id: "creds-trained", ok: (c) => c.credentials.required.some((r) => /trained/i.test(r)) },
  { id: "prep-previous-coat", ok: (c) => /previous coating|fully cured/i.test(c.surfacePrep.notes + c.surfacePrep.cleanliness + c.surfacePrep.substrates.join(" ")) },
  { id: "substrate-previous", ok: (c) => c.surfacePrep.substrates.some((s) => /previous|coat/i.test(s)) },
  { id: "profile-overcoat", ok: (c) => /not stated|overcoat|profile|mils/i.test(c.surfacePrep.profile) },
  { id: "moisture-dew-rh", ok: (c) => /dew|RH|dry application/i.test(c.surfacePrep.moisture) },
  { id: "apply-max-unstated", ok: (c) => c.environmentals.ambientTempMaxF == null },
  { id: "ppe-spray-or-sds", ok: (c) => c.safety.ppe.length > 0 },
  { id: "vent-required", ok: (c) => /ventilat/i.test(c.safety.ventilation) },
  { id: "confidence-high", ok: (c) => c.confidence === "high" },
  { id: "no-review-every-field", ok: (c) => !c.extractionNotes.some((n) => /review every field/i.test(n)) },
];

describe("high extract — PITT-THERM 1000 FX", () => {
  it("scores 100% against the lined PDS", () => {
    const card = runAudit("lined", PITT_THERM_PDS, PITT_GOLD);
    assert.equal(PITT_GOLD.filter((c) => c.ok(card)).length, PITT_GOLD.length);
  });

  it("scores 100% against space-joined PDF text", () => {
    runAudit("smashed", smashPds(PITT_THERM_PDS), PITT_GOLD);
  });

  it("scores 100% against pdf.js text from the attached PDS", async () => {
    const pdfPath = path.join(process.cwd(), "attachments", "143050007_1033_All_Data sheet.pdf");
    if (!fs.existsSync(pdfPath)) {
      return; // optional manufacturer PDF — lined/smashed fixtures still prove gold
    }
    const text = await extractPdfJsText(pdfPath);
    assert.ok(text.length > 500, "PDF text too short");
    runAudit("attached-pdf", text, PITT_GOLD);
  });

  it("buildCardFromPds stays high and honest", () => {
    const card = buildCardFromPds(PITT_THERM_PDS);
    assert.equal(card.confidence, "high");
    assert.equal(card.environmentals.dewPointSpreadMinF, 5);
    assert.equal(card.environmentals.relativeHumidityMax, 85);
    assert.equal(card.environmentals.precipitationAllowed, false);
  });
});

const MACRO_GOLD: Check[] = [
  { id: "name", ok: (c) => /Macropoxy\s*646/i.test(c.product.name) },
  { id: "maker", ok: (c) => /Sherwin/i.test(c.product.manufacturer) },
  { id: "dew-5", ok: (c) => c.environmentals.dewPointSpreadMinF === 5 },
  { id: "rain-false", ok: (c) => c.environmentals.precipitationAllowed === false },
  { id: "air-min-35", ok: (c) => c.environmentals.ambientTempMinF === 35 },
  { id: "air-max-120", ok: (c) => c.environmentals.ambientTempMaxF === 120 },
  { id: "rh-null", ok: (c) => c.environmentals.relativeHumidityMax == null },
  { id: "wind-25", ok: (c) => c.environmentals.windMaxMph === 25 },
  { id: "mix-1-1", ok: (c) => /1\s*:\s*1/.test(c.mixing.ratio) },
  { id: "dft-5-10", ok: (c) => /5\s*-\s*10\s*mils/i.test(c.installation.filmThickness) },
  { id: "profile", ok: (c) => /1\.5/.test(c.surfacePrep.profile) },
  { id: "sspc", ok: (c) => c.surfacePrep.methods.some((m) => /SSPC-SP6/i.test(m)) },
];

const SIKA_GOLD: Check[] = [
  { id: "name", ok: (c) => /Sikadur-31/i.test(c.product.name) },
  { id: "maker", ok: (c) => /Sika/i.test(c.product.manufacturer) },
  { id: "dew-5", ok: (c) => c.environmentals.dewPointSpreadMinF === 5 },
  { id: "rain-false", ok: (c) => c.environmentals.precipitationAllowed === false },
  { id: "min-40", ok: (c) => c.environmentals.ambientTempMinF === 40 || c.environmentals.substrateTempMinF === 40 },
  { id: "max-95", ok: (c) => c.environmentals.ambientTempMaxF === 95 || c.environmentals.substrateTempMaxF === 95 },
  { id: "mix-1-1", ok: (c) => /1\s*:\s*1/.test(c.mixing.ratio) },
  { id: "no-thin", ok: (c) => /do not thin/i.test(c.mixing.thinning) },
  { id: "trowel", ok: (c) => c.installation.methods.some((m) => /trowel/i.test(m)) },
];

const DYMONIC_GOLD: Check[] = [
  { id: "name", ok: (c) => /Dymonic\s*100/i.test(c.product.name) },
  { id: "maker", ok: (c) => /Tremco/i.test(c.product.manufacturer) },
  { id: "dew-null", ok: (c) => c.environmentals.dewPointSpreadMinF == null },
  { id: "rain-false", ok: (c) => c.environmentals.precipitationAllowed === false },
  { id: "single", ok: (c) => /single/i.test(c.mixing.components) || /single/i.test(c.product.productType) },
  { id: "gun", ok: (c) => c.installation.methods.some((m) => /gun/i.test(m)) },
];

describe("high extract — sample sheets", () => {
  it("Macropoxy 646 scores 100%", () => {
    runAudit("macropoxy", SAMPLE_PDS_TEXT.macropoxy, MACRO_GOLD);
  });
  it("Sikadur-31 scores 100%", () => {
    runAudit("sikadur", SAMPLE_PDS_TEXT.sikadur, SIKA_GOLD);
  });
  it("Dymonic 100 scores 100%", () => {
    runAudit("dymonic", SAMPLE_PDS_TEXT.dymonic, DYMONIC_GOLD);
  });
  it("Macropoxy smashed scores 100%", () => {
    runAudit("macropoxy-smashed", smashPds(SAMPLE_PDS_TEXT.macropoxy), MACRO_GOLD);
  });
});

const ZINC_GOLD: Check[] = [
  { id: "name", ok: (c) => /Carbozinc/i.test(c.product.name) },
  { id: "maker", ok: (c) => /Carboline/i.test(c.product.manufacturer) },
  { id: "dew-5", ok: (c) => c.environmentals.dewPointSpreadMinF === 5 },
  { id: "rain-false", ok: (c) => c.environmentals.precipitationAllowed === false },
  { id: "rh-85", ok: (c) => c.environmentals.relativeHumidityMax === 85 },
  { id: "air-min-50", ok: (c) => c.environmentals.ambientTempMinF === 50 },
  { id: "air-max-110", ok: (c) => c.environmentals.ambientTempMaxF === 110 },
  { id: "mix-4-1", ok: (c) => /4\s*:\s*1/.test(c.mixing.ratio) },
  { id: "dft-3-5", ok: (c) => /3/.test(c.installation.filmThickness) && /5/.test(c.installation.filmThickness) },
  { id: "sspc", ok: (c) => c.surfacePrep.methods.some((m) => /SSPC-SP6/i.test(m)) },
  { id: "high", ok: (c) => c.confidence === "high" },
];

const POLY_GOLD: Check[] = [
  { id: "name", ok: (c) => /EnviroLastic/i.test(c.product.name) },
  { id: "maker", ok: (c) => /Sherwin/i.test(c.product.manufacturer) },
  { id: "dew-5", ok: (c) => c.environmentals.dewPointSpreadMinF === 5 },
  { id: "rain-false", ok: (c) => c.environmentals.precipitationAllowed === false },
  { id: "min-40", ok: (c) => c.environmentals.ambientTempMinF === 40 },
  { id: "max-120", ok: (c) => c.environmentals.ambientTempMaxF === 120 },
  { id: "mix-1-1", ok: (c) => /1\s*:\s*1/.test(c.mixing.ratio) },
  { id: "plural", ok: (c) => c.installation.methods.some((m) => /plural/i.test(m)) },
  { id: "dft-30", ok: (c) => /30/.test(c.installation.filmThickness) },
  { id: "high", ok: (c) => c.confidence === "high" },
];

const PFP_GOLD: Check[] = [
  { id: "name", ok: (c) => /PITT-CHAR/i.test(c.product.name) },
  { id: "maker", ok: (c) => /PPG/i.test(c.product.manufacturer) },
  { id: "dew-5", ok: (c) => c.environmentals.dewPointSpreadMinF === 5 },
  { id: "rh-85", ok: (c) => c.environmentals.relativeHumidityMax === 85 },
  { id: "rain-false", ok: (c) => c.environmentals.precipitationAllowed === false },
  { id: "min-50", ok: (c) => c.environmentals.ambientTempMinF === 50 },
  { id: "mix-2.5", ok: (c) => /2\.5\s*:\s*1/.test(c.mixing.ratio) },
  { id: "no-thin", ok: (c) => /no thinner/i.test(c.mixing.thinning) },
  { id: "dft-200", ok: (c) => /200/.test(c.installation.filmThickness) },
  { id: "high", ok: (c) => c.confidence === "high" },
];

const MCU_GOLD: Check[] = [
  { id: "name", ok: (c) => /Corothane/i.test(c.product.name) },
  { id: "maker", ok: (c) => /Sherwin/i.test(c.product.manufacturer) },
  { id: "dew-5", ok: (c) => c.environmentals.dewPointSpreadMinF === 5 },
  { id: "rain-false", ok: (c) => c.environmentals.precipitationAllowed === false },
  { id: "single-mix", ok: (c) => /single/i.test(c.mixing.ratio) || /single/i.test(c.mixing.components) },
  { id: "dft-3-4", ok: (c) => /3/.test(c.installation.filmThickness) && /4/.test(c.installation.filmThickness) },
  { id: "high", ok: (c) => c.confidence === "high" },
];

describe("high extract — additional coating families", () => {
  it("zinc primer 100%", () => {
    runAudit("zinc", ZINC_PRIMER_PDS, ZINC_GOLD);
    runAudit("zinc-smashed", smashPds(ZINC_PRIMER_PDS), ZINC_GOLD);
  });
  it("polyurea 100%", () => {
    runAudit("polyurea", POLYUREA_PDS, POLY_GOLD);
    runAudit("polyurea-smashed", smashPds(POLYUREA_PDS), POLY_GOLD);
  });
  it("epoxy PFP 100%", () => {
    runAudit("pfp", PFP_EPOXY_PDS, PFP_GOLD);
    runAudit("pfp-smashed", smashPds(PFP_EPOXY_PDS), PFP_GOLD);
  });
  it("moisture-cure urethane 100%", () => {
    runAudit("mcu", MCU_PDS, MCU_GOLD);
    runAudit("mcu-smashed", smashPds(MCU_PDS), MCU_GOLD);
  });
});

const JOTUN_GOLD: Check[] = [
  { id: "name", ok: (c) => /Penguard/i.test(c.product.name) },
  { id: "maker", ok: (c) => /Jotun/i.test(c.product.manufacturer) },
  { id: "dew-5", ok: (c) => c.environmentals.dewPointSpreadMinF === 5 },
  { id: "rh-85", ok: (c) => c.environmentals.relativeHumidityMax === 85 },
  { id: "rain-false", ok: (c) => c.environmentals.precipitationAllowed === false },
  { id: "min-50", ok: (c) => c.environmentals.ambientTempMinF === 50 },
  { id: "max-140", ok: (c) => c.environmentals.ambientTempMaxF === 140 },
  { id: "mix-3-1", ok: (c) => /3\s*:\s*1/.test(c.mixing.ratio) },
  { id: "dft", ok: (c) => /5/.test(c.installation.filmThickness) && /8/.test(c.installation.filmThickness) },
  { id: "high", ok: (c) => c.confidence === "high" },
];

const HEMPEL_GOLD: Check[] = [
  { id: "name", ok: (c) => /Hempadur/i.test(c.product.name) },
  { id: "maker", ok: (c) => /Hempel/i.test(c.product.manufacturer) },
  { id: "dew-5", ok: (c) => c.environmentals.dewPointSpreadMinF === 5 },
  { id: "rh-80", ok: (c) => c.environmentals.relativeHumidityMax === 80 },
  { id: "rain-false", ok: (c) => c.environmentals.precipitationAllowed === false },
  { id: "min-41", ok: (c) => c.environmentals.ambientTempMinF === 41 },
  { id: "mix-4-1", ok: (c) => /4\s*:\s*1/.test(c.mixing.ratio) },
  { id: "high", ok: (c) => c.confidence === "high" },
];

const TNEMEC_GOLD: Check[] = [
  { id: "name", ok: (c) => /Series\s*66|Hi-Build Epoxoline/i.test(c.product.name) },
  { id: "maker", ok: (c) => /Tnemec/i.test(c.product.manufacturer) },
  { id: "dew-5", ok: (c) => c.environmentals.dewPointSpreadMinF === 5 },
  { id: "rh-85", ok: (c) => c.environmentals.relativeHumidityMax === 85 },
  { id: "rain-false", ok: (c) => c.environmentals.precipitationAllowed === false },
  { id: "min-50", ok: (c) => c.environmentals.ambientTempMinF === 50 },
  { id: "mix-1-1", ok: (c) => /1\s*:\s*1/.test(c.mixing.ratio) },
  { id: "induction", ok: (c) => /15/.test(c.mixing.inductionTime) },
  { id: "high", ok: (c) => c.confidence === "high" },
];

const INTERZINC_GOLD: Check[] = [
  { id: "name", ok: (c) => /Interzinc/i.test(c.product.name) },
  { id: "maker", ok: (c) => /International/i.test(c.product.manufacturer) },
  { id: "dew-5", ok: (c) => c.environmentals.dewPointSpreadMinF === 5 },
  { id: "rh-90", ok: (c) => c.environmentals.relativeHumidityMax === 90 },
  { id: "rain-false", ok: (c) => c.environmentals.precipitationAllowed === false },
  { id: "min-41", ok: (c) => c.environmentals.ambientTempMinF === 41 },
  { id: "mix-4-1", ok: (c) => /4\s*:\s*1/.test(c.mixing.ratio) },
  { id: "high", ok: (c) => c.confidence === "high" },
];

const ALKYD_GOLD: Check[] = [
  { id: "name", ok: (c) => /Shop-Alkyd/i.test(c.product.name) },
  { id: "maker", ok: (c) => /TestCoatings/i.test(c.product.manufacturer) },
  { id: "dew-null", ok: (c) => c.environmentals.dewPointSpreadMinF == null },
  { id: "rain-false", ok: (c) => c.environmentals.precipitationAllowed === false },
  { id: "single", ok: (c) => /single/i.test(c.mixing.ratio) || /single/i.test(c.mixing.components) },
  { id: "min-50", ok: (c) => c.environmentals.ambientTempMinF === 50 },
  { id: "max-100", ok: (c) => c.environmentals.ambientTempMaxF === 100 },
  { id: "high", ok: (c) => c.confidence === "high" },
];

describe("high extract — additional manufacturers", () => {
  it("Jotun Penguard 100%", () => {
    runAudit("jotun", JOTUN_PDS, JOTUN_GOLD);
    runAudit("jotun-smashed", smashPds(JOTUN_PDS), JOTUN_GOLD);
  });
  it("Hempel Hempadur 100%", () => {
    runAudit("hempel", HEMPEL_PDS, HEMPEL_GOLD);
    runAudit("hempel-smashed", smashPds(HEMPEL_PDS), HEMPEL_GOLD);
  });
  it("Tnemec Series 66 100%", () => {
    runAudit("tnemec", TNEMEC_PDS, TNEMEC_GOLD);
    runAudit("tnemec-smashed", smashPds(TNEMEC_PDS), TNEMEC_GOLD);
  });
  it("Interzinc 52 100%", () => {
    runAudit("interzinc", INTERZINC_PDS, INTERZINC_GOLD);
    runAudit("interzinc-smashed", smashPds(INTERZINC_PDS), INTERZINC_GOLD);
  });
  it("unknown-brand alkyd 100% without inventing dew", () => {
    runAudit("alkyd", ALKYD_PDS, ALKYD_GOLD);
    runAudit("alkyd-smashed", smashPds(ALKYD_PDS), ALKYD_GOLD);
  });
});

describe("intake has no product cheat buttons", () => {
  it("pds-intake does not inject a known PDS", () => {
    const src = fs.readFileSync(path.join(process.cwd(), "src/components/pds-intake.tsx"), "utf8");
    assert.doesNotMatch(src, /PITT-THERM|Parse the real|Sample products|SAMPLES|onSample|pitt-therm-1000/i);
    assert.match(src, /Drop PDF here or tap to upload/);
    assert.match(src, /data-testid="pds-file"/);
  });
});
