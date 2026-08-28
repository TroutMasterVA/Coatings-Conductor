import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { selectedMitigationLabels } from "./pdf-card.ts";
import type { SiteContext } from "./mitigations.ts";
import type { CustomMitigation } from "./types.ts";

function custom(id: string, label: string): CustomMitigation {
  return {
    id,
    label,
    summary: "",
    helps: [],
    createdAt: "2026-08-28T00:00:00Z",
    samples: 0,
    dAirF: 0,
    dSubstrateF: 0,
    dRh: 0,
    dDewF: 0,
    dWindMph: 0,
    sunMul: 1,
    notes: "",
  };
}

describe("stand PDF selected mitigations", () => {
  it("lists built-in labels", () => {
    const site: SiteContext = { substrate: "bare_steel", mitigations: ["canopy", "rain_tarp"] };
    assert.deepEqual(selectedMitigationLabels(site), ["Canopy / sunshade", "Rain tarping"]);
  });

  it("includes this job's selected custom mitigations", () => {
    const site: SiteContext = {
      substrate: "bare_steel",
      mitigations: ["canopy"],
      customMitigationIds: ["c1"],
      customMitigations: [custom("c1", "Shop heat"), custom("c2", "Extra tent")],
    };
    assert.deepEqual(selectedMitigationLabels(site), ["Canopy / sunshade", "Shop heat"]);
  });

  it("returns empty when none are selected", () => {
    assert.deepEqual(selectedMitigationLabels({ substrate: "bare_steel", mitigations: [] }), []);
    assert.deepEqual(selectedMitigationLabels(undefined), []);
  });
});
