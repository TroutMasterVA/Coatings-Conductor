import type { EditedProvenance, ProvenanceQuote, SavedExtract, SavedProvenance } from "@/lib/extract/provider";
import type { Sql } from "@/lib/db";
import type { FieldCardData } from "@/lib/types";
import { isEmpty, isStructural, leaves, type Leaf } from "./extract/provenance.ts";

/** Saved extract records are capped so a client cannot park arbitrary data on a job. */
export const SAVED_EXTRACT_MAX_CHARS = 1_000_000;

const MAX_QUOTE = 500;
const MAX_BY = 200;

function isIso(v: unknown): v is string {
  return typeof v === "string" && v.length <= 40 && !Number.isNaN(Date.parse(v));
}

/** `{ page?, quote }` with a positive integer page, or null. */
function parseQuote(v: unknown): ProvenanceQuote | null {
  if (!v || typeof v !== "object") return null;
  const q = v as { quote?: unknown; page?: unknown };
  if (typeof q.quote !== "string") return null;
  if (q.page !== undefined && !(Number.isInteger(q.page) && (q.page as number) > 0)) return null;
  return q.page ? { page: q.page as number, quote: q.quote.slice(0, MAX_QUOTE) } : { quote: q.quote.slice(0, MAX_QUOTE) };
}

/** One stored provenance entry: a quote, "not-stated", or a server edit stamp. Null when malformed. */
function parseEntry(v: unknown): SavedProvenance[string] | null {
  if (v === "not-stated") return "not-stated";
  if (v && typeof v === "object" && "edited" in v) {
    const e = (v as { edited?: unknown }).edited as { by?: unknown; at?: unknown } | undefined;
    if (!e || typeof e !== "object" || typeof e.by !== "string" || !e.by.trim() || !isIso(e.at)) return null;
    const out: EditedProvenance = { edited: { by: e.by.slice(0, MAX_BY), at: e.at } };
    const sq = (v as { sheetQuote?: unknown }).sheetQuote;
    if (sq !== undefined) {
      const q = parseQuote(sq);
      if (!q) return null;
      out.sheetQuote = q;
    }
    return out;
  }
  return parseQuote(v);
}

export function isEdited(v: SavedProvenance[string] | undefined): v is EditedProvenance {
  return !!v && typeof v === "object" && "edited" in v;
}

/**
 * Validate an `extract` object coming from the client (or the DB). Returns null when it is
 * missing or malformed; never throws. Unknown keys are dropped. Accepts server edit stamps
 * (`{ edited: { by, at }, sheetQuote? }`); whether a client may keep one is decided by
 * {@link planExtractSave}, not here.
 */
export function parseSavedExtract(raw: unknown): SavedExtract | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (r.provider !== "azure" && r.provider !== "on-device") return null;
  if (!r.provenance || typeof r.provenance !== "object" || Array.isArray(r.provenance)) return null;
  const provenance: SavedProvenance = {};
  for (const [k, v] of Object.entries(r.provenance as Record<string, unknown>)) {
    const entry = parseEntry(v);
    if (!entry) return null;
    provenance[k.slice(0, 200)] = entry;
  }
  const warnings = Array.isArray(r.warnings)
    ? r.warnings
        .filter((w): w is { code: string; message: string } =>
          Boolean(w) && typeof (w as { code?: unknown }).code === "string" && typeof (w as { message?: unknown }).message === "string",
        )
        .slice(0, 20)
        .map((w) => ({ code: w.code.slice(0, 64), message: w.message.slice(0, 500) }))
    : [];
  const extractedAt = typeof r.extractedAt === "string" && !Number.isNaN(Date.parse(r.extractedAt)) ? r.extractedAt : null;
  if (!extractedAt) return null;
  const out: SavedExtract = {
    provider: r.provider,
    provenance,
    warnings: warnings as SavedExtract["warnings"],
    extractedAt,
    draft: r.draft === true,
    unverifiedTemps: r.unverifiedTemps === true,
  };
  if (typeof r.deployment === "string" && r.deployment) out.deployment = r.deployment.slice(0, 128);
  return out;
}

/** Who made a hand edit and when, as decided by the server. */
export type Editor = { by: string; at: string };

function sameValue(a: Leaf["value"] | undefined, b: Leaf["value"] | undefined): boolean {
  const ea = a === undefined || isEmpty(a);
  const eb = b === undefined || isEmpty(b);
  if (ea || eb) return ea && eb;
  return a === b;
}

/**
 * Stamp every card field whose value differs from the stored card (CONTRACT.md "Edit stamp").
 * Changed field → `{ edited: { by, at }, sheetQuote? }`, where `sheetQuote` is the prior sheet
 * quote (kept from the first edit on later re-edits). Untouched fields keep their entry.
 * A field that no longer exists on the card loses its entry. Structural paths are skipped.
 */
export function stampEdits(
  storedCard: FieldCardData,
  nextCard: FieldCardData,
  extract: SavedExtract,
  editor: Editor,
): SavedExtract {
  const before = new Map(leaves(storedCard).map((l) => [l.path, l.value] as const));
  const after = new Map(leaves(nextCard).map((l) => [l.path, l.value] as const));
  const provenance: SavedProvenance = { ...extract.provenance };
  for (const path of new Set([...before.keys(), ...after.keys()])) {
    if (isStructural(path) || sameValue(before.get(path), after.get(path))) continue;
    if (!after.has(path)) {
      delete provenance[path];
      continue;
    }
    const prior = extract.provenance[path];
    const sheetQuote = isEdited(prior) ? prior.sheetQuote : prior && prior !== "not-stated" ? prior : undefined;
    provenance[path] = sheetQuote
      ? { edited: { by: editor.by, at: editor.at }, sheetQuote }
      : { edited: { by: editor.by, at: editor.at } };
  }
  return { ...extract, provenance };
}

/** Drop any edit stamp the client sent: only the server writes `edited`. */
function withoutClientStamps(extract: SavedExtract): SavedExtract {
  const provenance: SavedProvenance = {};
  for (const [k, v] of Object.entries(extract.provenance)) if (!isEdited(v)) provenance[k] = v;
  return { ...extract, provenance };
}

export type ExtractSavePlan = { extract: SavedExtract | null; action: "kept" | "cleared" | "replaced" };

/**
 * Decide the job's extract on save. Pure.
 * - `extract` missing keeps the stored record; `null` clears it; an object replaces it.
 * - An object from the SAME read (same `extractedAt` as stored) keeps the server's provenance:
 *   whatever the client sent for quotes or `edited` is ignored.
 * - An object from a NEW read replaces it, minus any client-sent `edited` entries; the card
 *   came from that read, so nothing is stamped.
 * - Otherwise, when a card is saved, fields that differ from the stored card are stamped.
 */
export function planExtractSave(input: {
  storedCard: FieldCardData | null;
  storedExtract: SavedExtract | null;
  card: FieldCardData | null | undefined;
  extract: unknown;
  editor: Editor;
}): ExtractSavePlan {
  const { storedCard, storedExtract, card, extract, editor } = input;
  if (extract === null) return { extract: null, action: "cleared" };
  let base: SavedExtract | null;
  let action: ExtractSavePlan["action"];
  if (extract === undefined) {
    base = storedExtract;
    action = "kept";
  } else {
    const parsed = parseSavedExtract(extract);
    if (!parsed) throw new Error("Saved source quotes are malformed.");
    action = "replaced";
    if (storedExtract && parsed.extractedAt === storedExtract.extractedAt) {
      base = { ...parsed, provenance: storedExtract.provenance };
    } else {
      return { extract: withoutClientStamps(parsed), action };
    }
  }
  if (base && card && storedCard) base = stampEdits(storedCard, card, base, editor);
  return { extract: base, action };
}

/** `by` for an edit stamp: the session user's display name, else email. */
export async function editorName(sql: Sql, userId: string): Promise<string> {
  const rows = await sql<{ name: string | null; email: string | null }>`
    select "name", "email" from "user" where "id" = ${userId}
  `;
  const r = rows[0];
  return (r?.name ?? "").trim() || (r?.email ?? "").trim() || "Signed-in user";
}

/**
 * Save the card and its extract (with server edit stamps) in ONE statement, scoped by user.
 * `card` undefined leaves the stored card. Returns null when the job is not this user's.
 */
export async function saveJobCard(
  sql: Sql,
  userId: string,
  jobId: string,
  input: { card?: FieldCardData | null; extract?: unknown },
  at: string = new Date().toISOString(),
): Promise<ExtractSavePlan | null> {
  const rows = await sql<{ card_json: string | null; extract_json: string | null }>`
    select card_json, extract_json from projects where id = ${jobId} and user_id = ${userId}
  `;
  const row = rows[0];
  if (!row) return null;
  let storedCard: FieldCardData | null = null;
  try {
    storedCard = row.card_json ? (JSON.parse(row.card_json) as FieldCardData) : null;
  } catch {
    storedCard = null;
  }
  const card = input.card !== undefined ? input.card : storedCard;
  const plan = planExtractSave({
    storedCard,
    storedExtract: decodeSavedExtract(row.extract_json),
    card: input.card,
    extract: input.extract,
    editor: { by: await editorName(sql, userId), at },
  });
  const updated = await sql<{ id: string }>`
    update projects set
      card_json = ${card ? JSON.stringify(card) : null},
      extract_json = ${encodeSavedExtract(plan.extract)}
    where id = ${jobId} and user_id = ${userId}
    returning id
  `;
  return updated.length ? plan : null;
}

export function encodeSavedExtract(extract: SavedExtract | null): string | null {
  if (!extract) return null;
  const json = JSON.stringify(extract);
  if (json.length > SAVED_EXTRACT_MAX_CHARS) throw new Error("Saved source quotes are too large.");
  return json;
}

export function decodeSavedExtract(json: string | null | undefined): SavedExtract | null {
  if (!json) return null;
  try {
    return parseSavedExtract(JSON.parse(json));
  } catch {
    return null;
  }
}

/** Write a job's extract record. Scoped by user: another user's job id updates nothing. */
export async function writeJobExtract(sql: Sql, userId: string, jobId: string, extract: SavedExtract | null): Promise<boolean> {
  const rows = await sql<{ id: string }>`
    update projects set extract_json = ${encodeSavedExtract(extract)}
    where id = ${jobId} and user_id = ${userId}
    returning id
  `;
  return rows.length > 0;
}

/** Read a job's extract record, scoped by user. Missing job, other user's job, or none saved -> null. */
export async function readJobExtract(sql: Sql, userId: string, jobId: string): Promise<SavedExtract | null> {
  const rows = await sql<{ extract_json: string | null }>`
    select extract_json from projects where id = ${jobId} and user_id = ${userId}
  `;
  return decodeSavedExtract(rows[0]?.extract_json);
}

/**
 * Save rule for `extract` (CONTRACT.md): missing keeps what is stored (so autosave after a field
 * edit never wipes the quotes), `null` clears it, an object replaces it. Returns what was done.
 */
export async function applyExtractOnSave(
  sql: Sql,
  userId: string,
  jobId: string,
  extract: unknown,
): Promise<"kept" | "cleared" | "replaced"> {
  if (extract === undefined) return "kept";
  if (extract === null) {
    await writeJobExtract(sql, userId, jobId, null);
    return "cleared";
  }
  const parsed = parseSavedExtract(extract);
  if (!parsed) throw new Error("Saved source quotes are malformed.");
  await writeJobExtract(sql, userId, jobId, parsed);
  return "replaced";
}
