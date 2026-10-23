import { AzureAuth } from "./auth.ts";
import type { AzureConfig } from "./config.ts";
import { AzureExtractError, isAbort } from "./errors.ts";
import { azureFetch, retryAfterMs, withBudget, type Clock, type FetchLike } from "./http.ts";

export const DOCINTEL_API_VERSION = "2024-11-30";

export type DocTable = { page?: number; rowCount: number; columnCount: number; rows: string[][] };
export type DocPage = { pageNumber: number; lines: string[] };
export type DocLayout = { pages: DocPage[]; tables: DocTable[] };

export type SupportedMime =
  | "application/pdf"
  | "image/png"
  | "image/jpeg"
  | "image/tiff"
  | "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

type AnalyzeResult = {
  content?: string;
  pages?: { pageNumber: number; lines?: { content: string }[] }[];
  tables?: {
    rowCount: number;
    columnCount: number;
    cells: { rowIndex: number; columnIndex: number; content: string }[];
    boundingRegions?: { pageNumber: number }[];
  }[];
};

type Operation = { status?: string; analyzeResult?: AnalyzeResult; error?: { code?: string } };

export type AnalyzeOptions = {
  cfg: AzureConfig;
  auth: AzureAuth;
  fetch: FetchLike;
  clock: Clock;
  signal?: AbortSignal;
  /** Budget for submit + polling, ms. */
  deadlineMs: number;
};

/**
 * Document Intelligence analyze (REST): POST the file, then poll Operation-Location with backoff
 * until succeeded / failed or the deadline. The poll URL must be on the configured endpoint, so a
 * token is never sent anywhere else.
 */
export async function analyzeLayout(fileBase64: string, opts: AnalyzeOptions): Promise<DocLayout> {
  const { cfg, clock } = opts;
  const started = clock.now();
  const left = () => opts.deadlineMs - (clock.now() - started);
  const url = `${cfg.docintelEndpoint}/documentintelligence/documentModels/${encodeURIComponent(cfg.docintelModel)}:analyze?api-version=${DOCINTEL_API_VERSION}`;

  const auth = await opts.auth.headersFor("docintel", cfg, opts.signal);
  const submit = await azureFetch(
    opts.fetch,
    url,
    {
      method: "POST",
      headers: { ...auth.headers, "Content-Type": "application/json" },
      body: JSON.stringify({ base64Source: fileBase64 }),
      signal: withBudget(opts.signal, left()),
    },
    "Document Intelligence submit",
  );
  const opUrl = submit.headers.get("operation-location");
  if (!opUrl)
    throw new AzureExtractError("AZURE_HTTP", "Document Intelligence gave no Operation-Location.");
  let opOrigin: string;
  try {
    opOrigin = new URL(opUrl).origin;
  } catch {
    throw new AzureExtractError(
      "AZURE_HTTP",
      "Document Intelligence gave a bad Operation-Location.",
    );
  }
  if (opOrigin !== cfg.docintelEndpoint) {
    throw new AzureExtractError(
      "AZURE_HTTP",
      "Document Intelligence Operation-Location is not on the configured endpoint.",
    );
  }

  let wait = 500;
  for (;;) {
    if (left() <= 0)
      throw new AzureExtractError("AZURE_TIMEOUT", "Document Intelligence did not finish in time.");
    try {
      await clock.sleep(Math.min(wait, Math.max(1, left())), opts.signal);
    } catch (err) {
      if (isAbort(err) || opts.signal?.aborted)
        throw new AzureExtractError("AZURE_TIMEOUT", "Document Intelligence timed out.");
      throw err;
    }
    if (left() <= 0)
      throw new AzureExtractError("AZURE_TIMEOUT", "Document Intelligence did not finish in time.");
    const pollAuth = await opts.auth.headersFor("docintel", cfg, opts.signal);
    let res: Response;
    try {
      res = await azureFetch(
        opts.fetch,
        opUrl,
        { method: "GET", headers: pollAuth.headers, signal: withBudget(opts.signal, left()) },
        "Document Intelligence poll",
      );
    } catch (err) {
      if (err instanceof AzureExtractError && err.status === 429) {
        wait = Math.min(Math.max(wait * 2, 1000), 8000);
        continue;
      }
      throw err;
    }
    let op: Operation;
    try {
      op = (await res.json()) as Operation;
    } catch {
      throw new AzureExtractError("AZURE_HTTP", "Document Intelligence poll was not JSON.");
    }
    const status = (op.status ?? "").toLowerCase();
    if (status === "succeeded") return toLayout(op.analyzeResult ?? {});
    if (status === "failed" || status === "canceled") {
      throw new AzureExtractError(
        "AZURE_ANALYZE_FAILED",
        `Document Intelligence analysis ${status}${op.error?.code ? ` (${op.error.code})` : ""}.`,
      );
    }
    wait = retryAfterMs(res, Math.min(Math.round(wait * 1.5), 4000));
  }
}

export function toLayout(r: AnalyzeResult): DocLayout {
  const pages: DocPage[] = (r.pages ?? []).map((p) => ({
    pageNumber: p.pageNumber,
    lines: (p.lines ?? []).map((l) => l.content).filter((s) => s.trim()),
  }));
  if (!pages.length && r.content)
    pages.push({ pageNumber: 1, lines: r.content.split("\n").filter((s) => s.trim()) });
  const tables: DocTable[] = (r.tables ?? []).map((t) => {
    const rows: string[][] = Array.from({ length: t.rowCount }, () =>
      Array.from({ length: t.columnCount }, () => ""),
    );
    for (const c of t.cells ?? []) {
      if (rows[c.rowIndex] && c.columnIndex < t.columnCount)
        rows[c.rowIndex]![c.columnIndex] = c.content.replace(/\s+/g, " ").trim();
    }
    return {
      page: t.boundingRegions?.[0]?.pageNumber,
      rowCount: t.rowCount,
      columnCount: t.columnCount,
      rows,
    };
  });
  return { pages, tables };
}

/**
 * Table rows as text, each data cell labeled with its column header, e.g.
 * `| Condition: Minimum | Surface: 20°F (-7°C) | Ambient: 20°F (-7°C) |`.
 * Header and cell text are both Document Intelligence output, so this is still sheet text,
 * and a temperature in a table carries its own label (air / surface / recoat) on its line.
 * The model sees exactly these lines and the gate checks quotes against exactly these lines.
 */
export function tableLines(t: DocTable): string[] {
  const header = t.rows[0] ?? [];
  const out = [`| ${header.join(" | ")} |`];
  for (const r of t.rows.slice(1)) {
    out.push(`| ${r.map((c, i) => (header[i] && c ? `${header[i]}: ${c}` : c)).join(" | ")} |`);
  }
  return out;
}

/** One string per page (lines joined by newline). Index i is page i+1 when page numbers are contiguous. */
export function pageTexts(layout: DocLayout): string[] {
  const max = layout.pages.reduce((m, p) => Math.max(m, p.pageNumber), 0);
  const out: string[] = Array.from({ length: max }, () => "");
  for (const p of layout.pages) out[p.pageNumber - 1] = p.lines.join("\n");
  return out;
}
