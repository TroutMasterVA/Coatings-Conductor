import { SIGN_IN_PATH } from "./gates";

/** Better Auth / `requireUserId` contract: expired or missing session. */
export function isUnauthorized(err: unknown): boolean {
  return err instanceof Error && err.message === "Unauthorized";
}

/** Auth expired returns to the existing login card. */
export function returnToLogin(): void {
  if (typeof window === "undefined") return;
  window.location.assign(`${SIGN_IN_PATH}?mode=in`);
}
