import type { Sql } from "./db.ts";
import { statusFields, type JobStatusFields } from "./job-close.ts";

/** Raw `projects` row as the server reads it. */
export type ProjectRow = {
  id: string;
  name: string;
  zip: string;
  archived: boolean;
  calibration_json: string;
  site_json: string;
  card_json: string | null;
  pds_text: string;
  recents_json: string;
  outcomes_json: string;
  last_opened_at: string;
  updated_at: string;
  status: string;
  closed_at: string | null;
  closed_by: string | null;
};

export type ProjectRowSummary = {
  id: string;
  name: string;
  zip: string;
  archived: boolean;
  lastOpenedAt: string;
  updatedAt: string;
  hasCard: boolean;
} & JobStatusFields;

export function toRowSummary(row: ProjectRow): ProjectRowSummary {
  return {
    id: row.id,
    name: row.name,
    zip: row.zip,
    archived: Boolean(row.archived),
    lastOpenedAt: row.last_opened_at,
    updatedAt: row.updated_at,
    hasCard: Boolean(row.card_json),
    ...statusFields(row),
  };
}

/** The caller's jobs for the list (includes status/closedAt/closedBy). */
export async function listProjectRows(sql: Sql, userId: string): Promise<ProjectRow[]> {
  return sql<ProjectRow>`
    select id, name, zip, archived, calibration_json, site_json, card_json, pds_text,
           recents_json, outcomes_json, last_opened_at, updated_at, status, closed_at, closed_by
    from projects
    where user_id = ${userId}
    order by archived asc, last_opened_at desc
  `;
}

/** Open (and stamp last_opened_at). Closed jobs still open: a closed job is a readable record. */
export async function openProjectRow(
  sql: Sql,
  userId: string,
  id: string,
  now: string,
): Promise<ProjectRow | null> {
  const rows = await sql<ProjectRow>`
    update projects
    set last_opened_at = ${now}
    where id = ${id} and user_id = ${userId} and archived = false
    returning id, name, zip, archived, calibration_json, site_json, card_json, pds_text,
              recents_json, outcomes_json, last_opened_at, updated_at, status, closed_at, closed_by
  `;
  return rows[0] ?? null;
}

/** Read the caller's row for a save. */
export async function readProjectRow(
  sql: Sql,
  userId: string,
  id: string,
): Promise<ProjectRow | null> {
  const rows = await sql<ProjectRow>`
    select id, name, zip, archived, calibration_json, site_json, card_json, pds_text,
           recents_json, outcomes_json, last_opened_at, updated_at, status, closed_at, closed_by
    from projects where id = ${id} and user_id = ${userId}
  `;
  return rows[0] ?? null;
}
