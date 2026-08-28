import { heuristicExtract } from "./heuristic-extract";
import type { FieldCardData } from "./types";

/** On-device only. The sheet never leaves the phone. Not a server function. */
export function buildCardFromPds(text: string): FieldCardData {
  const raw = (text ?? "").trim();
  if (raw.length < 40) throw new Error("PDS text is too short.");
  if (raw.length > 40000) throw new Error("PDS text exceeds 40,000 characters.");
  return heuristicExtract(raw.slice(0, 24000));
}
