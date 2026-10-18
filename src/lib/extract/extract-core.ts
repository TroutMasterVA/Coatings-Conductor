import { cleanBase64, isImageMime, maxBase64Length, normalizeMime, sniffFileType, DOCX_MIME } from "./file-type.ts";
import { readDocxText, readPdfText, type ReadText } from "./server-read.ts";
import { gateNumbers, leaves, quoteCoversNumbers, quoteIsVerbatim, sourceOf, unverifiedTempsFromGate, type SourceDoc } from "./provenance.ts";
import type {
  ExtractErrorCode,
  ExtractInput,
  ExtractRequest,
  ExtractProvider,
  ExtractResponse,
  ExtractResult,
  ExtractWarning,
  Provenance,
} from "./provider.ts";

export const EXTRACT_MAX_TEXT_CHARS = 40_000;
/** Default for env MAX_UPLOAD_MB (decoded file size). */
export const EXTRACT_DEFAULT_MAX_FILE_MB = 10;
export const EXTRACT_RATE_MAX = 10;
export const EXTRACT_RATE_WINDOW_MS = 60_000;
export const EXTRACT_TIMEOUT_MS = 60_000;
/** Azure must finish this long before the overall deadline so the on-device fallback still fits. */
export const FALLBACK_RESERVE_MS = 3_000;
/** Below this much text a PDF is treated as scanned / image-only. */
export const IMAGE_ONLY_TEXT_CHARS = 120;

export type RateStore = Map<string, number[]>;

export function takeRateSlot(
  store: RateStore,
  key: string,
  now: number,
  max = EXTRACT_RATE_MAX,
  windowMs = EXTRACT_RATE_WINDOW_MS,
): { ok: true } | { ok: false; retryAfterSec: number } {
  const stamps = (store.get(key) ?? []).filter((t) => now - t < windowMs);
  if (stamps.length >= max) {
    store.set(key, stamps);
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil((stamps[0]! + windowMs - now) / 1000)) };
  }
  stamps.push(now);
  store.set(key, stamps);
  return { ok: true };
}

export function base64Bytes(b64: string): number {
  const clean = b64.replace(/\s/g, "");
  const pad = clean.endsWith("==") ? 2 : clean.endsWith("=") ? 1 : 0;
  return Math.floor((clean.length * 3) / 4) - pad;
}

export type ExtractLog = (entry: {
  evt: "extract";
  provider: string;
  outcome: "ok" | "fallback" | ExtractErrorCode;
  ms: number;
  warnings: string[];
}) => void;

export type TextReaders = {
  pdf: (bytes: Uint8Array, signal?: AbortSignal) => Promise<ReadText>;
  docx: (bytes: Uint8Array) => Promise<ReadText>;
};

export type RunExtractDeps = {
  userId: string | null;
  input: ExtractRequest;
  azure: ExtractProvider | null;
  onDevice: ExtractProvider;
  rate: RateStore;
  now?: () => number;
  timeoutMs?: number;
  maxFileBytes?: number;
  log?: ExtractLog;
  /** Server-side text readers (pdf.js, mammoth). Injected for tests. */
  readers?: TextReaders;
};

class Timeout extends Error {
  constructor() {
    super("timeout");
    this.name = "Timeout";
  }
}

function withDeadline<T>(p: Promise<T>, ms: number, ctl: AbortController): Promise<T> {
  if (ms <= 0) {
    ctl.abort();
    return Promise.reject(new Timeout());
  }
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => {
      ctl.abort();
      reject(new Timeout());
    }, ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

/**
 * One number gate for every provider: a remote result is re-checked here against the source it read
 * (`source`, e.g. Document Intelligence content) or, failing that, the request text. A number with no
 * verbatim line becomes Not stated with VALUES_DROPPED_UNQUOTED. `source` never leaves the server.
 */
export function gateRemote(raw: ExtractResult, input: ExtractInput): ExtractResult {
  const { source, ...r } = raw;
  const src: SourceDoc = source && source.text ? source : sourceOf(input);
  const g = gateNumbers(r.card, src);
  const haystack = [src.text, ...(src.pages ?? [])].join("\n\n");
  // The provider's own quote (exact line + page) is kept only when it is verbatim on the sheet;
  // otherwise the gate's own verified line is used. A remote quote is never trusted as-is.
  // It must also back the value: every number in the value appears in the quote (quoteCoversNumbers),
  // so a real line about something else ("DFT: 5-7 mils" for a 5°F dew margin) is never kept.
  const values = new Map(leaves(g.card).map((l) => [l.path, l.value] as const));
  const provenance: Provenance = {};
  for (const [k, p] of Object.entries(g.provenance)) {
    const own = r.provenance[k];
    const v = values.get(k);
    const ownOk =
      p !== "not-stated" &&
      !!own &&
      own !== "not-stated" &&
      own.quote.trim() !== "" &&
      quoteIsVerbatim(own.quote, haystack) &&
      (typeof v !== "string" && typeof v !== "number" ? true : quoteCoversNumbers(k, v, own.quote));
    provenance[k] = ownOk ? own : p;
  }
  const dropped = g.droppedPaths.length;
  const extra: ExtractWarning[] = dropped
    ? [{
        code: "VALUES_DROPPED_UNQUOTED",
        message: `${dropped} value(s) with numbers could not be tied to a line on the sheet and were set to Not stated.`,
      }]
    : [];
  return withWarnings(
    {
      ...r,
      card: g.card,
      provenance,
      unverifiedTemps: unverifiedTempsFromGate(provenance, g.droppedPaths),
    },
    [...r.warnings, ...extra],
  );
}

/** De-duplicate warnings by code. */
function withWarnings(r: ExtractResult, warnings: ExtractWarning[]): ExtractResult {
  const seen = new Set<string>();
  const list = warnings.filter((w) => (seen.has(w.code) ? false : (seen.add(w.code), true)));
  return { ...r, warnings: list };
}

function fail(code: ExtractErrorCode, message: string, retryAfterSec?: number): ExtractResponse {
  return { ok: false, error: retryAfterSec ? { code, message, retryAfterSec } : { code, message } };
}

function textLength(t: { text?: string; pages?: string[] }): number {
  return (t.pages?.join(" ") ?? t.text ?? "").replace(/\s+/g, " ").trim().length;
}

type Checked =
  | { ok: true; input: ExtractInput; bytes?: Uint8Array; clientText: boolean }
  | { ok: false; code: ExtractErrorCode; message: string; maxUploadMb?: number };

/** Shape, size and type checks. Runs before the rate slot and before any decoding beyond the cap. */
export function checkRequest(raw: ExtractRequest | undefined, maxFileBytes: number): Checked {
  const r = (raw ?? {}) as ExtractRequest;
  const pages = Array.isArray(r.pages) ? r.pages.filter((p): p is string => typeof p === "string").slice(0, 200) : undefined;
  const text = typeof r.text === "string" ? r.text : "";
  const fileName = typeof r.fileName === "string" ? r.fileName.slice(0, 200) : undefined;
  const clientLen = pages?.length ? pages.join("\n\n").length : text.length;
  if (clientLen > EXTRACT_MAX_TEXT_CHARS) {
    return { ok: false, code: "FILE_TOO_LARGE", message: "Sheet text is over 40,000 characters." };
  }
  const clientText = clientLen > 0;
  const mb = Math.round((maxFileBytes / (1024 * 1024)) * 10) / 10;
  const tooBig = { ok: false as const, code: "FILE_TOO_LARGE" as const, message: `File is over ${mb} MB, the upload limit on this copy.`, maxUploadMb: mb };

  if (typeof r.fileBase64 !== "string" || r.fileBase64 === "") {
    if (!clientText) return { ok: false, code: "EXTRACT_FAILED", message: "Send a file or paste the sheet text." };
    return { ok: true, input: { text, pages: pages?.length ? pages : undefined, fileName }, clientText };
  }
  if (r.fileBase64.length > maxBase64Length(maxFileBytes) + 256) {
    return tooBig;
  }
  const mimeType = normalizeMime(r.mimeType);
  if (!mimeType) {
    return { ok: false, code: "UNSUPPORTED_FILE_TYPE", message: "Use a PDF, PNG, JPG, TIFF or Word (.docx) file." };
  }
  const b64 = cleanBase64(r.fileBase64);
  if (!b64) return { ok: false, code: "UNSUPPORTED_FILE_TYPE", message: "The file data could not be read." };
  if (b64.length > maxBase64Length(maxFileBytes) || base64Bytes(b64) > maxFileBytes) {
    return tooBig;
  }
  const bytes = new Uint8Array(Buffer.from(b64, "base64"));
  const sniffed = sniffFileType(bytes);
  if (!sniffed) {
    return { ok: false, code: "UNSUPPORTED_FILE_TYPE", message: "Use a PDF, PNG, JPG, TIFF or Word (.docx) file." };
  }
  if (sniffed !== mimeType) {
    return { ok: false, code: "UNSUPPORTED_FILE_TYPE", message: "The file's contents do not match its type." };
  }
  return {
    ok: true,
    input: { text, pages: pages?.length ? pages : undefined, fileBase64: b64, mimeType, fileName },
    bytes,
    clientText,
  };
}

/**
 * The extract use case, free of framework code so it is testable: type and size checks, per-user
 * rate limit, Azure first when configured, on-device fallback with a coded warning, 60 s deadline.
 * The server, never the browser, decides when a sheet is image-only.
 */
export async function runExtract(deps: RunExtractDeps): Promise<ExtractResponse> {
  const now = deps.now ?? Date.now;
  const started = now();
  const timeoutMs = deps.timeoutMs ?? EXTRACT_TIMEOUT_MS;
  const maxFileBytes = deps.maxFileBytes ?? EXTRACT_DEFAULT_MAX_FILE_MB * 1024 * 1024;
  const readers = deps.readers ?? { pdf: readPdfText, docx: readDocxText };
  const log = deps.log ?? (() => {});
  const done = (res: ExtractResponse, provider: string, outcome: "ok" | "fallback" | ExtractErrorCode) => {
    log({
      evt: "extract",
      provider,
      outcome,
      ms: now() - started,
      warnings: res.ok ? res.warnings.map((w) => w.code) : [],
    });
    return res;
  };

  if (!deps.userId) return done(fail("UNAUTHENTICATED", "Sign in to read a sheet."), "none", "UNAUTHENTICATED");

  const checked = checkRequest(deps.input, maxFileBytes);
  if (!checked.ok) {
    const res = fail(checked.code, checked.message);
    if (!res.ok && checked.maxUploadMb !== undefined) res.error.maxUploadMb = checked.maxUploadMb;
    return done(res, "none", checked.code);
  }
  let input = checked.input;

  const slot = takeRateSlot(deps.rate, deps.userId, now());
  if (!slot.ok) {
    return done(
      fail("RATE_LIMITED", "Too many sheets in a minute. Try again shortly.", slot.retryAfterSec),
      "none",
      "RATE_LIMITED",
    );
  }

  const warnings: ExtractWarning[] = [];
  const azure = deps.azure?.available() ? deps.azure : null;

  if (azure) {
    const ctl = new AbortController();
    const budget = timeoutMs - FALLBACK_RESERVE_MS - (now() - started);
    try {
      const raw = await withDeadline(azure.extract(input, ctl.signal), budget, ctl);
      const r = gateRemote(raw, input);
      return done({ ok: true, ...r }, r.provider, "ok");
    } catch (err) {
      const why = err instanceof Timeout ? "Azure timed out" : "Azure could not read this sheet";
      warnings.push({ code: "AZURE_FALLBACK", message: `${why}; showing the on-device read. Check every value.` });
    }
  } else {
    warnings.push({ code: "AZURE_NOT_CONFIGURED", message: "Azure reader is not set up; showing the on-device read." });
  }

  // On-device needs text. Use the client's pdf.js text if sent; otherwise read the file here.
  if (!checked.clientText && checked.bytes && input.mimeType) {
    const left = timeoutMs - (now() - started);
    const ctl = new AbortController();
    try {
      let read: ReadText = { text: "" };
      if (input.mimeType === "application/pdf") read = await withDeadline(readers.pdf(checked.bytes, ctl.signal), left, ctl);
      else if (input.mimeType === DOCX_MIME) read = await withDeadline(readers.docx(checked.bytes), left, ctl);
      input = { ...input, text: read.text, pages: read.pages?.length ? read.pages : undefined };
    } catch (err) {
      if (err instanceof Timeout) {
        return done(fail("EXTRACT_TIMEOUT", "Reading the sheet took too long."), "none", "EXTRACT_TIMEOUT");
      }
      return done(fail("EXTRACT_FAILED", "Could not read this file."), "none", "EXTRACT_FAILED");
    }
  }

  const imageOnly =
    (input.mimeType !== undefined && isImageMime(input.mimeType)) ||
    (input.mimeType === "application/pdf" && textLength(input) < IMAGE_ONLY_TEXT_CHARS);
  if (imageOnly) {
    warnings.push({
      code: "IMAGE_ONLY_NEEDS_AZURE",
      message: "This sheet needs the Azure reader. Showing what could be read on-device.",
    });
  }

  if (now() - started >= timeoutMs) {
    return done(fail("EXTRACT_TIMEOUT", "Reading the sheet took too long."), "none", "EXTRACT_TIMEOUT");
  }

  try {
    const r = await deps.onDevice.extract(input);
    const res: ExtractResponse = { ok: true, ...withWarnings(r, [...warnings, ...r.warnings]) };
    return done(res, r.provider, azure ? "fallback" : "ok");
  } catch (err) {
    if (imageOnly) {
      // A scrap of text layer that reads as nothing: blank card (all Not stated), never invented values.
      const blank = await deps.onDevice.extract({ ...input, text: "", pages: undefined });
      return done({ ok: true, ...withWarnings(blank, [...warnings, ...blank.warnings]) }, blank.provider, azure ? "fallback" : "ok");
    }
    const message = err instanceof Error && err.message ? err.message : "Could not read this sheet.";
    return done(fail("EXTRACT_FAILED", message), "none", "EXTRACT_FAILED");
  }
}
