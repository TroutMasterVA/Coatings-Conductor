/**
 * Security: do not inject Grok builder chrome, /__grok assets, or social login overlay.
 * The running app is email/password only and must not load grok-app-builder.
 */
export default async function grokPwaMiddleware(
  _event: unknown,
  next: () => unknown | Promise<unknown>,
): Promise<unknown> {
  return next();
}
