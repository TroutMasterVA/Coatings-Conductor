import { randomBytes } from "node:crypto";

/**
 * The server secret Better Auth signs with; also keys signed extract reads (domain-separated).
 * Deployed: BETTER_AUTH_SECRET. Preview: a process-stable random secret on globalThis, so an HMR
 * re-eval does not mint a new one (PGLite sessions live on globalThis too).
 */
const g = globalThis as typeof globalThis & { __grokAuthPreviewSecret__?: string };
export function authSecret(): string {
  const v = process.env.BETTER_AUTH_SECRET?.trim();
  if (v) return v;
  g.__grokAuthPreviewSecret__ ??= randomBytes(32).toString("hex");
  return g.__grokAuthPreviewSecret__;
}
