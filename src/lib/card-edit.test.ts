import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { EDITABLE_PATHS, isEditablePath, normalizeEditValue, setCardValue } from "./card-edit.ts";
import {
  extractForSave,
  provenanceRows,
  savedExtractState,
  SESSION_EDIT_TEXT,
  type DoneState,
} from "./extract-client.ts";
import { buildCardFromPds } from "./on-device-extract.ts";
import { SAMPLE_PDS_TEXT } from "./samples.ts";

const sampleText = Object.values(SAMPLE_PDS_TEXT).find((t) => t && t.length > 200) ?? "";
const card = buildCardFromPds(sampleText);

describe("tap-to-edit: card value", () => {
  it("every editable path is a string field on a real card", () => {
    for (const p of EDITABLE_PATHS) {
      const [g, k] = p.split(".") as [string, string];
      const v = (card as unknown as Record<string, Record<string, unknown>>)[g]?.[k];
      assert.ok(v === undefined || v === null || typeof v === "string", p);
    }
  });
  it("changes one field, does not mutate the input", () => {
    const before = JSON.stringify(card);
    const next = setCardValue(card, "installation.filmThickness", "  5.0–8.0 mils DFT ");
    assert.equal(next.installation.filmThickness, "5.0–8.0 mils DFT");
    assert.equal(JSON.stringify(card), before);
    assert.notEqual(next, card);
    assert.equal(next.cure, card.cure);
  });
  it("editing a 'Not stated' value fills it; blank clears it back to not stated", () => {
    const blank = setCardValue(card, "cure.immersionService", "");
    assert.equal(blank.cure.immersionService, "");
    const filled = setCardValue(blank, "cure.immersionService", "7 days");
    assert.equal(filled.cure.immersionService, "7 days");
  });
  it("same value or a non-editable path → same object (no save)", () => {
    const v = card.product.name;
    assert.equal(setCardValue(card, "product.name", ` ${v} `), card);
    assert.equal(setCardValue(card, "environmentals.ambientTempMinF", "40"), card);
    assert.equal(setCardValue(card, "__proto__.x", "1"), card);
    assert.equal(isEditablePath("surfacePrep.substrates"), false);
    assert.equal(normalizeEditValue("  a \n b "), "a b");
  });
});

describe("tap-to-edit: provenance + save payload", () => {
  const extract = {
    provider: "azure",
    provenance: {
      "installation.filmThickness": { page: 2, quote: "4.0-8.0 mils" },
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
  it("an inline edit shows 'Edited in this session — not from the sheet' for that field", () => {
    const d = savedExtractState({ card, extract }) as DoneState;
    const edited = setCardValue(card, "installation.filmThickness", "6 mils");
    const rows = provenanceRows(d.result.provenance, { current: edited, asRead: d.result.card });
    const film = rows.find((r) => r.fieldPath === "installation.filmThickness")!;
    assert.equal(film.text, SESSION_EDIT_TEXT);
    assert.equal(film.edited, true);
    // Untouched server-stamped field still reads "Edited by …".
    const name = rows.find((r) => r.fieldPath === "product.name")!;
    assert.match(name.text, /^Edited by Isaiah Chester/);
  });
  it("saving after an edit sends the card only: extract omitted, no `edited` from the browser", () => {
    const d = savedExtractState({ card, extract }) as DoneState;
    assert.equal(extractForSave(d), undefined);
  });
});
