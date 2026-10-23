import type { AzureConfig } from "./config.ts";
import { AzureExtractError } from "./errors.ts";

export const COGNITIVE_SCOPE = "https://cognitiveservices.azure.com/.default";

/** The slice of @azure/identity's TokenCredential we use. Injected in tests. */
export interface TokenSource {
  getToken(
    scopes: string | string[],
    options?: { abortSignal?: AbortSignal },
  ): Promise<{ token: string } | null>;
}

export type AuthMode = "managed-identity" | "api-key";
export type AuthHeaders = { headers: Record<string, string>; mode: AuthMode };

/** Lazily builds DefaultAzureCredential so @azure/identity loads only when Azure is used. */
export async function defaultCredential(): Promise<TokenSource> {
  const { DefaultAzureCredential } = await import("@azure/identity");
  return new DefaultAzureCredential();
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
