import type { AzureConfig } from "./config.ts";
import { AzureExtractError } from "./errors.ts";

export const COGNITIVE_SCOPE = "https://cognitiveservices.azure.com/.default";

/** A token source (managed identity here; injected in tests). */
export interface TokenSource {
  getToken(
    scopes: string | string[],
    options?: { abortSignal?: AbortSignal },
  ): Promise<{ token: string } | null>;
}

export type AuthMode = "managed-identity" | "api-key";
export type AuthHeaders = { headers: Record<string, string>; mode: AuthMode };

/*
 * Managed identity over Azure's documented token endpoints, without @azure/identity.
 * @azure/identity (every release up to 4.15.0-beta.1) pins @azure/msal-node ^6, which is
 * vulnerable to GHSA-xcx6-jx8p-x3h5 (fixed in msal-node 7.1.0). We can go back to
 * DefaultAzureCredential once @azure/identity supports @azure/msal-node >= 7.1.0.
 */
export const IMDS_TOKEN_URL = "http://169.254.169.254/metadata/identity/oauth2/token";
export const MI_TIMEOUT_MS = 5_000;
/** Refresh this long before the token's own expiry. */
export const MI_EXPIRY_SKEW_MS = 5 * 60_000;
/** After managed identity is unreachable, skip it for this long (key fallback stays fast). */
export const MI_UNAVAILABLE_MS = 5 * 60_000;

/** A cached token is never trusted for longer than this, whatever expires_on says. */
export const MI_MAX_LIFETIME_MS = 24 * 60 * 60_000;

/** IDENTITY_ENDPOINT must be https, or http only on localhost / 127.0.0.1 (App Service's local agent). */
export function identityEndpoint(raw: string): URL {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new AzureExtractError("AZURE_CONFIG", "IDENTITY_ENDPOINT is not a valid URL.");
  }
  const local = u.hostname === "localhost" || u.hostname === "127.0.0.1";
  if (u.username || u.password || !(u.protocol === "https:" || (u.protocol === "http:" && local))) {
    throw new AzureExtractError("AZURE_CONFIG", "IDENTITY_ENDPOINT must be https, or http on localhost/127.0.0.1.");
  }
  return u;
}

export type ManagedIdentityDeps = {
  fetch?: typeof fetch;
  /** Platform env: App Service / Functions inject IDENTITY_ENDPOINT + IDENTITY_HEADER. */
  env?: Record<string, string | undefined>;
  now?: () => number;
  timeoutMs?: number;
};

function resourceOf(scopes: string | string[]): string {
  const s = Array.isArray(scopes) ? scopes[0]! : scopes;
  return s.replace(/\/\.default$/, "");
}

/** Tokens from IMDS (VMs, Container Apps, AKS) or the App Service / Functions identity endpoint. */
export function managedIdentityCredential(deps: ManagedIdentityDeps = {}): TokenSource {
  const doFetch = deps.fetch ?? fetch;
  const env = deps.env ?? process.env;
  const now = deps.now ?? Date.now;
  const timeoutMs = deps.timeoutMs ?? MI_TIMEOUT_MS;
  const cache = new Map<string, { token: string; refreshAt: number }>();
  let unavailableUntil = 0;
  return {
    async getToken(scopes, options) {
      const resource = resourceOf(scopes);
      const hit = cache.get(resource);
      if (hit && now() < hit.refreshAt) return { token: hit.token };
      if (now() < unavailableUntil) throw new AzureExtractError("AZURE_AUTH", "Managed identity is not available here.");
      const appService = env.IDENTITY_ENDPOINT && env.IDENTITY_HEADER;
      let url: URL;
      if (appService) {
        url = identityEndpoint(env.IDENTITY_ENDPOINT!);
        url.searchParams.set("api-version", "2019-08-01");
      } else {
        url = new URL(IMDS_TOKEN_URL);
        url.searchParams.set("api-version", "2018-02-01");
      }
      url.searchParams.set("resource", resource);
      const headers: Record<string, string> = appService ? { "X-IDENTITY-HEADER": env.IDENTITY_HEADER! } : { Metadata: "true" };
      const ctl = new AbortController();
      const caller = options?.abortSignal;
      const onAbort = () => ctl.abort();
      caller?.addEventListener("abort", onAbort, { once: true });
      let ownTimeout = false;
      const timer = setTimeout(() => ((ownTimeout = true), ctl.abort()), timeoutMs);
      let res: Response;
      try {
        // redirect "error": Node keeps custom headers on a cross-host redirect.
        res = await doFetch(url.toString(), { method: "GET", headers, signal: ctl.signal, redirect: "error" });
      } catch {
        // Never include the response or headers: they can carry tokens.
        if (caller?.aborted && !ownTimeout) {
          // The caller cancelled: not a sign that managed identity is missing; no back-off.
          throw new AzureExtractError("AZURE_TIMEOUT", "Managed identity token request was cancelled.");
        }
        // Network / connection error or OUR timeout: skip managed identity for a while.
        unavailableUntil = now() + MI_UNAVAILABLE_MS;
        throw ownTimeout
          ? new AzureExtractError("AZURE_TIMEOUT", "Managed identity token request timed out.")
          : new AzureExtractError("AZURE_AUTH", "Managed identity endpoint is not reachable.");
      } finally {
        clearTimeout(timer);
        caller?.removeEventListener("abort", onAbort);
      }
      if (!res.ok) {
        // An HTTP status (400/401/403/...) never starts the back-off.
        throw new AzureExtractError("AZURE_AUTH", `Managed identity token request failed (HTTP ${res.status}).`);
      }
      let body: { access_token?: unknown; expires_on?: unknown; expires_in?: unknown };
      try {
        body = (await res.json()) as typeof body;
      } catch {
        throw new AzureExtractError("AZURE_AUTH", "Managed identity returned an unreadable token response.");
      }
      if (typeof body.access_token !== "string" || !body.access_token) {
        throw new AzureExtractError("AZURE_AUTH", "Managed identity response had no access_token.");
      }
      const on = Number(body.expires_on);
      const inSec = Number(body.expires_in);
      const stated = Number.isFinite(on) && on > 0 ? on * 1000 : Number.isFinite(inSec) && inSec > 0 ? now() + inSec * 1000 : now() + 5 * 60_000;
      const expiresAt = Math.min(stated, now() + MI_MAX_LIFETIME_MS);
      cache.set(resource, { token: body.access_token, refreshAt: expiresAt - MI_EXPIRY_SKEW_MS });
      return { token: body.access_token };
    },
  };
}

/** Default token source: managed identity over Azure's token endpoints. */
export async function defaultCredential(): Promise<TokenSource> {
  return managedIdentityCredential();
}

/**
 * Auth order: Entra / managed identity token first (scope cognitiveservices .default);
 * the service's key env var only when no token can be had. Key header names follow each
 * service: Document Intelligence `Ocp-Apim-Subscription-Key`, Azure OpenAI `api-key`.
 */
export class AzureAuth {
  private credential: Promise<TokenSource> | null = null;
  private readonly makeCredential: () => Promise<TokenSource>;
  private readonly warn: (msg: string) => void;
  private warned = false;
  constructor(
    makeCredential: () => Promise<TokenSource> = defaultCredential,
    warn: (msg: string) => void = (m) => console.warn(m),
  ) {
    this.makeCredential = makeCredential;
    this.warn = warn;
  }

  async headersFor(
    service: "docintel" | "openai",
    cfg: AzureConfig,
    signal?: AbortSignal,
  ): Promise<AuthHeaders> {
    const key = service === "docintel" ? cfg.docintelKey : cfg.openaiKey;
    try {
      this.credential ??= this.makeCredential();
      const tok = await (await this.credential).getToken(COGNITIVE_SCOPE, { abortSignal: signal });
      if (tok?.token)
        return { headers: { Authorization: `Bearer ${tok.token}` }, mode: "managed-identity" };
    } catch (err) {
      if (signal?.aborted) throw new AzureExtractError("AZURE_TIMEOUT", "Azure sign-in timed out.");
      // fall through to the key, if any
      void err;
    }
    if (key && cfg.authMode !== "identity") {
      if (!this.warned) {
        this.warned = true;
        // One-time, no secrets: which service fell back, never the key or token.
        this.warn(JSON.stringify({ evt: "extract.azure.auth", msg: "managed identity gave no token; using the API key fallback", service }));
      }
      return {
        headers: service === "docintel" ? { "Ocp-Apim-Subscription-Key": key } : { "api-key": key },
        mode: "api-key",
      };
    }
    throw new AzureExtractError(
      "AZURE_AUTH",
      `No Azure sign-in for ${service === "docintel" ? "Document Intelligence" : "Azure OpenAI"}: ${cfg.authMode === "identity" ? "managed identity gave no token (AZURE_AUTH_MODE=identity, keys not used)." : "managed identity gave no token and no key is set."}`,
    );
  }
}
