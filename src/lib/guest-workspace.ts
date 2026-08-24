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
export async function migrateGuestToAccount(): Promise<"imported" | "skipped" | "empty"> {
  const dump = read();
  if (dump.projects.length === 0 && dump.custom.length === 0) return "empty";
  const result = await importGuestWorkspace({
    data: {
      projects: dump.projects,
      custom: dump.custom,
      lastProjectId: dump.lastProjectId,
    },
  });
  if (result.skipped) return "skipped";
  write(empty());
  return "imported";
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

export function guestArchiveProject(id: string, archived: boolean) {
  const s = read();
  s.projects = s.projects.map((p) => (p.id === id ? { ...p, archived, updatedAt: new Date().toISOString() } : p));
  if (archived && s.lastProjectId === id) s.lastProjectId = null;
  write(s);
}

export function guestDeleteProject(id: string) {
  const s = read();
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
