/**
 * BUG-51-1: leaving /login must take ONE path. Someone who opens /login already signed in is sent
 * home by the router. While this page is submitting a sign-in or sign-up, the router must NOT also
 * send them home: the submit handler does the one full-page load to "/". Two paths meant two app
 * loads, and each asked the guest carry-over question.
 */
export function loginNavigatesHome(state: { user: unknown; submitting: boolean }): boolean {
  return Boolean(state.user) && !state.submitting;
}
