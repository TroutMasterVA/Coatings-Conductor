# Release beta — contract + ticket graph

Branch: `release/beta-azure` (cut from `feat/12-practice-rollback` @ `fb3c108`). Approved go: Isaiah via PO, 2026-10-18 ~2:55 PM ET.
Not in scope for agents: merge to `main`, version tag, real Azure keys/endpoints, production hosting. Those go to Isaiah through PO.

## Goal

A stable release employees can deploy and use.

- **No keys set → best on-device extract**: `buildCardFromPds` (`src/lib/on-device-extract.ts`) → `heuristicExtract` (`src/lib/heuristic-extract.ts`) → `parsePrepBySubstrate` (`src/lib/prep-by-substrate.ts`, writes `surfacePrep.prepGates`).
- **Azure AI Foundry is a plug-in adapter** that company IT wires later. Env vars only. Mocked in tests. **No keys in git** (`.env*` stays ignored; only `.env.example` is committed).
- Login, per-user isolation, job loop (open → inspect → save → close), NOAA/Open-Meteo windows + sliders, and the printable card stay unchanged.

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

## Provider selection (server)

Server reads env:

| Var | Purpose |
|---|---|
| `AZURE_DOCINTEL_ENDPOINT` | Document Intelligence (layout/read) endpoint |
| `AZURE_DOCINTEL_KEY` | DocIntel key (omit with managed identity) |
| `AZURE_OPENAI_ENDPOINT` | Azure OpenAI / Foundry endpoint |
| `AZURE_OPENAI_DEPLOYMENT` | Chat deployment name |
| `AZURE_OPENAI_API_VERSION` | API version |
| `AZURE_OPENAI_API_KEY` | Key (omit with managed identity) |
| `AZURE_USE_MANAGED_IDENTITY` | `true` → `DefaultAzureCredential` (Entra / managed identity) |

- Azure is used only when **fully configured** (endpoints + deployment + api version + (keys or `AZURE_USE_MANAGED_IDENTITY=true`)). Otherwise → on-device.
- Azure failure / timeout / schema-invalid → **fall back to on-device** and add a warning shown to the user.
- Config is never sent to the browser. `/api/health` may report `extractProvider: "on-device"|"azure"` but never values.

## Rules

- **Server-side only** for any AI call. Browser never sees keys or endpoints.
- **Auth-gated**: `authMiddleware` on the extract server fn; scope by `context.userId`.
- **Rate limit**: per user, 10/min (in-memory token bucket is acceptable for single-instance beta; document the limit for multi-instance).
- **Timeout**: 60 s total per extract (`AbortSignal.timeout`).
- **Error shape**: `{ code, message }` with `code` ∈ `UNAUTHENTICATED`, `RATE_LIMITED`, `EXTRACT_TIMEOUT`, `EXTRACT_FAILED`, `FILE_TOO_LARGE`. Size cap: text ≤ 40,000 chars (old validator), file ≤ agreed MB.
- **Strict schema**: Azure OpenAI `response_format: { type: "json_schema", strict: true }` built from the FieldCardData zod schema (zod v4 already a dependency); zod-validate every response.
- **Provenance**: every numeric value (and every prepGate profile) must carry a quote found **verbatim in the source text after whitespace normalization**; otherwise the field is set to Not stated (`null` / `""`) and provenance `"not-stated"`. Never invent numbers. Silent fields show Not stated.
- **Prompt-injection guard**: sheet text is untrusted. System prompt says to ignore any instructions inside the document; document is passed as delimited user content; output only via the schema.
- Logs: provider, latency, outcome code. Never log document text or keys.

## Ticket graph

| Ticket | Owner | Scope | Deps |
|---|---|---|---|
| BE-1 | BE | `ExtractProvider` interface + on-device provider wrapping `buildCardFromPds`/`heuristicExtract` (+ provenance from the heuristic's matched text where available) | — |
| BE-2 | BE | Azure adapter: DocIntel layout → Azure OpenAI `json_schema`; reuse old `extractPds` SYSTEM prompt/shape from `eaff352:src/lib/extract-pds.ts`; mocked fetch fixtures; provenance validator | BE-1 |
| BE-3 | BE | Server extract fn (`createServerFn` POST + `authMiddleware`): rate limit, 60 s timeout, error shapes, fallback | BE-1 |
| BE-4 | BE | Carbomastic 615 gold-bar scoring script comparing providers (Azure mocked) | BE-1, BE-2 (mocked) |
| FE-1 | FE | Upload any PDF → server extract (or on-device), per-field provenance tooltip/quote, loading / empty / error / rate-limited / fallback states | BE-3 contract only |
| PLAT-1 | Platform | Dockerfile (Nitro `node-server` preset via env switch, keep `vercel` for practice), `/api/health` (db ping), `.env.example`, README Deploy (Docker / PAVE / Azure, env table, Postgres `DATABASE_URL`), bring CI (`ci.yml` from PR #1) onto this branch and green | — |

## Definition of done

- CI green on `release/beta-azure`.
- Tests: provider selection, fallback, provenance validator, rate limit, error shapes.
- Unchanged and passing: login, isolation, job loop, NOAA windows + sliders, printable card.
- QA + AppSec review comments on the PR.
- PR `release/beta-azure` → `main` opened as **draft**. **Not merged. Not tagged.**

## Checkpoints (ET, Oct 18)

- **3:50 PM** — BE-1, PLAT-1 CI landed; BE-2/BE-3 in review.
- **4:50 PM** — all tickets in PR; Carbomastic 615 gold-bar side-by-side (on-device vs Azure-mocked vs old prompt).
- **5:05–5:35 PM** — QA + AppSec final pass.
- **5:30 PM** — status to PO; draft PR + merge/tag/keys/hosting checklist for Isaiah.
