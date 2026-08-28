import type { BetterAuthPlugin } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";
import {
  ACCOUNT_LOCKED,
  RATE_LIMITED,
  clearLoginFailures,
  evaluateLock,
  normalizeLoginEmail,
  recordLoginFailure,
  takeLoginRateSlot,
  type EmailLockState,
} from "./login-lockout";

type Store = {
  ip: Map<string, number[]>;
  email: Map<string, EmailLockState>;
};

const globalLock = globalThis as typeof globalThis & { __ccLoginLockout__?: Store };
function store(): Store {
  globalLock.__ccLoginLockout__ ??= { ip: new Map(), email: new Map() };
  return globalLock.__ccLoginLockout__;
}

function clientIp(ctx: { headers?: Headers; request?: Request }): string {
  const h = ctx.headers ?? ctx.request?.headers;
  const fwd = h?.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim() || "local";
  return h?.get("x-real-ip") ?? "local";
}

function bodyEmail(body: unknown): string {
  if (!body || typeof body !== "object") return "";
  const email = (body as { email?: unknown }).email;
  return typeof email === "string" ? normalizeLoginEmail(email) : "";
}

export function loginLockout(): BetterAuthPlugin {
  return {
    id: "login-lockout",
    hooks: {
      before: [
        {
          matcher: (ctx: { path?: string }) =>
            ctx.path === "/sign-in/email" || ctx.path === "/sign-up/email",
          handler: createAuthMiddleware(async (ctx) => {
            const now = Date.now();
            const s = store();
            const ip = clientIp(ctx);
            const slot = takeLoginRateSlot(now, s.ip.get(ip) ?? []);
            s.ip.set(ip, slot.stamps);
            if (!slot.ok) {
              throw new APIError("TOO_MANY_REQUESTS", {
                message: RATE_LIMITED.message,
                code: RATE_LIMITED.code,
              });
            }
            const email = bodyEmail(ctx.body);
            if (!email) return;
            const row = s.email.get(email) ?? clearLoginFailures();
            if (evaluateLock(now, row) === "locked") {
              throw new APIError("FORBIDDEN", {
                message: ACCOUNT_LOCKED.message,
                code: ACCOUNT_LOCKED.code,
              });
            }
          }),
        },
      ],
      after: [
        {
          matcher: (ctx: { path?: string }) => ctx.path === "/sign-in/email",
          handler: createAuthMiddleware(async (ctx) => {
            const email = bodyEmail(ctx.body);
            if (!email) return;
            const s = store();
            const now = Date.now();
            if (ctx.context.newSession) {
              s.email.set(email, clearLoginFailures());
              return;
            }
            const returned = ctx.context.returned as { status?: string } | undefined;
            if (returned && String(returned.status) === "BAD_REQUEST") return;
            const next = recordLoginFailure(now, s.email.get(email) ?? clearLoginFailures());
            s.email.set(email, next);
          }),
        },
      ],
    },
  } satisfies BetterAuthPlugin;
}
