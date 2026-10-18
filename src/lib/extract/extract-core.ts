import { heuristicExtract } from "../heuristic-extract.ts";
import { locateProvenance, sourceOf } from "./provenance.ts";
import type {
  ExtractErrorCode,
  ExtractInput,
  ExtractProvider,
  ExtractResponse,
  ExtractResult,
  ExtractWarning,
} from "./provider.ts";

export const EXTRACT_MAX_TEXT_CHARS = 40_000;
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

export type RunExtractDeps = {
  userId: string | null;
  input: ExtractInput;
  azure: ExtractProvider | null;
  onDevice: ExtractProvider;
  rate: RateStore;
  now?: () => number;
  timeoutMs?: number;
  maxFileBytes?: number;
  log?: ExtractLog;
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

function fail(code: ExtractErrorCode, message: string, retryAfterSec?: number): ExtractResponse {
  return { ok: false, error: retryAfterSec ? { code, message, retryAfterSec } : { code, message } };
}

function looksImageOnly(input: ExtractInput): boolean {
  const text = (input.pages?.join(" ") ?? input.text ?? "").replace(/\s+/g, " ").trim();
  return Boolean(input.pdfBase64) && text.length < IMAGE_ONLY_TEXT_CHARS;
}

/** Blank card for a sheet with no readable text: everything Not stated, nothing invented. */
function emptyResult(input: ExtractInput, warnings: ExtractWarning[]): ExtractResult {
  const src = sourceOf(input);
  const card = heuristicExtract(src.text || " ");
  return { card, provenance: locateProvenance(card, src), provider: "on-device", warnings };
}

/**
 * The extract use case, free of framework code so it is testable: size caps, per-user rate limit,
 * Azure first when configured, on-device fallback with a coded warning, 60 s overall deadline.
 */
export async function runExtract(deps: RunExtractDeps): Promise<ExtractResponse> {
  const now = deps.now ?? Date.now;
  const started = now();
  const timeoutMs = deps.timeoutMs ?? EXTRACT_TIMEOUT_MS;
  const maxFileBytes = deps.maxFileBytes ?? EXTRACT_DEFAULT_MAX_FILE_MB * 1024 * 1024;
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

  const input: ExtractInput = {
    text: typeof deps.input?.text === "string" ? deps.input.text : "",
    pages: Array.isArray(deps.input?.pages) ? deps.input.pages.filter((p) => typeof p === "string") : undefined,
    pdfBase64: typeof deps.input?.pdfBase64 === "string" ? deps.input.pdfBase64 : undefined,
    fileName: typeof deps.input?.fileName === "string" ? deps.input.fileName.slice(0, 200) : undefined,
  };
  const textLen = input.pages ? input.pages.join("\n\n").length : input.text.length;
  if (textLen > EXTRACT_MAX_TEXT_CHARS) {
    return done(fail("FILE_TOO_LARGE", "Sheet text is over 40,000 characters."), "none", "FILE_TOO_LARGE");
  }
  if (input.pdfBase64 && base64Bytes(input.pdfBase64) > maxFileBytes) {
    const mb = Math.round(maxFileBytes / (1024 * 1024));
    return done(fail("FILE_TOO_LARGE", `PDF is over ${mb} MB.`), "none", "FILE_TOO_LARGE");
  }

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
      const r = await withDeadline(azure.extract(input, ctl.signal), budget, ctl);
      return done({ ok: true, ...r }, r.provider, "ok");
    } catch (err) {
      const why = err instanceof Timeout ? "Azure timed out" : "Azure could not read this sheet";
      warnings.push({ code: "AZURE_FALLBACK", message: `${why}; showing the on-device read. Check every value.` });
    }
  } else {
    warnings.push({ code: "AZURE_NOT_CONFIGURED", message: "Azure reader is not set up; showing the on-device read." });
  }

  if (looksImageOnly(input) && !azure) {
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
    const res: ExtractResponse = { ok: true, ...r, warnings: [...warnings, ...r.warnings] };
    return done(res, r.provider, azure ? "fallback" : "ok");
  } catch (err) {
    if (warnings.some((w) => w.code === "IMAGE_ONLY_NEEDS_AZURE")) {
      return done({ ok: true, ...emptyResult(input, warnings) }, "on-device", "ok");
    }
    const message = err instanceof Error && err.message ? err.message : "Could not read this sheet.";
    return done(fail("EXTRACT_FAILED", message), "none", "EXTRACT_FAILED");
  }
}
