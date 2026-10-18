import { bareTemperatureLines } from "../heuristic-extract.ts";
import { buildCardFromPds } from "../on-device-extract.ts";
import { locateProvenance, sourceOf } from "./provenance.ts";
import type { ExtractInput, ExtractProvider, ExtractResult } from "./provider.ts";

/** Wraps the on-device heuristic. Always available; never calls the network. */
export const onDeviceProvider: ExtractProvider = {
  id: "on-device",
  available: () => true,
  async extract(input: ExtractInput): Promise<ExtractResult> {
    const src = sourceOf(input);
    const card = buildCardFromPds(src.text);
    const provenance = locateProvenance(card, src);
    const unpinned = Object.values(provenance).filter((p) => p !== "not-stated" && p.quote === "").length;
    const warnings: ExtractResult["warnings"] = [];
    // Bare numbers on a temperature / application-conditions line (no °F/°C) are never used as
    // temperatures; the fields stay Not stated and the user is told a value was set aside.
    const bare = bareTemperatureLines(src.text).length;
    if (bare) {
      warnings.push({
        code: "VALUES_DROPPED_UNQUOTED",
        message: `${bare} value(s) with numbers could not be tied to a line on the sheet and were set to Not stated.`,
      });
    }
    if (unpinned) {
      warnings.push({
        code: "ON_DEVICE_UNPINNED",
        message: `${unpinned} value(s) were read on-device but no single source line was found. Check them against the sheet.`,
      });
    }
    return { card, provenance, provider: "on-device", warnings };
  },
};
