/**
 * FE-1 client for the BE-3 server extract (`extractSheet`), with an on-device fallback for PDFs.
 *
 * No AI runs here, no keys, no xAI. The browser sends the file to our own server function;
 * the server decides which reader (Azure or on-device) reads it and whether a sheet is image-only.
 *
 * Contract: docs/release-beta/CONTRACT.md, BE-1 types (src/lib/extract/provider.ts, PR #24),
 * and LEAD rulings (Oct 18):
 *   input   { fileBase64, mimeType, fileName, text?, pages? }
 *           text/pages = pdf.js text (pages: one string per page, index 0 = page 1), PDFs only,
 *           omitted over 40,000 chars.
 *   success { ok: true, card, provenance, provider: "azure" | "on-device", deployment?, warnings: { code, message }[] }
 *           ("azure:<deployment>" from BE-1's ProviderLabel is tolerated and normalized.)
 *   error   { ok: false, error: { code, message, retryAfterSec? } }
 *   upload cap: server env MAX_UPLOAD_MB (default 10, practice 3); FILE_TOO_LARGE carries the
 *           limit in `message`, shown verbatim. The client only pre-checks the 10 MB ceiling.
 *
 * PENDING CONTRACT:
 * - `extractSheet` input in BE-3 (#26) is still { text, pages?, pdfBase64?, fileName? }; see extract-server.ts.
 * - No limits endpoint / `maxUploadMb` field, so the client pre-check stays at the 10 MB ceiling.
 * - Saved job `extract` field: BE-3 server write not landed (see SavedExtract).
 */
import type {
  ExtractErrorCode as ProviderErrorCode,
  ExtractInput,
  ExtractResult as ProviderResult,
  ExtractWarning,
  ExtractWarningCode,
  Provenance,
} from "./extract/provider.ts";
import type { FieldCardData } from "./types.ts";

export type { ExtractWarning, ExtractWarningCode, Provenance };

/**
 * Absolute ceiling for the client pre-check. The real limit is the server's MAX_UPLOAD_MB
 * (practice copy = 3 MB; Vercel request bodies cap near 4.5 MB, and base64 adds ~33%).
 */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
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

/** Warning codes, typed against BE-1's ExtractWarningCode union. */
export const WARNING_AZURE_NOT_CONFIGURED: ExtractWarningCode = "AZURE_NOT_CONFIGURED";
export const WARNING_AZURE_FALLBACK: ExtractWarningCode = "AZURE_FALLBACK";
export const WARNING_IMAGE_ONLY_NEEDS_AZURE: ExtractWarningCode = "IMAGE_ONLY_NEEDS_AZURE";
export const WARNING_VALUES_DROPPED_UNQUOTED: ExtractWarningCode = "VALUES_DROPPED_UNQUOTED";
export const WARNING_ON_DEVICE_UNPINNED: ExtractWarningCode = "ON_DEVICE_UNPINNED";
export const VALUES_DROPPED_NOTE =
  "Some values were left Not stated because no line on the sheet backed them.";
export const UNPINNED_TEXT = "Found on the sheet, no exact line.";
export const IMAGE_ONLY_NOTICE =
  "This sheet needs the Azure reader. Showing what could be read on-device.";

/** BE-1's codes plus UNSUPPORTED_FILE_TYPE (LEAD ruling; not yet in BE-1's union). */
export type ExtractErrorCode = ProviderErrorCode | "UNSUPPORTED_FILE_TYPE";
export const EXTRACT_ERROR_CODES: readonly ExtractErrorCode[] = [
  "UNAUTHENTICATED",
  "RATE_LIMITED",
  "EXTRACT_TIMEOUT",
  "EXTRACT_FAILED",
  "FILE_TOO_LARGE",
  "UNSUPPORTED_FILE_TYPE",
];
/** Client-only reason: the server function is missing or unreachable. Not a server code. */
export type ServerIssue = ExtractErrorCode | "SERVER_UNAVAILABLE";

export type ProvenanceEntry = Provenance[string];
export type ExtractProvider = "azure" | "on-device";

/** BE-1's result with the provider normalized (LEAD: "azure" | "on-device" + display-only deployment). */
export type ExtractResult = Omit<ProviderResult, "provider"> & {
  provider: ExtractProvider;
  deployment?: string;
};

/** BE-1's on-device provider, injected so tests and the browser share one shape. */
export type OnDeviceExtract = (input: ExtractInput) => Promise<ProviderResult>;

export type ExtractSheetInput = {
  fileBase64: string;
  mimeType: string;
  fileName: string;
  text?: string;
  /** pdf.js text, one entry per page (index 0 = page 1). PDFs only. */
  pages?: string[];
};
export type ExtractSheetResponse =
  | ({ ok: true } & Omit<ExtractResult, "provider"> & { provider: string })
  | { ok: false; error: { code: string; message?: string; retryAfterSec?: number } };

export type ServerOutcome =
  | { ok: true; result: ExtractResult }
  | { ok: false; code: ServerIssue; message?: string; retryAfterSec?: number };

export type DoneState = {
  kind: "done";
  result: ExtractResult;
  /** server = server answered; client-fallback = server failed and the browser read the PDF;
   *  on-device = no server call; saved = reopened from the job record. */
  source: "server" | "client-fallback" | "on-device" | "saved";
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
  FILE_TOO_LARGE: "This file is too large for the reader. Use a smaller file.",
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
  if (file.size > MAX_UPLOAD_BYTES) return "FILE_TOO_LARGE";
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

/** Tolerant: malformed warnings are dropped, missing messages become "". Never throws. */
export function parseWarnings(raw: unknown): ExtractWarning[] {
  if (!Array.isArray(raw)) return [];
  const out: ExtractWarning[] = [];
  for (const v of raw) {
    if (!v || typeof v !== "object") continue;
    const w = v as { code?: unknown; message?: unknown };
    if (typeof w.code !== "string") continue;
    // Unknown codes are kept (shown as plain notes); typed as the union for the known ones.
    out.push({ code: w.code as ExtractWarningCode, message: typeof w.message === "string" ? w.message : "" });
  }
  return out;
}

/** "azure", "azure:<deployment>", or "on-device". Anything else reads as on-device. */
export function normalizeProvider(
  raw: unknown,
  deployment?: unknown,
): { provider: ExtractProvider; deployment?: string } {
  const p = typeof raw === "string" ? raw : "";
  let dep = typeof deployment === "string" && deployment ? deployment : undefined;
  if (p !== "azure" && !p.startsWith("azure:")) return { provider: "on-device" };
  if (!dep && p.startsWith("azure:")) dep = p.slice("azure:".length) || undefined;
  return dep ? { provider: "azure", deployment: dep } : { provider: "azure" };
}

/** Provenance map, or null when any entry is malformed. */
export function parseProvenance(raw: unknown): Provenance | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const provenance: Provenance = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!isProvenanceEntry(v)) return null;
    provenance[k] = v;
  }
  return provenance;
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
  const provenance = parseProvenance(b.provenance);
  if (!provenance) return null;
  return {
    card,
    provenance,
    ...normalizeProvider(b.provider, b.deployment),
    warnings: parseWarnings(b.warnings),
  };
}

/** Map the server fn's returned value to an outcome. */
export function mapServerResponse(res: unknown): ServerOutcome {
  if (!res || typeof res !== "object") return { ok: false, code: "EXTRACT_FAILED" };
  const r = res as {
    ok?: unknown;
    error?: { code?: unknown; message?: unknown; retryAfterSec?: unknown };
  };
  if (r.ok === true) {
    const result = parseExtractResult(res);
    return result ? { ok: true, result } : { ok: false, code: "EXTRACT_FAILED" };
  }
  const code = isErrorCode(r.error?.code) ? r.error.code : "EXTRACT_FAILED";
  const retry = r.error?.retryAfterSec;
  const message = typeof r.error?.message === "string" && r.error.message.trim() ? r.error.message : undefined;
  return {
    ok: false,
    code,
    ...(message ? { message } : {}),
    ...(typeof retry === "number" && retry > 0 ? { retryAfterSec: retry } : {}),
  };
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

export function normalizeResult(r: ProviderResult): ExtractResult {
  return { ...r, ...normalizeProvider(r.provider), warnings: parseWarnings(r.warnings) };
}

/** On-device via BE-1's onDeviceProvider: same provenance, warnings and not-stated marks as the server. */
async function onDeviceRead(
  src: { text: string; pages?: string[] },
  onDevice: OnDeviceExtract,
  source: DoneState["source"],
  issue?: ServerIssue,
  retryAfterSec?: number,
): Promise<ExtractState> {
  try {
    const r = await onDevice(src.pages?.length ? { text: src.text, pages: src.pages } : { text: src.text });
    return {
      kind: "done",
      result: normalizeResult(r),
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

/** FILE_TOO_LARGE shows the server's message verbatim (it names the deploy's limit). */
function errorState(issue: ServerIssue, retryAfterSec?: number, serverMessage?: string): ExtractState {
  const base = issue === "FILE_TOO_LARGE" && serverMessage ? serverMessage : ISSUE_COPY[issue];
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
  /** pdf.js per-page text (PDFs only). */
  pages?: string[];
  signedIn: boolean;
  onDevice: OnDeviceExtract;
  readBase64: () => Promise<string>;
  server: ServerCall;
}): Promise<ExtractState> {
  const pre = precheckFile(input.file);
  if (pre) return errorState(pre);
  const pdf = isPdf(input.file);
  if (!input.signedIn) {
    return pdf
      ? onDeviceRead(input, input.onDevice, "on-device")
      : { kind: "error", message: GUEST_NEEDS_SIGN_IN };
  }
  const mimeType = mimeTypeFor(input.file)!;
  let fileBase64: string;
  try {
    fileBase64 = await input.readBase64();
  } catch {
    return pdf
      ? onDeviceRead(input, input.onDevice, "on-device")
      : { kind: "error", message: "Could not open this file." };
  }
  const payload: ExtractSheetInput = { fileBase64, mimeType, fileName: input.file.name };
  if (pdf && input.text && input.text.length <= MAX_TEXT_CHARS) {
    payload.text = input.text;
    const pages = input.pages;
    if (pages?.length && pages.join("\n\n").length <= MAX_TEXT_CHARS) payload.pages = pages;
  }
  const out = await callServer(input.server, payload);
  if (out.ok) return { kind: "done", result: out.result, source: "server" };
  if (out.code === "UNAUTHENTICATED") return { kind: "unauthenticated" };
  if (pdf && CLIENT_FALLBACK_CODES.has(out.code)) {
    return onDeviceRead(input, input.onDevice, "client-fallback", out.code, out.retryAfterSec);
  }
  return errorState(out.code, out.retryAfterSec, out.message);
}

/** Pasted text: always on-device (the server takes a file). */
export function extractPasted(text: string, onDevice: OnDeviceExtract): Promise<ExtractState> {
  return onDeviceRead({ text }, onDevice, "on-device");
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
  WARNING_VALUES_DROPPED_UNQUOTED,
  WARNING_ON_DEVICE_UNPINNED,
]);

/** Small neutral notes under the card. Known codes get our copy; unknown codes show their message. */
export function displayWarnings(result: ExtractResult): string[] {
  const notes: string[] = [];
  if (hasWarning(result, WARNING_VALUES_DROPPED_UNQUOTED)) notes.push(VALUES_DROPPED_NOTE);
  for (const w of result.warnings) {
    if (HANDLED_CODES.has(w.code) || !w.message.trim()) continue;
    if (!notes.includes(w.message)) notes.push(w.message);
  }
  return notes;
}

/** Small provider note under the card. */
export function providerLabel(state: DoneState): string {
  if (usedOnDeviceFallback(state)) return FALLBACK_NOTE;
  if (state.result.provider === "azure") {
    return state.result.deployment ? `Azure reader (${state.result.deployment}).` : "Azure reader.";
  }
  if (azureNotConfigured(state)) return "On-device reader.";
  return "On-device reader. Check every value against the sheet.";
}

export type ProvenanceRow = { fieldPath: string; label: string; stated: boolean; text: string };

function labelFor(path: string): string {
  return path
    .split(".")
    .map((seg) => (/^\d+$/.test(seg) ? `#${Number(seg) + 1}` : seg))
    .map((seg) =>
      seg
        .replace(/\[(\d+)\]/g, (_m, n: string) => ` #${Number(n) + 1}`)
        .replace(/([a-z])([A-Z])/g, "$1 $2"),
    )
    .map((seg) => seg.charAt(0).toUpperCase() + seg.slice(1))
    .join(" › ");
}

export function describeProvenance(entry: ProvenanceEntry): string {
  if (entry === "not-stated") return "Not stated";
  if (!entry.quote.trim()) return UNPINNED_TEXT;
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

/**
 * Saved with the job record next to `card` (LEAD ruling):
 *   extract: { provider, deployment?, provenance, warnings, extractedAt }
 * PENDING BE-3: the server write (column / JSON field) is not in #26 yet. FE sends it on save and
 * reads it on reopen through these two functions only. Older jobs lack it → panel stays empty.
 */
export type SavedExtract = {
  provider: ExtractProvider;
  deployment?: string;
  provenance: Provenance;
  warnings: ExtractWarning[];
  extractedAt: string;
};

/** What to save for the current read; null when there is nothing to save (idle/error/loading). */
export function toSavedExtract(state: ExtractState, now: () => string = () => new Date().toISOString()): SavedExtract | null {
  if (state.kind !== "done") return null;
  const r = state.result;
  return {
    provider: r.provider,
    ...(r.deployment ? { deployment: r.deployment } : {}),
    provenance: r.provenance,
    warnings: r.warnings,
    extractedAt: r.card.extractedAt || now(),
  };
}

/** Reopen: rebuild the panel from the saved record. Missing or malformed → idle, never throws. */
export function savedExtractState(record: { card: FieldCardData | null; extract?: unknown }): ExtractState {
  if (!record.card || !record.extract || typeof record.extract !== "object") return { kind: "idle" };
  const x = record.extract as Record<string, unknown>;
  const provenance = parseProvenance(x.provenance);
  if (!provenance || typeof x.provider !== "string") return { kind: "idle" };
  return {
    kind: "done",
    source: "saved",
    result: {
      card: record.card,
      provenance,
      ...normalizeProvider(x.provider, x.deployment),
      warnings: parseWarnings(x.warnings),
    },
  };
}
