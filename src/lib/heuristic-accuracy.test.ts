import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  heuristicExtract,
  temperatureGates,
  dewPointSpreadFromText,
  mixRatioFromText,
  relativeHumidityMaxFromText,
  capToOneLine,
} from "./heuristic-extract.ts";

// Real snippets (pdf.js text as the app sees it) from QA's 10-sheet run, /workspace/cc-qa (Oct 18, 2026).
// Each one produced an invented number before this change. Silent → null, never a guess.
const S_CARBOLINE_CARBOZINC11_0 =
  "cceptable. CZ 11 CZ 11 FG Solids Content By Weight: 79% ± 2% 74% + 2% Zinc Content In dry film By Weight: 85% ± 2% 79% + 2% Theoretical Coverage Rate CZ 11: 1000 mil ft 2 (24.9 m 2 /l at 25 microns) 333 ft 2 at 3.0 mils (8.3 m 2 /l at 75 microns) CZ 11 FG: 850 mil ft 2 (21.2 m 2 /l at 25 microns) 283 ft 2 at 3";
const S_CARBOLINE_CARBOZINC11_1 =
  "ecommended by your Carboline sales representative. Under certain conditions, a mist coat is required to minimize topcoat bubbling. Dry Film Thickness Minimum 2.0-3.0 mils (50-75 microns) for optimum corrosion protection. Dry film thickness up to 6.0 mils (150 microns) is acceptable. CZ 11 CZ 11 FG Solids Content By Wei";
const S_CARBOLINE_CARBOZINC11_2 =
  " Employ adequate methods to remove dirt, dust, oil and all other contaminants that could interfere with adhesion of the coating. Steel Non-Immersion: SSPC-SP6 and obtain a 1.0-3.0 mil (25-75 micron) angular blast profile. Performance Data CZ 11 Test Method System Results ASTM A-325 Slip Co-efficient Blasted";
const S_HEMPEL_HEMPADUR15570_3 =
  "ballast tanks of chemical carriers) to be abrasive blast cleaned to a uniform, sharp, dense profile (Rugotest No. 3, BN9a, ISO Comparator Medium (G), Keane-Tator Comparator 2. 0 G/S) corresponding to Rz minimum 50 micron. Any salts, grease, oil, etc. to be removed before abrasive blasting is commenced. Maintenance: Remove oil and g";
const S_HEMPEL_HEMPADUR15570_4 =
  "ools: Page: 1/2 - Product Data Sheet Date of issue: December 2012\n\nSURFACE PREPARATION: New steel: Abrasive blasting to Sa 2½ (ISO 8501-1:2007). For temporary protection, if required, use a suitable shopprimer. All damage of shopprimer and contamination from storage and fabrication shou";
const S_HEMPEL_MULTI_US_5 =
  "ive blasting to min. PSa 2½ (ISO 8501-2) / SP 10 (SSPC). - Concrete: According to Hempel’s Specification. Roughness - Surface profile Medium (G) (ISO 8503-2). Consult Hempel's separate Surface Preparation Guidelines for more details. Application Mixing ratio Base 35539 : Curing agent 95530 (3 : 1 by volum";
const S_HEMPEL_MULTI_US_6 =
  "itable detergent cleaning. - Remove salts, detergents and other contaminants by high pressure fresh water cleaning. New build: - Abrasive blasting to min. Sa 2½ (ISO 8501-1) / SP 10 (SSPC). - Remove dust, blast media and loose materials. - Concrete: According to Hempel’s Specification. - Remove damaged shopprimer and any contamination prior to painting. Mai";
const S_INTL_INTERTHANE990_7 =
  "hose containing alcohols, can severely affect the curing mechanism of the coating. Surface temperature must always be a minimum of 3°C (5°F) above dew point. When applying Interthane 990 in confined spaces ensure adequate ventilation. Interthane 990 is capable of curing";
const S_JOTUN_JOTAMASTIC87_US_8 =
  "ic 87 Wintergrade Comp B 1 part(s) Jotamastic 87 Standard Comp B Thinner/Cleaning solvent Thinner: Jotun Thinner No. 17 Nozzle tip (inch/1000): Pressure at nozzle (minimum): Guiding data for airless spray 19-25 150 bar/2100 psi Date of issue: 27 June 2024 Page: 3/6 This technical data sheet supersedes those previously issued. Th";
const S_JOTUN_JOTAMASTIC87_US_9 =
  "uct. For your nearest local Jotun office, please visit our website at www.jotun.com\n\nTechnical Data Sheet Jotamastic 87 Substrate Minimum Recommended St 2 (ISO 8501-1) or SSPC SP-2 Carbon steel Sa 2 (ISO 8501-1) / SP 6 / NACE No. 3 (SSPC-VIS 1) Shop primed steel Clean, dry and undamaged shop primer (ISO";
const S_PPG_AMERCOAT450H_10 =
  " F˚/C˚ 90/32 70/21 50/10 2 4 6 Dry times F˚/C˚ 90/32 70/21 50/10 touch (minutes) 10 30 90 through (hours) 4 8 24 Recoat times F˚/C˚ 90/32 70/21 50/10 minimum (hours) 2 4 12 maximum Unlimited* *Surface must be dry and free of all contaminants. (w/866m accelerator) 90/32 70/21 50/10 32/";
const S_RUSTOLEUM_9100_11 =
  "shing the surface with Krud Kutter ® Original Cleaner Degreaser or other suitable cleaner. Rinse with fresh water and allow to dry. STEEL: Hand tool (SSPC-SP-2) or power tool (SSPC-SP-3) clean to remove loose rust, scale, and deteriorated previous coatings to obtain a sound rusted surface. For optimum corros";
const S_SW_MACROPOXY646FC_12 =
  "grease, dirt, loose rust, and other foreign material to ensure adequate adhesion. Minimum recommended surface preparation: Iron & Steel: Atmospheric: SSPC-SP2/3/ ISO8501-1:2007 St 2 or SSPC-SP WJ-3 / NACE WJ-3L Immersion: SSPC-SP10 / NACE 2/ ISO8501-1:2007 Sa 2.5, 2-3 mil (50-75 micron) pro fi le or SSPC-SP WJ-2/NACE WJ-2L Stainless Steel: Atmospheric: SSPC-SP16, 1 mil (25 micron) pro fi le Aluminum & Galva";
const S_SW_PROINDUSTRIAL_DTM_ACRYLIC_13 =
  ". Hose ¼ inch I.D. Tip .017-.021 inch Filter 60 mesh Conventional Spray: Gun Binks 95 Fluid Nozzle 66 Air Nozzle 63 PB Atomization Pressure 50 p.s.i. Fluid Pressure 10-20 p.s.i. Reduction: Not Recommended Brush: Nylon-polyester Roller Cover: 1/4-3/8 inch woven If specific application";
const S_TNEMEC_90_97_14 =
  "TNEME-ZINC PRODUCT DATA SHEET SERIES 90-97 PRODUCT PROFILE GENERIC DESCRIPTION Aromatic Urethane, Zinc-Rich COMMON USAGE An advanced technology, two-component, moisture-cured, zinc-rich primer providing extraordinary performance. It’s user fr";

const env = (t: string) => heuristicExtract(t).environmentals;

describe("QA regression: the 24 invented values", () => {
  it("SW Macropoxy 646: 'SSPC-SP2/3' is not a surface min of 2°F", () => {
    const v = env(S_SW_MACROPOXY646FC_12).substrateTempMinF;
    assert.notEqual(v, 2);
    assert.equal(v, null);
  });
  it("SW Macropoxy 646: 'ISO8501-1' is not a surface max of 1°F", () => {
    const v = env(S_SW_MACROPOXY646FC_12).substrateTempMaxF;
    assert.notEqual(v, 1);
    assert.equal(v, null);
  });
  it("Tnemec 90-97: product name 'SERIES 90-97' is not an air min of 90°F", () => {
    const v = env(S_TNEMEC_90_97_14).ambientTempMinF;
    assert.notEqual(v, 90);
    assert.equal(v, null);
  });
  it("Tnemec 90-97: product name 'SERIES 90-97' is not an air max of 97°F", () => {
    const v = env(S_TNEMEC_90_97_14).ambientTempMaxF;
    assert.notEqual(v, 97);
    assert.equal(v, null);
  });
  it("Interthane 990: a 3°C dew margin is not an air min of 37°F", () => {
    const v = env(S_INTL_INTERTHANE990_7).ambientTempMinF;
    assert.notEqual(v, 37);
    assert.equal(v, null);
  });
  it("Interthane 990: a 3°C (5°F) dew margin is 5°F, not 37°F", () => {
    const v = env(S_INTL_INTERTHANE990_7).dewPointSpreadMinF;
    assert.notEqual(v, 37);
    assert.equal(v, 5);
  });
  it("Amercoat 450H: 'minimum (hours) 2' is not an air min of 2°F", () => {
    const v = env(S_PPG_AMERCOAT450H_10).ambientTempMinF;
    assert.notEqual(v, 2);
    assert.equal(v, null);
  });
  it("Jotamastic 87: 'Nozzle tip … 19-25' is not an air min of 19°F", () => {
    const v = env(S_JOTUN_JOTAMASTIC87_US_8).ambientTempMinF;
    assert.notEqual(v, 19);
    assert.equal(v, null);
  });
  it("Jotamastic 87: 'Nozzle tip … 19-25' is not an air max of 25°F", () => {
    const v = env(S_JOTUN_JOTAMASTIC87_US_8).ambientTempMaxF;
    assert.notEqual(v, 25);
    assert.equal(v, null);
  });
  it("Jotamastic 87: 'St 2' is not a surface min of 2°F", () => {
    const v = env(S_JOTUN_JOTAMASTIC87_US_9).substrateTempMinF;
    assert.notEqual(v, 2);
    assert.equal(v, null);
  });
  it("Jotamastic 87: 'ISO 8501-1' is not a surface max of 1°F", () => {
    const v = env(S_JOTUN_JOTAMASTIC87_US_9).substrateTempMaxF;
    assert.notEqual(v, 1);
    assert.equal(v, null);
  });
  it("Hempadur 15570: 'Rz minimum 50 micron' is not an air min of 50°F", () => {
    const v = env(S_HEMPEL_HEMPADUR15570_3).ambientTempMinF;
    assert.notEqual(v, 50);
    assert.equal(v, null);
  });
  it("Hempadur 15570: 'Sa 2½' is not a surface min of 2°F", () => {
    const v = env(S_HEMPEL_HEMPADUR15570_4).substrateTempMinF;
    assert.notEqual(v, 2);
    assert.equal(v, null);
  });
  it("Hempadur 15570: 'ISO 8501-1' is not a surface max of 1°F", () => {
    const v = env(S_HEMPEL_HEMPADUR15570_4).substrateTempMaxF;
    assert.notEqual(v, 1);
    assert.equal(v, null);
  });
  it("Hempadur Multi-Strength: 'min. Sa 2½' is not an air min of 2°F", () => {
    const v = env(S_HEMPEL_MULTI_US_6).ambientTempMinF;
    assert.notEqual(v, 2);
    assert.equal(v, null);
  });
  it("Hempadur Multi-Strength: 'ISO 8503-2' is not a surface min of 8503°F", () => {
    const v = env(S_HEMPEL_MULTI_US_5).substrateTempMinF;
    assert.notEqual(v, 8503);
    assert.equal(v, null);
  });
  it("Hempadur Multi-Strength: 'ISO 8503-2' is not a surface max of 2°F", () => {
    const v = env(S_HEMPEL_MULTI_US_5).substrateTempMaxF;
    assert.notEqual(v, 2);
    assert.equal(v, null);
  });
  it("Carbozinc 11: 'Minimum 2.0-3.0 mils' is not an air min of 2°F", () => {
    const v = env(S_CARBOLINE_CARBOZINC11_1).ambientTempMinF;
    assert.notEqual(v, 2);
    assert.equal(v, null);
  });
  it("Carbozinc 11: 'SSPC-SP6' is not a surface min of 6°F", () => {
    const v = env(S_CARBOLINE_CARBOZINC11_2).substrateTempMinF;
    assert.notEqual(v, 6);
    assert.equal(v, null);
  });
  it("Carbozinc 11: '1.0-3.0 mil' is not a surface max of 3°F", () => {
    const v = env(S_CARBOLINE_CARBOZINC11_2).substrateTempMaxF;
    assert.notEqual(v, 3);
    assert.equal(v, null);
  });
  it("Rust-Oleum 9100: 'SSPC-SP-2' is not a surface min of 2°F", () => {
    const v = env(S_RUSTOLEUM_9100_11).substrateTempMinF;
    assert.notEqual(v, 2);
    assert.equal(v, null);
  });
  it("Rust-Oleum 9100: 'SSPC-SP-3' is not a surface max of 3°F", () => {
    const v = env(S_RUSTOLEUM_9100_11).substrateTempMaxF;
    assert.notEqual(v, 3);
    assert.equal(v, null);
  });
  it("SW DTM Acrylic: 'Fluid Pressure 10-20 p.s.i.' is not an air max of 20°F", () => {
    const v = env(S_SW_PROINDUSTRIAL_DTM_ACRYLIC_13).ambientTempMaxF;
    assert.notEqual(v, 20);
    assert.equal(v, null);
  });
  it("Carbozinc 11: 'CZ 11: 1000 mil ft2' is not a mix ratio of 11:1000", () => {
    const card = heuristicExtract(S_CARBOLINE_CARBOZINC11_0);
    assert.equal(card.mixing.ratio, "");
    assert.equal(card.product.mixRatio, "");
  });
});

describe("°C/°F ranges convert each end by its own unit (#29)", () => {
  const sub = (t: string) => {
    const e = env(t);
    return [e.substrateTempMinF, e.substrateTempMaxF];
  };
  const air = (t: string) => {
    const e = env(t);
    return [e.ambientTempMinF, e.ambientTempMaxF];
  };
  it("'Air and surface temperature 10-40°C' → 50/104 for both", () => {
    const t = "Air and surface temperature 10-40°C during application.";
    assert.deepEqual(air(t), [50, 104]);
    assert.deepEqual(sub(t), [50, 104]);
  });
  it("'10 to 40 °C' (spaced unit)", () => {
    assert.deepEqual(sub("Surface temperature: 10 to 40 °C"), [50, 104]);
  });
  it("'10°C-40°C' (unit on both ends)", () => {
    assert.deepEqual(sub("Substrate temperature 10°C-40°C"), [50, 104]);
  });
  it("'50-104°F (10-40°C)' uses the stated °F", () => {
    assert.deepEqual(air("Air temperature 50-104°F (10-40°C)"), [50, 104]);
  });
  it("'10°C to 104°F' converts each end by its own unit", () => {
    assert.deepEqual(air("Ambient temperature 10°C to 104°F"), [50, 104]);
  });
  it("°F range stays as stated", () => {
    assert.deepEqual(air("Apply at air temperatures between 50-120°F (10-49°C)."), [50, 120]);
  });
  it("negative °C end: '-10°C/14°F minimum' → 14", () => {
    assert.equal(env("Air temperature: -10°C/14°F minimum").ambientTempMinF, 14);
  });
  it("°F with a °C pair in brackets: 'above 50°F [10°C]'", () => {
    assert.equal(
      env("Surface temperature must be above 50°F [10°C] during application.").substrateTempMinF,
      50,
    );
  });
  it("degree glyph variants (˚, º, '° F') are read", () => {
    assert.equal(env("Surface temperature less than 120ºF (49ºC).").substrateTempMaxF, 120);
    assert.equal(env("Air temperature minimum 40 ° F (4 ° C).").ambientTempMinF, 40);
  });
  it("postfix qualifiers: 'Air: 35°F (1.7°C) minimum, 120°F (49°C) maximum'", () => {
    assert.deepEqual(
      air("Temperature: Air: 35°F (1.7°C) minimum, 120°F (49°C) maximum"),
      [35, 120],
    );
  });
  it("prefix qualifiers: 'SURFACE TEMPERATURE Minimum 35°F (2°C) Maximum 140°F (60°C)'", () => {
    assert.deepEqual(
      sub(
        "SURFACE TEMPERATURE Minimum 35°F (2°C) Maximum 140°F (60°C) Maximum for Brush & Roller 120°F (49°C)",
      ),
      [35, 140],
    );
  });
  it("label list after the values: 'minimum 50°F / 10°C maximum 110°F / 43°C air, surface and material'", () => {
    const t = "Temperature: minimum 50°F / 10°C maximum 110°F / 43°C air, surface and material";
    assert.deepEqual(air(t), [50, 110]);
    assert.deepEqual(sub(t), [50, 110]);
  });
  it("wrapped PDF lines are re-joined: '…at air' / 'temperatures between 50-120°F'", () => {
    assert.deepEqual(
      air(
        "Use the Standard Activator at air\ntemperatures between 50-120°F (10-49°C) and when the",
      ),
      [50, 120],
    );
  });
  it("unit-column table: '°F °C air and surface temp 20 to 120 -7 to 49'", () => {
    const t = "Environmental conditions °F °C air and surface temp 20 to 120 -7 to 49";
    assert.deepEqual(air(t), [20, 120]);
    assert.deepEqual(sub(t), [20, 120]);
  });
});

describe("a temperature needs a °F/°C unit AND a gate label", () => {
  it("no unit → not a temperature", () => {
    assert.equal(temperatureGates("Surface temperature minimum 50").length, 0);
  });
  it("unit but no air/surface label → not a gate", () => {
    const e = env(
      "Use only where application and curing can proceed at temperatures above: -10°C/14°F.",
    );
    assert.equal(e.ambientTempMinF, null);
    assert.equal(e.substrateTempMinF, null);
  });
  it("material / paint temperature is not air or surface", () => {
    const e = env(
      "Material: 40°F (4.5°C) minimum. Paint temperature must be 40°F (4.5°C) minimum.",
    );
    assert.equal(e.ambientTempMinF, null);
    assert.equal(e.substrateTempMinF, null);
  });
  it("a bare temperature with no min/max is not a limit (drying/storage tables)", () => {
    const e = env(
      "Drying time Surface temperature 68°F [20°C] Touch dry hours 6. Storage Ambient temperature 77°F [25°C]",
    );
    assert.equal(e.substrateTempMinF, null);
    assert.equal(e.ambientTempMinF, null);
  });
  it("a space-only label row is a table header, not a gate", () => {
    const e = env(
      "Application Conditions Condition Material Surface Ambient Humidity Normal 40°-95°F (4°-35°C) 40°-110°F (4°-43°C)",
    );
    assert.deepEqual(
      [e.ambientTempMinF, e.substrateTempMinF, e.substrateTempMaxF],
      [null, null, null],
    );
  });
  it("'if the surface temperature is 35°F to 60°F' is a condition, not the limit", () => {
    const e = env(
      "Accelerator must be used if the surface temperature is 35°F to 60°F (2°C to 16°C).",
    );
    assert.equal(e.substrateTempMaxF, null);
  });
  it("storage limits are not application limits", () => {
    const e = env("STORAGE TEMPERATURE Minimum 20°F (-7°C) Maximum 110°F (43°C)");
    assert.equal(e.ambientTempMinF, null);
    assert.equal(e.ambientTempMaxF, null);
  });
  it("first stated value wins; a later range does not overwrite it", () => {
    const e = env(
      "Use at air temperatures between 50-120°F (10-49°C). Use the Immersion Activator at air and surface temperatures between 60-100°F (15- 38°C).",
    );
    assert.deepEqual([e.ambientTempMinF, e.ambientTempMaxF], [50, 120]);
  });
});

describe("dew-point margin is a difference: never +32", () => {
  it("5°F stays 5", () =>
    assert.equal(dewPointSpreadFromText("at least 5°F above the dew point"), 5));
  it("3°C alone → 5°F", () => assert.equal(dewPointSpreadFromText("3°C above the dew point"), 5));
  it("'3°C (5°F) above dew point' → 5", () =>
    assert.equal(
      dewPointSpreadFromText("must always be a minimum of 3°C (5°F) above dew point"),
      5,
    ));
  it("'5°F [3°C] above the dew point' (brackets) → 5", () =>
    assert.equal(
      dewPointSpreadFromText("a temperature that is at least 5°F [3°C] above the dew point"),
      5,
    ));
  it("'5˚F (3˚C) above dew point' (ring glyph) → 5", () =>
    assert.equal(
      dewPointSpreadFromText("Surface temperatures must be at least 5˚F (3˚C) above dew point"),
      5,
    ));
  it("a bare dew mention is silent", () =>
    assert.equal(dewPointSpreadFromText("Apply above the dew point."), null));
  it("no unit → silent", () => assert.equal(dewPointSpreadFromText("5 above the dew point"), null));
  it("the margin never becomes an air or surface gate", () => {
    const e = env("Surface temperature must be at least 5°F (3°C) above the dew point.");
    assert.equal(e.substrateTempMinF, null);
    assert.equal(e.dewPointSpreadMinF, 5);
  });
});

describe("mix ratio only from a sane pattern next to a mix label", () => {
  it("'Mix Ratio: 1:1 by volume'", () =>
    assert.equal(
      mixRatioFromText("Mix Ratio: 1:1 by volume Typical Thickness: 5"),
      "1:1 by volume",
    ));
  it("'Mixing ratio 4 parts resin to 1 part cure (by volume)'", () =>
    assert.match(
      mixRatioFromText("Mixing ratio 4 parts resin to 1 part cure (by volume) Curing mechanism"),
      /^4 parts resin to 1 part cure/,
    ));
  it("'Combine at a 1:1 ratio by volume'", () =>
    assert.match(mixRatioFromText("Combine at a 1:1 ratio by volume in a container"), /^1:1/));
  it("label on its own line, value two lines down", () =>
    assert.equal(
      mixRatioFromText("Mixing ratio\nBase 35539 : Curing agent 95530\n(3 : 1 by volume)"),
      "3 : 1 by volume",
    ));
  it("n:n:n is accepted", () => assert.equal(mixRatioFromText("Mix ratio: 2:1:1"), "2:1:1"));
  it("a pump ratio is not a mix ratio", () =>
    assert.equal(mixRatioFromText("Airless Spray Pump Ratio: 30:1 (min.)"), ""));
  it("a ratio with no mix label is ignored", () =>
    assert.equal(mixRatioFromText("Coverage 11: 1000 mil ft2 and 3:1 elsewhere"), ""));
  it("big numbers are not a ratio", () =>
    assert.equal(mixRatioFromText("Mix ratio 35539 : 95530"), ""));
});

describe("humidity and one-line values", () => {
  it("RH max from its labelled phrase", () => {
    assert.equal(relativeHumidityMaxFromText("Relative humidity: 85% maximum"), 85);
    assert.equal(
      relativeHumidityMaxFromText("Relative humidity must be below 85% during curing."),
      85,
    );
  });
  it("a stated RH minimum is not the max", () =>
    assert.equal(
      relativeHumidityMaxFromText("AMBIENT HUMIDITY Minimum 20% Maximum 90% CLEANUP"),
      90,
    ));
  it("a test condition or cure note is not a limit", () => {
    assert.equal(
      relativeHumidityMaxFromText("Dry to handle in 45 minutes at 60°F and 50% relative humidity."),
      null,
    );
    assert.equal(
      relativeHumidityMaxFromText(
        "determined under controlled temperatures and relative humidity below 85 %",
      ),
      null,
    );
    assert.equal(
      relativeHumidityMaxFromText("Humidity levels below 50% will require longer cure times."),
      null,
    );
    assert.equal(
      relativeHumidityMaxFromText("100 °F (38 °C) 50% RH 50% RH 50% RH Touch: 4-5 hours"),
      null,
    );
  });
  it("labelled values stop at their own line", () => {
    const card = heuristicExtract(
      "Pot life: 4 hours at 77°F\nThinner: Reducer #111\nCoverage: 400 sq ft/gal",
    );
    assert.equal(card.shelfLife.mixedPotLife, "4 hours at 77°F");
    assert.equal(card.mixing.thinning, "Reducer #111");
  });
  it("a run-on value is capped", () => {
    const v = capToOneLine("word ".repeat(200));
    assert.ok(v.length <= 161);
  });
  it("thinner skips prose and stops at the cleaner", () => {
    const card = heuristicExtract(
      "Use thinner or Amercoat 12 before use. Thinners Amercoat 65, Amercoat 101 Cleaner Amercoat 12",
    );
    assert.equal(card.mixing.thinning, "Amercoat 65, Amercoat 101");
  });
});

describe("substrate labels come from their own gate lines", () => {
  // Real text from SW Pro Industrial DTM Acrylic p1, preceded by a concrete line as on the sheet.
  const DTM =
    "Concrete & Masonry: Weathered masonry and concrete should be cleaned. Recognize that any surface preparation short of total removal of the old coating may compromise the service length of the system. Iron & Steel - Minimum surface preparation is Hand Tool Clean per SSPC-SP2. Remove all oil and grease from surface per SSPC-SP1. For better performance, use Commercial Blast Cleaning per SSPC-SP6.";
  // Real text from Jotun Jotamastic 87 p3 (surface preparation table).
  const JOTUN =
    "Technical Data Sheet Jotamastic 87 Substrate Minimum Recommended St 2 (ISO 8501-1) or SSPC SP-2 Carbon steel Sa 2 (ISO 8501-1) / SP 6 / NACE No. 3 (SSPC-VIS 1) Shop primed steel Clean, dry and undamaged shop primer. Galvanized steel Sweep blast.";
  const gates = (t: string) => heuristicExtract(t).surfacePrep.prepGates ?? [];
  it("'Iron & Steel - … SSPC-SP2' is a steel gate, not Concrete", () => {
    const g = gates(DTM);
    const steel = g.find((x) => x.family === "steel-non-immersion");
    assert.ok(steel?.methods.includes("SSPC-SP2"));
    assert.ok(!g.find((x) => x.family === "concrete")?.methods.includes("SSPC-SP2"));
  });
  it("'Carbon steel … NACE No. 3' is a steel gate, not Non-ferrous", () => {
    const g = gates(JOTUN);
    assert.ok(g.find((x) => x.family === "steel-non-immersion")?.methods.includes("NACE 3"));
    assert.ok(!g.find((x) => x.family === "non-ferrous")?.methods.includes("NACE 3"));
  });
});
