import { NOT_YOUR_JOB_MESSAGE } from "@/lib/guest-import";
import { GUEST_CLOSED_BY, JOB_CLOSED_DELETE_MESSAGE, JOB_CLOSED_MESSAGE, statusFields, type CloseResult } from "@/lib/job-close";
import { guestTrust, planExtractSave } from "@/lib/job-extract";
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
  data: { projects: ProjectFull[]; custom: CustomMitigation[]; lastProjectId?: string | null; claim?: boolean };
}) => Promise<{ imported: number; skipped: boolean; importedIds?: string[]; customOk?: boolean }>;

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

/** How many device (guest) jobs are waiting on this browser. */
export function guestJobCount(): number {
  return read().projects.length;
}

/** The explicit claim prompt. Nothing moves into an account without a yes to this. */
export function claimPromptText(n: number, names: string[] = []): string {
  const shown = names.slice(0, 3).map((x) => x.trim()).filter(Boolean);
  const more = names.length > shown.length ? `, +${names.length - shown.length} more` : "";
  const list = shown.length ? ` (${shown.join(", ")}${more})` : "";
  return `This browser has ${n} job${n === 1 ? "" : "s"} made while signed out${list}. They may not be yours. Move them into your account?`;
}

/** Device flag: the user chose "Not now / don't ask again on this device". */
export const CLAIM_DONT_ASK_KEY = "fieldcard.guestClaim.dontAsk.v1";
export type ClaimChoice = "move" | "not-now" | "dont-ask";

/** The flag is per account: one user's "don't ask again" never silences the prompt for another. */
export function claimDontAskKey(accountId: string): string {
  return `${CLAIM_DONT_ASK_KEY}:${accountId}`;
}

export function guestClaimSuppressed(accountId: string): boolean {
  try {
    return typeof window !== "undefined" && localStorage.getItem(claimDontAskKey(accountId)) === "1";
  } catch {
    return false;
  }
}

/** Names of the device jobs, newest first, for the prompt. */
export function guestJobNames(): string[] {
  return read().projects.map((p) => p.name);
}

/**
 * A signed-in list is only that account's server jobs. Device (guest) jobs are never shown there,
 * even if a row with a device id slipped into the payload; they stay hidden until claimed.
 */
export function signedInJobList<T extends { id: string }>(serverJobs: T[]): T[] {
  const device = new Set(read().projects.map((p) => p.id));
  return serverJobs.filter((p) => p && !device.has(p.id));
}

export type ClaimResult = {
  /** "busy": another claim (this tab or another tab) is already asking or moving; nothing was asked. */
  outcome: "declined" | "suppressed" | "empty" | "imported" | "partial" | "busy";
  imported: number;
  kept: number;
};

/** One claim per account at a time in this tab: a second caller shares the first one's result. */
const inflightClaims = new Map<string, Promise<ClaimResult>>();

/** Cross-tab marker: a tab is showing the move prompt or moving jobs for this account. */
export const CLAIM_LOCK_KEY = "fieldcard.guestClaim.inflight.v1";
/** A tab that closed mid-claim can't leave the lock forever. */
export const CLAIM_LOCK_TTL_MS = 2 * 60 * 1000;
/** Per tab (sessionStorage): "Not now" was answered for this account; don't ask again until a new tab. */
export const CLAIM_NOT_NOW_KEY = "fieldcard.guestClaim.notNow.v1";

function claimLockKey(accountId: string): string {
  return `${CLAIM_LOCK_KEY}:${accountId}`;
}

function takeClaimLock(accountId: string, now: number): boolean {
  try {
    const held = Number(localStorage.getItem(claimLockKey(accountId)) ?? "");
    if (Number.isFinite(held) && held > 0 && now - held < CLAIM_LOCK_TTL_MS) return false;
    localStorage.setItem(claimLockKey(accountId), String(now));
  } catch {
    // No storage: the server still adds each device job at most once.
  }
  return true;
}

function releaseClaimLock(accountId: string) {
  try {
    localStorage.removeItem(claimLockKey(accountId));
  } catch {
    // ignore
  }
}

function tabSession(): Storage | null {
  try {
    return typeof sessionStorage !== "undefined" ? sessionStorage : null;
  } catch {
    return null;
  }
}

function notNowThisTab(accountId: string): boolean {
  return Boolean(accountId) && tabSession()?.getItem(`${CLAIM_NOT_NOW_KEY}:${accountId}`) === "1";
}

function rememberNotNow(accountId: string) {
  if (!accountId) return;
  try {
    tabSession()?.setItem(`${CLAIM_NOT_NOW_KEY}:${accountId}`, "1");
  } catch {
    // ignore
  }
}

/**
 * Claim device jobs into the signed-in account, only when `confirm` says yes. Declining imports
 * nothing and leaves the device copy as-is (hidden while signed in). On a full import the device
 * store is cleared; on a partial one only the jobs that did not import are kept on the device.
 */
export function claimGuestJobs(
  confirm: (n: number, names: string[]) => boolean | ClaimChoice | Promise<boolean | ClaimChoice>,
  importer: GuestImporter = importGuestWorkspace,
  accountId = "",
): Promise<ClaimResult> {
  // A remount, a re-run effect or a double click while a claim is open joins it: one prompt, one request.
  const running = inflightClaims.get(accountId);
  if (running) return running;
  const run = runClaim(confirm, importer, accountId).finally(() => inflightClaims.delete(accountId));
  inflightClaims.set(accountId, run);
  return run;
}

async function runClaim(
  confirm: (n: number, names: string[]) => boolean | ClaimChoice | Promise<boolean | ClaimChoice>,
  importer: GuestImporter,
  accountId: string,
): Promise<ClaimResult> {
  const dump = read();
  const n = dump.projects.length;
  if (n === 0) return { outcome: "empty", imported: 0, kept: 0 };
  if (accountId && guestClaimSuppressed(accountId)) return { outcome: "suppressed", imported: 0, kept: n };
  if (notNowThisTab(accountId)) return { outcome: "declined", imported: 0, kept: n };
  if (accountId && !takeClaimLock(accountId, Date.now())) return { outcome: "busy", imported: 0, kept: n };
  try {
    return await askAndMove(dump, confirm, importer, accountId);
  } finally {
    if (accountId) releaseClaimLock(accountId);
  }
}

async function askAndMove(
  dump: GuestStore,
  confirm: (n: number, names: string[]) => boolean | ClaimChoice | Promise<boolean | ClaimChoice>,
  importer: GuestImporter,
  accountId: string,
): Promise<ClaimResult> {
  const n = dump.projects.length;
  const choice = await confirm(n, dump.projects.map((p) => p.name));
  if (choice === "dont-ask") {
    // Imports nothing; device jobs stay hidden while signed in; this device is not asked again.
    if (accountId) localStorage.setItem(claimDontAskKey(accountId), "1");
    return { outcome: "declined", imported: 0, kept: n };
  }
  if (choice !== true && choice !== "move") {
    rememberNotNow(accountId);
    return { outcome: "declined", imported: 0, kept: n };
  }
  let res: Awaited<ReturnType<GuestImporter>>;
  try {
    res = await importer({
      data: { projects: dump.projects, custom: dump.custom, lastProjectId: dump.lastProjectId, claim: true },
    });
  } catch {
    return { outcome: "partial", imported: 0, kept: n };
  }
  const done = new Set(res.skipped ? [] : (res.importedIds ?? []));
  const left = dump.projects.filter((p) => !done.has(p.id));
  const customLeft = res.customOk ? [] : dump.custom;
  if (left.length === 0 && customLeft.length === 0) {
    write(empty());
    return { outcome: "imported", imported: n, kept: 0 };
  }
  write({
    lastProjectId: left.some((p) => p.id === dump.lastProjectId) ? dump.lastProjectId : null,
    projects: left,
    custom: customLeft,
  });
  return { outcome: left.length ? "partial" : "imported", imported: n - left.length, kept: left.length };
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
    extract: seed?.card ? (seed.extract ?? null) : null,
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

/** `edited.by` on a guest (signed-out, this-device) job. */
export const GUEST_EDITOR = "Guest (this device)";

export function guestSaveProject(input: {
  id: string;
  name?: string;
  zip?: string;
  calibration?: Calibration;
  site?: SiteContext;
  card?: FieldCardData | null;
  extract?: ProjectFull["extract"];
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
  // Same edit-stamp rule as the server, on this device only (no account, so "by" is the guest).
  const plan = planExtractSave({
    storedCard: found.card,
    storedExtract: found.extract ?? null,
    card: input.card,
    extract: input.extract,
    editor: { by: GUEST_EDITOR, at: now },
    trust: (incoming, card, stored) => guestTrust(incoming, card, stored, found.card),
  });
  const next: ProjectFull = {
    ...found,
    name: input.name?.trim() || found.name,
    zip: input.zip != null ? input.zip.replace(/\D/g, "").slice(0, 5) : found.zip,
    calibration: input.calibration ?? found.calibration,
    site: input.site ?? found.site,
    card: input.card !== undefined ? input.card : found.card,
    extract: plan.extract,
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
    return { ok: true, status: "closed", closedAt: found.closedAt, closedBy: found.closedBy ?? GUEST_CLOSED_BY };
  }
  const now = new Date().toISOString();
  const next: ProjectFull = { ...found, status: "closed", closedAt: now, closedBy: GUEST_CLOSED_BY, updatedAt: now };
  s.projects = s.projects.map((p) => (p.id === id ? next : p));
  write(s);
  return { ok: true, status: "closed", closedAt: now, closedBy: GUEST_CLOSED_BY };
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
