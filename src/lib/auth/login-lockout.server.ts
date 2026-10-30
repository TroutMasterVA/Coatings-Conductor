import type { BetterAuthPlugin } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";
import type { Sql } from "../db";
import {
  ACCOUNT_LOCKED,
  LOGIN_FAIL_MAX,
  LOGIN_IP_FAIL_MAX,
  LOGIN_IP_FAIL_WINDOW_MS,
  LOGIN_IP_LOCK_MS,
  LOGIN_LOCK_MS,
  LOGIN_RATE_MAX,
  LOGIN_RATE_WINDOW_MS,
  RATE_LIMITED,
  SIGNIN_UNAVAILABLE,
  normalizeLoginEmail,
} from "./login-lockout";
import {
  clientIpConfigFromEnv,
  resolveClientIp,
  warnNoClientIpOnce,
  type ClientIpConfig,
} from "../rate-limit/client-ip";
import { clear, refund, take } from "../rate-limit/limiter";

/**
 * Login rate limit + lockout in the SHARED database (item 3). Every replica sees the same counts.
 *
 * The race fix: an attempt is RESERVED before Better Auth checks the password (one atomic SQL
 * statement per bucket), not recorded afterwards. However many tries arrive at once, at most
 * LOGIN_FAIL_MAX of them per email reach the password check in the lock window.
 *
 * Buckets:
 * - login-ip       LOGIN_RATE_MAX / minute per IP, sign-in + sign-up.
 * - login-ip-fail  LOGIN_IP_FAIL_MAX sign-in attempts per IP per 15 min, then the IP is locked 15 min.
 *                  A successful or malformed attempt is given back, so only failures add up.
 * - login-email    LOGIN_FAIL_MAX sign-in attempts per email per 15 min, then locked 15 min.
 *                  A success clears it; a malformed request (BAD_REQUEST) is given back.
 *
 * No usable client IP -> the per-IP buckets are skipped for that request (never one shared bucket);
 * the per-email lockout still applies. Database errors -> 503 SIGNIN_UNAVAILABLE (fail closed).
 */
export const LOGIN_BUCKETS = {
  ip: "login-ip",
  ipFail: "login-ip-fail",
  email: "login-email",
} as const;

export type LoginLockoutDeps = {
  /** Defaults to the app's shared database (`getSql` from ../db). */
  getSql?: () => Promise<Sql>;
  /** Socket peer address, when the runtime exposes it. */
  peerIp?: (request: Request | undefined) => Promise<string | undefined> | string | undefined;
  ipConfig?: () => ClientIpConfig;
  log?: (line: string) => void;
};

async function defaultGetSql(): Promise<Sql> {
  const { getSql } = await import("../db");
  return getSql();
}

async function defaultPeerIp(request: Request | undefined): Promise<string | undefined> {
  try {
    const { getRequestIP } = await import("@tanstack/react-start/server");
    // No xForwardedFor: this is the socket peer only.
    const ip = getRequestIP();
    if (ip) return ip;
  } catch {
    // Not inside a TanStack Start request (or the runtime has no socket).
  }
  const own = (request as (Request & { ip?: unknown }) | undefined)?.ip;
  return typeof own === "string" ? own : undefined;
}

function bodyEmail(body: unknown): string {
  if (!body || typeof body !== "object") return "";
  const email = (body as { email?: unknown }).email;
  return typeof email === "string" ? normalizeLoginEmail(email) : "";
}

const sec = (ms: number) => Math.round(ms / 1000);

function rateLimited(retryAfterSec: number): APIError {
  return new APIError(
    "TOO_MANY_REQUESTS",
    { message: RATE_LIMITED.message, code: RATE_LIMITED.code },
    { "Retry-After": String(retryAfterSec) },
  );
}

function accountLocked(retryAfterSec: number): APIError {
  return new APIError(
    "FORBIDDEN",
    { message: ACCOUNT_LOCKED.message, code: ACCOUNT_LOCKED.code },
    { "Retry-After": String(retryAfterSec) },
  );
}

function unavailable(): APIError {
  return new APIError("SERVICE_UNAVAILABLE", {
    message: SIGNIN_UNAVAILABLE.message,
    code: SIGNIN_UNAVAILABLE.code,
  });
}

type HookCtx = {
  path?: string;
  body?: unknown;
  headers?: Headers;
  request?: Request;
};

export function loginLockout(deps: LoginLockoutDeps = {}): BetterAuthPlugin {
  const getSql = deps.getSql ?? defaultGetSql;
  const peerIp = deps.peerIp ?? defaultPeerIp;
  const ipConfig = deps.ipConfig ?? (() => clientIpConfigFromEnv());
  const log = deps.log ?? ((line: string) => console.error(line));

  async function clientIp(ctx: HookCtx): Promise<string | null> {
    const headers = ctx.headers ?? ctx.request?.headers;
    const res = resolveClientIp(headers, await peerIp(ctx.request), ipConfig());
    if (res.ip === null) {
      warnNoClientIpOnce(res.reason);
      return null;
    }
    return res.ip;
  }

  return {
    id: "login-lockout",
    hooks: {
      before: [
        {
          matcher: (ctx: { path?: string }) =>
            ctx.path === "/sign-in/email" || ctx.path === "/sign-up/email",
          handler: createAuthMiddleware(async (ctx) => {
            const ip = await clientIp(ctx);
            const email = bodyEmail(ctx.body);
            const signIn = ctx.path === "/sign-in/email";
            let sql: Sql;
            try {
              sql = await getSql();
            } catch {
              log("[rate-limit] login: database unavailable (fail closed)");
              throw unavailable();
            }
            let ipFailTaken = false;
            try {
              if (ip) {
                const r = await take(sql, LOGIN_BUCKETS.ip, ip, {
                  max: LOGIN_RATE_MAX,
                  windowSec: sec(LOGIN_RATE_WINDOW_MS),
                });
                if (!r.allowed) throw rateLimited(r.retryAfterSec);
              }
              if (!signIn) return;
              if (ip) {
                const f = await take(sql, LOGIN_BUCKETS.ipFail, ip, {
                  max: LOGIN_IP_FAIL_MAX,
                  windowSec: sec(LOGIN_IP_FAIL_WINDOW_MS),
                  lockSec: sec(LOGIN_IP_LOCK_MS),
                });
                if (!f.allowed) throw rateLimited(f.retryAfterSec);
                ipFailTaken = true;
              }
              if (!email) return;
              const e = await take(sql, LOGIN_BUCKETS.email, email, {
                max: LOGIN_FAIL_MAX,
                windowSec: sec(LOGIN_LOCK_MS),
                lockSec: sec(LOGIN_LOCK_MS),
              });
              if (!e.allowed) {
                // The password is never checked, so this try does not count against the IP.
                if (ipFailTaken && ip) await refund(sql, LOGIN_BUCKETS.ipFail, ip, LOGIN_IP_FAIL_MAX);
                throw accountLocked(e.retryAfterSec);
              }
            } catch (err) {
              if (err instanceof APIError) throw err;
              log("[rate-limit] login: limiter query failed (fail closed)");
              throw unavailable();
            }
          }),
        },
      ],
      after: [
        {
          matcher: (ctx: { path?: string }) => ctx.path === "/sign-in/email",
          handler: createAuthMiddleware(async (ctx) => {
            // The attempt was reserved before the password check; here we only give it back when
            // it succeeded or never checked a password. Errors here never undo a sign-in, and a
            // reservation that is not given back stays counted (safe side).
            const email = bodyEmail(ctx.body);
            const returned = ctx.context.returned as { status?: string } | undefined;
            const success = Boolean(ctx.context.newSession);
            const malformed = !success && returned != null && String(returned.status) === "BAD_REQUEST";
            if (!success && !malformed) return;
            try {
              const ip = await clientIp(ctx);
              const sql = await getSql();
              if (email) {
                if (success) await clear(sql, LOGIN_BUCKETS.email, email);
                else await refund(sql, LOGIN_BUCKETS.email, email, LOGIN_FAIL_MAX);
              }
              if (ip) await refund(sql, LOGIN_BUCKETS.ipFail, ip, LOGIN_IP_FAIL_MAX);
            } catch {
              log("[rate-limit] login: could not settle an attempt");
            }
          }),
        },
      ],
    },
  } satisfies BetterAuthPlugin;
}
