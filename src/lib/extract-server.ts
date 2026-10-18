import type { ExtractSheetInput, ExtractSheetResponse } from "./extract-client.ts";

/**
 * Thin adapter to BE-3's `extractSheet` server function.
 *
 * PENDING BE-3: `@/lib/extract/extract-sheet` is not on release/beta-azure yet. When it lands,
 * replace the body with:
 *   const { extractSheet } = await import("@/lib/extract/extract-sheet");
 *   return extractSheet({ data: input });
 * Until then this returns null ("server reader not available"), so PDFs fall back to the
 * browser's on-device reader and photos / Word files show the error state.
 */
export async function callExtractSheet(
  _input: ExtractSheetInput,
): Promise<ExtractSheetResponse | null> {
  return null;
}
