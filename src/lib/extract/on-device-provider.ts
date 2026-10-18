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
    const warnings = unpinned
      ? [
          {
            code: "ON_DEVICE_UNPINNED" as const,
            message: `${unpinned} value(s) were read on-device but no single source line was found. Check them against the sheet.`,
          },
        ]
      : [];
    return { card, provenance, provider: "on-device", warnings };
  },
};
