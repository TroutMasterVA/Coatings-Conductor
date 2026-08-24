import { r as createServerFn } from "./ssr.mjs";
import { t as createServerRpc } from "./createServerRpc-CcvdN_gc.mjs";
import { c as mergeCustomMitigation, t as DEFAULT_CALIBRATION } from "./learning-CQdNi_eK.mjs";
import { r as getSql } from "./db-Cg0loizT.mjs";
import { t as authMiddleware } from "./middleware-DEdNZdDP.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/project-store-Bdsau4Pu.js
function parseJson(raw, fallback) {
	if (!raw) return fallback;
	try {
		return JSON.parse(raw);
	} catch {
		return fallback;
	}
}
function defaultSite() {
	return {
		substrate: "bare_steel",
		mitigations: [],
		customMitigationIds: []
	};
}
function toSummary(row) {
	return {
		id: row.id,
		name: row.name,
		zip: row.zip,
		archived: Boolean(row.archived),
		lastOpenedAt: row.last_opened_at,
		updatedAt: row.updated_at,
		hasCard: Boolean(row.card_json)
	};
}
function toFull(row) {
	const site = parseJson(row.site_json, defaultSite());
	return {
		...toSummary(row),
		calibration: {
			...DEFAULT_CALIBRATION,
			...parseJson(row.calibration_json, {})
		},
		site: {
			substrate: site.substrate ?? "bare_steel",
			mitigations: site.mitigations ?? [],
			customMitigationIds: site.customMitigationIds ?? [],
			moistureTolerant: site.moistureTolerant,
			discipline: site.discipline,
			bodies: site.bodies
		},
		card: parseJson(row.card_json, null),
		pdsText: row.pds_text ?? "",
		recents: parseJson(row.recents_json, []),
		outcomes: parseJson(row.outcomes_json, [])
	};
}
async function listRows(userId) {
	return (await getSql())`
    select id, name, zip, archived, calibration_json, site_json, card_json, pds_text,
           recents_json, outcomes_json, last_opened_at, updated_at
    from projects
    where user_id = ${userId}
    order by archived asc, last_opened_at desc
  `;
}
async function loadCustom(userId) {
	return (await (await getSql())`
    select payload_json from custom_mitigations
    where user_id = ${userId}
    order by updated_at desc
  `).map((r) => parseJson(r.payload_json, null)).filter((c) => Boolean(c));
}
var loadWorkspace_createServerFn_handler = createServerRpc({
	id: "4001ac0e3fa599c3b6c16c48953b32dac17e23933b616d2cea3c469261cd5f49",
	name: "loadWorkspace",
	filename: "src/lib/project-store.ts"
}, (opts) => loadWorkspace.__executeServer(opts));
var loadWorkspace = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(loadWorkspace_createServerFn_handler, async ({ context }) => {
	const sql = await getSql();
	const [projects, custom, prefs] = await Promise.all([
		listRows(context.userId),
		loadCustom(context.userId),
		sql`select last_project_id from user_prefs where user_id = ${context.userId}`
	]);
	return {
		lastProjectId: prefs[0]?.last_project_id ?? null,
		projects: projects.map(toSummary),
		custom
	};
});
var createProject_createServerFn_handler = createServerRpc({
	id: "db3e85134a404be42369235757524fccdce0e01215ffef27e9590cec13abc0cf",
	name: "createProject",
	filename: "src/lib/project-store.ts"
}, (opts) => createProject.__executeServer(opts));
var createProject = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((input) => {
	const name = input.name.trim();
	const zip = input.zip.replace(/\D/g, "").slice(0, 5);
	if (!name) throw new Error("Project name is required.");
	if (zip.length !== 5) throw new Error("Enter a 5-digit US ZIP.");
	return {
		name,
		zip,
		seed: input.seed
	};
}).handler(createProject_createServerFn_handler, async ({ context, data }) => {
	const sql = await getSql();
	const id = crypto.randomUUID();
	const now = (/* @__PURE__ */ new Date()).toISOString();
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
		outcomes
	};
});
var openProject_createServerFn_handler = createServerRpc({
	id: "fbc1b91a1fda83a921c988a17311cd4f481a048a5f131b4f426adeb0e4d3a274",
	name: "openProject",
	filename: "src/lib/project-store.ts"
}, (opts) => openProject.__executeServer(opts));
var openProject = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((id) => id).handler(openProject_createServerFn_handler, async ({ context, data: id }) => {
	const sql = await getSql();
	const row = (await sql`
      update projects
      set last_opened_at = ${(/* @__PURE__ */ new Date()).toISOString()}
      where id = ${id} and user_id = ${context.userId} and archived = false
      returning id, name, zip, archived, calibration_json, site_json, card_json, pds_text,
                recents_json, outcomes_json, last_opened_at, updated_at
    `)[0];
	if (!row) throw new Error("Project not found.");
	await sql`
      insert into user_prefs (user_id, last_project_id) values (${context.userId}, ${id})
      on conflict (user_id) do update set last_project_id = ${id}
    `;
	return toFull(row);
});
var saveProject_createServerFn_handler = createServerRpc({
	id: "e63f4109eba5f70c326f3399b4ccb7ad4f3be4c1f66ea9b7fa8fc6d09af684cf",
	name: "saveProject",
	filename: "src/lib/project-store.ts"
}, (opts) => saveProject.__executeServer(opts));
var saveProject = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((input) => input).handler(saveProject_createServerFn_handler, async ({ context, data }) => {
	const sql = await getSql();
	const row = (await sql`
      select id, name, zip, archived, calibration_json, site_json, card_json, pds_text,
             recents_json, outcomes_json, last_opened_at, updated_at
      from projects where id = ${data.id} and user_id = ${context.userId}
    `)[0];
	if (!row) throw new Error("Project not found.");
	const name = data.name?.trim() || row.name;
	const zip = data.zip != null ? data.zip.replace(/\D/g, "").slice(0, 5) : row.zip;
	const cal = data.calibration ?? parseJson(row.calibration_json, DEFAULT_CALIBRATION);
	const site = data.site ?? parseJson(row.site_json, defaultSite());
	const card = data.card !== void 0 ? data.card : parseJson(row.card_json, null);
	const pdsText = data.pdsText ?? row.pds_text;
	const recents = data.recents ?? parseJson(row.recents_json, []);
	const outcomes = data.outcomes ?? parseJson(row.outcomes_json, []);
	const now = (/* @__PURE__ */ new Date()).toISOString();
	return toSummary((await sql`
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
    `)[0]);
});
var archiveProject_createServerFn_handler = createServerRpc({
	id: "73a1e3c2816431146f1b7b790b1ace9f8c5cbec6445b879d7c2f87998b278d29",
	name: "archiveProject",
	filename: "src/lib/project-store.ts"
}, (opts) => archiveProject.__executeServer(opts));
var archiveProject = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((input) => input).handler(archiveProject_createServerFn_handler, async ({ context, data }) => {
	const sql = await getSql();
	if (!(await sql`
      update projects set archived = ${data.archived}, updated_at = ${(/* @__PURE__ */ new Date()).toISOString()}
      where id = ${data.id} and user_id = ${context.userId}
      returning id
    `)[0]) throw new Error("Project not found.");
	if (data.archived) await sql`
        update user_prefs set last_project_id = null
        where user_id = ${context.userId} and last_project_id = ${data.id}
      `;
	return { ok: true };
});
var deleteProject_createServerFn_handler = createServerRpc({
	id: "da134c65dd91b188214ccc07961ee0b663b094462ec1770a33c47c7739e45f95",
	name: "deleteProject",
	filename: "src/lib/project-store.ts"
}, (opts) => deleteProject.__executeServer(opts));
var deleteProject = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((id) => id).handler(deleteProject_createServerFn_handler, async ({ context, data: id }) => {
	const sql = await getSql();
	if (!(await sql`
      delete from projects where id = ${id} and user_id = ${context.userId} returning id
    `)[0]) throw new Error("Project not found.");
	await sql`
      update user_prefs set last_project_id = null
      where user_id = ${context.userId} and last_project_id = ${id}
    `;
	return { ok: true };
});
var saveCustomMitigation_createServerFn_handler = createServerRpc({
	id: "72bfc25ca4f03357ce5a466c4c096b74d0695e4dc106a7fb1554274cfb388e91",
	name: "saveCustomMitigation",
	filename: "src/lib/project-store.ts"
}, (opts) => saveCustomMitigation.__executeServer(opts));
var saveCustomMitigation = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((input) => input).handler(saveCustomMitigation_createServerFn_handler, async ({ context, data }) => {
	const list = await loadCustom(context.userId);
	const { saved } = mergeCustomMitigation(list, data);
	const sql = await getSql();
	const now = (/* @__PURE__ */ new Date()).toISOString();
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
var importGuestWorkspace_createServerFn_handler = createServerRpc({
	id: "9462225899c15c0146fedd3d47a0e833584fad49706095c307688725a605cd01",
	name: "importGuestWorkspace",
	filename: "src/lib/project-store.ts"
}, (opts) => importGuestWorkspace.__executeServer(opts));
var importGuestWorkspace = createServerFn({ method: "POST" }).middleware([authMiddleware]).validator((input) => {
	return {
		projects: Array.isArray(input.projects) ? input.projects.slice(0, 50) : [],
		custom: Array.isArray(input.custom) ? input.custom.slice(0, 40) : [],
		lastProjectId: input.lastProjectId ?? null
	};
}).handler(importGuestWorkspace_createServerFn_handler, async ({ context, data }) => {
	const [existing, existingCustom] = await Promise.all([listRows(context.userId), loadCustom(context.userId)]);
	if (existing.length > 0 || existingCustom.length > 0) return {
		imported: 0,
		skipped: true
	};
	const sql = await getSql();
	const now = (/* @__PURE__ */ new Date()).toISOString();
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
	const last = (data.lastProjectId && data.projects.some((p) => p.id === data.lastProjectId) ? data.lastProjectId : null) ?? data.projects[0]?.id ?? null;
	if (last) await sql`
        insert into user_prefs (user_id, last_project_id) values (${context.userId}, ${last})
        on conflict (user_id) do update set last_project_id = ${last}
      `;
	return {
		imported,
		skipped: false
	};
});
//#endregion
export { archiveProject_createServerFn_handler, createProject_createServerFn_handler, deleteProject_createServerFn_handler, importGuestWorkspace_createServerFn_handler, loadWorkspace_createServerFn_handler, openProject_createServerFn_handler, saveCustomMitigation_createServerFn_handler, saveProject_createServerFn_handler };
