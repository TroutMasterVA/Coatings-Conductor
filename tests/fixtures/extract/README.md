# Extract fixtures (BE-3)

Tiny synthetic files for `src/lib/extract/extract-core.test.ts`. No real product sheet, no tuning target.

- `text-layer.pdf`: two pages with a text layer (made with jsPDF).
- `no-text.pdf`: a page with only a drawn box (no text layer), stands in for a scan.
- `sheet.docx`: minimal Word file (zip with `word/document.xml`).

PNG/JPEG/TIFF/garbage byte samples are built inline in the test.
