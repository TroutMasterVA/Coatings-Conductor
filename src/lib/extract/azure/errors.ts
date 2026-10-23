/**
 * Every Azure failure is thrown as an AzureExtractError. BE-3's extract core catches any throw
 * from the Azure provider and falls back to on-device with an AZURE_FALLBACK warning.
 * Messages never contain document text, keys or tokens.
 */
export type AzureErrorCode =
  /** Env missing or an endpoint is not https on an Azure hostname. */
  | "AZURE_CONFIG"
  /** No managed identity token and no key env var. */
  | "AZURE_AUTH"
  /** No file bytes, or bytes are not PDF / PNG / JPEG / TIFF / DOCX. */
  | "AZURE_INPUT"
  /** Overall deadline, poll deadline, or caller abort. */
  | "AZURE_TIMEOUT"
  /** Non-2xx from Document Intelligence or Azure OpenAI. */
  | "AZURE_HTTP"
  /** Model reply was not JSON (or was cut off / refused). */
  | "AZURE_BAD_JSON"
  /** Model JSON did not match the card schema. */
  | "AZURE_SCHEMA"
  /** Document Intelligence reported a failed analysis. */
  | "AZURE_ANALYZE_FAILED";

export class AzureExtractError extends Error {
  readonly code: AzureErrorCode;
  readonly status?: number;
  constructor(code: AzureErrorCode, message: string, status?: number) {
    super(message);
    this.name = "AzureExtractError";
    this.code = code;
    this.status = status;
  }
}

export function isAbort(err: unknown): boolean {
  return err instanceof Error && (err.name === "AbortError" || err.name === "TimeoutError");
}

/** Map a thrown fetch error to a typed one. */
export function toAzureError(err: unknown, stage: string): AzureExtractError {
  if (err instanceof AzureExtractError) return err;
  if (isAbort(err)) return new AzureExtractError("AZURE_TIMEOUT", `Azure ${stage} timed out.`);
  return new AzureExtractError("AZURE_HTTP", `Azure ${stage} request failed.`);
}
