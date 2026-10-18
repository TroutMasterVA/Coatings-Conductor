/**
 * `npm run azure:check` — for IT, after setting the Azure env vars on the app host.
 * Checks config, sign-in, Document Intelligence and the vision deployment with one tiny
 * generated sample image (no customer data). Prints OK or a clear error. Never prints secrets.
 * Exit code 0 = OK, 1 = not OK.
 */
import { createCanvas } from "@napi-rs/canvas";
import { createAzureProvider } from "../src/lib/extract/azure/azure-provider.ts";
import { readAzureConfig } from "../src/lib/extract/azure/config.ts";
import { AzureExtractError } from "../src/lib/extract/azure/errors.ts";

const HINTS: Record<string, string> = {
  AZURE_CONFIG:
    "Set AZURE_DOCINTEL_ENDPOINT, AZURE_OPENAI_ENDPOINT and AZURE_OPENAI_DEPLOYMENT (https, Azure hostnames only).",
  AZURE_AUTH:
    "Give the app's managed identity 'Cognitive Services User' (Document Intelligence) and 'Cognitive Services OpenAI User' (Azure OpenAI), or set the optional key env vars.",
  AZURE_HTTP:
    "Check the endpoint, the model / deployment name, the API version, and the role assignments (401/403 = access, 404 = wrong name or version).",
  AZURE_TIMEOUT:
    "Azure did not answer in time. Check network egress from the app host to the Azure endpoints.",
  AZURE_BAD_JSON:
    "The deployment answered but not with valid JSON. Use a GPT-4o-class deployment and an API version with json_schema support (2024-08-01-preview or later).",
  AZURE_SCHEMA:
    "The deployment answered but not in the card schema. Use a GPT-4o-class deployment with structured outputs.",
  AZURE_ANALYZE_FAILED:
    "Document Intelligence could not analyze the sample. Check AZURE_DOCINTEL_MODEL (default prebuilt-layout).",
};

function sample(): string {
  const c = createCanvas(900, 260);
  const g = c.getContext("2d");
  g.fillStyle = "#fff";
  g.fillRect(0, 0, 900, 260);
  g.fillStyle = "#000";
  g.font = "32px sans-serif";
  g.fillText("Sample Epoxy 100 - Product Data Sheet", 30, 60);
  g.fillText("Mix ratio: 1:1 by volume", 30, 120);
  g.fillText("Air temperature: 50°F minimum", 30, 180);
  g.fillText("Pot life: 2 hours at 77°F", 30, 240);
  return c.toBuffer("image/png").toString("base64");
}

async function main(): Promise<number> {
  let deployment = "";
  try {
    const cfg = readAzureConfig();
    deployment = cfg.deployment;
    console.log(
      `Config: OK (Document Intelligence model ${cfg.docintelModel}, deployment ${cfg.deployment}, API ${cfg.apiVersion})`,
    );
  } catch (e) {
    const err = e as AzureExtractError;
    console.error(`NOT OK [${err.code ?? "AZURE_CONFIG"}] ${err.message}\n  ${HINTS.AZURE_CONFIG}`);
    return 1;
  }
  const started = Date.now();
  const provider = createAzureProvider({ log: () => {}, timeoutMs: 60_000 });
  try {
    const r = await provider.extract({
      fileBase64: sample(),
      mimeType: "image/png",
      fileName: "azure-check.png",
    });
    const ratio = r.card.mixing.ratio || r.card.product.mixRatio;
    console.log(
      `Sign-in, Document Intelligence and ${deployment}: OK in ${Date.now() - started} ms`,
    );
    console.log(
      `Sample read: mix ratio "${ratio || "Not stated"}", air min ${r.card.environmentals.ambientTempMinF ?? "Not stated"} °F`,
    );
    console.log("OK");
    return 0;
  } catch (e) {
    const err =
      e instanceof AzureExtractError ? e : new AzureExtractError("AZURE_HTTP", "Unexpected error.");
    console.error(`NOT OK [${err.code}] ${err.message}\n  ${HINTS[err.code] ?? ""}`);
    return 1;
  }
}

process.exitCode = await main();
