/**
 * Job closeout, screen half (CONTRACT.md "Job closeout (smallest version)", Lead ruling 3:57 PM ET).
 * Pure helpers only, so node:test can load them. The server enforces closed = read-only (BE);
 * everything here is display and client-side courtesy, never authorization.
 */
import { NOT_YOUR_JOB_MESSAGE } from "./guest-import.ts";
import { JOB_CLOSED_DELETE_MESSAGE, JOB_CLOSED_MESSAGE } from "./job-close.ts";

/** BE's exported constants (#37 job-close.ts); one source for the text. */
export { JOB_CLOSED_CODE, JOB_CLOSED_DELETE_MESSAGE, JOB_CLOSED_MESSAGE } from "./job-close.ts";

export type JobStatus = "open" | "closed";

/** Fields `openProject` and the job list carry (BE 0004). Optional here so pre-0004 data reads as open. */
export type JobStatusFields = {
  status?: JobStatus;
  closedAt?: string | null;
  closedBy?: string | null;
};

export type JobStatusView = { status: JobStatus; closedAt: string | null; closedBy: string | null };

export const CLOSE_CONFIRM_TEXT = "Close this job? It becomes read-only.";
export const CLOSE_JOB_LABEL = "Close job";
export const CANCEL_LABEL = "Cancel";

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v : null;
}

/** Normalize whatever the server or local store gave us. Anything but "closed" is open. */
export function jobStatusOf(p: JobStatusFields | null | undefined): JobStatusView {
  if (p?.status !== "closed") return { status: "open", closedAt: null, closedBy: null };
  return { status: "closed", closedAt: str(p.closedAt), closedBy: str(p.closedBy) };
}

export function isClosed(p: JobStatusFields | null | undefined): boolean {
  return jobStatusOf(p).status === "closed";
}

/** "Oct 18, 2026" in the viewer's zone; null when missing or not a date. */
export function formatClosedDate(at: string | null | undefined): string | null {
  if (!at) return null;
  const d = new Date(at);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/** Badge text: "Closed · Oct 18, 2026 · by Isaiah Chester"; parts drop out when missing. */
export function closedBadgeText(view: {
  closedAt: string | null;
  closedBy: string | null;
}): string {
  const date = formatClosedDate(view.closedAt);
  return ["Closed", date, view.closedBy ? `by ${view.closedBy}` : null].filter(Boolean).join(" · ");
}

/** Autosave runs only for an open, loaded job on the job screen. */
export function canAutosave(input: {
  projectId: string | null;
  hydrated: boolean;
  mode: string;
  closed: boolean;
}): boolean {
  return Boolean(input.projectId) && input.hydrated && input.mode === "job" && !input.closed;
}

function messageOf(err: unknown): string | null {
  if (err instanceof Error) return err.message;
  if (
    err &&
    typeof err === "object" &&
    typeof (err as { message?: unknown }).message === "string"
  ) {
    return (err as { message: string }).message;
  }
  return null;
}

/** Thrown by saveProject (and any field edit) on a closed job. Matched by text, like NOT_YOUR_JOB_MESSAGE. */
export function isJobClosedError(err: unknown): boolean {
  return messageOf(err) === JOB_CLOSED_MESSAGE;
}

export type CloseOutcome =
  | { kind: "closed"; closedAt: string | null; closedBy: string | null }
  | { kind: "unauthenticated" }
  | { kind: "not-found"; message: string }
  | { kind: "error"; message: string };

/**
 * Map closeProject's result. Server style (same as archiveProject): returns
 * `{ ok: true, status: "closed", closedAt, closedBy }`, throws "Unauthorized" or NOT_YOUR_JOB_MESSAGE.
 * Idempotent: closing an already-closed job is still `closed`.
 */
export function mapCloseResult(res: unknown): CloseOutcome {
  const r = (res && typeof res === "object" ? res : {}) as {
    ok?: unknown;
    status?: unknown;
    closedAt?: unknown;
    closedBy?: unknown;
  };
  if (r.ok === true && r.status === "closed") {
    return { kind: "closed", closedAt: str(r.closedAt), closedBy: str(r.closedBy) };
  }
  return { kind: "error", message: "Could not close this job. It is still open." };
}

export function mapCloseError(err: unknown): CloseOutcome {
  const msg = messageOf(err);
  if (msg === "Unauthorized") return { kind: "unauthenticated" };
  if (msg === NOT_YOUR_JOB_MESSAGE) return { kind: "not-found", message: msg };
  // Already closed elsewhere: the job is closed either way.
  if (msg === JOB_CLOSED_MESSAGE) return { kind: "closed", closedAt: null, closedBy: null };
  return {
    kind: "error",
    message: msg?.trim() ? msg : "Could not close this job. It is still open.",
  };
}

/** PO ruling: a closed job can be archived but not deleted. Archived rows keep Restore. */
export function rowActions(p: JobStatusFields & { archived: boolean }): {
  open: boolean;
  archive: boolean;
  restore: boolean;
  remove: boolean;
} {
  const closed = isClosed(p);
  return { open: !p.archived, archive: !p.archived, restore: p.archived, remove: !closed };
}

/** Delete refused: the server's (or guest guard's) text, so a closed job reads "can't be deleted". */
export function deleteErrorMessage(err: unknown): string {
  const msg = messageOf(err);
  if (msg === JOB_CLOSED_DELETE_MESSAGE) return JOB_CLOSED_DELETE_MESSAGE;
  return msg?.trim() ? msg : "Could not remove project.";
}
