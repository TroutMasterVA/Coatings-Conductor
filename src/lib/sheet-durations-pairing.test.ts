import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { potLifeFromText, recoatFromText, VARIES_BY_TEMP } from "./sheet-durations.ts";

// QA item 3: a three-column temperature row is paired with its headers, or one note. Synthetic text.
describe("duration rows across temperature columns", () => {
  const head = "Drying Times @ 5 mils wet: 50°F (10°C) 77°F (25°C) 100°F (38°C) 50% RH 50% RH 50% RH\n";
  it("pairs each pot-life cell with its column temperature", () => {
    assert.equal(potLifeFromText(`${head}Pot Life: 10 hours 4 hours 2 hours\n`), "10 hours at 50°F, 4 hours at 77°F, 2 hours at 100°F");
  });
  it("pairs recoat minimum cells, °C-first headers too", () => {
    const t = "Temperature -5°C (23°F) 5°C (41°F) 25°C (77°F)\nRecoat: minimum: 48 hours 8 hours 4.5 hours maximum: 1 year 1 year 1 year\n";
    const r = recoatFromText(t);
    assert.equal(r.min, "48 hours at 23°F, 8 hours at 41°F, 4.5 hours at 77°F");
    assert.equal(r.max, "1 year");
  });
  it("ambiguous (no headers, or a count mismatch) gives one note, never unlabeled numbers", () => {
    assert.equal(potLifeFromText("Pot Life: 10 hours 4 hours 2 hours\n"), VARIES_BY_TEMP);
    assert.equal(potLifeFromText("At 50°F (10°C) 77°F (25°C)\nPot Life: 10 hours 4 hours 2 hours\n"), VARIES_BY_TEMP);
  });
  it("a single value or a value with its own temperature is unchanged", () => {
    assert.equal(potLifeFromText("Pot Life: 4 hours\n"), "4 hours");
    assert.equal(potLifeFromText("Pot life 2 hours at 77°F\n"), "2 hours at 77°F");
  });
});
