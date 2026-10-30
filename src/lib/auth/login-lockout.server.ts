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
  NETWORK_PAUSED,
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
import { reserve, settle, take, type SettleOutcome } from "../rate-limit/limiter";

/**
 * Login rate limit + lockout in the SHARED database (item 3). Every replica sees the same counts.
 *
 * The race fix: an attempt is RESERVED before Better Auth checks the password (one atomic SQL
 * statement per bucket) and SETTLED afterwards. At most LOGIN_FAIL_MAX password checks per email
 * run in a window, however many tries arrive at once.
 *
 * BUG-52-1 (QA, burst of 20 with the right password at #10): a success used to DELETE the email
 * row, lock included, while other tries of the same burst were still in flight, so the count
 * restarted mid-attack (6 checks) and the account ended up unlocked. Now a success gives nothing
 * back unless it was the last reservation in flight and the key is not locked; once the cap is
 * full, the lock is sticky until it expires (see `reserve`/`settle` in ../rate-limit/limiter).
 *
 * Buckets:
 * - login-ip       LOGIN_RATE_MAX / minute per IP, sign-in + sign-up (429 RATE_LIMITED).
 * - login-ip-fail  LOGIN_IP_FAIL_MAX unsuccessful sign-ins per IP per 15 min, then that network is
 *                  paused 15 min (429 NETWORK_PAUSED). Successes and malformed tries are given back.
 * - login-email    LOGIN_FAIL_MAX sign-in attempts per email per 15 min, then locked 15 min
 *                  (403 ACCOUNT_LOCKED). Unknown emails are counted exactly like real ones.
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
    { message: RATE_LIMITED.message, code: RATE_LIMITED.code, retryAfterSec },
    { "Retry-After": String(retryAfterSec) },
  );
}

function networkPaused(retryAfterSec: number): APIError {
  return new APIError(
    "TOO_MANY_REQUESTS",
    { message: NETWORK_PAUSED.message, code: NETWORK_PAUSED.code, retryAfterSec },
    { "Retry-After": String(retryAfterSec) },
  );
}

function accountLocked(retryAfterSec: number): APIError {
  return new APIError(
    "FORBIDDEN",
    { message: ACCOUNT_LOCKED.message, code: ACCOUNT_LOCKED.code, retryAfterSec },
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

  const emailRule = { max: LOGIN_FAIL_MAX, windowSec: sec(LOGIN_LOCK_MS), lockSec: sec(LOGIN_LOCK_MS) };

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
            const ipFailRule = { max: LOGIN_IP_FAIL_MAX, windowSec: sec(LOGIN_IP_FAIL_WINDOW_MS), lockSec: sec(LOGIN_IP_LOCK_MS) };
            let ipFailReserved = false;
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
                const f = await reserve(sql, LOGIN_BUCKETS.ipFail, ip, ipFailRule);
                if (!f.allowed) throw networkPaused(f.retryAfterSec);
                ipFailReserved = true;
              }
              if (!email) return;
              const e = await reserve(sql, LOGIN_BUCKETS.email, email, emailRule);
              if (!e.allowed) {
                // The password is never checked, so this try does not count against the network.
                if (ipFailReserved && ip) await settle(sql, LOGIN_BUCKETS.ipFail, ip, "refund", ipFailRule);
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
            // Runs only when the before hook let the try through (a throw there skips after hooks),
            // so every reservation it made is settled exactly once here. Errors here never undo a
            // sign-in; a reservation that is never settled stays counted and in flight (safe side).
            const email = bodyEmail(ctx.body);
            const returned = ctx.context.returned as { status?: string } | undefined;
            const success = Boolean(ctx.context.newSession);
            const malformed = !success && returned != null && String(returned.status) === "BAD_REQUEST";
            // Email: a success resets only when nothing else is in flight and the key isn't locked.
            const emailOutcome: SettleOutcome = success ? "success" : malformed ? "refund" : "failure";
            // Network: only failures add up, so a success is given back like a malformed try.
            const ipOutcome: SettleOutcome = success || malformed ? "refund" : "failure";
            try {
              const ip = await clientIp(ctx);
              const sql = await getSql();
              if (email) await settle(sql, LOGIN_BUCKETS.email, email, emailOutcome, emailRule);
              if (ip) await settle(sql, LOGIN_BUCKETS.ipFail, ip, ipOutcome, {
                max: LOGIN_IP_FAIL_MAX,
                lockSec: sec(LOGIN_IP_LOCK_MS),
              });
            } catch {
              log("[rate-limit] login: could not settle an attempt");
            }
          }),
        },
      ],
    },
  } satisfies BetterAuthPlugin;
}
