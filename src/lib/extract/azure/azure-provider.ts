import { randomUUID } from "node:crypto";
import { buildLaymanBullets } from "../../layman-bullets.ts";
import type { FieldCardData } from "../../types.ts";
import { gateNumbers, unverifiedTempsFromGate, type SourceDoc } from "../provenance.ts";
import type {
  ExtractInput,
  ExtractProvider,
  ExtractResult,
  ExtractWarning,
  Provenance,
} from "../provider.ts";
import { AzureAuth, type TokenSource, defaultCredential } from "./auth.ts";
import { isConfigured, readAzureConfig } from "./config.ts";
import { analyzeLayout, tableLines, type DocLayout, type SupportedMime } from "./docintel.ts";
import { AzureExtractError, toAzureError } from "./errors.ts";
import { realClock, type Clock, type FetchLike } from "./http.ts";
import { chatExtract } from "./openai.ts";
import { pageImages, type PageImage } from "./page-images.ts";
import { INJECTION_HINTS } from "./prompt.ts";
import { ModelOutputSchema } from "./schema.ts";
import { checkClaims } from "./gate.ts";

/** #24's ExtractInput already has `fileBase64` / `mimeType`; `pdfBase64` is tolerated from older callers. */
export type AzureExtractInput = Omit<ExtractInput, "mimeType"> & {
  mimeType?: string;
  pdfBase64?: string;
};

/** Flat result (CONTRACT.md): `provider: "azure"`, `deployment`, `draft: false`, `unverifiedTemps`. Save with #24's `toSavedExtract`. */
export type AzureExtractResult = ExtractResult & {
  provider: "azure";
  deployment: string;
  draft: false;
  unverifiedTemps: boolean;
  /**
   * INTERNAL, SERVER-ONLY. The Document Intelligence layout text (`sourceFromLayout(layout).text`:
   * per page, lines then labeled table rows) that every quote was checked against. #26's
   * `runExtract` uses it for its second number check, including file-only uploads with no request
   * `text`. The server MUST strip it before responding: it is never sent to the browser and never saved.
   */
  source: { text: string; pages?: string[] };
};

export type AzureLog = (e: {
  provider: "azure";
  stage: string;
  ms: number;
  outcome: string;
  auth?: string;
}) => void;

export type AzureDeps = {
  env?: Record<string, string | undefined>;
  fetch?: FetchLike;
  credential?: () => Promise<TokenSource>;
  clock?: Clock;
  renderPages?: (fileBase64: string, mimeType: string) => Promise<PageImage[]>;
  log?: AzureLog;
  /** Overall Azure budget (ms). BE-3 also passes its own AbortSignal. */
  timeoutMs?: number;
  nonce?: () => string;
};

export const DEFAULT_AZURE_TIMEOUT_MS = 55_000;
const DOCINTEL_SHARE = 0.45;

const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/** File type from the bytes themselves. */
export function sniffMime(bytes: Uint8Array): SupportedMime | null {
  const b = (i: number) => bytes[i] ?? -1;
  if (b(0) === 0x25 && b(1) === 0x50 && b(2) === 0x44 && b(3) === 0x46) return "application/pdf";
  if (b(0) === 0x89 && b(1) === 0x50 && b(2) === 0x4e && b(3) === 0x47) return "image/png";
  if (b(0) === 0xff && b(1) === 0xd8 && b(2) === 0xff) return "image/jpeg";
  if (
    (b(0) === 0x49 && b(1) === 0x49 && b(2) === 0x2a && b(3) === 0) ||
    (b(0) === 0x4d && b(1) === 0x4d && b(2) === 0 && b(3) === 0x2a)
  )
    return "image/tiff";
  if (b(0) === 0x50 && b(1) === 0x4b && b(2) === 0x03 && b(3) === 0x04) return DOCX;
  return null;
}

function resolveFile(input: AzureExtractInput): { fileBase64: string; mimeType: SupportedMime } {
  const fileBase64 = (input.fileBase64 ?? input.pdfBase64)?.replace(/^data:[^,]*,/, "");
  if (!fileBase64)
    throw new AzureExtractError("AZURE_INPUT", "Azure reader needs the file itself.");
  const head = Buffer.from(fileBase64.slice(0, 16), "base64");
  const sniffed = sniffMime(head);
  if (!sniffed)
    throw new AzureExtractError("AZURE_INPUT", "File is not a PDF, PNG, JPEG, TIFF or DOCX.");
  const claimed = input.mimeType
    ?.toLowerCase()
    .replace(/^image\/jpg$/, "image/jpeg")
    .replace(/^image\/tif$/, "image/tiff");
  if (claimed && claimed !== sniffed)
    throw new AzureExtractError("AZURE_INPUT", "File type does not match its contents.");
  if (!input.mimeType && !input.fileBase64 && sniffed !== "application/pdf") {
    throw new AzureExtractError("AZURE_INPUT", "pdfBase64 must be a PDF.");
  }
  return { fileBase64, mimeType: sniffed };
}

/**
 * Document Intelligence text the gate checks quotes against: per page, lines then labeled table
 * rows (the same lines the model saw).
 */
export function sourceFromLayout(layout: DocLayout): SourceDoc {
  const max = layout.pages.reduce((m, p) => Math.max(m, p.pageNumber), 0);
  const pages: string[] = Array.from({ length: max }, () => "");
  for (const p of layout.pages) {
    const rows = layout.tables.filter((t) => t.page === p.pageNumber).flatMap(tableLines);
    pages[p.pageNumber - 1] = [...p.lines, ...rows].join("\n");
  }
  const orphan = layout.tables.filter((t) => !t.page || t.page > max).flatMap(tableLines);
  if (orphan.length) {
    if (!pages.length) pages.push("");
    pages[pages.length - 1] += `\n${orphan.join("\n")}`;
  }
  return { text: pages.join("\n\n"), pages: pages.length ? pages : undefined };
}

export function createAzureProvider(deps: AzureDeps = {}) {
  const env = deps.env ?? process.env;
  const fetchImpl: FetchLike = deps.fetch ?? ((u, i) => fetch(u, i));
  const clock = deps.clock ?? realClock;
  const auth = new AzureAuth(deps.credential ?? defaultCredential);
  const render = deps.renderPages ?? pageImages;
  const log: AzureLog =
    deps.log ?? ((e) => console.info(JSON.stringify({ evt: "extract.azure", ...e })));
  const timeoutMs = deps.timeoutMs ?? DEFAULT_AZURE_TIMEOUT_MS;
  const nonce = deps.nonce ?? (() => randomUUID().replace(/-/g, "").slice(0, 16));

  async function extract(
    input: AzureExtractInput,
    signal?: AbortSignal,
  ): Promise<AzureExtractResult> {
    const t0 = clock.now();
    const left = () => timeoutMs - (clock.now() - t0);
    let stage = "config";
    try {
      const cfg = readAzureConfig(env);
      stage = "input";
      const file = resolveFile(input);

      stage = "docintel";
      const layout = await analyzeLayout(file.fileBase64, {
        cfg,
        auth,
        fetch: fetchImpl,
        clock,
        signal,
        deadlineMs: Math.round(timeoutMs * DOCINTEL_SHARE),
      });
      log({ provider: "azure", stage, ms: clock.now() - t0, outcome: "ok" });

      stage = "images";
      let images: PageImage[] = [];
      try {
        images = await render(file.fileBase64, file.mimeType);
      } catch {
        log({ provider: "azure", stage, ms: clock.now() - t0, outcome: "skipped" });
      }

      stage = "openai";
      if (left() <= 0)
        throw new AzureExtractError(
          "AZURE_TIMEOUT",
          "Azure ran out of time before the model call.",
        );
      const raw = await chatExtract(
        layout,
        images,
        { cfg, auth, fetch: fetchImpl, signal, budgetMs: left(), nonce: nonce() },
        input.fileName,
      );

      stage = "validate";
      const parsed = ModelOutputSchema.safeParse(raw);
      if (!parsed.success)
        throw new AzureExtractError(
          "AZURE_SCHEMA",
          "Azure OpenAI reply did not match the card schema.",
        );
      const { provenance: claimed, ...rest } = parsed.data;

      const extractedAt = new Date(clock.now()).toISOString();
      const card: FieldCardData = { ...rest, id: randomUUID(), extractedAt, extractionNotes: [] };
      const source = sourceFromLayout(layout);

      // 1) Azure-specific check of the model's own quotes (verbatim in DocIntel text, holds the
      //    number, unit + label for temps, sane mix ratio). Failing values are blanked.
      const claims = checkClaims(card, claimed, source);
      // 2) The shared #24 gate, same as every provider: no number without a source line.
      const gated = gateNumbers(claims.card, source);
      // Prefer the model's verified quote (exact line + real page) where both agree on a value.
      const provenance: Provenance = { ...gated.provenance };
      for (const [path, p] of Object.entries(provenance)) {
        const v = claims.verified.get(path);
        if (p !== "not-stated" && v) provenance[path] = v;
        else if (p !== "not-stated" && p.quote === "") provenance[path] = "not-stated";
      }
      const droppedPaths = [...new Set([...claims.rejected, ...gated.droppedPaths])];
      const outCard = gated.card;
      // Values left unpinned by the shared gate are not shown from Azure: blank them too.
      for (const path of gated.unpinned) {
        if (!claims.verified.has(path)) {
          blank(outCard, path);
          droppedPaths.push(path);
        }
      }
      outCard.extractionNotes = buildLaymanBullets(outCard);

      const warnings: ExtractWarning[] = [];
      if (droppedPaths.length) {
        warnings.push({
          code: "VALUES_DROPPED_UNQUOTED",
          message: `${droppedPaths.length} value(s) were set to Not stated because no exact line in the sheet backed them.`,
        });
      }
      const unverifiedTemps = unverifiedTempsFromGate(provenance, droppedPaths);
      if (INJECTION_HINTS.test(source.text))
        log({
          provider: "azure",
          stage: "injection-hint",
          ms: clock.now() - t0,
          outcome: "flagged",
        });
      log({
        provider: "azure",
        stage: "done",
        ms: clock.now() - t0,
        outcome: droppedPaths.length ? "ok-dropped" : "ok",
      });

      return {
        card: outCard,
        provenance,
        provider: "azure",
        deployment: cfg.deployment,
        warnings,
        draft: false,
        unverifiedTemps,
        // Internal only: stripped by the server before the response (see AzureExtractResult.source).
        source: { text: source.text },
      };
    } catch (err) {
      const e = toAzureError(err, stage);
      log({ provider: "azure", stage, ms: clock.now() - t0, outcome: e.code });
      throw e;
    }
  }

  return {
    id: "azure" as const,
    available: () => isConfigured(env),
    extract,
  };
}

function blank(card: FieldCardData, path: string): void {
  const parts = path.split(".");
  let cur = card as unknown as Record<string, unknown>;
  for (const k of parts.slice(0, -1)) cur = cur[k] as Record<string, unknown>;
  const k = parts[parts.length - 1]!;
  cur[k] = typeof cur[k] === "number" ? null : "";
}

export type AzureProvider = ReturnType<typeof createAzureProvider>;

/** BE-3 hookup: `azure: azureFromEnv()` in the extract core deps. Null when Azure env is not set. */
export function azureFromEnv(
  env: Record<string, string | undefined> = process.env,
  deps: Omit<AzureDeps, "env"> = {},
): ExtractProvider | null {
  if (!isConfigured(env)) return null;
  return createAzureProvider({ ...deps, env });
}
