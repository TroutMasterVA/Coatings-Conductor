/**
 * Server-side text readers for the on-device path: pdf.js (legacy Node build, no worker) for PDFs
 * and mammoth for DOCX. No network. Text only; never logged.
 */

import { fromPdfJsItems, pageText } from "../pdf-lines.ts";

/** Server-read text is capped here (client-sent text stays capped at 40,000 characters). */
export const SERVER_TEXT_MAX_CHARS = 200_000;
export const SERVER_PDF_MAX_PAGES = 200;

export type ReadText = { text: string; pages?: string[] };

function cap(pages: string[]): string[] {
  const out: string[] = [];
  let used = 0;
  for (const p of pages) {
    if (used >= SERVER_TEXT_MAX_CHARS) break;
    const slice = p.slice(0, SERVER_TEXT_MAX_CHARS - used);
    out.push(slice);
    used += slice.length + 2;
  }
  return out;
}

export async function readPdfText(bytes: Uint8Array, signal?: AbortSignal): Promise<ReadText> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const task = pdfjs.getDocument({
    data: bytes.slice(),
    disableFontFace: true,
    useSystemFonts: false,
    verbosity: 0,
  });
  const onAbort = () => void task.destroy();
  signal?.addEventListener("abort", onAbort, { once: true });
  try {
    const doc = await task.promise;
    const n = Math.min(doc.numPages, SERVER_PDF_MAX_PAGES);
    const pages: string[] = [];
    for (let i = 1; i <= n; i++) {
      if (signal?.aborted) throw new Error("aborted");
      const content = await (await doc.getPage(i)).getTextContent();
      // Same line rebuild as the browser (pdf-lines.ts, FE #31), so server and browser quotes match.
      pages.push(pageText(fromPdfJsItems(content.items)));
    }
    await task.destroy();
    const capped = cap(pages);
    return { text: capped.join("\n\n"), pages: capped };
  } finally {
    signal?.removeEventListener("abort", onAbort);
  }
}

export async function readDocxText(bytes: Uint8Array): Promise<ReadText> {
  const mammoth = (await import("mammoth")).default;
  const r = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
  const text = r.value.replace(/\n{3,}/g, "\n\n").trim().slice(0, SERVER_TEXT_MAX_CHARS);
  return { text };
}
