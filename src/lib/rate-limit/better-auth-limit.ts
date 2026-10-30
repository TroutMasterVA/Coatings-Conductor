/**
 * Settings for Better Auth's OWN rate limiter (on by default in production), item 3.
 *
 * - /sign-in/email and /sign-up/email (exactly) are skipped there: our login-lockout plugin owns them (one IP parser, one
 *   store, one message), and Better Auth's 429 used to fire before our hooks so those tries were
 *   never counted.
 * - When Better Auth could not find a client IP it would put every user in one shared
 *   `no-trusted-ip` bucket. We skip its limiter for that request instead (PO rule: never one bucket
 *   for everyone).
 * - Storage: password/email-changing paths go to the shared database (all replicas agree);
 *   everything else (get-session and friends, 100 per 10 s) stays in memory per process, as before,
 *   so routine session reads add no database writes.
 */
import type { Sql } from "../db";
import { betterAuthWouldShareBucket, warnNoClientIpOnce } from "./client-ip";
import { take } from "./limiter";

type Rule = { window: number; max: number };
type ConsumeResult = { allowed: boolean; retryAfter: number | null };

/**
 * SEC (PR #52): skip Better Auth's limiter for EXACTLY the two endpoints our lockout owns. Any other
 * sign-in/sign-up path (social, anonymous, magic link, if ever enabled) keeps Better Auth's limiter.
 */
export const AUTH_BASE_PATH = "/api/auth";
export const OWNED_BY_LOGIN_LOCKOUT: ReadonlySet<string> = new Set(["/sign-in/email", "/sign-up/email"]);

export function ownedByLoginLockout(pathname: string): boolean {
  const rel = pathname.startsWith(`${AUTH_BASE_PATH}/`) ? pathname.slice(AUTH_BASE_PATH.length) : pathname;
  return OWNED_BY_LOGIN_LOCKOUT.has(rel);
}
const SHARED_PATHS = [
  "/change-password",
  "/change-email",
  "/request-password-reset",
  "/reset-password",
  "/forget-password",
  "/send-verification-email",
  "/email-otp",
  "/update-user",
  "/delete-user",
];

export function isSharedPath(path: string): boolean {
  return SHARED_PATHS.some((p) => path === p || path.startsWith(`${p}/`));
}

export function pathOfKey(key: string): string {
  const i = key.lastIndexOf("|");
  return i >= 0 ? key.slice(i + 1) : key;
}

export type BetterAuthLimitDeps = {
  getSql: () => Promise<Sql>;
  production?: boolean;
  now?: () => number;
};

export function betterAuthRateLimit(deps: BetterAuthLimitDeps) {
  const production = deps.production ?? process.env.NODE_ENV === "production";
  const now = deps.now ?? Date.now;
  const memory = new Map<string, { count: number; until: number }>();

  function memoryConsume(key: string, rule: Rule): ConsumeResult {
    const t = now();
    if (memory.size > 10_000) {
      for (const [k, v] of memory) if (v.until <= t) memory.delete(k);
    }
    const row = memory.get(key);
    if (!row || row.until <= t) {
      memory.set(key, { count: 1, until: t + rule.window * 1000 });
      return { allowed: rule.max >= 1, retryAfter: null };
    }
    if (row.count >= rule.max) {
      return { allowed: false, retryAfter: Math.max(1, Math.ceil((row.until - t) / 1000)) };
    }
    row.count += 1;
    return { allowed: true, retryAfter: null };
  }

  return {
    customRules: {
      "/**": (request: Request, current: Rule): false | Rule => {
        let path = "";
        try {
          path = new URL(request.url).pathname;
        } catch {
          path = "";
        }
        if (ownedByLoginLockout(path)) return false;
        if (betterAuthWouldShareBucket(request.headers, production)) {
          warnNoClientIpOnce("better-auth-no-single-xff");
          return false;
        }
        return current;
      },
    },
    customStorage: {
      consume: async (key: string, rule: Rule): Promise<ConsumeResult> => {
        if (!isSharedPath(pathOfKey(key))) return memoryConsume(key, rule);
        try {
          const sql = await deps.getSql();
          const r = await take(sql, "ba", key, { max: rule.max, windowSec: rule.window });
          return { allowed: r.allowed, retryAfter: r.allowed ? null : r.retryAfterSec };
        } catch {
          // Password/email changes fail closed when the shared limiter is unreachable.
          return { allowed: false, retryAfter: rule.window };
        }
      },
    },
  };
}
