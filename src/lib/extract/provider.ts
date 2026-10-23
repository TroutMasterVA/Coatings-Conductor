import type { FieldCardData } from "../types.ts";

/** Where a card value came from. `page` is 1-based when known. */
export type ProvenanceQuote = { page?: number; quote: string };

/**
 * Field path (dot form, array index as a segment, e.g. `surfacePrep.prepGates.0.profile`)
 * to its source quote, or `"not-stated"` when the sheet is silent.
 * An empty `quote` means the on-device parser read the value but could not pin one exact line.
 */
export type Provenance = Record<string, ProvenanceQuote | "not-stated">;

/**
 * A hand edit, stamped by the SERVER on save (CONTRACT.md "Edit stamp (hand edits)").
 * `by` = session user's display name, else email; `at` = server time (ISO-8601).
 * `sheetQuote` is the prior sheet quote, kept as history only: it does not back the new value.
 */
export type EditedProvenance = {
  edited: { by: string; at: string };
  sheetQuote?: ProvenanceQuote;
};

/** Provenance as stored on a job: reader quotes plus server edit stamps. */
export type SavedProvenance = Record<string, ProvenanceQuote | "not-stated" | EditedProvenance>;

/** Which reader produced the card. The Azure deployment name, when known, is in `deployment`. */
export type ProviderLabel = "azure" | "on-device";

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

/** File types the extract endpoint accepts. The server checks the bytes, not just this claim. */
export const EXTRACT_MIME_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/tiff",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
] as const;
export type ExtractMimeType = (typeof EXTRACT_MIME_TYPES)[number];

/** What the browser sends to `extractSheet`. A file, or pasted text, or both. */
export type ExtractRequest = {
  /** Raw file bytes, base64 (no `data:` prefix needed; one is tolerated). */
  fileBase64?: string;
  mimeType?: string;
  fileName?: string;
  /** Client-side pdf.js text (pages joined by a blank line). Optional; the server reads the file when absent. */
  text?: string;
  /** Optional per-page text (pdf.js, one entry per page). When sent, quotes carry page numbers. */
  pages?: string[];
};

/**
 * What a provider gets after the server has validated the request and read any text it can.
 * `fileBase64`/`mimeType` are optional so the paste-text path still works; with neither text nor
 * pages, the on-device provider returns an all-Not-stated card with IMAGE_ONLY_NEEDS_AZURE.
 */
export type ExtractInput = {
  /** Plain text of the sheet. Pages joined by a blank line. May be absent or "" for photos and scans. */
  text?: string;
  /** Optional per-page text. When set, quotes carry page numbers. */
  pages?: string[];
  /** Raw file bytes, base64, already size- and type-checked. Remote providers send this to Azure. */
  fileBase64?: string;
  mimeType?: ExtractMimeType;
  fileName?: string;
};

export type ExtractResult = {
  card: FieldCardData;
  provenance: Provenance;
  provider: ProviderLabel;
  /** Azure deployment name, for display only. */
  deployment?: string;
  warnings: ExtractWarning[];
  /** true on on-device results (a draft to check against the sheet). Missing = false. */
  draft?: boolean;
  /** true when any temperature field (ambient/substrate min/max, dew-point spread) has no verbatim quote. Missing = false. */
  unverifiedTemps?: boolean;
  /** Set by extractSheet (server-only signature). The client copies it into the saved extract untouched. */
  serverRead?: ServerRead;
  /** Internal only: the text a remote provider read (e.g. Document Intelligence content). The server gates against it and strips it before responding. */
  source?: { text: string; pages?: string[] };
};

/**
 * Server-issued proof that a card came from this user's read (CONTRACT.md "Signed reads").
 * SERVER-ONLY: returned by extractSheet, passed back untouched on save, never built by the client,
 * and stripped before the extract is stored or returned.
 */
export type ServerRead = { id: string; sig: string; fields: Record<string, string> };

/** Saved next to `card` in the job record. Older jobs have no `extract` (treat as missing; flags false). */
export type SavedExtract = {
  provider: ProviderLabel;
  deployment?: string;
  provenance: SavedProvenance;
  warnings: ExtractWarning[];
  /** ISO 8601. */
  extractedAt: string;
  draft?: boolean;
  unverifiedTemps?: boolean;
  /** Inbound only (save requests): the signed read this extract came from. Never stored. */
  serverRead?: ServerRead;
};

/** Builds the object the UI saves next to `card` from the flat extract response. */
export function toSavedExtract(r: ExtractResult, extractedAt: string = new Date().toISOString()): SavedExtract {
  return {
    provider: r.provider,
    ...(r.deployment ? { deployment: r.deployment } : {}),
    provenance: r.provenance,
    warnings: r.warnings,
    extractedAt,
    draft: r.draft === true,
    unverifiedTemps: r.unverifiedTemps === true,
    ...(r.serverRead ? { serverRead: r.serverRead } : {}),
  };
}

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
  | "FILE_TOO_LARGE"
  | "UNSUPPORTED_FILE_TYPE";

export type ExtractResponse =
  | ({ ok: true } & ExtractResult)
  | {
      ok: false;
      error: {
        code: ExtractErrorCode;
        message: string;
        /** RATE_LIMITED only. */
        retryAfterSec?: number;
        /** FILE_TOO_LARGE only: the upload limit on this copy (MAX_UPLOAD_MB). */
        maxUploadMb?: number;
      };
    };
