import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildCardFromPds } from "./on-device-extract.ts";
import { buildLaymanBullets } from "./layman-bullets.ts";
import { SAMPLE_PDS_TEXT } from "./samples.ts";

describe("layman bullets from on-device extract", () => {
  it("covers substrates, prep gates, and go gates for Macropoxy", () => {
    const card = buildCardFromPds(SAMPLE_PDS_TEXT.macropoxy);
    const bullets = buildLaymanBullets(card);
    const text = bullets.join(" | ");
    assert.match(text, /Macropoxy/i);
    assert.ok(
      /Substrates:/i.test(text) || /Steel immersion:|Steel non-immersion:/i.test(text),
      "expected substrates or per-gate prep lines",
    );
    assert.ok(/Prep gates:|Steel immersion:|Steel non-immersion:|SSPC|NACE/i.test(text));
    assert.match(text, /SSPC|NACE|AMPP/i);
    assert.match(text, /Go gates:/i);
    assert.match(text, /dew spread/i);
    assert.match(text, /no rain/i);
    assert.ok(bullets.length >= 4);
    assert.equal(bullets.some((b) => /Review every field/i.test(b)), false);
    assert.ok((card.surfacePrep.prepGates?.length ?? 0) >= 2, "Macropoxy should yield immersion + atmospheric gates");
  });

  it("does not invent dew when the sheet is silent", () => {
    const sheet = `
Product data sheet — zinc primer for carbon steel
Mix ratio 4:1 by volume. Pot life 6 hours.
DFT 3 mils. Ambient 50-90 F. Recoat 8 hours.
Surface preparation SSPC-SP6.
Service: atmospheric steel.
`;
    const card = buildCardFromPds(sheet);
    const bullets = buildLaymanBullets(card);
    assert.match(bullets.join(" "), /dew spread not stated/i);
    assert.equal(card.environmentals.dewPointSpreadMinF, null);
  });

  it("handles sealant / adhesive style sheets", () => {
    const card = buildCardFromPds(SAMPLE_PDS_TEXT.dymonic);
    const bullets = buildLaymanBullets(card);
    assert.match(bullets.join(" "), /Dymonic|Tremco|sealant|joint|Service:/i);
  });
});
