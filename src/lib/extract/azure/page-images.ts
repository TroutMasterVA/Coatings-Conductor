/**
 * Page images for the vision model. PDFs are rendered server-side with pdfjs + @napi-rs/canvas
 * (max 12 pages, ~150 dpi, long edge capped). PNG/JPEG pass through. TIFF and DOCX send no
 * images: Document Intelligence text covers them, and Azure OpenAI does not take TIFF.
 */
export const MAX_PAGES = 12;
export const DPI = 150;
export const MAX_EDGE_PX = 2000;

export type PageImage = { page: number; dataUrl: string };

export async function pageImages(fileBase64: string, mimeType: string): Promise<PageImage[]> {
  if (mimeType === "image/png" || mimeType === "image/jpeg") {
    return [{ page: 1, dataUrl: `data:${mimeType};base64,${fileBase64}` }];
  }
  if (mimeType !== "application/pdf") return [];
  return renderPdfPages(Buffer.from(fileBase64, "base64"));
}

export async function renderPdfPages(
  bytes: Uint8Array,
  maxPages = MAX_PAGES,
): Promise<PageImage[]> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const { createCanvas } = await import("@napi-rs/canvas");
  const task = pdfjs.getDocument({
    data: new Uint8Array(bytes),
    disableFontFace: true,
    useSystemFonts: false,
    verbosity: 0,
  });
  const doc = await task.promise;
  const out: PageImage[] = [];
  try {
    const n = Math.min(doc.numPages, maxPages);
    for (let i = 1; i <= n; i++) {
      const page = await doc.getPage(i);
      const base = page.getViewport({ scale: 1 });
      const scale = Math.min(DPI / 72, MAX_EDGE_PX / Math.max(base.width, base.height));
      const viewport = page.getViewport({ scale });
      const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({
        canvas: canvas as unknown as HTMLCanvasElement,
        canvasContext: ctx as unknown as CanvasRenderingContext2D,
        viewport,
      }).promise;
      out.push({
        page: i,
        dataUrl: `data:image/png;base64,${canvas.toBuffer("image/png").toString("base64")}`,
      });
      page.cleanup();
    }
  } finally {
    await task.destroy();
  }
  return out;
}
