import { createFileRoute } from "@tanstack/react-router";
import { auth } from "@/lib/auth/server";
import { loginsAvailable, loginsOffResponse } from "@/lib/auth/secret.server";
import { withPublicErrors } from "@/lib/errors/public-error";

// Vercel Preview without BETTER_AUTH_SECRET: logins are off (503), guests still work.
// Better Auth's own responses (and APIErrors) pass unchanged; only an unexpected throw (e.g. the
// database is down) becomes a plain 500 + ref id in production, with details in the server log.
const handle = withPublicErrors("api/auth", ({ request }: { request: Request }) =>
  loginsAvailable() ? auth.handler(request) : loginsOffResponse(),
);

export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      GET: handle,
      POST: handle,
    },
  },
});
