import { buildCardFromPds } from "./on-device-extract";
import type { FieldCardData } from "./types";

/** Client-only. Same call shape as the old server fn so the job screen compiles. No xAI. */
export async function extractPds(input: {
  data: { text: string };
}): Promise<{ ok: true; card: FieldCardData } | { ok: false; error: string }> {
  try {
    return { ok: true, card: buildCardFromPds(input.data.text) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Extract failed" };
  }
}
