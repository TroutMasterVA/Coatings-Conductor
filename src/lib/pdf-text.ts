import { fromPdfJsItems, joinPages, pageText } from "./pdf-lines.ts";

export type PdfPageText = { page: number; text: string };

/** First 12 pages, one entry per page (1-based `page`), lines rebuilt by position. */
export async function extractPdfPages(file: File): Promise<PdfPageText[]> {
  const pdfjs = await import("pdfjs-dist");
  const workerUrl = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  const data = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data }).promise;
  const max = Math.min(doc.numPages, 12);
  const pages: PdfPageText[] = [];
  for (let i = 1; i <= max; i += 1) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    pages.push({ page: i, text: pageText(fromPdfJsItems(content.items)) });
  }
  return pages;
}

/** Joined text for existing callers: pages joined by a blank line. */
export async function extractPdfText(file: File): Promise<string> {
  return joinPages(await extractPdfPages(file));
}
