import { joinPages } from "./pdf-lines.ts";

export type PdfPageText = { page: number; text: string };

/** The slice of a pdf.js document this module uses (lets tests pass a stub). */
export type PdfDocLike = {
  numPages: number;
  getPage(n: number): Promise<{
    getTextContent(): Promise<{ items: unknown[] }>;
    cleanup?: () => unknown;
  }>;
  destroy(): Promise<unknown> | unknown;
};

/** Flat page text: pdf.js text items joined by spaces, whitespace collapsed. */
export function flatPageText(items: readonly unknown[]): string {
  return items
    .map((i) => (i && typeof i === "object" && "str" in i ? String((i as { str: unknown }).str) : ""))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Read up to 12 pages from a loaded document, then always destroy it, so the
 * pdf.js worker and its parsed copy of the PDF are freed even when a page throws.
 * Without this every upload left a worker alive in the tab.
 */
export async function readPagesThenDestroy(doc: PdfDocLike, maxPages = 12): Promise<PdfPageText[]> {
  try {
    const max = Math.min(doc.numPages, maxPages);
    const pages: PdfPageText[] = [];
    for (let i = 1; i <= max; i += 1) {
      const page = await doc.getPage(i);
      try {
        const content = await page.getTextContent();
        pages.push({ page: i, text: flatPageText(content.items) });
      } finally {
        page.cleanup?.();
      }
    }
    return pages;
  } finally {
    await doc.destroy();
  }
}

/** First 12 pages, one entry per page (1-based `page`), flat text per page. */
export async function extractPdfPages(file: File): Promise<PdfPageText[]> {
  const pdfjs = await import("pdfjs-dist");
  const workerUrl = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  const data = await file.arrayBuffer();
  return readLoadedPdf(pdfjs.getDocument({ data }));
}

/** The slice of a pdf.js loading task this module uses. */
export type PdfLoadingTaskLike = { promise: Promise<unknown>; destroy(): Promise<unknown> | unknown };

/**
 * Wait for a pdf.js loading task, read its pages, then free it. pdf.js 5+/6 has no
 * `PDFDocumentProxy.destroy()`: the loading task owns the worker, so destroy goes through it.
 * (Calling `doc.destroy()` threw in `finally`, which threw away the text and left every upload empty.)
 */
export async function readLoadedPdf(loadingTask: PdfLoadingTaskLike, maxPages = 12): Promise<PdfPageText[]> {
  let doc: PdfDocLike;
  try {
    doc = (await loadingTask.promise) as PdfDocLike;
  } catch (err) {
    await loadingTask.destroy();
    throw err;
  }
  return readPagesThenDestroy(
    { numPages: doc.numPages, getPage: (n) => doc.getPage(n), destroy: () => loadingTask.destroy() },
    maxPages,
  );
}

/** Joined text for existing callers: pages joined by a blank line. */
export async function extractPdfText(file: File): Promise<string> {
  return joinPages(await extractPdfPages(file));
}
