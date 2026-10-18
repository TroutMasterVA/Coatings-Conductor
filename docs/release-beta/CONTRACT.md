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

## Extract provider interface (BE-1)

```ts
// src/lib/extract/provider.ts
type FieldPath = string; // e.g. "environmentals.dewPointSpreadMinF", "surfacePrep.prepGates[0].profile"

interface ExtractInput { text: string; pages?: string[]; fileName?: string }

interface ExtractResult {
  card: FieldCardData;
  provenance: Record<FieldPath, { page?: number; quote: string } | "not-stated">;
  provider: string;        // "on-device" | "azure:<deployment>"
  warnings: string[];      // user-visible (e.g. "Azure timed out; showing on-device extract")
}

interface ExtractProvider {
  id: "on-device" | "azure";
  extract(input: ExtractInput): Promise<ExtractResult>;
}
```

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

- **Auth order**: `DefaultAzureCredential` (managed identity / Entra) **first**; API-key env vars only if set and credential is not used/available.
- Azure is used when endpoints + deployment + API version are set. Otherwise → on-device fallback.
- Azure failure / timeout / schema-invalid → **fall back to on-device** with a user-visible warning.
- Config is never sent to the browser. `/api/health` may report `extractProvider: "azure"|"on-device"` but never values.

## Rules

- **Server-side only** for any AI call. Browser never sees keys or endpoints.
- **Auth-gated**: `authMiddleware` on the extract server fn; scope by `context.userId`.
- **Rate limit**: per user, 10/min (in-memory token bucket is acceptable for single-instance beta; document the limit for multi-instance).
- **Timeout**: 60 s total per extract (`AbortSignal.timeout`).
- **Error shape**: `{ code, message }` with `code` ∈ `UNAUTHENTICATED`, `RATE_LIMITED`, `EXTRACT_TIMEOUT`, `EXTRACT_FAILED`, `FILE_TOO_LARGE`. Size cap: text ≤ 40,000 chars (old validator), file ≤ agreed MB.
- **Strict schema**: `response_format: { type: "json_schema", strict: true }` built from the FieldCardData zod schema (zod v4 already a dependency); zod-validate every response.
- **Provenance** (per field, shown in the collapsed panel under the card): every numeric value (and every prepGate profile) must carry a quote found **verbatim in the source text after whitespace normalization**; otherwise the field is set to Not stated (`null` / `""`) and provenance `"not-stated"`. Never invent numbers. Silent fields show Not stated.
- **Known limits:** Pro Industrial DTM's 55°F reading from the filler sentence is a **blocker** being fixed in **#40** with a general rule that temperature limits come only from the application-conditions or temperature section.
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

## Edit stamp (hand edits) — Lead ruling 2026-10-18 3:34 PM ET

When a saved card's field value differs from the stored card, the **server** (never the browser) sets that field's provenance entry to:

```ts
type EditedProvenance = {
  edited: { by: string; at: string }; // by = session user's display name, else email; at = server time, ISO-8601
  sheetQuote?: { page?: number; quote: string }; // the prior sheet quote, kept as history only
};
```

- Untouched fields keep `{ page?, quote }` or `'not-stated'`.
- Any `edited` value sent by the client is ignored and overwritten by the server.
- The UI shows "Edited by {by}, {at}" and must not present `sheetQuote` as backing the new value.
- Saving without `extract` keeps the stored extract (and its edit stamps); `extract: null` clears it; a new object replaces it.

## Job closeout (smallest version) — Lead ruling 2026-10-18 3:57 PM ET; PO archive/delete 4:06 PM ET

- Migration `0004_job_status.sql`: `projects.status text not null default 'open'` (`'open' | 'closed'`), `closed_at timestamptz null`, `closed_by text null`.
- `closeProject({ id })`: `createServerFn` behind `authMiddleware`, same style as `archiveProject`. Owner-only: a non-owner gets the existing `NOT_YOUR_JOB_MESSAGE` throw (same as isolation). Idempotent. Returns `{ ok: true, status: 'closed', closedAt, closedBy }`.
- `openProject` and the job list include `status`, `closedAt`, `closedBy`.
- Closed job: `saveProject` (and any field edit) throws `new Error(JOB_CLOSED_MESSAGE)` (exported constant, like `NOT_YOUR_JOB_MESSAGE`; text "This job is closed and can't be changed."). `extractSheet` attaching to a closed job returns the existing read-error shape `{ ok: false, error: { code: 'JOB_CLOSED', message: JOB_CLOSED_MESSAGE } }` (message "This job is closed and can't be changed."), like the other read errors. The server enforces this; hiding UI is not enough.
- A closed job is a record: opening, reading, and printing/saving the PDF stay allowed. Only edits and new reads stop. Autosave is off.
- **Archive vs delete (PO 4:06 PM ET):** a closed job **can be archived** (archive only hides it from the list; the record is kept) but **cannot be deleted**. The server enforces this inside the delete itself: deleting a closed job throws `new Error(JOB_CLOSED_DELETE_MESSAGE)` (exported constant; text "This job is closed and can't be deleted."). The UI hides Delete on closed jobs, but the server check is the one that counts. Guest (local) workspace follows the same rule.
- No reopen in this release.
- Guest (local) workspace mirrors the same status and refusal client-side.
- UI: "Close job" button, confirm "Close this job? It becomes read-only." (Close job / Cancel); "Closed" badge with date on the job and in the list; inputs disabled; print/PDF still available; `JOB_CLOSED` shows the server message; Delete hidden on closed jobs.
- Tests: owner-only, idempotent close, save refused after close; deleting a closed job is refused and archiving still works.

## Signed extract read (edit-stamp proof) — Lead + PO 2026-10-18 ~4:05 PM ET

- `extractSheet`'s result carries a **server-only** read id and an HMAC signature built with the existing `BETTER_AUTH_SECRET` (**no new key**) and covering the user and card values.
- The client sends the read id and signature back untouched and **never builds** them; they are **not stored**.
- Saves **without a valid signature** are compared with what's stored, and every changed field is stamped `{edited:{by,at}, sheetQuote?}`.
- A genuine signed read whose signature verifies saves clean (unstamped) as a fresh extract.
- Ignore any `extractedAt` from the client; the server alone decides fresh-read vs hand-edit.
- **Known limit (previews):** without a fixed `BETTER_AUTH_SECRET`, each preview instance has its own secret. A read signed on one instance and saved on another fails verification and shows "Edited by". That is the **safe failure**, not a bug. Documented for QA in #26 and the 4:40 in/out list until Isaiah approves a fixed secret for Preview.
- **Known limit (job binding):** the signature is **not** bound to a job id, so a user could reuse their own read on another of their jobs. The values are still real sheet reads, so the risk is low. Binding the job id is deferred to **issue #30** after this release (PO ruling, 4:20 PM ET). `extractSheet`'s input is unchanged.

## Draft flag on extract response — PO 4:19 PM ET (PR #26)

Owned by the extract endpoint in PR #26, for **every** provider (Azure and on-device).

- The **server** sets `draft: true` when any of these hold:
  - any shown field lacks its own **verbatim** sheet quote that backs its value;
  - any field fell back to the gate's sheet line;
  - the card's confidence is low.
- **On-device reads are always draft.**
- A card drops the Draft banner only when **every** shown value has a backing verbatim quote.
- The **client never sets or clears** `draft`.
- Tests cover each case (missing quote → draft; gate-line fallback → draft; low confidence → draft; on-device → always draft; all values quote-backed → not draft).

## Duration fields (recoat / pot life) — PO 4:19 PM ET (PR #40)

- **Recoat max**, **recoat min**, and **pot life** must show a **duration** taken from the sheet (e.g. `"1 year"`, `"8 h"`), read from the **table cell or row**.
- If the reader finds **only prose**, the field is **Not stated**.
- Lives in **PR #40**, not #36 (#36 stays cuttable).

## After this release — surface-prep / thinner misreads (issue #30) — PO 4:19 PM ET

- Surface-prep and thinner misreads are **out of this release**; they go to **issue #30** after this release.
- **Condition:** every such card must always render as a **draft** with the **"check against the sheet"** warning, never as a confirmed reading. If any shows as confirmed, that is a blocker for this release.
