import type { Sql } from "./db.ts";
import { NOT_YOUR_JOB_MESSAGE } from "./guest-import.ts";
import { openProjectRow, readProjectRow, type ProjectRow } from "./project-rows.ts";

/** Sets the HTTP status of the current server-function response (injected so tests need no server). */
export type SetStatus = (status: number) => void;

/** HTTP status for "not your project" and "no such project": the same answer for both. */
export const PROJECT_NOT_FOUND_STATUS = 404;

/**
 * One answer for "belongs to another user" and "does not exist": HTTP 404 and the same
 * plain error (NOT_YOUR_JOB_MESSAGE), with no project data. Callers reach this only after a
 * single lookup scoped by `id AND user_id`, so the two cases take the same path.
 */
export function throwProjectNotFound(setStatus: SetStatus): never {
  setStatus(PROJECT_NOT_FOUND_STATUS);
  const err = new Error(NOT_YOUR_JOB_MESSAGE);
  // The error is serialized to the browser: drop the stack so the body is the message only
  // (identical for both cases, and no server file paths or line numbers).
  delete (err as { stack?: string }).stack;
  throw err;
}

/** Open (and stamp last_opened_at on) the caller's own, non-archived project, or 404. */
export async function openOwnedProject(
  sql: Sql,
  userId: string,
  id: string,
  now: string,
  setStatus: SetStatus,
): Promise<ProjectRow> {
  const row = await openProjectRow(sql, userId, id, now);
  return row ?? throwProjectNotFound(setStatus);
}

/** Read the caller's own project for a save, or 404. */
export async function readOwnedProject(sql: Sql, userId: string, id: string, setStatus: SetStatus): Promise<ProjectRow> {
  const row = await readProjectRow(sql, userId, id);
  return row ?? throwProjectNotFound(setStatus);
}
