import { AzureAuth } from "./auth.ts";
import type { AzureConfig } from "./config.ts";
import { tableLines, type DocLayout } from "./docintel.ts";
import { AzureExtractError } from "./errors.ts";
import { azureFetch, withBudget, type FetchLike } from "./http.ts";
import type { PageImage } from "./page-images.ts";
import { AZURE_CARD_SCHEMA, AZURE_SYSTEM_PROMPT } from "./prompt.ts";

/** Max layout characters sent to the model (old validator capped text at 40,000). */
export const MAX_LAYOUT_CHARS = 40_000;

/** Strip anything that could close or forge the sheet fence. */
function defang(s: string): string {
  return s.replace(/<\/?\s*sheet\b[^>]*>/gi, "[sheet-tag removed]");
}

/** Page-tagged layout text: lines per page, then tables as pipe rows. */
export function layoutText(layout: DocLayout): string {
  const parts: string[] = [];
  for (const p of layout.pages) {
    parts.push(`[page ${p.pageNumber}]`);
    parts.push(...p.lines);
    const tables = layout.tables.filter((t) => t.page === p.pageNumber);
    tables.forEach((t, i) => {
      parts.push(`[page ${p.pageNumber} table ${i + 1}]`);
      parts.push(...tableLines(t));
    });
  }
  const orphan = layout.tables.filter(
    (t) => !t.page || !layout.pages.some((p) => p.pageNumber === t.page),
  );
  orphan.forEach((t, i) => {
    parts.push(`[table ${i + 1}]`);
    parts.push(...tableLines(t));
  });
  return defang(parts.join("\n")).slice(0, MAX_LAYOUT_CHARS);
}

export type ChatOptions = {
  cfg: AzureConfig;
  auth: AzureAuth;
  fetch: FetchLike;
  signal?: AbortSignal;
  budgetMs: number;
  nonce: string;
};

export function buildChatBody(
  layout: DocLayout,
  images: PageImage[],
  nonce: string,
  fileName?: string,
): Record<string, unknown> {
  const system = AZURE_SYSTEM_PROMPT.replaceAll("NONCE", nonce);
  const safeName = (fileName ?? "").replace(/[^\w .()-]/g, "").slice(0, 120);
  const text =
    `Extract the field QC card from this sheet${safeName ? ` (file name: ${safeName})` : ""}. ` +
    `The layout text below is the only source you may quote from. Page images, if any, follow it and help you read layout only.\n` +
    `<sheet id="${nonce}">\n${layoutText(layout)}\n</sheet id="${nonce}">`;
  const content: Record<string, unknown>[] = [{ type: "text", text }];
  for (const img of images) {
    content.push({ type: "text", text: `Image of page ${img.page} (untrusted sheet content):` });
    content.push({ type: "image_url", image_url: { url: img.dataUrl, detail: "high" } });
  }
  return {
    temperature: 0,
    max_tokens: 8000,
    response_format: {
      type: "json_schema",
      json_schema: { name: "field_card", strict: true, schema: AZURE_CARD_SCHEMA },
    },
    messages: [
      { role: "system", content: system },
      { role: "user", content },
    ],
  };
}

type ChatReply = {
  choices?: {
    finish_reason?: string;
    message?: { content?: string | null; refusal?: string | null };
  }[];
};

/** Azure OpenAI chat completions with strict json_schema. Returns parsed (not yet validated) JSON. */
export async function chatExtract(
  layout: DocLayout,
  images: PageImage[],
  opts: ChatOptions,
  fileName?: string,
): Promise<unknown> {
  const { cfg } = opts;
  const url = `${cfg.openaiEndpoint}/openai/deployments/${encodeURIComponent(cfg.deployment)}/chat/completions?api-version=${encodeURIComponent(cfg.apiVersion)}`;
  const auth = await opts.auth.headersFor("openai", cfg, opts.signal);
  const res = await azureFetch(
    opts.fetch,
    url,
    {
      method: "POST",
      headers: { ...auth.headers, "Content-Type": "application/json" },
      body: JSON.stringify(buildChatBody(layout, images, opts.nonce, fileName)),
      signal: withBudget(opts.signal, opts.budgetMs),
    },
    "OpenAI",
  );
  let body: ChatReply;
  try {
    body = (await res.json()) as ChatReply;
  } catch {
    throw new AzureExtractError("AZURE_BAD_JSON", "Azure OpenAI response was not JSON.");
  }
  const choice = body.choices?.[0];
  if (choice?.message?.refusal)
    throw new AzureExtractError("AZURE_BAD_JSON", "Azure OpenAI refused the request.");
  if (choice?.finish_reason === "length")
    throw new AzureExtractError("AZURE_BAD_JSON", "Azure OpenAI reply was cut off.");
  if (choice?.finish_reason === "content_filter")
    throw new AzureExtractError("AZURE_BAD_JSON", "Azure OpenAI reply was filtered.");
  const raw = choice?.message?.content ?? "";
  try {
    return JSON.parse(raw);
  } catch {
    throw new AzureExtractError("AZURE_BAD_JSON", "Azure OpenAI reply was not valid JSON.");
  }
}
