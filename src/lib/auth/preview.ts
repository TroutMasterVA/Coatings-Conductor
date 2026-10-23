/**
 * Exact auth hosts / origins (server-only — NEVER import from the client).
 *
 * SEC (beta bundle): no wildcard hosts. Better Auth only trusts hosts named in env:
 *   - AUTH_TRUSTED_ORIGINS: comma list of origins or hosts (e.g. https://cc.example.com)
 *   - BETTER_AUTH_URL: the app's own public URL
 *   - on Vercel (VERCEL=1): VERCEL_BRANCH_URL and VERCEL_URL (this deployment's own hosts)
 * Any entry with a `*` is dropped. Loopback dev origins are added only outside production.
 * Email/password is the only sign-in; there is no Grok broker or gate.
 */
export type Env = Record<string, string | undefined>;

export const LOCAL_DEV_ORIGINS: readonly string[] = [
  "http://localhost:8080",
  "http://127.0.0.1:8080",
  "http://[::1]:8080",
];

function toOrigin(raw: string): string | null {
  const v = raw.trim();
  if (!v || v.includes("*")) return null;
  try {
    const u = new URL(/^https?:\/\//i.test(v) ? v : `https://${v}`);
    if (u.username || u.password || (u.pathname !== "/" && u.pathname !== "")) return null;
    return u.origin;
  } catch {
    return null;
  }
}

/** Exact origins from env, deduplicated. Never a wildcard. */
export function trustedOriginsFromEnv(env: Env): string[] {
  const raw = [
    ...(env.AUTH_TRUSTED_ORIGINS ?? "").split(","),
    env.BETTER_AUTH_URL ?? "",
    ...(env.VERCEL ? [env.VERCEL_BRANCH_URL ?? "", env.VERCEL_URL ?? ""] : []),
  ];
  const out = raw.map(toOrigin).filter((o): o is string => Boolean(o));
  if (env.NODE_ENV !== "production" && !env.VERCEL) out.push(...LOCAL_DEV_ORIGINS);
  return [...new Set(out)];
}

/** Hosts (no scheme) for Better Auth's dynamic baseURL allowlist. */
export function trustedHostsFromEnv(env: Env): string[] {
  return [...new Set(trustedOriginsFromEnv(env).map((o) => new URL(o).host))];
}
