import { randomBytes } from "node:crypto";

/**
 * The server secret Better Auth signs with; also keys signed extract reads (domain-separated).
 *
 * SEC (beta bundle): no random per-instance secret anywhere it could sign a real session.
 *   - BETTER_AUTH_SECRET set            -> use it.
 *   - Vercel Preview, no secret          -> "logins-off": auth routes answer 503 and nobody can
 *                                           sign in; guest mode + the on-device reader keep working.
 *   - Production / Docker (node-server)  -> refuse to start with a clear error.
 *   - Local dev (not production)         -> process-stable dev secret (HMR-safe, PGLite only).
 */
export type Env = Record<string, string | undefined>;
export type SecretMode = { kind: "secret"; secret: string } | { kind: "dev" } | { kind: "logins-off" };

export const LOGINS_OFF_MESSAGE = "Logins aren't set up on this copy";
export const MISSING_SECRET_MESSAGE =
  "[auth] BETTER_AUTH_SECRET is not set. Refusing to start: set a long random BETTER_AUTH_SECRET " +
  "(e.g. `openssl rand -base64 32`) in the server environment.";

export function secretMode(env: Env = process.env): SecretMode {
  const v = env.BETTER_AUTH_SECRET?.trim();
  if (v) return { kind: "secret", secret: v };
  if (env.VERCEL && env.VERCEL_ENV === "preview") return { kind: "logins-off" };
  if (env.NODE_ENV === "production" || env.VERCEL) throw new Error(MISSING_SECRET_MESSAGE);
  return { kind: "dev" };
}

/** False on a Vercel Preview with no secret: auth routes 503, sessions never resolve. */
export function loginsAvailable(env: Env = process.env): boolean {
  return secretMode(env).kind !== "logins-off";
}

const g = globalThis as typeof globalThis & { __grokAuthPreviewSecret__?: string };
export function authSecret(env: Env = process.env): string {
  const mode = secretMode(env);
  if (mode.kind === "secret") return mode.secret;
  // logins-off: Better Auth still needs a value to construct, but every way in is closed
  // (routes 503, getSessionUser -> null, no userId to sign reads for), so it never signs anything.
  g.__grokAuthPreviewSecret__ ??= randomBytes(32).toString("hex");
  return g.__grokAuthPreviewSecret__;
}

/** 503 for /api/auth/* when logins are off on this copy. */
export function loginsOffResponse(): Response {
  return new Response(JSON.stringify({ code: "LOGINS_NOT_SET_UP", message: LOGINS_OFF_MESSAGE }), {
    status: 503,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}
