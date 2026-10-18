/** pdf.js text per page (first 12 pages). Index 0 = page 1; a page with no text layer is "". */
export async function extractPdfPages(file: File): Promise<string[]> {
  const pdfjs = await import("pdfjs-dist");
  const workerUrl = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  const data = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data }).promise;
  const max = Math.min(doc.numPages, 12);
  const pages: string[] = [];
  for (let i = 1; i <= max; i += 1) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    pages.push(
      content.items
        .map((item) => ("str" in item ? item.str : ""))
        .join(" ")
        .replace(/\s+/g, " ")
        .trim(),
    );
  }
  return pages;
}

/** Same text as before: non-empty pages joined by a blank line. */
export function joinPdfPages(pages: string[]): string {
  return pages.filter(Boolean).join("\n\n");
}

export async function extractPdfText(file: File): Promise<string> {
  return joinPdfPages(await extractPdfPages(file));
}
