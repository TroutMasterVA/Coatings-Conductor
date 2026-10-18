/**
 * FE-1 client for the BE-3 server extract (`extractSheet`), with an on-device fallback for PDFs.
 *
 * No AI runs here, no keys, no xAI. The browser sends the file to our own server function;
 * the server decides which reader (Azure or on-device) reads it and whether a sheet is image-only.
 *
 * Contract: docs/release-beta/CONTRACT.md + LEAD-approved BE-3 changes (Oct 18):
 *   input   { fileBase64, mimeType, fileName, text? }   (file ≤ 10 MB; text = pdf.js text for PDFs only)
 *   success { ok: true, card, provenance, provider: "azure" | "on-device", warnings: { code, message }[] }
 *   error   { ok: false, error: { code, message, retryAfterSec? } }
 *
 * PENDING CONTRACT (until BE-3's CONTRACT.md lands):
 * - `extractSheet` module (`@/lib/extract/extract-sheet`) is not on the branch yet; see extract-server.ts.
 * - Warning codes AZURE_NOT_CONFIGURED / AZURE_FALLBACK / IMAGE_ONLY_NEEDS_AZURE.
 * - Text cap: we omit `text` above 40,000 chars rather than reject (server reads the file).
 */
import type { FieldCardData } from "./types.ts";

export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_TEXT_CHARS = 40_000;
/** BE-3 server timeout is 60s; the client waits a little longer so the server's code wins. */
export const CLIENT_TIMEOUT_MS = 65_000;

export const ACCEPT_ATTR = ".pdf,.png,.jpg,.jpeg,.tif,.tiff,.docx";
export const PDF_MIME = "application/pdf";
export const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
/** Extension → mimeType we send. The server decides; this only pre-rejects obvious misses. */
const MIME_BY_EXT: Record<string, string> = {
  pdf: PDF_MIME,
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  tif: "image/tiff",
  tiff: "image/tiff",
  docx: DOCX_MIME,
};
export const ALLOWED_MIME_TYPES = [...new Set(Object.values(MIME_BY_EXT))];

/** Warning codes (pending contract). */
export const WARNING_AZURE_NOT_CONFIGURED = "AZURE_NOT_CONFIGURED";
export const WARNING_AZURE_FALLBACK = "AZURE_FALLBACK";
export const WARNING_IMAGE_ONLY_NEEDS_AZURE = "IMAGE_ONLY_NEEDS_AZURE";
export const IMAGE_ONLY_NOTICE =
  "This sheet needs the Azure reader. Showing what could be read on-device.";

export const EXTRACT_ERROR_CODES = [
  "UNAUTHENTICATED",
  "RATE_LIMITED",
  "EXTRACT_TIMEOUT",
  "EXTRACT_FAILED",
  "FILE_TOO_LARGE",
  "UNSUPPORTED_FILE_TYPE",
] as const;
export type ExtractErrorCode = (typeof EXTRACT_ERROR_CODES)[number];
/** Client-only reason: the server function is missing or unreachable. Not a server code. */
export type ServerIssue = ExtractErrorCode | "SERVER_UNAVAILABLE";

export type ProvenanceEntry = { page?: number; quote: string } | "not-stated";
export type Provenance = Record<string, ProvenanceEntry>;
export type ExtractWarning = { code: string; message: string };

export type ExtractResult = {
  card: FieldCardData;
  provenance: Provenance;
  provider: string;
  warnings: ExtractWarning[];
};

export type ExtractSheetInput = {
  fileBase64: string;
  mimeType: string;
  fileName: string;
  text?: string;
};
export type ExtractSheetResponse =
  | ({ ok: true } & ExtractResult)
  | { ok: false; error: { code: string; message?: string; retryAfterSec?: number } };

export type ServerOutcome =
  { ok: true; result: ExtractResult } | { ok: false; code: ServerIssue; retryAfterSec?: number };

export type DoneState = {
  kind: "done";
  result: ExtractResult;
  /** server = server answered; client-fallback = server failed and the browser read the PDF; on-device = no server call. */
  source: "server" | "client-fallback" | "on-device";
  issue?: ServerIssue;
  retryAfterSec?: number;
};

/** What the UI renders. */
export type ExtractState =
  | { kind: "idle" }
  | { kind: "loading" }
  | DoneState
  | { kind: "unauthenticated" }
  | { kind: "error"; message: string; issue?: ServerIssue; retryAfterSec?: number };

export const ISSUE_COPY: Record<ServerIssue, string> = {
  UNAUTHENTICATED: "Your sign-in ran out. Sign in again to keep going.",
  RATE_LIMITED: "That’s 10 sheets in a minute. The server reader needs a short break.",
  EXTRACT_TIMEOUT: "The server reader took longer than a minute on this sheet.",
  EXTRACT_FAILED: "The server reader couldn’t read this sheet.",
  FILE_TOO_LARGE: "This file is over 10 MB. Use a smaller file.",
  UNSUPPORTED_FILE_TYPE:
    "That file type isn’t supported. Use a PDF, photo or scan (PNG, JPG, TIFF), or Word (.docx) file.",
  SERVER_UNAVAILABLE: "The server reader isn’t reachable right now.",
};

export const FALLBACK_NOTE = "Used the on-device reader. Check every value against the sheet.";
export const GUEST_NEEDS_SIGN_IN =
  "Sign in to read photos, scans, and Word files. PDFs and pasted text work without an account.";

export function retryCopy(sec: number | undefined): string {
  if (!sec || sec <= 0) return "Try again in a minute.";
  return `Try again in ${Math.ceil(sec)} s.`;
}

function extOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i < 0 ? "" : name.slice(i + 1).toLowerCase();
}

/** Mime type to send, from the extension (falls back to the browser's type). Null = obviously unsupported. */
export function mimeTypeFor(file: { name: string; type?: string }): string | null {
  const byExt = MIME_BY_EXT[extOf(file.name)];
  if (byExt) return byExt;
  if (file.type && ALLOWED_MIME_TYPES.includes(file.type)) return file.type;
  return null;
}

export function isPdf(file: { name: string; type?: string }): boolean {
  return mimeTypeFor(file) === PDF_MIME;
}

/** Client pre-check: size and obvious extension. Returns the code to show, or null when OK to send. */
export function precheckFile(file: {
  name: string;
  type?: string;
  size: number;
}): ExtractErrorCode | null {
  if (!mimeTypeFor(file)) return "UNSUPPORTED_FILE_TYPE";
  if (file.size > MAX_FILE_BYTES) return "FILE_TOO_LARGE";
  return null;
}

function isErrorCode(v: unknown): v is ExtractErrorCode {
  return typeof v === "string" && (EXTRACT_ERROR_CODES as readonly string[]).includes(v);
}

function isProvenanceEntry(v: unknown): v is ProvenanceEntry {
  if (v === "not-stated") return true;
  if (!v || typeof v !== "object") return false;
  const e = v as { quote?: unknown; page?: unknown };
  return typeof e.quote === "string" && (e.page === undefined || typeof e.page === "number");
}

function isWarning(v: unknown): v is ExtractWarning {
  if (!v || typeof v !== "object") return false;
  const w = v as { code?: unknown; message?: unknown };
  return typeof w.code === "string" && typeof w.message === "string";
}

/** Only the documented result fields. Anything malformed is EXTRACT_FAILED. */
export function parseExtractResult(body: unknown): ExtractResult | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  const card = b.card as FieldCardData | undefined;
  if (
    !card ||
    typeof card !== "object" ||
    !card.product ||
    !card.environmentals ||
    !card.surfacePrep
  )
    return null;
  if (typeof b.provider !== "string") return null;
  if (!Array.isArray(b.warnings) || !b.warnings.every(isWarning)) return null;
  const rawProv = b.provenance;
  if (!rawProv || typeof rawProv !== "object" || Array.isArray(rawProv)) return null;
  const provenance: Provenance = {};
  for (const [k, v] of Object.entries(rawProv as Record<string, unknown>)) {
    if (!isProvenanceEntry(v)) return null;
    provenance[k] = v;
  }
  return { card, provenance, provider: b.provider, warnings: b.warnings as ExtractWarning[] };
}

/** Map the server fn's returned value to an outcome. */
export function mapServerResponse(res: unknown): ServerOutcome {
  if (!res || typeof res !== "object") return { ok: false, code: "EXTRACT_FAILED" };
  const r = res as { ok?: unknown; error?: { code?: unknown; retryAfterSec?: unknown } };
  if (r.ok === true) {
    const result = parseExtractResult(res);
    return result ? { ok: true, result } : { ok: false, code: "EXTRACT_FAILED" };
  }
  const code = isErrorCode(r.error?.code) ? r.error.code : "EXTRACT_FAILED";
  const retry = r.error?.retryAfterSec;
  return typeof retry === "number" && retry > 0
    ? { ok: false, code, retryAfterSec: retry }
    : { ok: false, code };
}

/** A thrown error from the server fn: authMiddleware throws "Unauthorized"; anything else is unreachable. */
export function mapThrown(err: unknown): ServerIssue {
  if (err && typeof err === "object" && (err as { message?: unknown }).message === "Unauthorized")
    return "UNAUTHENTICATED";
  return "SERVER_UNAVAILABLE";
}

export function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  const step = 0x8000;
  for (let i = 0; i < bytes.length; i += step) {
    bin += String.fromCharCode(...bytes.subarray(i, i + step));
  }
  return btoa(bin);
}

export type ServerCall = (input: ExtractSheetInput) => Promise<ExtractSheetResponse | null>;

/** Run the server call with a client timeout. `null` from the adapter = server fn not available. */
export async function callServer(
  call: ServerCall,
  input: ExtractSheetInput,
  timeoutMs = CLIENT_TIMEOUT_MS,
): Promise<ServerOutcome> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<"timeout">((resolve) => {
    timer = setTimeout(() => resolve("timeout"), timeoutMs);
  });
  try {
    const res = await Promise.race([call(input), timeout]);
    if (res === "timeout") return { ok: false, code: "EXTRACT_TIMEOUT" };
    if (res === null) return { ok: false, code: "SERVER_UNAVAILABLE" };
    return mapServerResponse(res);
  } catch (err) {
    return { ok: false, code: mapThrown(err) };
  } finally {
    clearTimeout(timer);
  }
}

/** Codes where a PDF may still be read in the browser. Not for auth, type, or size refusals. */
const CLIENT_FALLBACK_CODES: ReadonlySet<ServerIssue> = new Set([
  "SERVER_UNAVAILABLE",
  "EXTRACT_FAILED",
  "EXTRACT_TIMEOUT",
  "RATE_LIMITED",
]);

export const ON_DEVICE_PROVIDER = "on-device";

function onDeviceRead(
  text: string,
  onDevice: (text: string) => FieldCardData,
  source: DoneState["source"],
  issue?: ServerIssue,
  retryAfterSec?: number,
): ExtractState {
  try {
    const card = onDevice(text);
    return {
      kind: "done",
      result: { card, provenance: {}, provider: ON_DEVICE_PROVIDER, warnings: [] },
      source,
      ...(issue ? { issue } : {}),
      ...(retryAfterSec ? { retryAfterSec } : {}),
    };
  } catch (err) {
    const local = err instanceof Error ? err.message : "Could not read this sheet.";
    return {
      kind: "error",
      message: issue ? `${ISSUE_COPY[issue]} ${local}` : local,
      issue,
      retryAfterSec,
    };
  }
}

function errorState(issue: ServerIssue, retryAfterSec?: number): ExtractState {
  const base = ISSUE_COPY[issue];
  const message = issue === "RATE_LIMITED" ? `${base} ${retryCopy(retryAfterSec)}` : base;
  return { kind: "error", message, issue, ...(retryAfterSec ? { retryAfterSec } : {}) };
}

/**
 * Upload path. Signed in: server first. Server unreachable/failed: only PDFs fall back to the
 * browser's on-device reader (pdf.js text); photos and Word files show the error instead of a fake card.
 * Guests skip the server (it is auth-gated): PDFs read on-device, other types ask to sign in.
 */
export async function extractUpload(input: {
  file: { name: string; type?: string; size: number };
  /** pdf.js text (PDFs only; "" when unreadable). */
  text: string;
  signedIn: boolean;
  onDevice: (text: string) => FieldCardData;
  readBase64: () => Promise<string>;
  server: ServerCall;
}): Promise<ExtractState> {
  const pre = precheckFile(input.file);
  if (pre) return errorState(pre);
  const pdf = isPdf(input.file);
  if (!input.signedIn) {
    return pdf
      ? onDeviceRead(input.text, input.onDevice, "on-device")
      : { kind: "error", message: GUEST_NEEDS_SIGN_IN };
  }
  const mimeType = mimeTypeFor(input.file)!;
  let fileBase64: string;
  try {
    fileBase64 = await input.readBase64();
  } catch {
    return pdf
      ? onDeviceRead(input.text, input.onDevice, "on-device")
      : { kind: "error", message: "Could not open this file." };
  }
  const payload: ExtractSheetInput = { fileBase64, mimeType, fileName: input.file.name };
  if (pdf && input.text && input.text.length <= MAX_TEXT_CHARS) payload.text = input.text;
  const out = await callServer(input.server, payload);
  if (out.ok) return { kind: "done", result: out.result, source: "server" };
  if (out.code === "UNAUTHENTICATED") return { kind: "unauthenticated" };
  if (pdf && CLIENT_FALLBACK_CODES.has(out.code)) {
    return onDeviceRead(input.text, input.onDevice, "client-fallback", out.code, out.retryAfterSec);
  }
  return errorState(out.code, out.retryAfterSec);
}

/** Pasted text: always on-device (the server takes a file). */
export function extractPasted(
  text: string,
  onDevice: (text: string) => FieldCardData,
): ExtractState {
  return onDeviceRead(text, onDevice, "on-device");
}

function hasWarning(result: ExtractResult, code: string): boolean {
  return result.warnings.some((w) => w.code === code);
}

/** Server said the sheet is image-only and Azure isn't there. Never decided in the browser. */
export function needsAzureReader(result: ExtractResult): boolean {
  return hasWarning(result, WARNING_IMAGE_ONLY_NEEDS_AZURE);
}

/** "Used on-device fallback": server fell back (AZURE_FALLBACK) or the browser did. */
export function usedOnDeviceFallback(state: DoneState): boolean {
  return state.source === "client-fallback" || hasWarning(state.result, WARNING_AZURE_FALLBACK);
}

export function azureNotConfigured(state: DoneState): boolean {
  return hasWarning(state.result, WARNING_AZURE_NOT_CONFIGURED);
}

const HANDLED_CODES = new Set([
  WARNING_AZURE_NOT_CONFIGURED,
  WARNING_AZURE_FALLBACK,
  WARNING_IMAGE_ONLY_NEEDS_AZURE,
]);

/** Warnings shown as plain messages; codes with their own notice are not repeated. */
export function displayWarnings(result: ExtractResult): string[] {
  return result.warnings.filter((w) => !HANDLED_CODES.has(w.code)).map((w) => w.message);
}

/** Small provider note under the card. */
export function providerLabel(state: DoneState): string {
  if (usedOnDeviceFallback(state)) return FALLBACK_NOTE;
  if (state.source === "server" && state.result.provider === "azure") return "Azure reader.";
  if (state.source === "server" && azureNotConfigured(state)) return "On-device reader.";
  return "On-device reader. Check every value against the sheet.";
}

export type ProvenanceRow = { fieldPath: string; label: string; stated: boolean; text: string };

function labelFor(path: string): string {
  return path
    .split(".")
    .map((seg) => seg.replace(/\[(\d+)\]/g, " $1").replace(/([a-z])([A-Z])/g, "$1 $2"))
    .map((seg) => seg.charAt(0).toUpperCase() + seg.slice(1))
    .join(" › ");
}

export function describeProvenance(entry: ProvenanceEntry): string {
  if (entry === "not-stated") return "Not stated";
  const q = `“${entry.quote}”`;
  return typeof entry.page === "number" ? `p. ${entry.page} — ${q}` : q;
}

/** Sorted rows for the "Where each value came from" panel. */
export function provenanceRows(provenance: Provenance): ProvenanceRow[] {
  return Object.keys(provenance)
    .sort()
    .map((fieldPath) => {
      const entry = provenance[fieldPath]!;
      return {
        fieldPath,
        label: labelFor(fieldPath),
        stated: entry !== "not-stated",
        text: describeProvenance(entry),
      };
    });
}
