import { createFileRoute } from "@tanstack/react-router";
import { checkHealth, healthResponse } from "@/lib/health";
import { withPublicErrors } from "@/lib/errors/public-error";

/**
 * `GET /api/health` — liveness/readiness probe for Docker HEALTHCHECK and
 * container hosts (Azure Container Apps / App Service probes).
 *
 * No auth. 200 `{status:"ok", db:"ok", …}` when `SELECT 1` succeeds, 503
 * `{status:"degraded", db:"down", …}` otherwise. No secrets in the body.
 */
async function handle(): Promise<Response> {
  const { getSql, dbSource } = await import("@/lib/db");
  const result = await checkHealth({
    dbSource: dbSource === "neon" ? "postgres" : "pglite",
    env: process.env,
    ping: async () => {
      const sql = await getSql();
      await sql.query("SELECT 1");
    },
  });
  return healthResponse(result);
}

export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      // The 200/503 bodies above are unchanged; only an unexpected throw becomes a plain 500 + ref id.
      GET: withPublicErrors("GET /api/health", handle),
      HEAD: withPublicErrors("HEAD /api/health", async () => {
        const res = await handle();
        return new Response(null, { status: res.status, headers: res.headers });
      }),
    },
  },
});
