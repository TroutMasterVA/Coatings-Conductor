/**
 * Live-preview host allowlist (server-only — NEVER import from the client).
 *
 * Practice copy is a Vercel preview (`*.vercel.app`). Sandbox live preview is
 * `*.grok-sandbox.com`. Better Auth derives the origin from the request host
 * and validates it against this list. grok.me is out.
 *
 * Email/password is the only sign-in; there is no Grok broker client baked here.
 */
export const PREVIEW_ALLOWED_HOSTS = ["*.grok-sandbox.com", "*.vercel.app"] as const;
