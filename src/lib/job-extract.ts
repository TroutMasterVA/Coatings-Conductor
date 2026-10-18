import type { SavedExtract } from "@/lib/extract/provider";
import type { Sql } from "@/lib/db";

/** Saved extract records are capped so a client cannot park arbitrary data on a job. */
export const SAVED_EXTRACT_MAX_CHARS = 1_000_000;

function isQuote(v: unknown): boolean {
  if (v === "not-stated") return true;
  if (!v || typeof v !== "object") return false;
  const q = v as { quote?: unknown; page?: unknown };
  return typeof q.quote === "string" && (q.page === undefined || (Number.isInteger(q.page) && (q.page as number) > 0));
}

/**
 * Validate an `extract` object coming from the client (or the DB). Returns null when it is
 * missing or malformed; never throws. Unknown keys are dropped.
 */
export function parseSavedExtract(raw: unknown): SavedExtract | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (r.provider !== "azure" && r.provider !== "on-device") return null;
  if (!r.provenance || typeof r.provenance !== "object" || Array.isArray(r.provenance)) return null;
  const provenance: SavedExtract["provenance"] = {};
  for (const [k, v] of Object.entries(r.provenance as Record<string, unknown>)) {
    if (!isQuote(v)) return null;
    provenance[k.slice(0, 200)] =
      v === "not-stated"
        ? "not-stated"
        : (() => {
            const q = v as { quote: string; page?: number };
            return q.page ? { page: q.page, quote: q.quote.slice(0, 500) } : { quote: q.quote.slice(0, 500) };
          })();
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
