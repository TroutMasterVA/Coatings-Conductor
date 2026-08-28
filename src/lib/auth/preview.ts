/**
 * Live-preview host allowlist (server-only — NEVER import from the client).
 *
 * The sandbox serves each live preview on a dynamic `https://*.grok-sandbox.com`
 * URL. Better Auth derives the origin from the request host and validates it
 * against this list. Email/password is the only sign-in; there is no Grok
 * broker client baked here.
 */
export const PREVIEW_ALLOWED_HOSTS = ["*.grok-sandbox.com"] as const;
