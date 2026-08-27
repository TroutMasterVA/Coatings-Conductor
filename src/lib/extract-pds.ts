import { createServerFn } from "@tanstack/react-start";
import { heuristicExtract } from "./heuristic-extract";
import { refineExtractedCard } from "./pds-application-table";
import type { FieldCardData } from "./types";

/** Local PDS extract — no model, no credits. Kept as a server fn for callers that already POST. */
export const extractPds = createServerFn({ method: "POST" })
  .validator((input: { text: string }) => {
    const text = (input?.text ?? "").trim();
    if (text.length < 40) throw new Error("PDS text is too short.");
    if (text.length > 40000) throw new Error("PDS text exceeds 40,000 characters.");
    return { text: text.slice(0, 24000) };
  })
  .handler(async ({ data }): Promise<{ ok: true; card: FieldCardData; usedAi: boolean } | { ok: false; error: string }> => {
    try {
      const card = refineExtractedCard(heuristicExtract(data.text), data.text);
      return { ok: true, card, usedAi: false };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "Extract failed" };
    }
  });
