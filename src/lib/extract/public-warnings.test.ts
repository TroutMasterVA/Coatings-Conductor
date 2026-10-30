import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { publicWarnings, withPublicWarnings, READER_OFF_CODE, READER_OFF_MESSAGE } from "./public-warnings.ts";
import { runExtract } from "./extract-core.ts";
import { onDeviceProvider } from "./on-device-provider.ts";
import type { ExtractWarning } from "./provider.ts";

describe("no provider name in network warnings (QA P3)", () => {
  it("AZURE_NOT_CONFIGURED goes out as SERVER_READER_OFF; the detail is logged", () => {
    const logs: Record<string, unknown>[] = [];
    const out = publicWarnings(
      [{ code: "AZURE_NOT_CONFIGURED", message: "Azure reader is not set up; showing the on-device read." }],
      (e) => logs.push(e),
    );
    assert.deepEqual(out, [{ code: READER_OFF_CODE, message: READER_OFF_MESSAGE }]);
    assert.equal(logs.length, 1);
    assert.equal(logs[0]!.code, "AZURE_NOT_CONFIGURED");
    assert.match(String(logs[0]!.detail), /Azure reader is not set up/);
  });
  it("other warnings pass through untouched, in order", () => {
    const w: ExtractWarning[] = [
      { code: "VALUES_DROPPED_UNQUOTED", message: "a" },
      { code: "AZURE_NOT_CONFIGURED", message: "b" },
      { code: "ON_DEVICE_UNPINNED", message: "c" },
    ];
    const out = publicWarnings(w, () => {});
    assert.deepEqual(out.map((x) => x.code), ["VALUES_DROPPED_UNQUOTED", READER_OFF_CODE, "ON_DEVICE_UNPINNED"]);
    assert.equal(w[1]!.code, "AZURE_NOT_CONFIGURED", "input not mutated");
  });
  it("a real extract reply with Azure off carries no 'Azure' in its warnings", async () => {
    const res = await runExtract({
      userId: "u",
      input: { text: "ACME 1 PRIMER\nAir: 50°F minimum, 100°F maximum" },
      azure: null,
      onDevice: onDeviceProvider,
      rate: new Map(),
    });
    assert.equal(res.ok, true);
    const pub = withPublicWarnings(res, () => {});
    assert.ok(pub.ok && pub.warnings.some((w) => w.code === READER_OFF_CODE));
    assert.doesNotMatch(JSON.stringify(pub.ok ? pub.warnings : []), /azure/i);
  });
  it("null, errors and saved extracts without warnings are returned as is", () => {
    assert.equal(withPublicWarnings(null), null);
    const err = { ok: false as const, error: { code: "EXTRACT_FAILED" as const, message: "m" } };
    assert.equal(withPublicWarnings(err), err);
  });
});
