import type { FieldCardData } from "../types.ts";

/** Where a card value came from. `page` is 1-based when known. */
export type ProvenanceQuote = { page?: number; quote: string };

/**
 * Field path (dot form, array index as a segment, e.g. `surfacePrep.prepGates.0.profile`)
 * to its source quote, or `"not-stated"` when the sheet is silent.
 * An empty `quote` means the on-device parser read the value but could not pin one exact line.
 */
export type Provenance = Record<string, ProvenanceQuote | "not-stated">;

/** `"on-device"` or `"azure:<deployment>"`. */
export type ProviderLabel = "on-device" | `azure:${string}`;

export type ExtractWarningCode =
  /** Azure failed, timed out, or returned unusable JSON; on-device result shown. */
  | "AZURE_FALLBACK"
  /** Azure env is not set; on-device result shown. */
  | "AZURE_NOT_CONFIGURED"
  /** Little or no text layer and Azure is off: "This sheet needs the Azure reader." */
  | "IMAGE_ONLY_NEEDS_AZURE"
  /** The reader returned values with no verbatim quote; they were set to Not stated. */
  | "VALUES_DROPPED_UNQUOTED"
  /** On-device read a value but could not pin one exact source line (quote is ""). */
  | "ON_DEVICE_UNPINNED";

export type ExtractWarning = { code: ExtractWarningCode; message: string };

export type ExtractInput = {
  /** Plain text of the sheet (pdf.js text from the client). Pages joined by a blank line. */
  text: string;
  /** Optional per-page text (pdf.js, one entry per page). When sent, quotes carry page numbers. */
  pages?: string[];
  /** Raw PDF bytes, base64. Only remote providers use it. */
  pdfBase64?: string;
  fileName?: string;
};

export type ExtractResult = {
  card: FieldCardData;
  provenance: Provenance;
  provider: ProviderLabel;
  warnings: ExtractWarning[];
};

export interface ExtractProvider {
  readonly id: "on-device" | "azure";
  /** True when this provider can run in the current environment (e.g. env vars present). */
  available(): boolean;
  extract(input: ExtractInput, signal?: AbortSignal): Promise<ExtractResult>;
}

export type ExtractErrorCode =
  | "UNAUTHENTICATED"
  | "RATE_LIMITED"
  | "EXTRACT_TIMEOUT"
  | "EXTRACT_FAILED"
  | "FILE_TOO_LARGE";

export type ExtractResponse =
  | ({ ok: true } & ExtractResult)
  | { ok: false; error: { code: ExtractErrorCode; message: string; retryAfterSec?: number } };
