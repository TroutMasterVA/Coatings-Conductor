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
 *   flags   `draft?`, `unverifiedTemps?` top-level on the (flat) response; missing = false.
 *   save    `extract` = #24's `toSavedExtract(result)`; reopen reads `extract.draft/.unverifiedTemps`.
 *   limits  `getExtractLimits()` → { maxUploadMb } for the pre-check, capped at the 10 MB ceiling.
 *
 *   edits   CONTRACT.md "Edit stamp (hand edits)": a hand-edited field's provenance entry is
 *           `{ edited: { by, at }, sheetQuote?: { page?, quote } }`, set only by the server
 *           (by = display name, else email; at = server time, ISO-8601). The panel shows
 *           "Edited by {by}, {at}" and the old sheet quote beneath it, labelled as the original
 *           (never as backing the new value). Until the server stamps, a field changed this
 *           session reads "Edited in this session — not from the sheet". The browser never writes
 *           `edited` into a saved extract: saves send a fresh read once (replace) and otherwise
 *           omit `extract` so the server keeps what it stored (and its stamps).
 */
import { parseSavedExtract } from "./job-extract.ts";
import { toSavedExtract as buildSavedExtract } from "./extract/provider.ts";
import type {
  ExtractRequest,
  SavedExtract,
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

/** Server stamp for a hand-edited field (CONTRACT.md "Edit stamp (hand edits)"). */
export type SheetQuote = { page?: number; quote: string };
export type EditedEntry = { edited: { by: string; at: string }; sheetQuote?: SheetQuote };
export type ProvenanceEntry = Provenance[string] | EditedEntry;
export type ClientProvenance = Record<string, ProvenanceEntry>;
export const SESSION_EDIT_TEXT = "Edited in this session — not from the sheet";
/** Label for the pre-edit sheet quote kept under a stamp. History only, not the new value's source. */
export const SHEET_QUOTE_LABEL = "Original sheet quote (before the edit)";
/** Shown when a stamp's `at` is missing or not a date. */
export const EDITED_AT_UNKNOWN = "time not recorded";
/** Shown when a stamp's `by` is missing or blank. */
export const EDITED_BY_UNKNOWN = "a signed-in user";
export type ExtractProvider = "azure" | "on-device";

/** BE-1's result with the provider normalized (LEAD: "azure" | "on-device" + display-only deployment). */
export type ExtractResult = Omit<ProviderResult, "provider" | "provenance"> & {
  provider: ExtractProvider;
  deployment?: string;
  provenance: ClientProvenance;
};

/** BE-1's on-device provider, injected so tests and the browser share one shape. */
export type OnDeviceExtract = (input: ExtractInput) => Promise<ProviderResult>;

export type { SavedExtract };
/** BE-3 `ExtractRequest`, with the file required on the upload path. */
export type ExtractSheetInput = ExtractRequest & {
  fileBase64: string;
  mimeType: string;
  fileName: string;
};
/** Loose on purpose: the server's value is validated by mapServerResponse. */
export type ExtractSheetResponse = unknown;

export type ServerOutcome =
  | { ok: true; result: ExtractResult }
  | { ok: false; code: ServerIssue; message?: string; retryAfterSec?: number };

export type DoneState = {
  kind: "done";
  result: ExtractResult;
  /** server = server answered; client-fallback = server failed and the browser read the PDF;
   *  on-device = no server call; saved = reopened from the job record. */
  source: "server" | "client-fallback" | "on-device" | "saved";
  /** Reopened jobs: the saved extract as stored (read for flags; never re-sent, the server keeps it). */
  saved?: SavedExtract;
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

/** Same text as the server's FILE_TOO_LARGE (extract-core `checkRequest`), so browser and server copy match. */
export function fileTooLargeMessage(maxBytes?: number): string {
  const bytes = Math.min(maxBytes ?? MAX_UPLOAD_BYTES, MAX_UPLOAD_BYTES);
  const mb = Math.round((bytes / (1024 * 1024)) * 10) / 10;
  return `File is over ${mb} MB, the upload limit on this copy.`;
}

/** Client pre-check: size and obvious extension. Returns the code to show, or null when OK to send. */
export function precheckFile(
  file: { name: string; type?: string; size: number },
  /** From getExtractLimits() when available; never above the 10 MB ceiling. */
  maxBytes?: number,
): ExtractErrorCode | null {
  if (!mimeTypeFor(file)) return "UNSUPPORTED_FILE_TYPE";
  if (file.size > Math.min(maxBytes ?? MAX_UPLOAD_BYTES, MAX_UPLOAD_BYTES)) return "FILE_TOO_LARGE";
  return null;
}

function isErrorCode(v: unknown): v is ExtractErrorCode {
  return typeof v === "string" && (EXTRACT_ERROR_CODES as readonly string[]).includes(v);
}

function isQuoteEntry(v: unknown): v is Provenance[string] {
  if (v === "not-stated") return true;
  if (!v || typeof v !== "object") return false;
  const e = v as { quote?: unknown; page?: unknown };
  return typeof e.quote === "string" && (e.page === undefined || typeof e.page === "number");
}

function isSheetQuote(v: unknown): v is SheetQuote {
  return isQuoteEntry(v) && v !== "not-stated";
}

/**
 * A server edit stamp, normalized. `edited` must be an object; a missing/blank `by` or a
 * missing/non-string `at` is tolerated (rendered as unknown) so one odd stamp never blanks the
 * panel. A malformed `sheetQuote` is dropped. Null = not an edit stamp.
 */
function parseEditedEntry(v: unknown): EditedEntry | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const e = v as { edited?: unknown; sheetQuote?: unknown };
  const ed = e.edited;
  if (!ed || typeof ed !== "object" || Array.isArray(ed)) return null;
  const { by, at } = ed as { by?: unknown; at?: unknown };
  const out: EditedEntry = {
    edited: {
      by: typeof by === "string" ? by : "",
      at: typeof at === "string" ? at : "",
    },
  };
  if (isSheetQuote(e.sheetQuote)) {
    const q = e.sheetQuote;
    out.sheetQuote =
      typeof q.page === "number" ? { page: q.page, quote: q.quote } : { quote: q.quote };
  }
  return out;
}

export function isEditedEntry(v: unknown): v is EditedEntry {
  return !!v && typeof v === "object" && "edited" in v;
}

function parseProvenanceEntry(v: unknown): ProvenanceEntry | null {
  if (isQuoteEntry(v)) return v;
  return parseEditedEntry(v);
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
    out.push({
      code: w.code as ExtractWarningCode,
      message: typeof w.message === "string" ? w.message : "",
    });
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
export function parseProvenance(raw: unknown): ClientProvenance | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const provenance: ClientProvenance = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const entry = parseProvenanceEntry(v);
    if (!entry) return null;
    provenance[k] = entry;
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
  // Flat response (CONTRACT.md on #24): each field once, no `extract` object.
  if (typeof b.provider !== "string") return null;
  const provenance = parseProvenance(b.provenance);
  if (!provenance) return null;
  const norm = normalizeProvider(b.provider, b.deployment);
  const warnings = parseWarnings(b.warnings);
  return {
    card,
    provenance,
    ...norm,
    warnings,
    draft: b.draft === true,
    unverifiedTemps: b.unverifiedTemps === true,
    // Signed read (CONTRACT "Signed extract read"): server-only, passed back untouched on the
    // one fresh-read save. Never built, parsed into parts, or altered here.
    ...(b.serverRead !== undefined
      ? { serverRead: b.serverRead as ExtractResult["serverRead"] }
      : {}),
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
  const message =
    typeof r.error?.message === "string" && r.error.message.trim() ? r.error.message : undefined;
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
  return {
    ...r,
    ...normalizeProvider(r.provider, r.deployment),
    warnings: parseWarnings(r.warnings),
  };
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
    const r = await onDevice(
      src.pages?.length ? { text: src.text, pages: src.pages } : { text: src.text },
    );
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
function errorState(
  issue: ServerIssue,
  retryAfterSec?: number,
  serverMessage?: string,
): ExtractState {
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
  /** getExtractLimits().maxUploadMb in bytes, when known. */
  maxUploadBytes?: number;
}): Promise<ExtractState> {
  const pre = precheckFile(input.file, input.maxUploadBytes);
  if (pre === "FILE_TOO_LARGE")
    return errorState(pre, undefined, fileTooLargeMessage(input.maxUploadBytes));
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

export type ProvenanceRow = {
  fieldPath: string;
  label: string;
  stated: boolean;
  edited: boolean;
  text: string;
  /** Server stamp with a kept sheet quote: "p. N — “…”", shown beneath under SHEET_QUOTE_LABEL. */
  sheetQuote?: string;
};

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

/** ISO-8601 server time → "Oct 18, 2026, 3:30 PM EDT". Missing or unparseable → EDITED_AT_UNKNOWN. */
export function formatEditedAt(at: unknown): string {
  if (typeof at !== "string" || !at.trim()) return EDITED_AT_UNKNOWN;
  const d = new Date(at);
  if (Number.isNaN(d.getTime())) return EDITED_AT_UNKNOWN;
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

function describeQuote(entry: SheetQuote): string {
  if (!entry.quote.trim()) return UNPINNED_TEXT;
  const q = `“${entry.quote}”`;
  return typeof entry.page === "number" ? `p. ${entry.page} — ${q}` : q;
}

export function describeProvenance(entry: ProvenanceEntry): string {
  if (entry === "not-stated") return "Not stated";
  if (isEditedEntry(entry)) {
    const by = entry.edited?.by?.trim() || EDITED_BY_UNKNOWN;
    return `Edited by ${by}, ${formatEditedAt(entry.edited?.at)}`;
  }
  return describeQuote(entry);
}

/** Sorted rows for the "Where each value came from" panel. */
/** Value at a dot path (`surfacePrep.prepGates.0.profile`), or undefined. */
export function valueAt(obj: unknown, path: string): unknown {
  let cur: unknown = obj;
  for (const seg of path.split(".")) {
    if (cur === null || cur === undefined || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[seg];
  }
  return cur;
}

/**
 * Rows for the "Where each value came from" panel. Server-stamped edits read "Edited by …", with
 * the kept sheet quote (if any) in `sheetQuote`. Pass `session` (card now vs card as read/opened):
 * a field changed in this session reads SESSION_EDIT_TEXT only — even over an older stamp, which no
 * longer describes the value on screen. Nothing about session edits goes into the saved extract.
 */
export function provenanceRows(
  provenance: ClientProvenance,
  session?: { current: unknown; asRead: unknown },
): ProvenanceRow[] {
  return Object.keys(provenance)
    .sort()
    .map((fieldPath) => {
      const entry = provenance[fieldPath]!;
      const serverEdited = isEditedEntry(entry);
      const sessionEdited =
        !!session &&
        JSON.stringify(valueAt(session.current, fieldPath) ?? null) !==
          JSON.stringify(valueAt(session.asRead, fieldPath) ?? null);
      const row: ProvenanceRow = {
        fieldPath,
        label: labelFor(fieldPath),
        stated: entry !== "not-stated" || sessionEdited,
        edited: serverEdited || sessionEdited,
        text: sessionEdited ? SESSION_EDIT_TEXT : describeProvenance(entry),
      };
      if (!sessionEdited && isEditedEntry(entry) && entry.sheetQuote) {
        row.sheetQuote = describeQuote(entry.sheetQuote);
      }
      return row;
    });
}

/** Provenance as the browser may save it: never an `edited` stamp (server-only, CONTRACT.md). */
function withoutEditStamps(p: ClientProvenance): Provenance {
  const out: Provenance = {};
  for (const [k, v] of Object.entries(p)) {
    out[k] = isEditedEntry(v) ? (v.sheetQuote ?? "not-stated") : v;
  }
  return out;
}

/**
 * The object a fresh read would store (replace); never carries `edited`.
 * `undefined` for anything that is not a fresh read: idle, reading, failed, or reopened from the record.
 * Use `extractForSave` to build the save payload.
 */
export function toSavedExtract(state: ExtractState): SavedExtract | undefined {
  if (state.kind !== "done") return undefined;
  if (state.source === "saved") return undefined;
  const r = state.result;
  // #24's helper builds the saved object; client-only state (session edits) never goes in.
  // Read time = the card's extractedAt, so the saved object is the same on every call.
  const at = r.card?.extractedAt;
  return buildSavedExtract(
    { ...r, provider: r.provider, provenance: withoutEditStamps(r.provenance) },
    typeof at === "string" && !Number.isNaN(Date.parse(at)) ? at : undefined,
  );
}

/**
 * The `extract` field for a save (CONTRACT.md keep / clear / replace). Omit (`undefined`) unless:
 * - a fresh successful read not yet stored → the object (replace), stamps stripped;
 * - the card was explicitly replaced without a read (sample, recent) → `null` (clear).
 * Idle, still reading, failed, unparseable saved extract, or a reopened job → `undefined`, so the
 * server keeps the stored quotes and Edited-by stamps.
 */
export function extractForSave(
  state: ExtractState,
  opts: { alreadyStored?: boolean; cardReplaced?: boolean } = {},
): SavedExtract | null | undefined {
  if (state.kind === "done") {
    if (state.source === "saved" || opts.alreadyStored) return undefined;
    return toSavedExtract(state);
  }
  return opts.cardReplaced ? null : undefined;
}

/** Reopen: rebuild the panel from the saved record. Missing or malformed → idle, never throws. */
export function savedExtractState(record: {
  card: FieldCardData | null;
  extract?: unknown;
}): ExtractState {
  if (!record.card) return { kind: "idle" };
  const raw = (
    record.extract && typeof record.extract === "object" ? record.extract : null
  ) as Record<string, unknown> | null;
  const provenance = parseProvenance(raw?.provenance);
  // parseSavedExtract (#24/#26) rejects server-stamped edited entries; tolerate them here.
  if (!raw || !provenance || (raw.provider !== "azure" && raw.provider !== "on-device"))
    return { kind: "idle" };
  const norm = normalizeProvider(raw.provider, raw.deployment);
  const warnings = parseWarnings(raw.warnings);
  const draft = raw.draft === true;
  const unverifiedTemps = raw.unverifiedTemps === true;
  const savedOut: SavedExtract = parseSavedExtract(record.extract) ?? {
    ...norm,
    provenance: provenance as unknown as SavedExtract["provenance"],
    warnings,
    extractedAt: typeof raw.extractedAt === "string" ? raw.extractedAt : record.card.extractedAt,
    draft,
    unverifiedTemps,
  };
  return {
    kind: "done",
    source: "saved",
    saved: savedOut,
    result: { card: record.card, provenance, ...norm, warnings, draft, unverifiedTemps },
  };
}
