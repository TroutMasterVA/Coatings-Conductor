import { createFileRoute } from "@tanstack/react-router";
import { auth } from "@/lib/auth/server";
import { loginsAvailable, loginsOffResponse } from "@/lib/auth/secret.server";

// Vercel Preview without BETTER_AUTH_SECRET: logins are off (503), guests still work.
const handle = ({ request }: { request: Request }) =>
  loginsAvailable() ? auth.handler(request) : loginsOffResponse();

export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      GET: handle,
      POST: handle,
    },
  },
});
