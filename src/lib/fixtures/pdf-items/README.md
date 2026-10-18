# pdf-items fixtures

These are pdf.js `getTextContent()` items (`str`, transform-derived `x`/`y`, `width`, `height`) for **page 1 only** of three vendor product data sheets. QA collected the sheets for the beta (`/workspace/cc-qa/pds`, not committed):

| File | Source sheet |
|---|---|
| `sw_macropoxy646fc.p1.json` | Sherwin-Williams Macropoxy 646 Fast Cure Epoxy Mastic, PDS |
| `intl_interthane990.p1.json` | International (AkzoNobel) Interthane 990, PDS |
| `tnemec_90-97.p1.json` | Tnemec Series 90-97 Tneme-Zinc, PDS |

- They contain only text positions taken from the public PDFs. There are no images or fonts, and no PDF bytes.
- They are used by `src/lib/pdf-lines.test.ts`, only to check row grouping, spacing and column splitting.
- The vendors own the sheet text. Do not reuse it outside of tests.
- To regenerate, run pdf.js (`pdfjs-dist`) on the original PDF, page 1, and map each item's `transform[4]`/`transform[5]` to `x`/`y`.
