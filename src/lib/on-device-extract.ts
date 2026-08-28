import { heuristicExtract } from "./heuristic-extract.ts";
import type { FieldCardData } from "./types.ts";

function looksLikeCoatingSheet(t: string): boolean {
  return /(product data|pds\b|dft|wft|\bmils?\b|pot\s*life|recoat|voc\b|sspc|nace|ampp|dew\s*point|relative humidity|mix(?:ing)?\s+ratio|epoxy|polyurethane|polyurea|zinc|coating|primer|blast|substrate|ambient|sealant|adhesive)/i.test(
    t,
  );
}

/** On-device only. The sheet never leaves the phone. Not a server function. */
export function buildCardFromPds(text: string): FieldCardData {
  const raw = (text ?? "").trim();
  if (raw.length < 40) throw new Error("Could not read this sheet.");
  if (raw.length > 40000) throw new Error("PDS text exceeds 40,000 characters.");
  const slice = raw.slice(0, 40000);
  if (!looksLikeCoatingSheet(slice)) throw new Error("Could not read this sheet.");
  return heuristicExtract(slice);
}
