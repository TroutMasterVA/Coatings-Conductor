import { guestMigrateResult, NOT_YOUR_JOB_MESSAGE } from "@/lib/guest-import";
import { JOB_CLOSED_DELETE_MESSAGE, JOB_CLOSED_MESSAGE, statusFields, type CloseResult } from "@/lib/job-close";
import { DEFAULT_CALIBRATION, mergeCustomMitigation, type CustomMitigationInput } from "@/lib/learning";
import {
  defaultSite,
  importGuestWorkspace,
  type ProjectFull,
  type ProjectSummary,
  type WorkspacePayload,
} from "@/lib/project-store";
import type { Calibration, CustomMitigation, FieldCardData, FieldOutcome, SavedCard } from "@/lib/types";
import type { SiteContext } from "@/lib/mitigations";

const KEY = "fieldcard.projects.v1";

type GuestStore = {
  lastProjectId: string | null;
  projects: ProjectFull[];
  custom: CustomMitigation[];
};

type GuestImporter = (args: {
  data: { projects: ProjectFull[]; custom: CustomMitigation[]; lastProjectId?: string | null };
}) => Promise<{ imported: number; skipped: boolean }>;

function empty(): GuestStore {
  return { lastProjectId: null, projects: [], custom: [] };
}

function read(): GuestStore {
  if (typeof window === "undefined") return empty();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty();
    const parsed = JSON.parse(raw) as Partial<GuestStore>;
    return {
      lastProjectId: parsed.lastProjectId ?? null,
      projects: parsed.projects ?? [],
      custom: parsed.custom ?? [],
    };
  } catch {
    return empty();
  }
}

function write(store: GuestStore) {
  localStorage.setItem(KEY, JSON.stringify(store));
}

function summaryOf(p: ProjectFull): ProjectSummary {
  return {
    id: p.id,
    name: p.name,
    zip: p.zip,
    archived: p.archived,
    lastOpenedAt: p.lastOpenedAt,
    updatedAt: p.updatedAt,
    hasCard: Boolean(p.card),
    ...statusFields({ status: p.status, closed_at: p.closedAt ?? null, closed_by: p.closedBy ?? null }),
  };
}

export function guestLoadWorkspace(): WorkspacePayload {
  const s = read();
  return {
    lastProjectId: s.lastProjectId,
    projects: s.projects.map(summaryOf).sort((a, b) => Number(a.archived) - Number(b.archived)),
    custom: s.custom,
  };
}

export function guestDump(): GuestStore {
  return read();
}

export function guestClear() {
  write(empty());
}

export function guestHasData(): boolean {
  const s = read();
  return s.projects.length > 0 || s.custom.length > 0;
}

/** First sign-in with an empty account lifts this device’s jobs. Account jobs win if both exist. */
export async function migrateGuestToAccount(
  importer: GuestImporter = importGuestWorkspace,
): Promise<"imported" | "skipped" | "empty"> {
  const dump = read();
  const guestHasData = dump.projects.length > 0 || dump.custom.length > 0;
  if (!guestHasData) return "empty";
  const result = await importer({
    data: {
      projects: dump.projects,
      custom: dump.custom,
      lastProjectId: dump.lastProjectId,
    },
  });
  const decided = guestMigrateResult({ guestHasData: true, skipped: result.skipped });
  if (decided.clearGuest) write(empty());
  return decided.outcome;
}

export function guestCreateProject(name: string, zip: string, seed?: Partial<ProjectFull>): ProjectFull {
  const trimmed = name.trim();
  const zipped = zip.replace(/\D/g, "").slice(0, 5);
  if (!trimmed) throw new Error("Project name is required.");
  if (zipped.length !== 5) throw new Error("Enter a 5-digit US ZIP.");
  const now = new Date().toISOString();
  const full: ProjectFull = {
    id: crypto.randomUUID(),
    name: trimmed,
    zip: zipped,
    archived: false,
    lastOpenedAt: now,
    updatedAt: now,
    hasCard: Boolean(seed?.card),
    status: "open",
    closedAt: null,
    closedBy: null,
    calibration: seed?.calibration ?? DEFAULT_CALIBRATION,
    site: seed?.site ?? defaultSite(),
    card: seed?.card ?? null,
    pdsText: seed?.pdsText ?? "",
    recents: seed?.recents ?? [],
    outcomes: seed?.outcomes ?? [],
  };
  const s = read();
  s.projects = [full, ...s.projects];
  s.lastProjectId = full.id;
  write(s);
  return full;
}

export function guestOpenProject(id: string): ProjectFull {
  const s = read();
  const found = s.projects.find((p) => p.id === id && !p.archived);
  if (!found) throw new Error("Project not found.");
  const now = new Date().toISOString();
  const next = { ...found, lastOpenedAt: now };
  s.projects = s.projects.map((p) => (p.id === id ? next : p));
  s.lastProjectId = id;
  write(s);
  return next;
}

export function guestSaveProject(input: {
  id: string;
  name?: string;
  zip?: string;
  calibration?: Calibration;
  site?: SiteContext;
  card?: FieldCardData | null;
  pdsText?: string;
  recents?: SavedCard[];
  outcomes?: FieldOutcome[];
}): ProjectSummary {
  const s = read();
  const found = s.projects.find((p) => p.id === input.id);
  if (!found) throw new Error("Project not found.");
  // Mirrors the server: a closed job is read-only.
  if (found.status === "closed") throw new Error(JOB_CLOSED_MESSAGE);
  const now = new Date().toISOString();
  const next: ProjectFull = {
    ...found,
    name: input.name?.trim() || found.name,
    zip: input.zip != null ? input.zip.replace(/\D/g, "").slice(0, 5) : found.zip,
    calibration: input.calibration ?? found.calibration,
    site: input.site ?? found.site,
    card: input.card !== undefined ? input.card : found.card,
    pdsText: input.pdsText ?? found.pdsText,
    recents: input.recents ?? found.recents,
    outcomes: input.outcomes ?? found.outcomes,
    updatedAt: now,
    hasCard: Boolean(input.card !== undefined ? input.card : found.card),
  };
  s.projects = s.projects.map((p) => (p.id === input.id ? next : p));
  write(s);
  return summaryOf(next);
}

/** Guest mirror of closeProject: idempotent, no reopen. No account, so "closed by" is this device. */
export function guestCloseProject(id: string): CloseResult {
  const s = read();
  const found = s.projects.find((p) => p.id === id);
  if (!found) throw new Error(NOT_YOUR_JOB_MESSAGE);
  if (found.status === "closed" && found.closedAt) {
    return { ok: true, status: "closed", closedAt: found.closedAt, closedBy: found.closedBy ?? "This device" };
  }
  const now = new Date().toISOString();
  const next: ProjectFull = { ...found, status: "closed", closedAt: now, closedBy: "This device", updatedAt: now };
  s.projects = s.projects.map((p) => (p.id === id ? next : p));
  write(s);
  return { ok: true, status: "closed", closedAt: now, closedBy: "This device" };
}

export function guestArchiveProject(id: string, archived: boolean) {
  const s = read();
  s.projects = s.projects.map((p) => (p.id === id ? { ...p, archived, updatedAt: new Date().toISOString() } : p));
  if (archived && s.lastProjectId === id) s.lastProjectId = null;
  write(s);
}

export function guestDeleteProject(id: string) {
  const s = read();
  // Mirrors the server: a closed job is a record and can't be deleted (archive stays allowed).
  if (s.projects.find((p) => p.id === id)?.status === "closed") throw new Error(JOB_CLOSED_DELETE_MESSAGE);
  s.projects = s.projects.filter((p) => p.id !== id);
  if (s.lastProjectId === id) s.lastProjectId = null;
  write(s);
}

export function guestSaveCustom(input: CustomMitigationInput): CustomMitigation {
  const s = read();
  const { list, saved } = mergeCustomMitigation(s.custom, input);
  s.custom = list;
  write(s);
  return saved;
}
