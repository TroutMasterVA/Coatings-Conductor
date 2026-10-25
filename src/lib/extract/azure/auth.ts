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
      const url = appService
        ? `${env.IDENTITY_ENDPOINT}?api-version=2019-08-01&resource=${encodeURIComponent(resource)}`
        : `${IMDS_TOKEN_URL}?api-version=2018-02-01&resource=${encodeURIComponent(resource)}`;
      const headers: Record<string, string> = appService ? { "X-IDENTITY-HEADER": env.IDENTITY_HEADER! } : { Metadata: "true" };
      const ctl = new AbortController();
      const onAbort = () => ctl.abort();
      options?.abortSignal?.addEventListener("abort", onAbort, { once: true });
      const timer = setTimeout(() => ctl.abort(), timeoutMs);
      let res: Response;
      try {
        res = await doFetch(url, { method: "GET", headers, signal: ctl.signal });
      } catch {
        unavailableUntil = now() + MI_UNAVAILABLE_MS;
        // Never include the response or headers: they can carry tokens.
        throw ctl.signal.aborted
          ? new AzureExtractError("AZURE_TIMEOUT", "Managed identity token request timed out.")
          : new AzureExtractError("AZURE_AUTH", "Managed identity endpoint is not reachable.");
      } finally {
        clearTimeout(timer);
        options?.abortSignal?.removeEventListener("abort", onAbort);
      }
      if (!res.ok) {
        unavailableUntil = now() + MI_UNAVAILABLE_MS;
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
      const expiresAt = Number.isFinite(on) && on > 0 ? on * 1000 : Number.isFinite(inSec) && inSec > 0 ? now() + inSec * 1000 : now() + 5 * 60_000;
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
  constructor(makeCredential: () => Promise<TokenSource> = defaultCredential) {
    this.makeCredential = makeCredential;
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
    if (key) {
      return {
        headers: service === "docintel" ? { "Ocp-Apim-Subscription-Key": key } : { "api-key": key },
        mode: "api-key",
      };
    }
    throw new AzureExtractError(
      "AZURE_AUTH",
      `No Azure sign-in for ${service === "docintel" ? "Document Intelligence" : "Azure OpenAI"}: managed identity gave no token and no key is set.`,
    );
  }
}
