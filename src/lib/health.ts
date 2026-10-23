/**
 * Health check logic for `GET /api/health` (server-only, no auth).
 *
 * Kept free of DB / framework imports so it can be unit-tested with an injected
 * ping. The route (`src/routes/api/health.ts`) wires in the real `getSql()`.
 *
 * The body never carries secrets: no connection strings, endpoints, keys or
 * error messages — only fixed status words, the app version and which backends
 * are active.
 */

export type HealthDbSource = "postgres" | "pglite";
export type ExtractProviderId = "azure" | "on-device";

/** Public body: fixed status words only (SEC: no commit id, DB type or reader provider). */
export interface HealthOk {
  status: "ok";
  db: "ok";
}

export interface HealthDegraded {
  status: "degraded";
  db: "down";
}

export type HealthBody = HealthOk | HealthDegraded;

export interface HealthDeps {
  /** Run a trivial query (`SELECT 1`). Resolve on success, reject on failure. */
  ping: () => Promise<unknown>;
  dbSource: HealthDbSource;
  env: Record<string, string | undefined>;
  /** Max time to wait for the ping before reporting the DB as down. */
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 3000;

const set = (env: Record<string, string | undefined>, key: string): boolean =>
  Boolean(env[key]?.trim());

/**
 * Which extract reader is configured. Azure needs both endpoints, the
 * deployment name and an API version (see docs/release-beta/CONTRACT.md);
 * anything less means the on-device reader. Reports a label only, never values.
 */
export function extractProviderFromEnv(env: Record<string, string | undefined>): ExtractProviderId {
  const required = [
    "AZURE_DOCINTEL_ENDPOINT",
    "AZURE_OPENAI_ENDPOINT",
    "AZURE_OPENAI_DEPLOYMENT",
    "AZURE_OPENAI_API_VERSION",
  ];
  return required.every((key) => set(env, key)) ? "azure" : "on-device";
}

/** App version: explicit APP_VERSION, else a deploy commit sha, else "dev". */
export function appVersionFromEnv(env: Record<string, string | undefined>): string {
  const raw =
    env.APP_VERSION?.trim() || env.VERCEL_GIT_COMMIT_SHA?.trim() || env.GITHUB_SHA?.trim() || "dev";
  // Keep it short and printable; never echo arbitrary long env content.
  return raw.replace(/[^\w.\-+]/g, "").slice(0, 64) || "dev";
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("health ping timed out")), ms);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

/** Build the health status code + body. Never throws. */
export async function checkHealth(
  deps: HealthDeps,
): Promise<{ status: 200 | 503; body: HealthBody }> {
  try {
    await withTimeout(Promise.resolve().then(deps.ping), deps.timeoutMs ?? DEFAULT_TIMEOUT_MS);
    return { status: 200, body: { status: "ok", db: "ok" } };
  } catch {
    return { status: 503, body: { status: "degraded", db: "down" } };
  }
}

/** JSON response for the health body; never cached by proxies. */
export function healthResponse(result: { status: number; body: HealthBody }): Response {
  return new Response(JSON.stringify(result.body), {
    status: result.status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
