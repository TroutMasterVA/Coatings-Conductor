import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { heuristicExtract } from "./heuristic-extract.ts";
import { parsePrepBySubstrate } from "./prep-by-substrate.ts";

/**
 * Manufacturer-agnostic proof fixture modeled on Carbomastic 615–style
 * sectioned prep language (immersion / non-immersion / concrete / non-ferrous).
 * Not a product-specific parser — the heuristic must read the sections.
 */
const CARBOMASTIC_615_STYLE_PDS = `
Product data sheet
Carbomastic 615
Manufacturer: Carboline
Generic Type: Aluminum-pigmented epoxy mastic
Mix ratio: 1:1 by volume
Pot life: 2 hours at 75 F
DFT: 5-7 mils
Ambient: 50-90 F
Surface must be at least 5°F above the dew point.
Do not apply if rain is imminent.

SURFACE PREPARATION

Immersion Service
NACE No. 2 / SSPC-SP10 Near-White Metal Blast Cleaning.
Anchor profile 2-3 mils.

Non-Immersion Service
NACE No. 3 / SSPC-SP6 Commercial Blast Cleaning preferred.
Alternates: SSPC-SP2 Hand Tool Cleaning, SSPC-SP3 Power Tool Cleaning.

Concrete
NACE No. 6 / SSPC-SP13 Surface Preparation of Concrete.
ICRI CSP 3-5.

Non-Ferrous Metals
SSPC-SP16 Brush-Off Blast Cleaning of Coated and Uncoated Galvanized Steel,
Stainless Steels, and Non-Ferrous Metals. SSPC-SP17.
`;

describe("prep-by-substrate (Carbomastic 615–style fixture)", () => {
  it("parses four substrate families with methods and profiles tied to each gate", () => {
    const gates = parsePrepBySubstrate(CARBOMASTIC_615_STYLE_PDS);
    const byFamily = Object.fromEntries(gates.map((g) => [g.family, g]));

    assert.ok(byFamily["steel-immersion"], "Steel immersion gate missing");
    assert.ok(
      byFamily["steel-immersion"].methods.some((m) => /NACE\s*2/i.test(m)),
      "immersion should include NACE 2",
    );
    assert.ok(
      byFamily["steel-immersion"].methods.some((m) => /SSPC-SP10/i.test(m)),
      "immersion should include SSPC-SP10",
    );
    assert.match(byFamily["steel-immersion"].profile, /2-3\s*mil/i);

    assert.ok(byFamily["steel-non-immersion"], "Steel non-immersion gate missing");
    assert.ok(
      byFamily["steel-non-immersion"].methods.some((m) => /NACE\s*3/i.test(m)),
      "non-immersion should include NACE 3",
    );
    assert.ok(
      byFamily["steel-non-immersion"].methods.some((m) => /SSPC-SP6/i.test(m)),
      "non-immersion should include SSPC-SP6",
    );
    assert.ok(
      byFamily["steel-non-immersion"].methods.some((m) => /SSPC-SP2/i.test(m)),
      "non-immersion alternates should include SSPC-SP2",
    );

    assert.ok(byFamily.concrete, "Concrete gate missing");
    assert.ok(
      byFamily.concrete.methods.some((m) => /NACE\s*6/i.test(m)),
      "concrete should include NACE 6",
    );
    assert.ok(
      byFamily.concrete.methods.some((m) => /SSPC-SP13/i.test(m)),
      "concrete should include SSPC-SP13",
    );
    assert.ok(
      byFamily.concrete.methods.some((m) => /ICRI\s*CSP/i.test(m)),
      "concrete should include ICRI CSP when stated",
    );

    assert.ok(byFamily["non-ferrous"], "Non-ferrous gate missing");
    assert.ok(
      byFamily["non-ferrous"].methods.some((m) => /SSPC-SP16/i.test(m)),
      "non-ferrous should include SSPC-SP16",
    );
    assert.ok(
      byFamily["non-ferrous"].methods.some((m) => /SSPC-SP17/i.test(m)),
      "non-ferrous should include SSPC-SP17",
    );
  });

  it("heuristicExtract surfaces prepGates and does not collapse to Concrete-only", () => {
    const card = heuristicExtract(CARBOMASTIC_615_STYLE_PDS);
    const labels = card.surfacePrep.substrates;
    assert.ok(labels.includes("Steel immersion"));
    assert.ok(labels.includes("Steel non-immersion"));
    assert.ok(labels.includes("Concrete"));
    assert.ok(labels.includes("Non-ferrous metals"));
    assert.equal(card.surfacePrep.prepGates.length, 4);

    const immersion = card.surfacePrep.prepGates.find((g) => g.family === "steel-immersion");
    assert.ok(immersion);
    assert.match(immersion.profile, /2-3/);

    // Immersion profile must not be the only top-level profile when multiple gates exist.
    assert.equal(card.surfacePrep.profile, "");

    // Env drivers still accurate (feeds score-windows).
    assert.equal(card.environmentals.dewPointSpreadMinF, 5);
    assert.equal(card.environmentals.precipitationAllowed, false);
  });

  it("stays silent when prep gates are not stated", () => {
    const thin = `
Product data sheet — field epoxy
Mix ratio 1:1 by volume. Pot life 2 hours.
DFT 5-8 mils. Air and surface 40-100 F.
Surface must be at least 5°F above the dew point.
`;
    const gates = parsePrepBySubstrate(thin);
    assert.equal(gates.length, 0);
    const card = heuristicExtract(thin);
    assert.deepEqual(card.surfacePrep.prepGates, []);
    assert.deepEqual(card.surfacePrep.substrates, []);
  });
});
