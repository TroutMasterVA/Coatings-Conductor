/** Rate-limit and lockout for the existing email/password card. No new screen. */

/** Per IP, sign-in + sign-up together, per minute. F-52-4 (PO): 30, so a shift start on one site Wi-Fi works. */
export const LOGIN_RATE_MAX = 30;
export const LOGIN_RATE_WINDOW_MS = 60_000;
export const LOGIN_FAIL_MAX = 5;
export const LOGIN_LOCK_MS = 15 * 60 * 1000;

export const RATE_LIMITED = {
  status: 429 as const,
  code: "RATE_LIMITED",
  message: "Too many tries. Wait a minute and try again.",
};

export const ACCOUNT_LOCKED = {
  status: 403 as const,
  code: "ACCOUNT_LOCKED",
  message: "This account is locked. Try again later.",
};

/**
 * Per-IP cap on sign-in attempts that did not succeed, per 15 min, then that network is paused 15 min.
 * BUG-52-2: 50 (was 30), SEC's ruling on PR #52. Each account already stops at LOGIN_FAIL_MAX (5)
 * wrong passwords, and tries against a locked account are given back to the network, so one person
 * mistyping adds at most 5; pausing a whole crew's Wi-Fi takes 10 accounts' worth of full lockouts
 * from that one network in 15 min. It still stops a password spray across many emails
 * (50 guesses / 15 min / IP).
 */
export const LOGIN_IP_FAIL_MAX = 50;
export const LOGIN_IP_FAIL_WINDOW_MS = 15 * 60 * 1000;
export const LOGIN_IP_LOCK_MS = 15 * 60 * 1000;

/** BUG-52-2: the per-IP failed-sign-in lock pauses the whole network, so it says so. */
export const NETWORK_PAUSED = {
  status: 429 as const,
  code: "NETWORK_PAUSED",
  message: "Sign-in is paused on this network for up to 15 minutes.",
};

/**
 * BUG-52-3: the account-lock line with the time, formatted on the CLIENT in the user's own time
 * zone from the server's `retryAfterSec` (relative, so a wrong device clock doesn't matter). The
 * time is rounded UP to the next whole minute so "after" is always true. Same text for every email,
 * real or not (the server answers unknown emails the same way).
 */
export function accountLockedMessage(
  retryAfterSec: number,
  opts: { now?: number; locale?: string; timeZone?: string } = {},
): string {
  const minutes = Math.round(LOGIN_LOCK_MS / 60_000);
  const at = Math.ceil(((opts.now ?? Date.now()) + Math.max(0, retryAfterSec) * 1000) / 60_000) * 60_000;
  const time = new Date(at).toLocaleTimeString(opts.locale ?? "en-US", {
    hour: "numeric",
    minute: "2-digit",
    ...(opts.timeZone ? { timeZone: opts.timeZone } : {}),
  });
  return `Locked for ${minutes} minutes. Try again after ${time}.`;
}

/** Login fails closed when the shared limiter database can't be reached. */
export const SIGNIN_UNAVAILABLE = {
  status: 503 as const,
  code: "SIGNIN_UNAVAILABLE",
  message: "Sign-in is unavailable. Try again shortly.",
};

export function normalizeLoginEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function takeLoginRateSlot(
  now: number,
  prior: number[],
  max = LOGIN_RATE_MAX,
  windowMs = LOGIN_RATE_WINDOW_MS,
): { ok: true; stamps: number[] } | { ok: false; stamps: number[] } {
  const stamps = prior.filter((t) => now - t < windowMs);
  if (stamps.length >= max) return { ok: false, stamps };
  return { ok: true, stamps: [...stamps, now] };
}

export type EmailLockState = {
  failures: number[];
  lockUntil: number | null;
};

export function evaluateLock(now: number, state: EmailLockState, lockMs = LOGIN_LOCK_MS): "ok" | "locked" {
  if (state.lockUntil != null && now < state.lockUntil) return "locked";
  const recent = state.failures.filter((t) => now - t < lockMs);
  if (recent.length >= LOGIN_FAIL_MAX) return "locked";
  return "ok";
}

export function recordLoginFailure(
  now: number,
  state: EmailLockState,
  failMax = LOGIN_FAIL_MAX,
  lockMs = LOGIN_LOCK_MS,
): EmailLockState {
  const failures = [...state.failures.filter((t) => now - t < lockMs), now];
  const lockUntil = failures.length >= failMax ? now + lockMs : null;
  return { failures, lockUntil };
}

export function clearLoginFailures(): EmailLockState {
  return { failures: [], lockUntil: null };
}

/** Shape Better Auth's client `{ error }` actually gives us. */
export type LoginCardError = {
  message?: string | null;
  code?: string | null;
  status?: number | string | null;
  /** Sent by our lockout with ACCOUNT_LOCKED / NETWORK_PAUSED / RATE_LIMITED. */
  retryAfterSec?: number | string | null;
};

function retryAfterOf(err: LoginCardError): number | null {
  const n = Number(err.retryAfterSec);
  return err.retryAfterSec != null && Number.isFinite(n) && n > 0 ? n : null;
}

/** Copy for the existing login-card nogo line. Do not invent a new screen. */
export function loginCardMessage(
  err: LoginCardError | null | undefined,
  fallback = "Sign-in failed.",
  opts: { now?: number; locale?: string; timeZone?: string } = {},
): string {
  if (!err) return fallback;
  const code = String(err.code ?? "");
  const status = err.status;
  const message = err.message ?? "";
  // Checked before the generic 429 below: the network pause is 429 too, but lasts up to 15 min.
  if (code === NETWORK_PAUSED.code || message === NETWORK_PAUSED.message) return NETWORK_PAUSED.message;
  const retryAfter = retryAfterOf(err);
  if (code === ACCOUNT_LOCKED.code && retryAfter != null) return accountLockedMessage(retryAfter, opts);
  if (
    code === RATE_LIMITED.code ||
    status === RATE_LIMITED.status ||
    code === "TOO_MANY_REQUESTS" ||
    message === RATE_LIMITED.message
  ) {
    return RATE_LIMITED.message;
  }
  if (code === ACCOUNT_LOCKED.code || message === ACCOUNT_LOCKED.message) {
    return ACCOUNT_LOCKED.message;
  }
  return message || fallback;
}
