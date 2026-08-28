type PdfTextItem = {
  str?: string;
  transform?: number[];
};

type Point = { str: string; x: number; y: number };

function reconstructPage(items: Point[]): string {
  if (!items.length) return "";
  items.sort((a, b) => b.y - a.y || a.x - b.x);
  const lines: { y: number; parts: { x: number; str: string }[] }[] = [];
  const yTol = 3.5;
  for (const it of items) {
    const last = lines[lines.length - 1];
    if (last && Math.abs(last.y - it.y) <= yTol) last.parts.push({ x: it.x, str: it.str });
    else lines.push({ y: it.y, parts: [{ x: it.x, str: it.str }] });
  }
  return lines
    .map((l) =>
      l.parts
        .sort((a, b) => a.x - b.x)
        .map((p) => p.str)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim(),
    )
    .filter(Boolean)
    .join("\n");
}

async function loadPdfjs() {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs").catch(() => import("pdfjs-dist"));
  const workerMod = await import("pdfjs-dist/legacy/build/pdf.worker.min.mjs?url").catch(() =>
    import("pdfjs-dist/build/pdf.worker.min.mjs?url"),
  );
  pdfjs.GlobalWorkerOptions.workerSrc = workerMod.default;
  return pdfjs;
}

async function textFromPdfData(data: ArrayBuffer): Promise<string> {
  const pdfjs = await loadPdfjs();
  const load = (buf: ArrayBuffer, disableWorker: boolean) =>
    pdfjs.getDocument({
      data: buf,
      disableWorker,
      isEvalSupported: false,
      useSystemFonts: true,
    }).promise;

  let doc: Awaited<ReturnType<typeof load>>;
  try {
    doc = await load(data.slice(0), true);
  } catch {
    doc = await load(data.slice(0), false);
  }
  const max = Math.min(doc.numPages, 12);
  const pages: string[] = [];
  for (let i = 1; i <= max; i += 1) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const items: Point[] = [];
    for (const raw of content.items) {
      const item = raw as PdfTextItem;
      const str = item.str ?? "";
      if (!str.trim()) continue;
      const t = item.transform ?? [1, 0, 0, 1, 0, 0];
      items.push({ str, x: t[4] ?? 0, y: t[5] ?? 0 });
    }
    const text = reconstructPage(items);
    if (text) pages.push(text);
  }
  return pages
    .join("\n\n")
    .replace(/(\w)-\s*\n\s*(\w)/g, "$1-$2")
    .trim();
}

export async function extractPdfText(file: File): Promise<string> {
  const data = await file.arrayBuffer();
  return textFromPdfData(data);
}

export async function extractPdfBytes(bytes: Uint8Array): Promise<string> {
  const copy = new Uint8Array(bytes);
  return textFromPdfData(copy.buffer);
}
