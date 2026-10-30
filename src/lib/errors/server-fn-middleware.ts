import { createMiddleware } from "@tanstack/react-start";
import { toBrowserError } from "./public-error.ts";

/**
 * First middleware on every `createServerFn` (src/lib/errors/public-error.ts has the rules).
 * It wraps the rest of the chain, so errors from later middleware (auth, same-site check), the
 * validator and the handler all go through it. Allowlisted errors and redirect/notFound pass
 * unchanged; in production anything else reaches the browser as a plain message plus a ref id,
 * and the details go to the server log only.
 *
 *   createServerFn({ method: "POST" }).middleware([publicErrors, authMiddleware])...
 *
 * `public-error.integration.test.ts` fails if a server function is added without it.
 */
export const publicErrors = createMiddleware({ type: "function" }).server(async ({ next, serverFnMeta }) => {
  try {
    return await next();
  } catch (err) {
    throw toBrowserError(err, { where: `serverFn:${serverFnMeta?.name ?? serverFnMeta?.id ?? "unknown"}` });
  }
});
