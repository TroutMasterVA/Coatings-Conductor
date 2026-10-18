import { heuristicExtract } from "../heuristic-extract.ts";
import { buildCardFromPds } from "../on-device-extract.ts";
import { gateNumbers, sourceOf, unverifiedTempsFromGate } from "./provenance.ts";
import type { ExtractInput, ExtractProvider, ExtractResult, ExtractWarning, Provenance } from "./provider.ts";

function result(card: ExtractResult["card"], provenance: Provenance, warnings: ExtractWarning[], droppedPaths: string[]): ExtractResult {
  return {
    card,
    provenance,
    provider: "on-device",
    warnings,
    draft: true,
    unverifiedTemps: unverifiedTempsFromGate(provenance, droppedPaths),
  };
}

const IMAGE_ONLY: ExtractWarning = {
  code: "IMAGE_ONLY_NEEDS_AZURE",
  message: "This sheet needs the Azure reader. Showing what could be read on-device.",
};

/** Wraps the on-device heuristic. Always available; never calls the network. */
export const onDeviceProvider: ExtractProvider = {
  id: "on-device",
  available: () => true,
  async extract(input: ExtractInput): Promise<ExtractResult> {
    const src = sourceOf(input);
    if (!src.text.trim()) {
      // No text layer (photo, scan, or file only): every field Not stated, nothing invented.
      // App placeholders (e.g. default product label, generic PPE line) are not sheet values either.
      const blank = gateNumbers(heuristicExtract(" "), src);
      const provenance = Object.fromEntries(Object.keys(blank.provenance).map((k) => [k, "not-stated" as const]));
      return result(blank.card, provenance, [IMAGE_ONLY], []);
    }
    const { card, provenance, dropped, droppedPaths, unpinned } = gateNumbers(buildCardFromPds(src.text), src);
    const warnings: ExtractWarning[] = [];
    if (dropped) {
      warnings.push({
        code: "VALUES_DROPPED_UNQUOTED",
        message: `${dropped} value(s) with numbers could not be tied to a line on the sheet and were set to Not stated.`,
      });
    }
    if (unpinned.length) {
      warnings.push({
        code: "ON_DEVICE_UNPINNED",
        message: `${unpinned.length} value(s) were read on-device but no single source line was found. Check them against the sheet.`,
      });
    }
    return result(card, provenance, warnings, droppedPaths);
  },
};
