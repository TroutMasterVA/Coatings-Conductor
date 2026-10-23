/**
 * be-9: film thickness, product title, and standard names. Real lines from QA's sheets
 * (/workspace/cc-qa/out/*.apptext.txt) plus synthetic fixtures; general rules, no sheet tuning.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { heuristicExtract } from "./heuristic-extract.ts";
import { filmThicknessFromText, maskStandards, productTitleFromText } from "./sheet-title-film.ts";

// Real Macropoxy 646 Fast Cure text (pdf.js, flattened).
const MP_HEAD =
  "MACROPOXY ® 646 FAST CURE EPOXY MASTIC Protective & Marine Coatings PRODUCT DATA SHEET Revised: September 23, 2026 Ref: 1101-1 www.sherwin-williams.com/protective Page 1 of 2 PRODUCT DESCRIPTION MACROPOXY 646 Fast Cure Epoxy Mastic is a high solids, high build, fast drying, polyamide epoxy";
const MP_THICK =
  "Typical Thickness: Recommended Spreading Rate per coat: Minimum Maximum Wet mils (microns) 7.0 (175) 13.5 (338) Dry mils (microns) 5.0* (125) 10.0 (250) ~Coverage sq ft/gal (m 2 /L) 115 (2.9) 230 (5.8) Theoretical coverage sq ft/gal (m 2 /L) @ 1 mil / 25 microns dft 1152 (28.2) *May be applied at 3.0-10.0 mils (75-250 microns) dft as an intermediate in a multicoat system.";
const MP_PREP =
  "Minimum recommended surface preparation: Iron & Steel: Atmospheric: SSPC-SP2/3/ ISO8501-1:2007 St 2 or SSPC-SP WJ-3 / NACE WJ-3L Immersion: SSPC-SP10 / NACE 2/ ISO8501-1:2007 Sa 2.5, 2-3 mil (50-75 micron) pro fi le or SSPC-SP WJ-2/NACE WJ-2L Stainless Steel: Atmospheric: SSPC-SP16, 1 mil (25 micron) pro fi le Aluminum & Galvanizing: SSPC-SP1.";

describe("film thickness (dry)", () => {
  it("Macropoxy 646: the 'Dry mils (microns)' row of the spreading-rate table, not the 1152 coverage", () => {
    const v = filmThicknessFromText(MP_THICK);
    assert.equal(v, "5.0–10.0 mils");
    assert.doesNotMatch(v, /1152/);
    assert.equal(
      heuristicExtract(`${MP_HEAD}\n${MP_THICK}`).installation.filmThickness,
      "5.0–10.0 mils",
    );
  });

  it("'Dry mils: 2.4-4.0': the label's unit applies to the range (SW Pro Industrial DTM)", () => {
    assert.equal(
      filmThicknessFromText(
        "Recommended Spreading Rate per coat: Wet mils: 6.0-10.0 Dry mils: 2.4-4.0 Coverage: 160-267 sq. ft. per gallon",
      ),
      "2.4–4.0 mils",
    );
  });

  it("labelled DFT with a unit (Carbozinc, Tnemec, Amercoat, Rust-Oleum lines)", () => {
    assert.equal(
      filmThicknessFromText(
        "Dry Film Thickness Minimum 2.0-3.0 mils (50-75 microns) for optimum corrosion protection.",
      ),
      "2.0-3.0 mils (50-75 microns)",
    );
    assert.equal(
      filmThicknessFromText("DRY FILM THICKNESS 2.5 to 3.5 mils (65 to 90 microns) per coat."),
      "2.5 to 3.5 mils (65 to 90 microns)",
    );
    assert.equal(
      filmThicknessFromText("Dry film thickness (per coat) 2-5 mils (50-125 microns) Coats 1 or 2"),
      "2-5 mils (50-125 microns)",
    );
    assert.equal(
      filmThicknessFromText(
        "For proper performance, a dry film thickness of 5-8 mils per coat is required.",
      ),
      "5-8 mils",
    );
  });

  it("a value followed by 'dry' (Interthane 990), but not a drying-time phrase", () => {
    assert.equal(
      filmThicknessFromText(
        "50-75 microns (2-3 mils) dry equivalent to 88-132 microns (3.5-5.3 mils) wet",
      ),
      "50-75 microns (2-3 mils)",
    );
    assert.equal(filmThicknessFromText("At 5 mils dry to touch in 2 hours"), "");
  });

  it("a coverage basis '@ 1 mil DFT' or a coverage figure is never a film thickness", () => {
    assert.equal(
      filmThicknessFromText("Theoretical coverage sq ft/gal @ 1 mil / 25 microns dft 1152 (28.2)"),
      "",
    );
    assert.equal(
      filmThicknessFromText("Theoretical coverage at 1 mil DFT (25μ) 1,250-1,300 sq.ft./gal."),
      "",
    );
    assert.equal(filmThicknessFromText("DFT: see specification"), "");
  });

  it("no DFT / dry-mils label: Not stated (a profile '2-3 mil' is not a film)", () => {
    assert.equal(filmThicknessFromText(MP_PREP), "");
    assert.equal(
      filmThicknessFromText(
        "Wet film thickness 7-14 mils. Theoretical spreading rate 115 sq ft/gal.",
      ),
      "",
    );
  });
});

describe("product title", () => {
  it("Macropoxy 646: the title, not 'DATA SHEET Revised: …'", () => {
    assert.equal(productTitleFromText(MP_HEAD), "MACROPOXY 646 FAST CURE EPOXY MASTIC");
    assert.equal(
      heuristicExtract(`${MP_HEAD}\n${MP_THICK}`).product.name,
      "MACROPOXY 646 FAST CURE EPOXY MASTIC",
    );
  });

  it("boilerplate first, title after (Jotun template line, Tnemec, Carbozinc)", () => {
    assert.equal(
      productTitleFromText(
        "^(ValidationDate) 515 515;519;527;1549 1,2 epoxy mastic Technical Data Sheet Jotamastic 87 Product description This is a two component",
      ),
      "Jotamastic 87",
    );
    assert.equal(
      productTitleFromText(
        "TNEME-ZINC PRODUCT DATA SHEET SERIES 90-97 PRODUCT PROFILE GENERIC DESCRIPTION",
      ),
      "TNEME-ZINC",
    );
    assert.equal(
      productTitleFromText(
        "Carbozinc ® 11 Includes Carbozinc 11 FG August 2010 replaces May 2010 0250 To the best of our knowledge",
      ),
      "Carbozinc 11",
    );
  });

  it("index number, issue date and URL are stripped (SW Pro Industrial)", () => {
    assert.equal(
      productTitleFromText(
        "113.08 Pro Industrial ™ DTM Acrylic Gloss B66–1050 Series 5/2023 www.sherwin-williams.com continued on back CHARACTERISTICS",
      ),
      "Pro Industrial DTM Acrylic Gloss B66–1050 Series",
    );
  });

  it("a lone category tag is skipped (Rust-Oleum 'EPOXY TECHNICAL DATA …')", () => {
    assert.equal(
      productTitleFromText(
        "EPOXY TECHNICAL DATA RO-139 HIGH PERFORMANCE 9100 SYSTEM DTM EPOXY MASTIC 1 Form: ARJ-1503 Rev.: 091922 DESCRIPTION AND USES",
      ),
      "RO-139 HIGH PERFORMANCE 9100 SYSTEM DTM EPOXY MASTIC 1",
    );
  });

  it("line layout: company and segment lines are not the title", () => {
    assert.equal(
      productTitleFromText(
        "Sherwin-Williams\nProtective & Marine Coatings\nPRODUCT DATA SHEET\nACME 123 POLYURETHANE\nRevised: 01/2026",
      ),
      "ACME 123 POLYURETHANE",
    );
    assert.equal(
      productTitleFromText(
        "PRODUCT DATA SHEET — Macropoxy 646 Fast Cure\nManufacturer: Sherwin-Williams",
      ),
      "Macropoxy 646 Fast Cure",
    );
    assert.equal(
      productTitleFromText("Product name: Hydro Shield 7\nRevised 2026"),
      "Hydro Shield 7",
    );
  });

  it("nothing but boilerplate, a sentence, or a bullet list: Not stated, never 'DATA SHEET'", () => {
    for (const head of [
      "PRODUCT DATA SHEET Revised: September 23, 2026 Ref: 1101-1 www.example.com Page 1 of 2 PRODUCT DESCRIPTION",
      "Product Data Description: Recommended use: Service temperature:",
      "A two component aliphatic acrylic polyurethane finish giving excellent durability. PRODUCT DESCRIPTION",
      "Product Data/ Application Instructions • Gloss topcoat with unlimited recoatability • Low VOC",
      "Technical Data Sheet",
    ]) {
      const v = productTitleFromText(head);
      assert.equal(v, "", head);
      assert.doesNotMatch(heuristicExtract(head).product.name, /data\s+sheet/i);
    }
  });
});

describe("standard names never yield a temperature", () => {
  it("Macropoxy prep line (SSPC-SP2/3 / ISO8501-1:2007 St 2) -> no air/surface temperature", () => {
    const e = heuristicExtract(MP_PREP).environmentals;
    assert.deepEqual(
      [e.ambientTempMinF, e.ambientTempMaxF, e.substrateTempMinF, e.substrateTempMaxF],
      [null, null, null, null],
    );
  });

  it("other standards near a surface/air label carry no temperature", () => {
    for (const s of [
      "Surface preparation: ISO 8501-1 Sa 2½ to SSPC-SP10",
      "Surface: NACE No. 2 / SSPC-SP 10 and ASTM D4417",
      "Steel surfaces: SSPC-SP6/NACE 3, profile per ASTM D4417-B",
      "Air spray per ISO 12944-5 and AS/NZS 2312.1",
    ]) {
      const e = heuristicExtract(s).environmentals;
      assert.deepEqual(
        [e.ambientTempMinF, e.ambientTempMaxF, e.substrateTempMinF, e.substrateTempMaxF],
        [null, null, null, null],
        s,
      );
    }
  });

  it("masking keeps real temperatures", () => {
    assert.equal(
      maskStandards("Air temperature 50°F to 90°F, SSPC-SP2"),
      "Air temperature 50°F to 90°F, STD",
    );
    const e = heuristicExtract(
      "Surface preparation SSPC-SP6. Air and surface temperature 50-100°F",
    ).environmentals;
    assert.equal(e.ambientTempMinF ?? e.substrateTempMinF, 50);
  });
});
