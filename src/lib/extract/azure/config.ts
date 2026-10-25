import { AzureExtractError } from "./errors.ts";

/** Server-only Azure settings. Never sent to the browser, never logged. */
export type AzureConfig = {
  docintelEndpoint: string;
  docintelModel: string;
  openaiEndpoint: string;
  deployment: string;
  apiVersion: string;
  docintelKey?: string;
  openaiKey?: string;
  /** AZURE_AUTH_MODE: "auto" (default: managed identity, then key) or "identity" (never a key). */
  authMode: "auto" | "identity";
};

export const DEFAULT_DOCINTEL_MODEL = "prebuilt-layout";
/** GA version with json_schema structured outputs and image input. */
export const DEFAULT_OPENAI_API_VERSION = "2024-10-21";

const AZURE_HOST =
  /^[a-z0-9]([a-z0-9-]*[a-z0-9])?\.(cognitiveservices\.azure\.com|openai\.azure\.com|services\.ai\.azure\.com)$/i;

type Env = Record<string, string | undefined>;

function val(env: Env, k: string): string | undefined {
  const v = env[k]?.trim();
  return v ? v : undefined;
}

/**
 * Accept only `https://<name>.cognitiveservices.azure.com`, `.openai.azure.com` or
 * `.services.ai.azure.com`, default port, no credentials in the URL. Returns the origin.
 */
export function checkAzureEndpoint(raw: string, name: string): string {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new AzureExtractError("AZURE_CONFIG", `${name} is not a valid URL.`);
  }
  if (u.protocol !== "https:")
    throw new AzureExtractError("AZURE_CONFIG", `${name} must use https.`);
  if (u.username || u.password)
    throw new AzureExtractError("AZURE_CONFIG", `${name} must not contain credentials.`);
  if (u.port)
    throw new AzureExtractError("AZURE_CONFIG", `${name} must use the default https port.`);
  if (!AZURE_HOST.test(u.hostname)) {
    throw new AzureExtractError(
      "AZURE_CONFIG",
      `${name} must be an Azure host (*.cognitiveservices.azure.com, *.openai.azure.com or *.services.ai.azure.com).`,
    );
  }
  return u.origin;
}

/** True when an origin is one this app is allowed to send data or tokens to. */
export function isAllowedAzureOrigin(origin: string): boolean {
  try {
    checkAzureEndpoint(origin, "url");
    return true;
  } catch {
    return false;
  }
}

/** Both endpoints and the deployment are set, and both endpoints pass the Azure host check. */
export function isConfigured(env: Env = process.env): boolean {
  try {
    readAzureConfig(env);
    return true;
  } catch {
    return false;
  }
}

export function readAzureConfig(env: Env = process.env): AzureConfig {
  const di = val(env, "AZURE_DOCINTEL_ENDPOINT");
  const oa = val(env, "AZURE_OPENAI_ENDPOINT");
  const deployment = val(env, "AZURE_OPENAI_DEPLOYMENT");
  const missing = [
    !di && "AZURE_DOCINTEL_ENDPOINT",
    !oa && "AZURE_OPENAI_ENDPOINT",
    !deployment && "AZURE_OPENAI_DEPLOYMENT",
  ].filter(Boolean);
  if (missing.length) throw new AzureExtractError("AZURE_CONFIG", `Missing ${missing.join(", ")}.`);
  const model = val(env, "AZURE_DOCINTEL_MODEL") ?? DEFAULT_DOCINTEL_MODEL;
  if (!/^[A-Za-z0-9._~-]{1,64}$/.test(model))
    throw new AzureExtractError("AZURE_CONFIG", "AZURE_DOCINTEL_MODEL is not a valid model id.");
  if (!/^[A-Za-z0-9._-]{1,64}$/.test(deployment!))
    throw new AzureExtractError(
      "AZURE_CONFIG",
      "AZURE_OPENAI_DEPLOYMENT is not a valid deployment name.",
    );
  const apiVersion = val(env, "AZURE_OPENAI_API_VERSION") ?? DEFAULT_OPENAI_API_VERSION;
  if (!/^\d{4}-\d{2}-\d{2}(-preview)?$/.test(apiVersion))
    throw new AzureExtractError(
      "AZURE_CONFIG",
      "AZURE_OPENAI_API_VERSION is not a valid API version.",
    );
  const mode = (val(env, "AZURE_AUTH_MODE") ?? "auto").toLowerCase();
  if (mode !== "auto" && mode !== "identity")
    throw new AzureExtractError("AZURE_CONFIG", "AZURE_AUTH_MODE must be 'identity' or 'auto'.");
  return {
    authMode: mode,
    docintelEndpoint: checkAzureEndpoint(di!, "AZURE_DOCINTEL_ENDPOINT"),
    docintelModel: model,
    openaiEndpoint: checkAzureEndpoint(oa!, "AZURE_OPENAI_ENDPOINT"),
    deployment: deployment!,
    apiVersion,
    docintelKey: val(env, "AZURE_DOCINTEL_KEY"),
    openaiKey: val(env, "AZURE_OPENAI_API_KEY"),
  };
}
