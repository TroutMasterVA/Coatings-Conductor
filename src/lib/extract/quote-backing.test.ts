import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { onDeviceProvider } from "./on-device-provider.ts";
import { gateRemote } from "./extract-core.ts";
import { leaves, quoteBacksValue, quoteIsVerbatim } from "./provenance.ts";
import { pageText, type PositionedItem } from "../pdf-lines.ts";
import { flatPageText } from "../pdf-text.ts";
import { heuristicExtract } from "../heuristic-extract.ts";

const items = (name: string) =>
  JSON.parse(readFileSync(new URL(`../fixtures/pdf-items/${name}.p1.json`, import.meta.url), "utf8")) as PositionedItem[];

// Shared quote gate (QA item 2): a shown value with a number must have a quote that contains it.
describe("every shown value's number appears in its own quote", () => {
  for (const name of ["sw_macropoxy646fc", "intl_interthane990"]) {
    for (const [mode, text] of [
      ["browser flat text", flatPageText(items(name))],
      ["server line text", pageText(items(name))],
    ] as const) {
      it(`${name} (${mode})`, async () => {
        const r = await onDeviceProvider.extract({ pages: [text] });
        let checked = 0;
        for (const l of leaves(r.card)) {
          if (typeof l.value !== "string" && typeof l.value !== "number") continue;
          if (!/\d/.test(String(l.value)) || l.value === "") continue;
          const p = r.provenance[l.path];
          if (p === undefined) continue; // structural / inferred guidance, not a sheet value
          assert.notEqual(p, "not-stated", `${l.path} shown but marked not-stated`);
          if (p === "not-stated") continue;
          // "N h at 50°F": the temperature is the column header; the row's own numbers must be quoted.
          const core = typeof l.value === "string" ? l.value.replace(/ at -?\d+(?:\.\d+)?°F(?=,|$)/g, "") : l.value;
          assert.ok(quoteBacksValue(l.path, core, p.quote), `${l.path}=${l.value} not in quote "${p.quote}"`);
          assert.ok(quoteIsVerbatim(p.quote, text), `${l.path} quote not on the sheet`);
          checked++;
        }
        assert.ok(checked >= 3, `checked ${checked}`);
        assert.equal(r.draft, true);
      });
    }
  }
  it("a run-on line (browser flat text) quotes the temperature, not the page header in front of it", async () => {
    const header = "Protective & Marine Coatings PRODUCT DATA SHEET Revised: September 23, 2026 Ref: 1101-1 www.example.com Page 2 of 2 ".repeat(2);
    const flat = `ACME 35 FAST CURE EPOXY ${header} APPLICATION CONDITIONS Temperature: Air: 35°F (1.7°C) minimum, 120°F (49°C) maximum Surface*: 35°F (1.7°C) minimum, 250°F (120°C) maximum`;
    const r = await onDeviceProvider.extract({ pages: [flat] });
    for (const k of ["environmentals.ambientTempMinF", "environmentals.substrateTempMinF"]) {
      const p = r.provenance[k];
      assert.ok(p && p !== "not-stated" && /35°F/.test(p.quote) && !/PRODUCT DATA SHEET/.test(p.quote), `${k}: ${JSON.stringify(p)}`);
    }
  });
  it("synthetic: a quote that is the title never backs a number, and the value drops", () => {
    const title = "ACME 500 FAST CURE EPOXY";
    assert.equal(quoteBacksValue("environmentals.ambientTempMinF", 50, title), false);
    assert.equal(quoteBacksValue("installation.filmThickness", "4-6 mils", title), false);
    const card = heuristicExtract(" ");
    card.environmentals.ambientTempMinF = 50;
    const input = { text: `${title}\nApply by brush or roller.` };
    const g = gateRemote(
      {
        card,
        provenance: { "environmentals.ambientTempMinF": { quote: title } },
        provider: "azure",
        warnings: [],
        draft: false,
        unverifiedTemps: false,
      },
      input,
    );
    assert.equal(g.card.environmentals.ambientTempMinF, null);
    assert.equal(g.provenance["environmentals.ambientTempMinF"], "not-stated");
    assert.equal(g.draft, true);
    assert.ok(g.warnings.some((w) => w.code === "VALUES_DROPPED_UNQUOTED"));
  });
});
