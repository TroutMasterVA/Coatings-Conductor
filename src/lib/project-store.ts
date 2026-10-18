import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { closeJob, deleteOpenProject, statusFields, throwWriteRefused, writeOpenProject, type JobStatus } from "@/lib/job-close";
import { listProjectRows, openProjectRow, readProjectRow, toRowSummary, type ProjectRow } from "@/lib/project-rows";
import { accountRejectsGuestImport, NOT_YOUR_JOB_MESSAGE, remapGuestImportInput } from "@/lib/guest-import";
import { DEFAULT_CALIBRATION, mergeCustomMitigation, type CustomMitigationInput } from "@/lib/learning";
import type { SiteContext, SubstrateId } from "@/lib/mitigations";
import type { Calibration, CustomMitigation, FieldCardData, FieldOutcome, SavedCard } from "@/lib/types";

export type ProjectSummary = {
  id: string;
  name: string;
  zip: string;
  archived: boolean;
  lastOpenedAt: string;
  updatedAt: string;
  hasCard: boolean;
  /** Closeout (CONTRACT.md "Job closeout"). Optional on the type so older guest data still loads. */
  status?: JobStatus;
  closedAt?: string | null;
  closedBy?: string | null;
};

export { JOB_CLOSED_DELETE_MESSAGE, JOB_CLOSED_MESSAGE } from "@/lib/job-close";

export type ProjectFull = ProjectSummary & {
  calibration: Calibration;
  site: SiteContext;
  card: FieldCardData | null;
  pdsText: string;
  recents: SavedCard[];
  outcomes: FieldOutcome[];
};

export type WorkspacePayload = {
  lastProjectId: string | null;
  projects: ProjectSummary[];
  custom: CustomMitigation[];
};

function parseJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function defaultSite(): SiteContext {
  return { substrate: "bare_steel", mitigations: [], customMitigationIds: [] };
}

function toSummary(row: ProjectRow): ProjectSummary {
  return toRowSummary(row);
}

function toFull(row: ProjectRow): ProjectFull {
  const site = parseJson<SiteContext>(row.site_json, defaultSite());
  return {
    ...toSummary(row),
    calibration: { ...DEFAULT_CALIBRATION, ...parseJson<Partial<Calibration>>(row.calibration_json, {}) },
    site: {
      substrate: (site.substrate ?? "bare_steel") as SubstrateId,
      mitigations: site.mitigations ?? [],
      customMitigationIds: site.customMitigationIds ?? [],
      moistureTolerant: site.moistureTolerant,
      discipline: site.discipline,
      bodies: site.bodies,
    },
    card: parseJson<FieldCardData | null>(row.card_json, null),
    pdsText: row.pds_text ?? "",
    recents: parseJson<SavedCard[]>(row.recents_json, []),
    outcomes: parseJson<FieldOutcome[]>(row.outcomes_json, []),
  };
}

async function listRows(userId: string) {
  return listProjectRows(await getSql(), userId);
}

async function loadCustom(userId: string) {
  const sql = await getSql();
  const rows = await sql<{ payload_json: string }>`
    select payload_json from custom_mitigations
    where user_id = ${userId}
    order by updated_at desc
  `;
  return rows.map((r) => parseJson<CustomMitigation | null>(r.payload_json, null)).filter((c): c is CustomMitigation => Boolean(c));
}

export const loadWorkspace = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<WorkspacePayload> => {
    const sql = await getSql();
    const [projects, custom, prefs] = await Promise.all([
      listRows(context.userId),
      loadCustom(context.userId),
      sql<{ last_project_id: string | null }>`select last_project_id from user_prefs where user_id = ${context.userId}`,
    ]);
    return {
      lastProjectId: prefs[0]?.last_project_id ?? null,
      projects: projects.map(toSummary),
      custom,
    };
  });

export const createProject = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { name: string; zip: string; seed?: Partial<ProjectFull> }) => {
    const name = input.name.trim();
    const zip = input.zip.replace(/\D/g, "").slice(0, 5);
    if (!name) throw new Error("Project name is required.");
    if (zip.length !== 5) throw new Error("Enter a 5-digit US ZIP.");
    return { name, zip, seed: input.seed };
  })
  .handler(async ({ context, data }): Promise<ProjectFull> => {
    const sql = await getSql();
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const cal = data.seed?.calibration ?? DEFAULT_CALIBRATION;
    const site = data.seed?.site ?? defaultSite();
    const card = data.seed?.card ?? null;
    const pdsText = data.seed?.pdsText ?? "";
    const recents = data.seed?.recents ?? [];
    const outcomes = data.seed?.outcomes ?? [];
    await sql`
      insert into projects (
        id, user_id, name, zip, archived, calibration_json, site_json, card_json, pds_text,
        recents_json, outcomes_json, created_at, updated_at, last_opened_at
      ) values (
        ${id}, ${context.userId}, ${data.name}, ${data.zip}, false,
        ${JSON.stringify(cal)}, ${JSON.stringify(site)}, ${card ? JSON.stringify(card) : null},
        ${pdsText}, ${JSON.stringify(recents)}, ${JSON.stringify(outcomes)},
        ${now}, ${now}, ${now}
      )
    `;
    await sql`
      insert into user_prefs (user_id, last_project_id) values (${context.userId}, ${id})
      on conflict (user_id) do update set last_project_id = ${id}
    `;
    return {
      id,
      name: data.name,
      zip: data.zip,
      archived: false,
      lastOpenedAt: now,
      updatedAt: now,
      hasCard: Boolean(card),
      status: "open",
      closedAt: null,
      closedBy: null,
      calibration: cal,
      site,
      card,
      pdsText,
      recents,
      outcomes,
    };
  });

export const openProject = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((id: string) => id)
  .handler(async ({ context, data: id }): Promise<ProjectFull> => {
    const sql = await getSql();
    const now = new Date().toISOString();
    const row = await openProjectRow(sql, context.userId, id, now);
    if (!row) throw new Error(NOT_YOUR_JOB_MESSAGE);
    await sql`
      insert into user_prefs (user_id, last_project_id) values (${context.userId}, ${id})
      on conflict (user_id) do update set last_project_id = ${id}
    `;
    return toFull(row);
  });

export const saveProject = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    (input: {
      id: string;
      name?: string;
      zip?: string;
      calibration?: Calibration;
      site?: SiteContext;
      card?: FieldCardData | null;
      pdsText?: string;
      recents?: SavedCard[];
      outcomes?: FieldOutcome[];
    }) => input,
  )
  .handler(async ({ context, data }): Promise<ProjectSummary> => {
    const sql = await getSql();
    const row = await readProjectRow(sql, context.userId, data.id);
    if (!row) throw new Error(NOT_YOUR_JOB_MESSAGE);
    // Closed jobs are read-only. The write below re-checks status in its WHERE clause (race-safe).
    if (row.status === "closed") return throwWriteRefused(sql, context.userId, data.id);
    const name = data.name?.trim() || row.name;
    const zip = data.zip != null ? data.zip.replace(/\D/g, "").slice(0, 5) : row.zip;
    const cal = data.calibration ?? parseJson(row.calibration_json, DEFAULT_CALIBRATION);
    const site = data.site ?? parseJson(row.site_json, defaultSite());
    const card = data.card !== undefined ? data.card : parseJson<FieldCardData | null>(row.card_json, null);
    const pdsText = data.pdsText ?? row.pds_text;
    const recents = data.recents ?? parseJson<SavedCard[]>(row.recents_json, []);
    const outcomes = data.outcomes ?? parseJson<FieldOutcome[]>(row.outcomes_json, []);
    const now = new Date().toISOString();
    const updated = await writeOpenProject<ProjectRow>(
      sql,
      context.userId,
      data.id,
      {
        name,
        zip,
        calibrationJson: JSON.stringify(cal),
        siteJson: JSON.stringify(site),
        cardJson: card ? JSON.stringify(card) : null,
        pdsText,
        recentsJson: JSON.stringify(recents),
        outcomesJson: JSON.stringify(outcomes),
      },
      now,
    );
    return toSummary(updated);
  });

export const archiveProject = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { id: string; archived: boolean }) => input)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const rows = await sql<{ id: string }>`
      update projects set archived = ${data.archived}, updated_at = ${new Date().toISOString()}
      where id = ${data.id} and user_id = ${context.userId}
      returning id
    `;
    if (!rows[0]) throw new Error(NOT_YOUR_JOB_MESSAGE);
    if (data.archived) {
      await sql`
        update user_prefs set last_project_id = null
        where user_id = ${context.userId} and last_project_id = ${data.id}
      `;
    }
    return { ok: true as const };
  });

/**
 * Close a job (CONTRACT.md "Job closeout"). Same style as archiveProject: owner-only
 * (non-owner throws NOT_YOUR_JOB_MESSAGE), idempotent, no reopen in this release.
 */
export const closeProject = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { id: string }) => {
    const id = typeof input?.id === "string" ? input.id : "";
    if (!id) throw new Error(NOT_YOUR_JOB_MESSAGE);
    return { id };
  })
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    return closeJob(sql, context.userId, data.id);
  });

export const deleteProject = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((id: string) => id)
  .handler(async ({ context, data: id }) => {
    const sql = await getSql();
    // Closed jobs can't be deleted (JOB_CLOSED_DELETE_MESSAGE); the status check is in the DELETE itself.
    await deleteOpenProject(sql, context.userId, id);
    await sql`
      update user_prefs set last_project_id = null
      where user_id = ${context.userId} and last_project_id = ${id}
    `;
    return { ok: true as const };
  });

export const saveCustomMitigation = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: CustomMitigationInput) => input)
  .handler(async ({ context, data }): Promise<CustomMitigation> => {
    const list = await loadCustom(context.userId);
    const { saved } = mergeCustomMitigation(list, data);
    const sql = await getSql();
    const now = new Date().toISOString();
    await sql`
      insert into custom_mitigations (id, user_id, label, payload_json, created_at, updated_at)
      values (${saved.id}, ${context.userId}, ${saved.label}, ${JSON.stringify(saved)}, ${saved.createdAt}, ${now})
      on conflict (id) do update set
        label = ${saved.label},
        payload_json = ${JSON.stringify(saved)},
        updated_at = ${now}
      where custom_mitigations.user_id = ${context.userId}
    `;
    return saved;
  });

/** Lift device-local jobs into an empty account. No-op if the account already has projects or a library. */
export const importGuestWorkspace = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { projects: ProjectFull[]; custom: CustomMitigation[]; lastProjectId?: string | null }) => {
    const projects = Array.isArray(input.projects) ? input.projects.slice(0, 50) : [];
    const custom = Array.isArray(input.custom) ? input.custom.slice(0, 40) : [];
    return { projects, custom, lastProjectId: input.lastProjectId ?? null };
  })
  .handler(async ({ context, data }): Promise<{ imported: number; skipped: boolean }> => {
    const [existing, existingCustom] = await Promise.all([listRows(context.userId), loadCustom(context.userId)]);
    if (accountRejectsGuestImport(existing.length, existingCustom.length)) {
      return { imported: 0, skipped: true };
    }
    const minted = remapGuestImportInput({
      projects: data.projects,
      custom: data.custom,
      lastProjectId: data.lastProjectId,
    });
    const sql = await getSql();
    const now = new Date().toISOString();
    let imported = 0;
    for (const p of minted.projects) {
      const name = String(p.name ?? "").trim();
      const zip = String(p.zip ?? "").replace(/\D/g, "").slice(0, 5);
      if (!name || zip.length !== 5) continue;
      const id = p.id;
      const cal = p.calibration ?? DEFAULT_CALIBRATION;
      const site = p.site ?? defaultSite();
      const card = p.card ?? null;
      const pdsText = typeof p.pdsText === "string" ? p.pdsText : "";
      const recents = Array.isArray(p.recents) ? p.recents : [];
      const outcomes = Array.isArray(p.outcomes) ? p.outcomes : [];
      const lastOpened = p.lastOpenedAt || now;
      const updated = p.updatedAt || now;
      // A job closed on this device stays closed (read-only record) in the account.
      const closed = statusFields({ status: p.status, closed_at: p.closedAt ?? null, closed_by: p.closedBy ?? null });
      await sql`
        insert into projects (
          id, user_id, name, zip, archived, calibration_json, site_json, card_json, pds_text,
          recents_json, outcomes_json, created_at, updated_at, last_opened_at,
          status, closed_at, closed_by
        ) values (
          ${id}, ${context.userId}, ${name}, ${zip}, ${Boolean(p.archived)},
          ${JSON.stringify(cal)}, ${JSON.stringify(site)}, ${card ? JSON.stringify(card) : null},
          ${pdsText}, ${JSON.stringify(recents)}, ${JSON.stringify(outcomes)},
          ${now}, ${updated}, ${lastOpened},
          ${closed.status}, ${closed.closedAt}, ${closed.closedBy}
        )
        on conflict (id) do nothing
      `;
      imported += 1;
    }
    for (const c of minted.custom) {
      if (!c?.id || !c?.label) continue;
      await sql`
        insert into custom_mitigations (id, user_id, label, payload_json, created_at, updated_at)
        values (${c.id}, ${context.userId}, ${c.label}, ${JSON.stringify(c)}, ${c.createdAt || now}, ${now})
        on conflict (id) do nothing
      `;
    }
    const last = minted.lastProjectId ?? minted.projects[0]?.id ?? null;
    if (last) {
      await sql`
        insert into user_prefs (user_id, last_project_id) values (${context.userId}, ${last})
        on conflict (user_id) do update set last_project_id = ${last}
      `;
    }
    return { imported, skipped: false };
  });
