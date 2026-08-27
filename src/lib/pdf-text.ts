type PdfTextItem = {
  str?: string;
  transform?: number[];
  width?: number;
  hasEOL?: boolean;
};

/** Rebuild reading-order lines from pdf.js text items using x/y. */
export function reconstructPdfLines(items: PdfTextItem[]): string {
  const pts: { x: number; y: number; str: string; w: number; eol: boolean }[] = [];
  for (const it of items) {
    const str = it.str ?? "";
    if (!str && !it.hasEOL) continue;
    const tr = it.transform ?? [1, 0, 0, 1, 0, 0];
    pts.push({
      x: tr[4] ?? 0,
      y: tr[5] ?? 0,
      str,
      w: it.width ?? 0,
      eol: Boolean(it.hasEOL),
    });
  }
  if (!pts.length) return "";

  const ys = pts.map((p) => p.y);
  const ySpan = Math.max(...ys) - Math.min(...ys);
  const allSameY = ySpan < 1.5;
  if (allSameY) {
    return pts
      .map((p) => p.str + (p.eol ? "\n" : ""))
      .join(" ")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/[ ]{2,}/g, " ");
  }

  pts.sort((a, b) => b.y - a.y || a.x - b.x);
  const lines: typeof pts[] = [];
  let current: typeof pts = [];
  let cy = pts[0].y;
  for (const p of pts) {
    if (Math.abs(p.y - cy) > 3.2) {
      if (current.length) lines.push(current);
      current = [p];
      cy = p.y;
    } else {
      current.push(p);
    }
  }
  if (current.length) lines.push(current);

  return lines
    .map((line) => {
      line.sort((a, b) => a.x - b.x);
      let s = line[0].str;
      for (let i = 1; i < line.length; i++) {
        const prev = line[i - 1];
        const gap = line[i].x - (prev.x + prev.w);
        s += gap > 12 ? "  " : gap > 1.2 ? " " : "";
        s += line[i].str;
      }
      if (line.some((p) => p.eol)) s += "\n";
      return s.trim();
    })
    .filter(Boolean)
    .join("\n");
}

export async function extractPdfText(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  const workerUrl = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  const data = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data }).promise;
  const max = Math.min(doc.numPages, 12);
  const chunks: string[] = [];
  for (let i = 1; i <= max; i += 1) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const lines = reconstructPdfLines(content.items as PdfTextItem[]);
    if (lines.trim()) chunks.push(lines.trim());
  }
  return chunks.join("\n\n");
}
