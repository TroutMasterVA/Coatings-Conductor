/** Rate-limit and lockout for the existing email/password card. No new screen. */

export const LOGIN_RATE_MAX = 10;
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
};

/** Copy for the existing login-card nogo line. Do not invent a new screen. */
export function loginCardMessage(
  err: LoginCardError | null | undefined,
  fallback = "Sign-in failed.",
): string {
  if (!err) return fallback;
  const code = String(err.code ?? "");
  const status = err.status;
  const message = err.message ?? "";
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
