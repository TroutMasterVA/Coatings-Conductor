import type { ExtractSheetInput, ExtractSheetResponse } from "./extract-client.ts";

/** Thin adapter to BE-3's `extractSheet` server function (#26). */
export async function callExtractSheet(
  input: ExtractSheetInput,
): Promise<ExtractSheetResponse | null> {
  const { extractSheet } = await import("@/lib/extract/extract-sheet");
  return extractSheet({ data: input });
}

/** Upload cap from the server (MAX_UPLOAD_MB), in bytes; null when unknown. */
export async function loadUploadLimitBytes(): Promise<number | null> {
  try {
    const { getExtractLimits } = await import("@/lib/extract/extract-sheet");
    const { maxUploadMb } = await getExtractLimits();
    return typeof maxUploadMb === "number" && maxUploadMb > 0 ? maxUploadMb * 1024 * 1024 : null;
  } catch {
    return null;
  }
}
