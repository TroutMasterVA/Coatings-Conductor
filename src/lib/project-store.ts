import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { accountRejectsGuestImport } from "@/lib/guest-import";
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
};

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

type ProjectRow = {
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
  return {
    id: row.id,
    name: row.name,
    zip: row.zip,
    archived: Boolean(row.archived),
    lastOpenedAt: row.last_opened_at,
    updatedAt: row.updated_at,
    hasCard: Boolean(row.card_json),
  };
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
  const sql = await getSql();
  return sql<ProjectRow>`
    select id, name, zip, archived, calibration_json, site_json, card_json, pds_text,
           recents_json, outcomes_json, last_opened_at, updated_at
    from projects
    where user_id = ${userId}
    order by archived asc, last_opened_at desc
  `;
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
    const rows = await sql<ProjectRow>`
      update projects
      set last_opened_at = ${now}
      where id = ${id} and user_id = ${context.userId} and archived = false
      returning id, name, zip, archived, calibration_json, site_json, card_json, pds_text,
                recents_json, outcomes_json, last_opened_at, updated_at
    `;
    const row = rows[0];
    if (!row) throw new Error("Project not found.");
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
    const existing = await sql<ProjectRow>`
      select id, name, zip, archived, calibration_json, site_json, card_json, pds_text,
             recents_json, outcomes_json, last_opened_at, updated_at
      from projects where id = ${data.id} and user_id = ${context.userId}
    `;
    const row = existing[0];
    if (!row) throw new Error("Project not found.");
    const name = data.name?.trim() || row.name;
    const zip = data.zip != null ? data.zip.replace(/\D/g, "").slice(0, 5) : row.zip;
    const cal = data.calibration ?? parseJson(row.calibration_json, DEFAULT_CALIBRATION);
    const site = data.site ?? parseJson(row.site_json, defaultSite());
    const card = data.card !== undefined ? data.card : parseJson<FieldCardData | null>(row.card_json, null);
    const pdsText = data.pdsText ?? row.pds_text;
    const recents = data.recents ?? parseJson<SavedCard[]>(row.recents_json, []);
    const outcomes = data.outcomes ?? parseJson<FieldOutcome[]>(row.outcomes_json, []);
    const now = new Date().toISOString();
    const updated = await sql<ProjectRow>`
      update projects set
        name = ${name},
        zip = ${zip},
        calibration_json = ${JSON.stringify(cal)},
        site_json = ${JSON.stringify(site)},
        card_json = ${card ? JSON.stringify(card) : null},
        pds_text = ${pdsText},
        recents_json = ${JSON.stringify(recents)},
        outcomes_json = ${JSON.stringify(outcomes)},
        updated_at = ${now}
      where id = ${data.id} and user_id = ${context.userId}
      returning id, name, zip, archived, calibration_json, site_json, card_json, pds_text,
                recents_json, outcomes_json, last_opened_at, updated_at
    `;
    return toSummary(updated[0]!);
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
    if (!rows[0]) throw new Error("Project not found.");
    if (data.archived) {
      await sql`
        update user_prefs set last_project_id = null
        where user_id = ${context.userId} and last_project_id = ${data.id}
      `;
    }
    return { ok: true as const };
  });

export const deleteProject = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((id: string) => id)
  .handler(async ({ context, data: id }) => {
    const sql = await getSql();
    const rows = await sql<{ id: string }>`
      delete from projects where id = ${id} and user_id = ${context.userId} returning id
    `;
    if (!rows[0]) throw new Error("Project not found.");
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
    const sql = await getSql();
    const now = new Date().toISOString();
    let imported = 0;
    for (const p of data.projects) {
      const name = String(p.name ?? "").trim();
      const zip = String(p.zip ?? "").replace(/\D/g, "").slice(0, 5);
      if (!name || zip.length !== 5) continue;
      const id = typeof p.id === "string" && p.id.length > 0 ? p.id : crypto.randomUUID();
      const cal = p.calibration ?? DEFAULT_CALIBRATION;
      const site = p.site ?? defaultSite();
      const card = p.card ?? null;
      const pdsText = typeof p.pdsText === "string" ? p.pdsText : "";
      const recents = Array.isArray(p.recents) ? p.recents : [];
      const outcomes = Array.isArray(p.outcomes) ? p.outcomes : [];
      const lastOpened = p.lastOpenedAt || now;
      const updated = p.updatedAt || now;
      await sql`
        insert into projects (
          id, user_id, name, zip, archived, calibration_json, site_json, card_json, pds_text,
          recents_json, outcomes_json, created_at, updated_at, last_opened_at
        ) values (
          ${id}, ${context.userId}, ${name}, ${zip}, ${Boolean(p.archived)},
          ${JSON.stringify(cal)}, ${JSON.stringify(site)}, ${card ? JSON.stringify(card) : null},
          ${pdsText}, ${JSON.stringify(recents)}, ${JSON.stringify(outcomes)},
          ${now}, ${updated}, ${lastOpened}
        )
        on conflict (id) do nothing
      `;
      imported += 1;
    }
    for (const c of data.custom) {
      if (!c?.id || !c?.label) continue;
      await sql`
        insert into custom_mitigations (id, user_id, label, payload_json, created_at, updated_at)
        values (${c.id}, ${context.userId}, ${c.label}, ${JSON.stringify(c)}, ${c.createdAt || now}, ${now})
        on conflict (id) do nothing
      `;
    }
    const last =
      (data.lastProjectId && data.projects.some((p) => p.id === data.lastProjectId) ? data.lastProjectId : null) ??
      data.projects[0]?.id ??
      null;
    if (last) {
      await sql`
        insert into user_prefs (user_id, last_project_id) values (${context.userId}, ${last})
        on conflict (user_id) do update set last_project_id = ${last}
      `;
    }
    return { imported, skipped: false };
  });
