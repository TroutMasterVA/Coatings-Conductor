import { beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";

// QA P1 (#50): a guest's limit edit must keep its value and its user-edited mark after a reload,
// also when the edit lands before the read's first autosave and when the read is sent again later.
const mem = new Map<string, string>();
(globalThis as Record<string, unknown>).window = globalThis;
(globalThis as Record<string, unknown>).localStorage = {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => void mem.set(k, v),
  removeItem: (k: string) => void mem.delete(k),
};

const { LimitsPanel } = await import("./limits-panel.tsx");
const { editLimit, limitSource, USER_EDITED } = await import("../lib/limit-source.ts");
const { extractPasted, extractForSave, readThenEdits, savedExtractState } = await import("../lib/extract-client.ts");
const { onDeviceProvider } = await import("../lib/extract/on-device-provider.ts");
const gw = await import("../lib/guest-workspace.ts");
import type { FieldCardData } from "../lib/types.ts";
import type { LimitKey } from "../lib/limit-fields.ts";

// Surface min/max stated; RH and wind not stated (like Amercoat 450H in QA's run).
const SHEET =
  "Duracoat 77X topcoat. Application conditions: surface temperature minimum 40°F, maximum 120°F. Pot life 2 hours at 77°F.";

async function freshRead() {
  const read = await extractPasted(SHEET, (input) => onDeviceProvider.extract(input));
  assert.equal(read.kind, "done");
  if (read.kind !== "done") throw new Error("read failed");
  return read;
}

function edit(card: FieldCardData, edits: Partial<Record<LimitKey, string>>): FieldCardData {
  let env = card.environmentals;
  for (const [k, v] of Object.entries(edits)) env = editLimit(env, k as LimitKey, v!);
  return { ...card, environmentals: env };
}

/** What a page reload does for a guest: reopen the project and rebuild the panel from the device store. */
function reload(id: string) {
  const full = gw.guestOpenProject(id);
  const st = savedExtractState(full);
  assert.equal(st.kind, "done", "saved read reopens");
  if (st.kind !== "done") throw new Error("no saved read");
  return { card: full.card!, asRead: st.result.card, provenance: st.result.provenance };
}

function assertEdited(id: string, edits: Partial<Record<LimitKey, string>>) {
  const r = reload(id);
  const html = renderToStaticMarkup(<LimitsPanel card={r.card} asRead={r.asRead} provenance={r.provenance} />);
  for (const [k, v] of Object.entries(edits)) {
    assert.equal(r.card.environmentals[k as LimitKey], Number(v), `${k} value kept`);
    const src = limitSource(`environmentals.${k}`, r.card, r.asRead, r.provenance);
    assert.equal(src.kind, "edited", `${k} still user-edited after reload`);
    assert.match(html, new RegExp(`limit-${k}-src" data-src="edited">${USER_EDITED}`), `${k} panel mark`);
  }
}

const EDITS = { relativeHumidityMax: "1", relativeHumidityMin: "99", windMaxMph: "0", substrateTempMinF: "200" } as const;

describe("guest limit edits survive a reload (QA P1)", () => {
  beforeEach(() => mem.clear());

  it("an edit made before the read's first autosave is stamped, not stored as the sheet's value", async () => {
    const read = await freshRead();
    assert.equal(read.result.card.environmentals.relativeHumidityMax, null, "RH max not stated on this sheet");
    const p = gw.guestCreateProject("Tank A", "22201");
    // One autosave carrying the fresh read and the edited card (edit inside the 600 ms debounce).
    const steps = readThenEdits({ id: p.id, card: edit(read.result.card, EDITS), extract: extractForSave(read) }, read.result.card);
    assert.equal(steps.length, 2, "read first, then the edits");
    assert.equal(steps[0]!.card, read.result.card);
    assert.ok(!("extract" in steps[1]!), "the edit save does not resend the read");
    for (const step of steps) gw.guestSaveProject(step);
    assertEdited(p.id, EDITS);
  });

  it("the same read sent again after the edit and the reload does not overwrite the mark or the value", async () => {
    const read = await freshRead();
    const p = gw.guestCreateProject("Tank B", "22201");
    gw.guestSaveProject({ id: p.id, card: read.result.card, extract: extractForSave(read) });
    gw.guestSaveProject({ id: p.id, card: edit(read.result.card, EDITS) });
    assertEdited(p.id, EDITS);
    // Sheet re-read replayed after the debounce: the read's extract again, with the card on screen.
    const reopened = gw.guestOpenProject(p.id);
    gw.guestSaveProject({ id: p.id, card: reopened.card, extract: extractForSave(read) });
    assertEdited(p.id, EDITS);
    // ...and with the race path's two steps replayed too.
    for (const step of readThenEdits({ id: p.id, card: reopened.card, extract: extractForSave(read) }, read.result.card))
      gw.guestSaveProject(step);
    assertEdited(p.id, EDITS);
  });

  it("a genuinely new read still replaces the stored read", async () => {
    const first = await freshRead();
    const p = gw.guestCreateProject("Tank C", "22201");
    gw.guestSaveProject({ id: p.id, card: first.result.card, extract: extractForSave(first) });
    const second = await freshRead();
    second.result.card = { ...second.result.card, extractedAt: new Date(Date.parse(first.result.card.extractedAt) + 1000).toISOString() };
    gw.guestSaveProject({ id: p.id, card: second.result.card, extract: extractForSave(second) });
    const r = reload(p.id);
    assert.equal(limitSource("environmentals.substrateTempMinF", r.card, r.asRead, r.provenance).kind, "sheet");
  });

  it("no edit, or no fresh read: one save, unchanged", async () => {
    const read = await freshRead();
    const plain = { id: "x", card: read.result.card, extract: extractForSave(read) };
    assert.deepEqual(readThenEdits(plain, read.result.card), [plain]);
    const noRead = { id: "x", card: edit(read.result.card, EDITS) };
    assert.deepEqual(readThenEdits(noRead, read.result.card), [noRead]);
  });
});
