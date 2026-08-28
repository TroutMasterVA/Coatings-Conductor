import { buildCardFromPds } from "./on-device-extract";
import type { FieldCardData } from "./types";

/** Client-only. Sheet never leaves the device. usedAi is always false and should be deleted with the toast ternary. */
export async function extractPds(input: {
  data: { text: string };
}): Promise<
  { ok: true; card: FieldCardData; usedAi: false } | { ok: false; error: string }
> {
  try {
    return { ok: true, card: buildCardFromPds(input.data.text), usedAi: false };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Extract failed" };
  }
}
