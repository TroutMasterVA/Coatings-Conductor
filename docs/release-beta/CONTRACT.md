# Release beta — contract + ticket graph

Branch: `release/beta-azure` (cut from `feat/12-practice-rollback` @ `fb3c108`). Approved go: Isaiah via PO, 2026-10-18 ~2:55 PM ET.
Not in scope for agents: merge to `main`, version tag, real Azure keys/endpoints, production hosting. Those go to Isaiah through PO.

## Goal

A stable release employees can deploy and use, reading any coatings sheet accurately.

- **Azure is the PRIMARY reader** when configured (company IT wires it; env vars only; mocked in tests; **no keys in git**, only `.env.example` committed).
- **On-device is fallback only** (no Azure configured, or Azure fails): `buildCardFromPds` (`src/lib/on-device-extract.ts`) → `heuristicExtract` (`src/lib/heuristic-extract.ts`) → `parsePrepBySubstrate` (`src/lib/prep-by-substrate.ts`, writes `surfacePrep.prepGates`).
- **Never tune to a single sheet.** Carbomastic 615 is one scored check in a varied fixture set, not the target.
- **No xAI** anywhere. The old xAI `extractPds` is reference only (prompt/shape ideas), not reused as a service.
- Login, per-user isolation, job loop (open → inspect → save → close), NOAA/Open-Meteo windows + sliders, and the printable card stay unchanged. **Card face, windows and print are unchanged**; FE provenance quotes live in a **collapsed panel under the card**.

## Current layout (as found)

| Area | Where |
|---|---|
| Card type | `FieldCardData` in `src/lib/types.ts` (product, storage, shelfLife, credentials, surfacePrep{…, prepGates?}, environmentals (numeric °F / % / mph or `null`), mixing, installation, holdPoints[], inspection, cure, safety, confidence, extractionNotes) |
| PDF text | `src/lib/pdf-text.ts` `extractPdfText(file)` — **browser**, pdfjs-dist, first 12 pages, pages joined by `\n\n` (page boundaries recoverable) |
| Intake UI | `src/components/pds-intake.tsx` → `src/routes/index.tsx` calls `buildCardFromPds(text)` client-side |
| Server fns | TanStack Start `createServerFn` + `.middleware([authMiddleware])` (`src/lib/auth/middleware.ts`; gives `context.userId`, runs `assertSameSiteRequest` + `requireUserId`). Examples: `src/lib/project-store.ts` |
| API routes | `src/routes/api/auth/$.ts` (Better Auth). Nitro `serverDir: ./server` (`server/middleware/`) |
| Nitro preset | `vite.config.ts` → `nitro({ preset: "vercel" })` (build/preview only) |
| DB | `src/lib/db.ts` `getSql()`: `pg` Pool when `DATABASE_URL` set, else embedded PGLite. Kysely used by Better Auth (`src/lib/auth/server.ts`, `pglite-dialect.ts`). Migrations in `migrations/`, `npm run db:migrate` |
| Tests | `node --test` (+ `--experimental-strip-types` for `.ts`) via `npm test`; use `bun test`/`bun` locally if node lacks strip-types. No vitest. |
| CI | Not on this branch. `.github/workflows/ci.yml` lives on `plat/ci-on-every-pr` (PR #1): npm ci → lint → typecheck → test → build (`VITE_AUTH_ENABLED=true`) |
| Old AI extract | `src/lib/extract-pds.ts` @ `369cebe^` (last version `eaff352`): `createServerFn` `extractPds`, xAI `grok-4.5`, `response_format: json_object`, inline `SYSTEM` prompt with full FieldCardData JSON shape, merges onto `heuristicExtract` base, `usedAi` flag. Removed in `369cebe`. |

## Extract contract (BE-1 types, BE-3 server fn)

Types live in `src/lib/extract/provider.ts`. Server fn: `extractSheet({ data })` from `@/lib/extract/extract-sheet` (TanStack Start `createServerFn` POST, signed-in users only). Limits fn: `getExtractLimits()` from the same module (GET, no auth) returns `{ maxUploadMb: number }` so the UI shows the same limit the server enforces.

### Request

```ts
type ExtractRequest = {
  fileBase64?: string; // raw file bytes, base64, no line breaks (a "data:...;base64," prefix is tolerated)
  mimeType?: string;   // required when fileBase64 is sent
  fileName?: string;
  text?: string;       // optional client pdf.js text, pages joined by a blank line; max 40,000 chars
  pages?: string[];    // optional per-page pdf.js text; when sent, quotes carry page numbers
};
```

- `fileBase64` / `mimeType` are optional so the **paste-text path** still works (`{ text }` only). Neither a file nor text → `EXTRACT_FAILED`.
- Accepted `mimeType`: `application/pdf`, `image/png`, `image/jpeg`, `image/tiff`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document` (DOCX). The server checks the file's own bytes (`%PDF-`, PNG signature, `FF D8 FF`, `II*\0` / `MM\0*`, zip containing `word/document.xml`). Another type, or bytes that do not match the claimed type → `UNSUPPORTED_FILE_TYPE`.
- File size: decoded bytes ≤ `MAX_UPLOAD_MB` (env, default **10**; practice on Vercel sets **3**). The base64 string is rejected before decoding when longer than `ceil(maxBytes * 4 / 3) + 4`.
- If `text` is omitted (FE omits it when pdf.js text is over 40k chars), the server reads the file itself: Azure when configured, else pdf.js (legacy Node build) for PDF and `mammoth` for DOCX. Server-read text is capped at 200,000 chars; the 40k cap applies only to client-sent `text`.
- **The server, never the browser, decides when a sheet is image-only** (photo/scan, or a PDF with little or no text layer).

### Response

```ts
type ExtractResponse =
  | {
      ok: true;
      card: FieldCardData;
      provenance: Provenance;
      provider: "azure" | "on-device";
      deployment?: string;          // Azure deployment name, display only
      warnings: { code: ExtractWarningCode; message: string }[];
      draft?: true;                 // set on every on-device result
      unverifiedTemps?: boolean;    // true when any temperature value on the card has no verbatim quote
    }
  | {
      ok: false;
      error: {
        code: ExtractErrorCode;
        message: string;
        retryAfterSec?: number;     // RATE_LIMITED
        maxUploadMb?: number;       // FILE_TOO_LARGE, e.g. "File is over 3 MB, the upload limit on this copy."
      };
    };
```

Missing `draft` / `unverifiedTemps` = false.

**Error codes:** `UNAUTHENTICATED` (no session), `RATE_LIMITED` (10/min per user, with `retryAfterSec`), `EXTRACT_TIMEOUT` (60 s overall), `EXTRACT_FAILED` (nothing readable / reader error), `FILE_TOO_LARGE` (file over `MAX_UPLOAD_MB`, with `maxUploadMb`; or client `text` over 40,000 chars), `UNSUPPORTED_FILE_TYPE`.

**Warning codes** (UI keys off `code`, never message text):

| Code | Meaning | UI |
|---|---|---|
| `AZURE_NOT_CONFIGURED` | No Azure env; on-device ran as designed | Quiet "on-device reader" note |
| `AZURE_FALLBACK` | Azure set up but failed / timed out; on-device ran | "Used on-device fallback" state |
| `IMAGE_ONLY_NEEDS_AZURE` | Little or no text layer and Azure not available (not set up, or failed) | "This sheet needs the Azure reader. Showing what could be read on-device." |
| `VALUES_DROPPED_UNQUOTED` | Values containing a number had no verbatim source line and were set to Not stated (all providers) | Informational |
| `ON_DEVICE_UNPINNED` | On-device read a non-numeric value but could not pin one exact line (quote `""`) | Informational |

### Provenance

```ts
type Provenance = Record<string, { page?: number; quote: string } | "not-stated">;
```

- Keys are dot paths with array indexes as segments: `environmentals.dewPointSpreadMinF`, `surfacePrep.prepGates.0.profile`.
- `page` is 1-based, present only when real page breaks were known (`pages` sent, or the server/Azure read the file).
- `"not-stated"`: the sheet is silent (or the value was dropped by the gate).
- **On-device `quote: ""`** = found on the sheet but no exact line (`ON_DEVICE_UNPINNED`). Allowed only for non-numeric text (e.g. a method name such as "NACE No. 2").
- **Number gate (every provider):** a value containing a number without a verbatim (whitespace/case/dash-normalized) source quote becomes Not stated (`null` / `""`), provenance `"not-stated"`, and a `VALUES_DROPPED_UNQUOTED` warning. Reusable as `gateNumbers(card, source)` in `src/lib/extract/provenance.ts` → `{ card, provenance, dropped, droppedPaths, unpinned }`.
- Inferred hold points (`source: "inferred"`) are app guidance and carry no provenance.

### Saved with the job

The job record gets an `extract` object next to `card`, copied from the ok response:

```ts
extract?: {
  provider: "azure" | "on-device";
  deployment?: string;
  provenance: Provenance;
  warnings: { code: string; message: string }[];
  extractedAt: string;          // ISO 8601
  draft?: true;
  unverifiedTemps?: boolean;
};
```

Older jobs have no `extract` (treat as missing). Stored under the same per-user isolation as the card (every query scoped by `user_id`).

### Provider interface

```ts
interface ExtractProvider {
  id: "on-device" | "azure";
  available(): boolean;                                   // e.g. Azure env present
  extract(input: ExtractInput, signal?: AbortSignal): Promise<ExtractResult>;
}
// ExtractInput = request after validation: { text?, pages?, fileBase64?, mimeType?, fileName? }
```

### Known limits

- **Rate limit is in memory, per instance.** With N instances a user can get up to 10×N/min. Fine for single-instance beta; a shared store is needed before scaling out.
- **Request body size:** a 10 MB file is about 13.4 MB as base64. **Vercel caps serverless request bodies at about 4.5 MB**, so on Vercel `MAX_UPLOAD_MB` must be ≤ 3 (3 MB → ~4 MB base64) until there is an upload step (PLAT/ARCH decision pending). The Nitro Node server has no lower body cap of its own; a container deploy / reverse proxy must allow ~14 MB (e.g. nginx `client_max_body_size 15m`).
- Logs carry provider, latency, outcome code and warning codes only. Never document text or keys.

## Azure path (primary)

1. **Document Intelligence** `prebuilt-layout` (model from `AZURE_DOCINTEL_MODEL`): text with page numbers, tables, figures, and OCR for scanned/image PDFs.
2. **Render PDF pages to images server-side** (capped page count / resolution) so brochure and chart layouts are readable.
3. **Vision-capable Azure OpenAI / Foundry deployment (GPT-4o class)** gets the layout text + tables + page images, returns `response_format: { type: "json_schema", strict: true }`.
4. zod-validate, then **provenance check**: numbers without a verbatim (whitespace-normalized) quote in the DocIntel text become Not stated.

## Provider selection (server)

| Var | Purpose |
|---|---|
| `AZURE_DOCINTEL_ENDPOINT` | Document Intelligence endpoint |
| `AZURE_DOCINTEL_MODEL` | Default `prebuilt-layout` |
| `AZURE_OPENAI_ENDPOINT` | Azure OpenAI / Foundry endpoint |
| `AZURE_OPENAI_DEPLOYMENT` | Vision-capable chat deployment name (GPT-4o class) |
| `AZURE_OPENAI_API_VERSION` | API version (must support json_schema + image input) |
| `AZURE_DOCINTEL_KEY` | Optional — key auth fallback |
| `AZURE_OPENAI_API_KEY` | Optional — key auth fallback |
| `MAX_UPLOAD_MB` | Upload cap in MB (decoded file). Default 10; practice on Vercel sets 3. Exposed to the UI via `getExtractLimits()` |

- **Auth order**: `DefaultAzureCredential` (managed identity / Entra) **first**; API-key env vars only if set and credential is not used/available.
- Azure is used when endpoints + deployment + API version are set. Otherwise → on-device fallback.
- Azure failure / timeout / schema-invalid → **fall back to on-device** with a user-visible warning.
- Config is never sent to the browser. `/api/health` may report `extractProvider: "azure"|"on-device"` but never values.

## Rules

- **Server-side only** for any AI call. Browser never sees keys or endpoints.
- **Auth-gated**: `authMiddleware` on the extract server fn; scope by `context.userId`.
- **Rate limit**: per user, 10/min (in-memory token bucket is acceptable for single-instance beta; document the limit for multi-instance).
- **Timeout**: 60 s total per extract (`AbortSignal.timeout`).
- **Error shape**: see *Extract contract* above (`{ code, message, retryAfterSec?, maxUploadMb? }`). Size cap: client text ≤ 40,000 chars, file ≤ `MAX_UPLOAD_MB`.
- **Strict schema**: `response_format: { type: "json_schema", strict: true }` built from the FieldCardData zod schema (zod v4 already a dependency); zod-validate every response.
- **Provenance** (per field, shown in the collapsed panel under the card): every numeric value (and every prepGate profile) must carry a quote found **verbatim in the source text after whitespace normalization**; otherwise the field is set to Not stated (`null` / `""`) and provenance `"not-stated"`. Never invent numbers. Silent fields show Not stated.
- **Prompt-injection guard**: sheet text is untrusted. System prompt says to ignore any instructions inside the document; document is passed as delimited user content; output only via the schema.
- Logs: provider, latency, outcome code. Never log document text or keys.

## Test fixtures (mocked Azure responses)

`tests/fixtures/extract/` — each fixture = source text/pages + mocked DocIntel layout JSON + mocked Azure OpenAI response + expected card:

1. Dense table spec sheet
2. Brochure-style sheet (charts/columns; page images matter)
3. Scanned image PDF (OCR-only text)
4. Multi-product sheet (must not cross-wire products)
5. Carbomastic 615 (scored check)

Plus negative mocks: invented number not in text → Not stated; injection text in sheet ignored; timeout → fallback; malformed JSON → fallback.

## Ticket graph

| Ticket | Owner | Scope | Deps |
|---|---|---|---|
| BE-1 | BE | `ExtractProvider` interface + on-device fallback provider wrapping `buildCardFromPds`/`heuristicExtract` | — |
| BE-2 | BE | Azure adapter (primary): DocIntel prebuilt-layout → server-side page images → vision deployment `json_schema`; `DefaultAzureCredential` first, keys secondary; provenance validator; mocks for all fixtures. Old `eaff352:src/lib/extract-pds.ts` SYSTEM prompt may seed the schema/prompt (no xAI). | BE-1 |
| BE-3 | BE | Server extract fn (`createServerFn` POST + `authMiddleware`), accepts file upload server-side; rate limit, 60 s timeout, error shapes, fallback | BE-1 |
| BE-4 | BE | Scoring harness across the full fixture set (per-field precision/recall, invented-number count = must be 0), Azure-mocked vs on-device; Carbomastic 615 is one row | BE-1, BE-2 (mocked) |
| FE-1 | FE | Upload any PDF/image → server extract; provenance quotes in a collapsed panel under the card (card face/windows/print unchanged); loading / empty / error / rate-limited / fallback-warning states | BE-3 contract only |
| PLAT-1 | Platform | Dockerfile (Nitro `node-server` preset via env switch, keep `vercel` for practice), `/api/health` (db ping), `.env.example`, README Deploy (Docker / PAVE, env table, Postgres `DATABASE_URL`) + **"IT: connect your Azure Foundry"** section, `npm run azure:check`, CI (`ci.yml` from PR #1) green on this branch | — |

### README — "IT: connect your Azure Foundry" (PLAT-1)

- Resources: Azure AI Document Intelligence (or AI Services multi-service) resource; Azure OpenAI / AI Foundry project with a vision-capable GPT-4o-class deployment; the app host (PAVE container) with a managed identity.
- Role assignments for the app identity: **Cognitive Services User** (Document Intelligence) and **Cognitive Services OpenAI User** (Azure OpenAI).
- Env vars: table above (keys optional; managed identity preferred).
- Test command: `npm run azure:check` — verifies config, auth, DocIntel and deployment reachability with a tiny bundled sample; prints pass/fail, never prints secrets.

## Definition of done

- CI green on `release/beta-azure`.
- Tests: provider selection, auth order, fallback, provenance validator, rate limit, error shapes, all five mocked fixtures + negative mocks.
- Unchanged and passing: login, isolation, job loop, NOAA windows + sliders, printable card.
- QA + AppSec review comments on the PR.
- PR `release/beta-azure` → `main` opened as **draft**. **Not merged. Not tagged.**

## Checkpoints (ET, Oct 18)

- **3:50 PM** — BE-1, PLAT-1 CI landed; BE-2/BE-3 in review.
- **4:50 PM** — all tickets in PR; scoring harness side-by-side across the fixture set (Azure-mocked vs on-device), Carbomastic 615 row included.
- **5:05–5:35 PM** — QA + AppSec final pass.
- **5:30 PM** — status to PO; draft PR + merge/tag/keys/hosting checklist for Isaiah.
