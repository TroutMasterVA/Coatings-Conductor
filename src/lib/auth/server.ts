/**
 * Self-hosted Better Auth for THIS app (server-only).
 *
 * Email and password only. No OAuth federation plugin, no broker issuer, no
 * broker client credentials. Provider buttons live on the login card
 * (Frontend); this file must not register broker upstreams even if a leftover
 * popup hits /auth/popup.
 *
 * Tri-mode:
 *   - Deployed: the deployer injects `BETTER_AUTH_URL` + `BETTER_AUTH_SECRET`
 *     + `DATABASE_URL`, so email/password sessions persist in Postgres.
 *   - Sandbox live preview: no injection -> process-stable preview secret and
 *     a dynamic `https://*.grok-sandbox.com` baseURL. Sessions persist in the
 *     embedded PGLite DB (same DB as app data); process restart wipes both.
 *     Live-preview iframe clients use a bearer token (partitioned cookies).
 *   - Off (`VITE_AUTH_ENABLED=false`): no auth server enforcement;
 *     `requireUserId` resolves a dev user with no database configured, and
 *     throws fail-closed once `DATABASE_URL` is set (see `verify.server.ts`).
 *
 * NEVER import this from client code — it pulls in `pg` + server-only Better
 * Auth internals. The client uses `@/lib/auth/client`; components read the
 * user via `@/lib/auth/use-current-user`; server functions get a verified id
 * via `@/lib/auth/middleware`.
 */
import { betterAuth } from "better-auth";
import { bearer } from "better-auth/plugins";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { getCookie } from "@tanstack/react-start/server";
import { Pool } from "pg";
import { ensureDbReady, getPglite } from "../db";
import { authSecret } from "./secret.server";
import { emailAndPasswordEnabled } from "./email-password";
import { loginLockout } from "./login-lockout.server";
import { betterAuthRateLimit } from "../rate-limit/better-auth-limit";
import { getSql } from "../db";
import { pgliteDialect } from "./pglite-dialect";
import { trustedHostsFromEnv, trustedOriginsFromEnv } from "./preview";

// Kick (and share) PGLite bootstrap as soon as the auth server module loads.
void ensureDbReady();

/** Read an env var, treating empty/whitespace as unset. */
const env = (key: string): string | undefined => {
  const value = process.env[key]?.trim();
  return value ? value : undefined;
};

// Explicit off-switch. The deployer sets `VITE_AUTH_ENABLED=true` when it
// provisions auth; set it to "false" to force auth off everywhere (dev user).
const authDisabled = env("VITE_AUTH_ENABLED") === "false";

/** True when email/password sign-in is active (real auth is enforced). */
export const authConfigured = !authDisabled;

// This app's own Better Auth origin: BETTER_AUTH_URL when set; otherwise a dynamic
// baseURL limited to the EXACT hosts from env (AUTH_TRUSTED_ORIGINS, Vercel's own
// VERCEL_BRANCH_URL / VERCEL_URL, loopback outside production). No wildcards (SEC).
const explicitBaseURL = env("BETTER_AUTH_URL");
const trustedOrigins: string[] = trustedOriginsFromEnv(process.env);
const baseURL = explicitBaseURL ?? {
  // Explicit `string[]`: Better Auth's DynamicBaseURLConfig needs a mutable array.
  allowedHosts: trustedHostsFromEnv(process.env),
  protocol: "auto" as const,
  fallback: "http://localhost:8080",
};

const databaseUrl = env("DATABASE_URL");

// Real Postgres when `DATABASE_URL` is set (deployed apps), else the app's
// embedded PGLite (preview) via a Kysely dialect — so Better Auth persists to the
// SAME DB as app data, including email/password users. Both use the Better Auth
// schema from `migrations/auth/0001_auth.sql`, copied into `migrations/` when
// the app turns sign-in on.
const database = databaseUrl
  ? new Pool({ connectionString: databaseUrl })
  : { dialect: pgliteDialect(() => getPglite()), type: "postgres" as const };

/** Session token cookie name — also read by leftover live-preview popup completion. */
export const SESSION_TOKEN_COOKIE = "__Host-grok-auth.session_token";

export const auth = betterAuth({
  baseURL,
  // Deployed apps inject BETTER_AUTH_SECRET. Preview: process-stable secret on
  // globalThis so HMR doesn't invalidate PGLite-backed sessions (see above).
  secret: authSecret(),
  database,

  // CSRF / origin check for credentialed auth POSTs (email sign-up/sign-in, …).
  // See `trustedOrigins` construction above — must cover live preview hosts AND
  // local loopback variants, or clients get "Invalid origin".
  trustedOrigins,

  // No broker OAuth, no preview-gate auto sign-in, no account linking (SEC):
  // email + password is the only way to get a session.
  account: { encryptOAuthTokens: true, accountLinking: { enabled: false } },

  // Cache the session in the short-lived signed `session_data` cookie so reads
  // (incl. the client's `/get-session`) skip the DB — this shrinks the "loading"
  // window and reduces auth flicker. See the `auth` skill for the full
  // flicker-prevention guidance (gate on `isPending`; SSR the session).
  session: { cookieCache: { enabled: true, maxAge: 300 } },

  // Better Auth's own limiter (on in production): sign-in/sign-up are left to our shared-database
  // login lockout; a request with no single trusted IP is skipped rather than put in one bucket
  // shared by everyone; password/email-changing paths count in the shared database (item 3).
  rateLimit: betterAuthRateLimit({ getSql }),

  // Local email/password — toggled only via `./email-password` (not a plugin).
  ...(emailAndPasswordEnabled ? { emailAndPassword: { enabled: true } } : {}),

  // `__Host-` prefixed cookies: the browser REFUSES any same-named cookie that
  // carries a `Domain` attribute, so a sibling `*.grok.me` app cannot "toss" a
  // `Domain=.grok.me` session cookie onto this app. `__Host-` requires Secure +
  // Path=/ + no Domain; Better Auth otherwise uses `__Secure-` (which permits
  // Domain), so we drop its auto prefix (`useSecureCookies: false`) and set
  // Secure + the names ourselves. (Browsers allow Secure cookies on
  // `http://localhost`, so local dev still works.)
  advanced: {
    useSecureCookies: false,
    defaultCookieAttributes: { secure: true, sameSite: "lax", path: "/" },
    cookies: {
      session_token: { name: SESSION_TOKEN_COOKIE },
      session_data: { name: "__Host-grok-auth.session_data" },
      account_data: { name: "__Host-grok-auth.account_data" },
      dont_remember: { name: "__Host-grok-auth.dont_remember" },
    },
  },

  plugins: [
    loginLockout(),

    // Accept `Authorization: Bearer <session-token>` as an alternative to the
    // cookie. Needed for the LIVE PREVIEW: the app runs in an embedded iframe
    // where cookies are partitioned, so after sign-in it authenticates with
    // a bearer token instead (see `client.ts` / the `auth` skill). The hook only
    // fires when an Authorization header is present, so the cookie path
    // (deployed apps) is unaffected.
    bearer(),

    // Bridges Better Auth's Set-Cookie into TanStack Start responses. MUST be
    // last so it runs after every other plugin's hooks.
    tanstackStartCookies(),
  ],
});

export function readSessionToken(): string | null {
  return getCookie(SESSION_TOKEN_COOKIE) ?? null;
}

// Empty array — kept so leftover imports do not break. Broker upstreams are gone.
export { GROK_PROVIDERS } from "./providers";
