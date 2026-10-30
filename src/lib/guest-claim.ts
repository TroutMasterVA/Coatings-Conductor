import type { Sql } from "./db.ts";
import { remapGuestImportInput } from "./guest-import.ts";
import { GUEST_CLOSED_BY, statusFields } from "./job-close.ts";
import { encodeSavedExtract, parseSavedExtract } from "./job-extract.ts";
import { DEFAULT_CALIBRATION } from "./learning.ts";
import type { SiteContext } from "./mitigations.ts";
import type { CustomMitigation } from "./types.ts";
import type { ProjectFull } from "./project-store.ts";

/**
 * Guest carry-over, made idempotent on the server (P1: guest carry-over duplicates).
 *
 * Every device item that moves into an account is recorded in `guest_claims` under
 * (user_id, kind, guest_id), a per-user unique key (migration 0005). The claim row and the new
 * project are written by ONE statement, so either both land or neither does. A repeat claim of
 * the same device item (reload, double click, two tabs, sign-in then refresh) hits the unique key,
 * inserts nothing, and is answered with the copy the account already has.
 */

export type GuestClaimKind = "project" | "custom";

/** Device ids are UUIDs; anything odd is not used as a claim key. */
const GUEST_ID_MAX = 128;

export function guestClaimKey(id: unknown): string | null {
  if (typeof id !== "string") return null;
  const key = id.trim();
  return key.length > 0 && key.length <= GUEST_ID_MAX ? key : null;
}

export type GuestClaimInput = {
  projects: ProjectFull[];
  custom: CustomMitigation[];
  lastProjectId?: string | null;
};

export type GuestClaimResult = {
  /** New projects written to the account by this call. */
  imported: number;
  /** Device projects this account already had from an earlier claim (nothing written). */
  alreadyMoved: number;
  /** Device ids that are now in the account (new or earlier); the device may drop exactly these. */
  importedIds: string[];
  /** False when a custom mitigation could not be written (the device keeps its library). */
  customOk: boolean;
};

type ClaimOpts = {
  now: string;
  fallbackSite: () => SiteContext;
  mint?: () => string;
};

/** The server id an earlier claim gave this device item, or null when it was never claimed. */
async function existingClaim(sql: Sql, userId: string, kind: GuestClaimKind, guestId: string): Promise<string | null> {
  const rows = await sql<{ server_id: string }>`
    select server_id from guest_claims where user_id = ${userId} and kind = ${kind} and guest_id = ${guestId}
  `;
  return rows[0]?.server_id ?? null;
}

export async function claimGuestWorkspace(
  sql: Sql,
  userId: string,
  data: GuestClaimInput,
  opts: ClaimOpts,
): Promise<GuestClaimResult> {
  const { now } = opts;
  const minted = remapGuestImportInput(
    { projects: data.projects, custom: data.custom, lastProjectId: data.lastProjectId ?? null },
    opts.mint,
  );

  // Custom mitigations first, so projects can point at the account's copy (new or earlier).
  let customOk = true;
  const mintedToFinal = new Map<string, string>();
  for (const [i, c] of minted.custom.entries()) {
    if (!c?.id || !c?.label) continue;
    const guestKey = guestClaimKey(data.custom[i]?.id);
    const payload = JSON.stringify(c);
    try {
      if (!guestKey) {
        await sql`
          insert into custom_mitigations (id, user_id, label, payload_json, created_at, updated_at)
          values (${c.id}, ${userId}, ${c.label}, ${payload}, ${c.createdAt || now}, ${now})
          on conflict (id) do nothing
        `;
        continue;
      }
      const claimed = await sql<{ server_id: string }>`
        with claim as (
          insert into guest_claims (user_id, kind, guest_id, server_id, created_at)
          values (${userId}, 'custom', ${guestKey}, ${c.id}, ${now}::timestamptz)
          on conflict (user_id, kind, guest_id) do nothing
          returning server_id
        ), ins as (
          insert into custom_mitigations (id, user_id, label, payload_json, created_at, updated_at)
          select claim.server_id, ${userId}::text, ${c.label}::text, ${payload}::text,
            ${c.createdAt || now}::timestamptz, ${now}::timestamptz
          from claim
          on conflict (id) do nothing
          returning id
        )
        select server_id from claim
      `;
      if (claimed.length === 0) {
        const earlier = await existingClaim(sql, userId, "custom", guestKey);
        if (earlier) mintedToFinal.set(c.id, earlier);
      }
    } catch {
      customOk = false;
    }
  }

  const importedIds: string[] = [];
  const guestToServer = new Map<string, string>();
  let imported = 0;
  let alreadyMoved = 0;
  for (const [i, p] of minted.projects.entries()) {
    const guestId = data.projects[i]?.id;
    const guestKey = guestClaimKey(guestId);
    const name = String(p.name ?? "").trim();
    const zip = String(p.zip ?? "").replace(/\D/g, "").slice(0, 5);
    if (!name || zip.length !== 5) continue;
    const id = p.id;
    const cal = p.calibration ?? DEFAULT_CALIBRATION;
    const baseSite = p.site ?? opts.fallbackSite();
    const site = {
      ...baseSite,
      customMitigationIds: (baseSite.customMitigationIds ?? []).map((cid) => mintedToFinal.get(cid) ?? cid),
    };
    const card = p.card ?? null;
    const extract = card ? parseSavedExtract(p.extract) : null;
    const pdsText = typeof p.pdsText === "string" ? p.pdsText : "";
    const recents = Array.isArray(p.recents) ? p.recents : [];
    const outcomes = Array.isArray(p.outcomes) ? p.outcomes : [];
    const lastOpened = p.lastOpenedAt || now;
    const updated = p.updatedAt || now;
    // A job closed on this device stays closed (read-only record) in the account.
    // closedBy is always "This device" (the browser's value is not trusted); a missing or invalid
    // closedAt falls back to the import time.
    const guestStatus = statusFields({ status: p.status, closed_at: p.closedAt ?? null });
    const closed =
      guestStatus.status === "closed"
        ? { status: "closed", closedAt: guestStatus.closedAt ?? now, closedBy: GUEST_CLOSED_BY }
        : { status: "open", closedAt: null, closedBy: null };
    const values = {
      archived: Boolean(p.archived),
      cal: JSON.stringify(cal),
      site: JSON.stringify(site),
      card: card ? JSON.stringify(card) : null,
      extract: encodeSavedExtract(extract),
      recents: JSON.stringify(recents),
      outcomes: JSON.stringify(outcomes),
    };
    try {
      if (!guestKey) {
        // No usable device id: nothing to key a claim on (older data). Same single insert as before.
        await sql`
          insert into projects (
            id, user_id, name, zip, archived, calibration_json, site_json, card_json, extract_json, pds_text,
            recents_json, outcomes_json, created_at, updated_at, last_opened_at,
            status, closed_at, closed_by
          ) values (
            ${id}, ${userId}, ${name}, ${zip}, ${values.archived},
            ${values.cal}, ${values.site}, ${values.card}, ${values.extract}, ${pdsText},
            ${values.recents}, ${values.outcomes}, ${now}, ${updated}, ${lastOpened},
            ${closed.status}, ${closed.closedAt}, ${closed.closedBy}
          )
          on conflict (id) do nothing
        `;
        imported += 1;
        if (typeof guestId === "string") {
          importedIds.push(guestId);
          guestToServer.set(guestId, id);
        }
        continue;
      }
      // One statement: the claim row and the project land together or not at all. A second claim
      // of the same device project waits on the unique key, then inserts nothing.
      const claimed = await sql<{ server_id: string }>`
        with claim as (
          insert into guest_claims (user_id, kind, guest_id, server_id, created_at)
          values (${userId}, 'project', ${guestKey}, ${id}, ${now}::timestamptz)
          on conflict (user_id, kind, guest_id) do nothing
          returning server_id
        ), ins as (
          insert into projects (
            id, user_id, name, zip, archived, calibration_json, site_json, card_json, extract_json, pds_text,
            recents_json, outcomes_json, created_at, updated_at, last_opened_at,
            status, closed_at, closed_by
          )
          select claim.server_id, ${userId}::text, ${name}::text, ${zip}::text, ${values.archived}::boolean,
            ${values.cal}::text, ${values.site}::text, ${values.card}::text, ${values.extract}::text, ${pdsText}::text,
            ${values.recents}::text, ${values.outcomes}::text, ${now}::timestamptz, ${updated}::timestamptz,
            ${lastOpened}::timestamptz, ${closed.status}::text, ${closed.closedAt}::timestamptz, ${closed.closedBy}::text
          from claim
          returning id
        )
        select server_id from claim
      `;
      if (claimed.length > 0) {
        imported += 1;
        importedIds.push(String(guestId));
        guestToServer.set(guestKey, id);
        continue;
      }
      const earlier = await existingClaim(sql, userId, "project", guestKey);
      if (earlier) {
        alreadyMoved += 1;
        importedIds.push(String(guestId));
        guestToServer.set(guestKey, earlier);
      }
    } catch {
      continue;
    }
  }

  const lastGuest = guestClaimKey(data.lastProjectId);
  const last = (lastGuest ? guestToServer.get(lastGuest) : undefined) ?? [...guestToServer.values()][0] ?? null;
  if (last) {
    // Only point at a project the account still has (an earlier copy may have been deleted since).
    await sql`
      insert into user_prefs (user_id, last_project_id)
      select ${userId}::text, ${last}::text
      where exists (select 1 from projects where id = ${last} and user_id = ${userId})
      on conflict (user_id) do update set last_project_id = excluded.last_project_id
    `;
  }
  return { imported, alreadyMoved, importedIds, customOk };
}
