import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  AIR_OUTSIDE_MATERIAL_LINE,
  MATERIAL_NOT_STATED,
  MATERIAL_READING_HOURS,
  MEASURE_MATERIAL_LINE,
  materialHour,
  materialLimits,
  materialNormalText,
  materialUnstatedFlags,
  readingFromSite,
  readingIsFresh,
  readingTimeText,
  type MaterialReading,
} from "./material-temp.ts";

// Item 5 rules matrix (PO calls, Oct 30). Site: Arlington VA; "now" = Fri Oct 30, 10:00 AM ET.
const TZ = "America/New_York";
const NOW = new Date("2026-10-30T14:00:00Z");
const TODAY = "2026-10-30";
const TOMORROW = "2026-10-31";
const ago = (min: number): string => new Date(NOW.getTime() - min * 60_000).toISOString();
const reading = (valueF: number, minutesAgo = 20): MaterialReading => ({ valueF, at: ago(minutesAgo) });

const MIN_ONLY = { materialTempMinF: 59 };
const BOTH = { materialTempMinF: 40, materialTempMaxF: 95 };
const run = (env: object | null, r: MaterialReading | null, hourDateKey: string, airF: number | null = 70) =>
  materialHour({ env: env as never, reading: r, hourDateKey, timeZone: TZ, now: NOW, airF });

describe("material limits on the card", () => {
  it("absent or null keys = not stated; either side stated = stated", () => {
    assert.equal(materialLimits({}), null);
    assert.equal(materialLimits({ materialTempMinF: null, materialTempMaxF: null }), null);
    assert.equal(materialLimits(null), null);
    assert.deepEqual(materialLimits(MIN_ONLY), { minF: 59, maxF: null });
    assert.deepEqual(materialLimits({ materialTempMaxF: 130 }), { minF: null, maxF: 130 });
    assert.deepEqual(materialUnstatedFlags({}), ["Not stated — check the sheet for material temp"]);
    assert.deepEqual(materialUnstatedFlags(BOTH), []);
  });
  it("the Normal band is info text only", () => {
    assert.equal(materialNormalText({ materialNormalTempMinF: 40, materialNormalTempMaxF: 95 } as never), "40–95°F");
    assert.equal(materialNormalText({} as never), null);
  });
});

describe("a reading counts for 4 hours, today only, and keeps its time", () => {
  it("reads value + time from the site; either missing = no reading", () => {
    assert.deepEqual(readingFromSite({ measuredMaterialTempF: 62, measuredMaterialAt: ago(5) }), { valueF: 62, at: ago(5) });
    assert.equal(readingFromSite({ measuredMaterialTempF: 62 }), null);
    assert.equal(readingFromSite({ measuredMaterialTempF: null, measuredMaterialAt: ago(5) }), null);
    assert.equal(readingFromSite({ measuredMaterialTempF: 62, measuredMaterialAt: "not a date" }), null);
  });
  it("fresh up to exactly 4 hours; stale one minute later", () => {
    assert.equal(MATERIAL_READING_HOURS, 4);
    assert.equal(readingIsFresh(reading(62, 0), NOW, TZ), true);
    assert.equal(readingIsFresh(reading(62, 240), NOW, TZ), true);
    assert.equal(readingIsFresh(reading(62, 241), NOW, TZ), false);
    assert.equal(readingIsFresh(null, NOW, TZ), false);
  });
  it("a reading from before midnight at the site does not count today, even inside 4 hours", () => {
    const justAfterMidnight = new Date("2026-10-30T04:30:00Z"); // 00:30 ET
    const lateYesterday = { valueF: 62, at: "2026-10-30T03:00:00Z" }; // 23:00 ET Oct 29
    assert.equal(readingIsFresh(lateYesterday, justAfterMidnight, TZ), false);
  });
  it("the time is shown in the site's zone", () => {
    assert.equal(readingTimeText("2026-10-30T13:40:00Z", TZ), "9:40 AM");
  });
});

describe("rules matrix", () => {
  it("not stated: never blocks, carries the check-the-sheet flag, no measure line", () => {
    for (const day of [TODAY, TOMORROW]) {
      const o = run({}, null, day);
      assert.equal(o.effect, "none");
      assert.deepEqual(o.notes, [MATERIAL_NOT_STATED]);
      assert.deepEqual(o.reasons, []);
    }
  });
  it("today, fresh reading inside the limit: no effect, the reading and its time show, no measure line", () => {
    const o = run(BOTH, reading(62), TODAY);
    assert.equal(o.effect, "none");
    assert.equal(o.check?.status, "pass");
    assert.match(o.notes.join(" | "), /Material 62°F \(measured 9:40 AM\) within sheet 40–95°F/);
    assert.ok(!o.notes.includes(MEASURE_MATERIAL_LINE));
  });
  it("today, fresh reading below the min: NO-GO", () => {
    const o = run(MIN_ONLY, reading(52), TODAY);
    assert.equal(o.effect, "nogo");
    assert.match(o.reasons[0]!, /^Material 52°F \(measured 9:40 AM\) below sheet min 59°F\. Condition it before mixing\.$/);
    assert.equal(o.check?.status, "fail");
  });
  it("today, fresh reading above the max: NO-GO", () => {
    const o = run(BOTH, reading(101), TODAY);
    assert.equal(o.effect, "nogo");
    assert.match(o.reasons[0]!, /above sheet max 95°F/);
  });
  it("today, stated, no reading: CAUTION at most, with the measure line", () => {
    const o = run(MIN_ONLY, null, TODAY);
    assert.equal(o.effect, "caution");
    assert.deepEqual(o.reasons, ["Material temp not measured today. Sheet: at least 59°F."]);
    assert.deepEqual(o.notes, [MEASURE_MATERIAL_LINE]);
  });
  it("today, stated, stale reading (even one outside the limit): CAUTION at most, never NO-GO", () => {
    for (const v of [62, 30]) {
      const o = run(MIN_ONLY, reading(v, 300), TODAY);
      assert.equal(o.effect, "caution", String(v));
      assert.match(o.reasons[0]!, /^Material reading from 5:00 AM is no longer valid \(counts 4 hours\)\. Sheet: at least 59°F\.$/);
      assert.ok(o.notes.includes(MEASURE_MATERIAL_LINE));
    }
  });
  it("future day, stated, air inside the range: GO allowed, MUST show the measure line", () => {
    const o = run(BOTH, null, TOMORROW, 70);
    assert.equal(o.effect, "none");
    assert.deepEqual(o.notes, [MEASURE_MATERIAL_LINE]);
  });
  it("a today reading never counts for another day", () => {
    const o = run(BOTH, reading(62), TOMORROW, 70);
    assert.equal(o.effect, "none");
    assert.deepEqual(o.notes, [MEASURE_MATERIAL_LINE]);
    assert.equal(o.check, undefined);
  });
  it("no reading, forecast air outside the material range: CAUTION with the exact air line, never NO-GO", () => {
    assert.equal(AIR_OUTSIDE_MATERIAL_LINE, "Air is outside the material range. Measure and condition material.");
    for (const [day, air] of [[TOMORROW, 35], [TOMORROW, 99], [TODAY, 35]] as const) {
      const o = run(BOTH, null, day, air);
      assert.equal(o.effect, "caution", `${day} air ${air}`);
      assert.ok(o.reasons.includes(AIR_OUTSIDE_MATERIAL_LINE), `${day} air ${air}`);
      assert.ok(o.notes.includes(MEASURE_MATERIAL_LINE));
    }
  });
  it("air is never used as a reading: air inside the range today still needs a measurement", () => {
    const o = run(MIN_ONLY, null, TODAY, 72);
    assert.equal(o.effect, "caution");
    assert.ok(!o.reasons.includes(AIR_OUTSIDE_MATERIAL_LINE));
    assert.equal(o.check, undefined);
  });
  it("a fresh in-range reading beats an air warning (the material was measured)", () => {
    const o = run(BOTH, reading(62), TODAY, 35);
    assert.equal(o.effect, "none");
    assert.ok(!o.reasons.includes(AIR_OUTSIDE_MATERIAL_LINE));
  });
  it("no forecast air: no air line, the measure rule still applies", () => {
    assert.equal(run(BOTH, null, TOMORROW, null).effect, "none");
    assert.equal(run(BOTH, null, TODAY, null).effect, "caution");
  });
});
