/**
 * Production error sanitizer (SEC item 4). One place decides what an error may say to the browser.
 *
 * - Intentional, user-facing errors pass through unchanged: a `PublicError`, one of the app's coded
 *   error classes (`UnauthorizedError`, `CrossSiteRequestError`, `ForecastUnavailableError`), or a
 *   message in `PUBLIC_MESSAGES` (the plain messages the app already throws on purpose).
 * - Anything else, in production (`NODE_ENV=production`, never `VERCEL`), becomes a plain message
 *   plus a short random reference id. The full error (name, message, stack, code) is logged on the
 *   server only, with the same ref id, after removing emails, passwords, tokens and URL credentials.
 * - Outside production the original error is kept so local debugging still shows details.
 *
 * Client-safe: no imports, no Node APIs (uses `globalThis.crypto`).
 */

/** Shown in place of any unexpected server error in production. The ref id is appended. */
export const GENERIC_ERROR_MESSAGE = "Something went wrong on our side. Try again.";

/** Forecast path: an unexpected failure is never a GO. */
export const GENERIC_FORECAST_ERROR_MESSAGE =
  "Forecast unavailable: something went wrong on our side. This is not a GO. Try again later.";

/** Sheet-reading path (EXTRACT_FAILED). */
export const GENERIC_EXTRACT_ERROR_MESSAGE = "Could not read this sheet.";

/** Throw this for a new message that is meant for the user. Its message reaches the browser as is. */
export class PublicError extends Error {
  readonly publicError = true as const;
  readonly code?: string;
  readonly status?: number;
  constructor(message: string, opts: { code?: string; status?: number } = {}) {
    super(message);
    this.name = "PublicError";
    this.code = opts.code;
    this.status = opts.status;
  }
}

/** Coded error classes whose messages are a stable, user-facing contract. Matched by `name`. */
export const PUBLIC_ERROR_NAMES: ReadonlySet<string> = new Set([
  "PublicError",
  "UnauthorizedError", // "Unauthorized" (client sends the visitor to sign-in)
  "CrossSiteRequestError", // "Forbidden: cross-site request blocked"
  "ForecastUnavailableError", // "Forecast unavailable: ... This is not a GO ..."
]);

/**
 * Plain messages the app throws on purpose (validators, job isolation, closeout, forecast, sheet
 * reading). Exact match. `public-error.test.ts` checks this list against the exported constants
 * so a renamed message can't silently turn into "Something went wrong".
 */
export const PUBLIC_MESSAGES: ReadonlySet<string> = new Set([
  // guest-import.ts NOT_YOUR_JOB_MESSAGE (project-access 404, job-close, closeProject validator)
  "Project not found.",
  // job-close.ts
  "This job is closed and can't be changed.",
  "This job is closed and can't be deleted.",
  // project-store.ts / guest-workspace.ts validators
  "Project name is required.",
  "Enter a 5-digit US ZIP.",
  // zip-check.ts ZIP_00000_MESSAGE (project create)
  "00000 isn't a US ZIP. Enter the job site's 5-digit ZIP.",
  // forecast.ts / forecast-cap.ts / forecast-sources.ts
  "ZIP not found. Use a 5-digit US ZIP.",
  "ZIP not found.",
  "Weather lookup is limited. Try again in a minute.",
  "Forecast unavailable: the weather services did not answer. This is not a GO. Plan later or check the site conditions by hand.",
  "Forecast unavailable: the ZIP lookup did not answer. This is not a GO. Try again later.",
  // job-extract.ts
  "Saved source quotes are malformed.",
  "Saved source quotes are too large.",
  // on-device-extract.ts / extract-core.ts / sheet-gate.ts
  "Could not read this sheet.",
  "Could not read this file.",
  "PDS text exceeds 40,000 characters.",
  "Sheet couldn't be read",
  "No sheet loaded",
  // verify.server.ts / isolation.server.ts (also matched by class name)
  "Unauthorized",
  "Forbidden: cross-site request blocked",
]);

const REF_ALPHABET = "ABCDEFGHJKMNPQRSTVWXYZ23456789"; // no 0/O, 1/I/L, U
export const REF_LENGTH = 10;
export const REF_PATTERN = /\(Ref: [A-Z0-9]{10}\)$/;

/** Random, short, read-aloud-friendly reference id (10 chars, ~49 bits). */
export function makeRef(): string {
  const bytes = new Uint8Array(REF_LENGTH);
  globalThis.crypto.getRandomValues(bytes);
  let out = "";
  for (const b of bytes) out += REF_ALPHABET[b % REF_ALPHABET.length];
  return out;
}

/**
 * Production = `NODE_ENV=production` at runtime, or a Vite production build (where the browser has
 * no `process`, Vite sets `import.meta.env.PROD`). Never keyed on `VERCEL`.
 */
export function isProduction(): boolean {
  return isProductionEnv(processEnv()) || viteProd();
}

/** The runtime half of `isProduction` (testable). */
export function isProductionEnv(env: { NODE_ENV?: string } | undefined): boolean {
  return env?.NODE_ENV === "production";
}

function processEnv(): { NODE_ENV?: string } | undefined {
  return typeof process !== "undefined" && process.env ? process.env : undefined;
}

function viteProd(): boolean {
  try {
    return (import.meta as unknown as { env?: { PROD?: boolean } }).env?.PROD === true;
  } catch {
    return false;
  }
}

function messageOf(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === "object" && typeof (err as { message?: unknown }).message === "string") {
    return (err as { message: string }).message;
  }
  return "";
}

/** True when the error is meant for the user and may reach the browser unchanged. */
export function isPublicError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  if ((err as { publicError?: unknown }).publicError === true) return true;
  const name = (err as { name?: unknown }).name;
  if (typeof name === "string" && PUBLIC_ERROR_NAMES.has(name)) return true;
  return isPublicMessage(messageOf(err));
}

/** True for an allowlisted message, or one this module already sanitized (it carries a ref id). */
export function isPublicMessage(message: string): boolean {
  if (PUBLIC_MESSAGES.has(message)) return true;
  return REF_PATTERN.test(message) && SANITIZED_PREFIXES.some((p) => message.startsWith(p));
}

const SANITIZED_PREFIXES = [GENERIC_ERROR_MESSAGE, GENERIC_FORECAST_ERROR_MESSAGE, GENERIC_EXTRACT_ERROR_MESSAGE];

/** Router control flow (redirect / notFound) is not an error and must pass untouched. */
export function isControlFlow(err: unknown): boolean {
  if (typeof Response !== "undefined" && err instanceof Response) return true;
  if (!err || typeof err !== "object") return false;
  const o = err as { isNotFound?: unknown; isRedirect?: unknown; options?: unknown; status?: unknown };
  return o.isNotFound === true || o.isRedirect === true;
}

export function withRef(message: string, ref: string): string {
  return `${message} (Ref: ${ref})`;
}

/** Remove things that must never land in a log: emails, passwords, tokens, URL credentials, cookies. */
export function redact(text: string): string {
  return text
    .replace(/([a-z][a-z0-9+.-]*:\/\/)[^\s/@:]+(:[^\s/@]*)?@/gi, "$1[redacted]@")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email]")
    .replace(/\b(bearer)\s+[A-Za-z0-9._~+/=-]+/gi, "$1 [redacted]")
    .replace(/((?:pass(?:word)?|pwd|secret|token|api[_-]?key|cookie|authorization)["']?\s*[:=]\s*)("[^"]*"|'[^']*'|[^\s,;}]+)/gi, "$1[redacted]");
}

export type ServerErrorLog = {
  level: "error";
  event: "server_error";
  ref: string;
  where: string;
  name: string;
  message: string;
  code?: string;
  stack?: string;
  cause?: string;
};

export type Logger = (entry: ServerErrorLog) => void;

export const defaultLogger: Logger = (entry) => {
  console.error(JSON.stringify(entry));
};

/** Server-side record of an unexpected error. Never includes request data, only the error itself. */
export function buildServerErrorLog(err: unknown, where: string, ref: string): ServerErrorLog {
  const e = err as { name?: unknown; code?: unknown; stack?: unknown; cause?: unknown } | null;
  const entry: ServerErrorLog = {
    level: "error",
    event: "server_error",
    ref,
    where,
    name: typeof e?.name === "string" ? e.name : typeof err,
    message: redact(messageOf(err) || String(err)),
  };
  if (typeof e?.code === "string" || typeof e?.code === "number") entry.code = String(e.code);
  if (typeof e?.stack === "string") entry.stack = redact(e.stack);
  if (e?.cause !== undefined) entry.cause = redact(messageOf(e.cause) || String(e.cause));
  return entry;
}

export type SanitizeOptions = {
  /** Server function or route name, for the log line. */
  where: string;
  /** Defaults to `NODE_ENV === "production"`. */
  production?: boolean;
  logger?: Logger;
  /** User message for an unexpected error (the ref id is appended). */
  fallback?: string;
};

export type Sanitized = { public: true; message: string } | { public: false; message: string; ref: string };

/**
 * Decide what the browser may see for `err`. Allowlisted errors keep their message. Unexpected ones
 * get `fallback + (Ref: XXXXXXXXXX)` and are logged with that ref. Outside production an unexpected
 * error is still logged, and the caller keeps the original.
 */
export function sanitize(err: unknown, opts: SanitizeOptions): Sanitized {
  if (isPublicError(err)) return { public: true, message: messageOf(err) };
  const ref = makeRef();
  (opts.logger ?? defaultLogger)(buildServerErrorLog(err, opts.where, ref));
  return { public: false, message: withRef(opts.fallback ?? GENERIC_ERROR_MESSAGE, ref), ref };
}

/**
 * For thrown errors (server functions). Returns the error to rethrow: the original when it is public
 * or control flow, or outside production; otherwise a fresh `Error` with only the plain message
 * (no stack, no cause, no extra fields).
 */
export function toBrowserError(err: unknown, opts: SanitizeOptions): unknown {
  if (isControlFlow(err)) return err;
  const production = opts.production ?? isProduction();
  const s = sanitize(err, opts);
  if (!production) return err;
  if (s.public) return rebuildPublicError(err, s.message);
  return stackless(new Error(s.message));
}

/** Public fields copied onto a rebuilt error. Nothing else (no stack, cause, query text, rows). */
const PUBLIC_FIELDS = ["code", "status", "statusCode", "publicError"] as const;

/**
 * A fresh `Error` with the same message and name plus the public fields (`code`, `status`, ...),
 * and no stack or cause. Used in production so even allowlisted errors never carry a server stack.
 * (The browser only receives `message` through TanStack Start; server-side `instanceof` checks run
 * inside the chain, before this middleware, so they still see the original class.)
 */
export function rebuildPublicError(err: unknown, message: string): Error {
  const safe = stackless(new Error(message));
  const src = (err && typeof err === "object" ? err : {}) as Record<string, unknown>;
  if (typeof src.name === "string" && src.name) safe.name = src.name;
  for (const k of PUBLIC_FIELDS) {
    const v = src[k];
    if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
      Object.defineProperty(safe, k, { value: v, enumerable: true, writable: false, configurable: true });
    }
  }
  return safe;
}

function stackless<E extends Error>(e: E): E {
  delete (e as { stack?: string }).stack;
  return e;
}

/** For errors turned into a returned message (`{ ok: false, error }` shapes). */
export function publicMessageOr(err: unknown, opts: SanitizeOptions): string {
  const production = opts.production ?? isProduction();
  const s = sanitize(err, opts);
  if (s.public) return s.message;
  if (!production) return messageOf(err) || (opts.fallback ?? GENERIC_ERROR_MESSAGE);
  return s.message;
}

export type PublicErrorBody = { message: string; ref: string };

/**
 * Wrap an API route handler. Returned responses pass through untouched (coded 4xx/5xx bodies such
 * as /api/health's 503 and the auth route's 503 stay exactly as they are). A thrown error becomes a
 * 500 `{ message, ref }` JSON body in production; outside production it is rethrown with details.
 * Better Auth `APIError`s are rethrown unchanged (their status/body is the auth contract).
 */
export function withPublicErrors<A extends unknown[]>(
  where: string,
  handler: (...args: A) => Response | Promise<Response>,
  opts: Omit<SanitizeOptions, "where"> = {},
): (...args: A) => Promise<Response> {
  return async (...args: A) => {
    try {
      return await handler(...args);
    } catch (err) {
      if (isControlFlow(err)) throw err;
      if ((err as { name?: unknown } | null)?.name === "APIError") throw err;
      const production = opts.production ?? isProduction();
      const s = sanitize(err, { ...opts, where });
      if (!production) throw err;
      const body: PublicErrorBody | { message: string } = s.public ? { message: s.message } : { message: s.message, ref: s.ref };
      return new Response(JSON.stringify(body), {
        status: s.public ? statusOf(err) : 500,
        headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
      });
    }
  };
}

function statusOf(err: unknown): number {
  const s = (err as { status?: unknown } | null)?.status;
  return typeof s === "number" && s >= 400 && s < 600 ? s : 500;
}

export const ROUTE_ERROR_FALLBACK = "An unexpected error occurred. Try reloading the page.";

/** What the route error screen may show for `error` (`AppErrorComponent`). */
export function routeErrorMessage(error: unknown, production = isProduction()): string {
  // Router 1.170.42+ types `error` as `unknown` (anything can be thrown).
  const message = error instanceof Error ? error.message : "";
  if (!message) return ROUTE_ERROR_FALLBACK;
  if (production && !isPublicMessage(message)) return ROUTE_ERROR_FALLBACK;
  return message;
}
