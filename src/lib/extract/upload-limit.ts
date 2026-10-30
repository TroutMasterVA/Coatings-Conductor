/**
 * Honest upload limit for the host (P2 413 fix, Oct 30).
 *
 * The browser sends the sheet as base64 inside the server-function request, plus up to 40,000
 * chars of pdf.js text and 40,000 chars of per-page text. On Vercel the whole request body is
 * capped by the platform before our code runs, so a file under MAX_UPLOAD_MB could still get a
 * bare 413 from Vercel. Measured on the practice preview (Oct 30, 2026): a 4,493,994-byte body
 * passed, 4,493,995 bytes got `413 FUNCTION_PAYLOAD_TOO_LARGE` (the cap is 4.5 MB = 4,500,000
 * bytes, request headers included).
 *
 * Largest decoded file that still fits: 3 MiB → 4,194,304 base64 chars, leaving ~300 KB for the
 * text fields, JSON framing and headers. 3.2 MiB would already be ~4.47 MB of base64 alone.
 * So on Vercel the limit is 3 MB, and MAX_UPLOAD_MB can only lower it.
 * Off Vercel (container / PAVE behind its own proxy) MAX_UPLOAD_MB is used as set (default 10).
 */

/** Vercel Functions request body cap (bytes), as measured. */
export const VERCEL_BODY_LIMIT_BYTES = 4_500_000;
/** Largest decoded upload that fits under VERCEL_BODY_LIMIT_BYTES with base64 + text overhead. */
export const VERCEL_MAX_UPLOAD_MB = 3;

type Env = Record<string, string | undefined>;

/** The host's own ceiling in MB, or null when the host has no lower cap than ours. */
export function hostMaxUploadMb(env: Env): number | null {
  return env.VERCEL ? VERCEL_MAX_UPLOAD_MB : null;
}

export type UploadLimit = {
  /** The limit the server enforces and getExtractLimits() reports. */
  mb: number;
  /** MAX_UPLOAD_MB when set to a positive number, else null. */
  configuredMb: number | null;
  hostMb: number | null;
  /** True when MAX_UPLOAD_MB (or the default) was above the host's ceiling and was lowered. */
  clamped: boolean;
};

export function uploadLimit(env: Env, defaultMb: number): UploadLimit {
  const n = Number(env.MAX_UPLOAD_MB);
  const configuredMb = env.MAX_UPLOAD_MB != null && Number.isFinite(n) && n > 0 ? n : null;
  const wanted = configuredMb ?? defaultMb;
  const hostMb = hostMaxUploadMb(env);
  const mb = hostMb != null ? Math.min(wanted, hostMb) : wanted;
  return { mb, configuredMb, hostMb, clamped: hostMb != null && wanted > hostMb };
}

/** A host/proxy "request too large" reply (Vercel: 413 FUNCTION_PAYLOAD_TOO_LARGE), as text or JSON. */
export function isHostTooLarge(v: unknown): boolean {
  if (typeof v === "string") return /FUNCTION_PAYLOAD_TOO_LARGE|Request Entity Too Large|Payload Too Large|\b413\b/i.test(v);
  if (!v || typeof v !== "object") return false;
  const o = v as { status?: unknown; code?: unknown; message?: unknown; error?: unknown };
  if (o.status === 413 || o.code === 413 || o.code === "413" || o.code === "FUNCTION_PAYLOAD_TOO_LARGE") return true;
  if (typeof o.message === "string" && isHostTooLarge(o.message)) return true;
  if (o.error && typeof o.error === "object") return isHostTooLarge(o.error);
  return false;
}
