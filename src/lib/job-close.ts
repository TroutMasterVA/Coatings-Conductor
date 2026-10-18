import type { Sql } from "./db.ts";
import { NOT_YOUR_JOB_MESSAGE } from "./guest-import.ts";

/**
 * Job closeout (CONTRACT.md "Job closeout"). A closed job is a record: it still
 * opens, reads and prints. Every write path checks `status = 'open'` in the same
 * WHERE clause as the write, so a save cannot slip in after a close.
 */
export type JobStatus = "open" | "closed";

/** Thrown by saveProject (and any field edit) on a closed job. */
export const JOB_CLOSED_MESSAGE = "This job is closed and can't be changed.";

/** Thrown by deleteProject on a closed job (PO ruling: a closed job is a record; archive stays allowed). */
export const JOB_CLOSED_DELETE_MESSAGE = "This job is closed and can't be deleted.";

/** Error code for envelope-style replies (extractSheet attach). */
export const JOB_CLOSED_CODE = "JOB_CLOSED" as const;

export type JobStatusFields = {
  status: JobStatus;
  closedAt: string | null;
  closedBy: string | null;
};

export type JobStatusRow = {
  status?: string | null;
  closed_at?: string | Date | null;
  closed_by?: string | null;
};

function iso(value: string | Date | null | undefined): string | null {
  if (value == null) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toISOString();
}

/** Row -> API fields. Anything but 'closed' reads as open (pre-0004 rows, guest data). */
export function statusFields(row: JobStatusRow): JobStatusFields {
  const closed = row.status === "closed";
  return {
    status: closed ? "closed" : "open",
    closedAt: closed ? iso(row.closed_at) : null,
    closedBy: closed ? (row.closed_by ?? null) : null,
  };
}

/** "Closed by" is the session user's display name, falling back to email. */
export function closedByLabel(
  user: { name?: string | null; email?: string | null } | null | undefined,
): string {
  const name = user?.name?.trim();
  if (name) return name;
  const email = user?.email?.trim();
  if (email) return email;
  return "Unknown user";
}

async function lookupClosedBy(sql: Sql, userId: string): Promise<string> {
  try {
    const rows = await sql<{ name: string | null; email: string | null }>`
      select "name", "email" from "user" where "id" = ${userId}
    `;
    return closedByLabel(rows[0]);
  } catch {
    return closedByLabel(null);
  }
}

export type CloseResult = { ok: true; status: "closed"; closedAt: string; closedBy: string };

/**
 * Owner-only, idempotent close. A non-owner or missing job throws
 * NOT_YOUR_JOB_MESSAGE (same as isolation). Closing a closed job returns the
 * original closedAt/closedBy unchanged.
 */
export async function closeJob(
  sql: Sql,
  userId: string,
  id: string,
  now: Date = new Date(),
): Promise<CloseResult> {
  const by = await lookupClosedBy(sql, userId);
  const at = now.toISOString();
  const updated = await sql<JobStatusRow>`
    update projects
    set status = 'closed', closed_at = ${at}, closed_by = ${by}, updated_at = ${at}
    where id = ${id} and user_id = ${userId} and status = 'open'
    returning status, closed_at, closed_by
  `;
  const row = updated[0] ?? (await readJobStatusRow(sql, userId, id));
  if (!row) throw new Error(NOT_YOUR_JOB_MESSAGE);
  const fields = statusFields(row);
  return {
    ok: true,
    status: "closed",
    closedAt: fields.closedAt ?? at,
    closedBy: fields.closedBy ?? by,
  };
}

async function readJobStatusRow(
  sql: Sql,
  userId: string,
  id: string,
): Promise<JobStatusRow | null> {
  const rows = await sql<JobStatusRow>`
    select status, closed_at, closed_by from projects where id = ${id} and user_id = ${userId}
  `;
  return rows[0] ?? null;
}

/** Status of the caller's job, or null when it isn't theirs / doesn't exist. */
export async function readJobStatus(
  sql: Sql,
  userId: string,
  id: string,
): Promise<JobStatusFields | null> {
  const row = await readJobStatusRow(sql, userId, id);
  return row ? statusFields(row) : null;
}

/** For envelope-style callers (extractSheet attach, #26): true when the caller's job is closed. */
export async function isJobClosed(sql: Sql, userId: string, id: string): Promise<boolean> {
  return (await readJobStatus(sql, userId, id))?.status === "closed";
}

/**
 * After a guarded write matched zero rows, decide why: closed job -> JOB_CLOSED_MESSAGE,
 * otherwise not the caller's job -> NOT_YOUR_JOB_MESSAGE.
 */
export async function throwWriteRefused(sql: Sql, userId: string, id: string): Promise<never> {
  const status = await readJobStatus(sql, userId, id);
  if (status?.status === "closed") throw new Error(JOB_CLOSED_MESSAGE);
  throw new Error(NOT_YOUR_JOB_MESSAGE);
}

export type ProjectWriteValues = {
  name: string;
  zip: string;
  calibrationJson: string;
  siteJson: string;
  cardJson: string | null;
  pdsText: string;
  recentsJson: string;
  outcomesJson: string;
};

/**
 * The saveProject write. Scoped by owner AND `status = 'open'` in one statement,
 * so a close that lands first makes this match nothing and the save is refused.
 */
export async function writeOpenProject<R>(
  sql: Sql,
  userId: string,
  id: string,
  v: ProjectWriteValues,
  now: string,
): Promise<R> {
  const rows = await sql<R>`
    update projects set
      name = ${v.name},
      zip = ${v.zip},
      calibration_json = ${v.calibrationJson},
      site_json = ${v.siteJson},
      card_json = ${v.cardJson},
      pds_text = ${v.pdsText},
      recents_json = ${v.recentsJson},
      outcomes_json = ${v.outcomesJson},
      updated_at = ${now}
    where id = ${id} and user_id = ${userId} and status = 'open'
    returning id, name, zip, archived, calibration_json, site_json, card_json, extract_json, pds_text,
              recents_json, outcomes_json, last_opened_at, updated_at, status, closed_at, closed_by
  `;
  if (!rows[0]) return throwWriteRefused(sql, userId, id);
  return rows[0];
}

/**
 * The deleteProject write. Owner AND `status = 'open'` are in the one DELETE, so a
 * close that lands first makes it match nothing. Ownership is decided first: a
 * non-owner or missing job gets NOT_YOUR_JOB_MESSAGE, never a hint that it exists.
 */
export async function deleteOpenProject(sql: Sql, userId: string, id: string): Promise<void> {
  const rows = await sql<{ id: string }>`
    delete from projects where id = ${id} and user_id = ${userId} and status = 'open' returning id
  `;
  if (rows[0]) return;
  const status = await readJobStatus(sql, userId, id);
  if (!status) throw new Error(NOT_YOUR_JOB_MESSAGE);
  if (status.status === "closed") throw new Error(JOB_CLOSED_DELETE_MESSAGE);
  throw new Error(NOT_YOUR_JOB_MESSAGE);
}
