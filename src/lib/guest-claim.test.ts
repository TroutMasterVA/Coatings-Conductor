import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import type { Sql } from "./db.ts";
import { claimGuestWorkspace, guestClaimKey } from "./guest-claim.ts";
import type { ProjectFull } from "./project-store.ts";
import type { CustomMitigation } from "./types.ts";

const MIGRATIONS = ["0001_auth.sql", "0002_projects.sql", "0003_job_extract.sql", "0004_job_status.sql", "0005_guest_claims.sql"];
const NOW = "2026-10-30T12:00:00.000Z";
const site = () => ({ substrate: "bare_steel" as const, mitigations: [], customMitigationIds: [] });

async function db(): Promise<Sql> {
  const pg = new PGlite();
  for (const f of MIGRATIONS) {
    await pg.exec(readFileSync(new URL(`../../migrations/${f}`, import.meta.url), "utf8"));
  }
  const run = async <T>(text: string, params: unknown[] = []) => (await pg.query<T>(text, params)).rows;
  const sql = (async (strings: TemplateStringsArray, ...values: unknown[]) => {
    let text = strings[0]!;
    values.forEach((_, i) => (text += `$${i + 1}${strings[i + 1]}`));
    return run(text, values);
  }) as Sql;
  sql.query = run as Sql["query"];
  return sql;
}

function guestProject(id: string, name: string, extra: Partial<ProjectFull> = {}): ProjectFull {
  return {
    id,
    name,
    zip: "22902",
    archived: false,
    lastOpenedAt: NOW,
    updatedAt: NOW,
    hasCard: false,
    status: "open",
    closedAt: null,
    closedBy: null,
    calibration: { master: 0.5 } as ProjectFull["calibration"],
    site: site(),
    card: null,
    extract: null,
    pdsText: "",
    recents: [],
    outcomes: [],
    ...extra,
  };
}

const custom = { id: "guest-mit-1", label: "Tent + heater", createdAt: NOW } as unknown as CustomMitigation;
const input = () => ({
  projects: [
    guestProject("guest-a", "Tank 4", { site: { ...site(), customMitigationIds: ["guest-mit-1"] } }),
    guestProject("guest-b", "Bridge"),
  ],
  custom: [custom],
  lastProjectId: "guest-a",
});
const opts = { now: NOW, fallbackSite: site };

async function projectsOf(sql: Sql, user: string) {
  return sql<{ id: string; name: string; site_json: string }>`select id, name, site_json from projects where user_id = ${user} order by name`;
}
async function customOf(sql: Sql, user: string) {
  return sql<{ id: string }>`select id from custom_mitigations where user_id = ${user}`;
}

describe("guest carry-over is idempotent on the server (P1 duplicates)", () => {
  it("first claim moves each device project exactly once", async () => {
    const sql = await db();
    const r = await claimGuestWorkspace(sql, "alice", input(), opts);
    assert.equal(r.imported, 2);
    assert.equal(r.alreadyMoved, 0);
    assert.deepEqual([...r.importedIds].sort(), ["guest-a", "guest-b"]);
    assert.equal(r.customOk, true);
    const rows = await projectsOf(sql, "alice");
    assert.deepEqual(rows.map((p) => p.name), ["Bridge", "Tank 4"]);
    // Server ids are fresh, never the device ids.
    assert.ok(rows.every((p) => p.id !== "guest-a" && p.id !== "guest-b"));
    const [mit] = await customOf(sql, "alice");
    assert.ok(mit);
    assert.deepEqual(JSON.parse(rows.find((p) => p.name === "Tank 4")!.site_json).customMitigationIds, [mit.id]);
    const [prefs] = await sql<{ last_project_id: string }>`select last_project_id from user_prefs where user_id = 'alice'`;
    assert.equal(prefs?.last_project_id, rows.find((p) => p.name === "Tank 4")!.id);
  });

  it("a repeat claim (reload / re-login / double click in sequence) adds nothing and reports the earlier copies", async () => {
    const sql = await db();
    const first = await claimGuestWorkspace(sql, "alice", input(), opts);
    const before = await projectsOf(sql, "alice");
    const second = await claimGuestWorkspace(sql, "alice", input(), opts);
    const third = await claimGuestWorkspace(sql, "alice", input(), opts);
    assert.equal(first.imported, 2);
    for (const r of [second, third]) {
      assert.equal(r.imported, 0);
      assert.equal(r.alreadyMoved, 2);
      // The device may still drop its copies: they are in the account.
      assert.deepEqual([...r.importedIds].sort(), ["guest-a", "guest-b"]);
      assert.equal(r.customOk, true);
    }
    assert.deepEqual(await projectsOf(sql, "alice"), before);
    assert.equal((await customOf(sql, "alice")).length, 1);
    const claims = await sql<{ n: number }>`select count(*)::int as n from guest_claims where user_id = 'alice'`;
    assert.equal(claims[0]?.n, 3);
  });

  it("concurrent claims (two tabs / double click in parallel) still give exactly one copy each", async () => {
    const sql = await db();
    const results = await Promise.all(Array.from({ length: 5 }, () => claimGuestWorkspace(sql, "alice", input(), opts)));
    const rows = await projectsOf(sql, "alice");
    assert.deepEqual(rows.map((p) => p.name), ["Bridge", "Tank 4"]);
    assert.equal((await customOf(sql, "alice")).length, 1);
    assert.equal(results.reduce((n, r) => n + r.imported, 0), 2);
    assert.equal(results.reduce((n, r) => n + r.alreadyMoved, 0), 8);
    for (const r of results) assert.deepEqual([...r.importedIds].sort(), ["guest-a", "guest-b"]);
    // A repeat that re-sends the library points at the ONE copy the account has.
    const mitId = (await customOf(sql, "alice"))[0]!.id;
    assert.deepEqual(JSON.parse(rows.find((p) => p.name === "Tank 4")!.site_json).customMitigationIds, [mitId]);
  });

  it("reload mid-claim: the device re-sends after the server already moved it; a new device project still moves", async () => {
    const sql = await db();
    await claimGuestWorkspace(sql, "alice", input(), opts);
    // The reply was lost (refresh), so the device still holds both, plus one made since.
    const resend = { ...input(), projects: [...input().projects, guestProject("guest-c", "Silo")] };
    const r = await claimGuestWorkspace(sql, "alice", resend, opts);
    assert.equal(r.imported, 1);
    assert.equal(r.alreadyMoved, 2);
    assert.deepEqual((await projectsOf(sql, "alice")).map((p) => p.name), ["Bridge", "Silo", "Tank 4"]);
  });

  it("the claim key is per user: another account claiming the same device ids gets its own copy, not alice's", async () => {
    const sql = await db();
    await claimGuestWorkspace(sql, "alice", input(), opts);
    const r = await claimGuestWorkspace(sql, "bob", input(), opts);
    assert.equal(r.imported, 2);
    assert.equal(r.alreadyMoved, 0);
    const alice = await projectsOf(sql, "alice");
    const bob = await projectsOf(sql, "bob");
    assert.equal(bob.length, 2);
    assert.ok(bob.every((b) => !alice.some((a) => a.id === b.id)));
  });

  it("a deleted earlier copy is not re-created by a repeat claim, and prefs don't point at it", async () => {
    const sql = await db();
    await claimGuestWorkspace(sql, "alice", input(), opts);
    await sql`delete from projects where user_id = 'alice'`;
    await sql`update user_prefs set last_project_id = null where user_id = 'alice'`;
    const r = await claimGuestWorkspace(sql, "alice", input(), opts);
    assert.equal(r.imported, 0);
    assert.equal((await projectsOf(sql, "alice")).length, 0);
    const [prefs] = await sql<{ last_project_id: string | null }>`select last_project_id from user_prefs where user_id = 'alice'`;
    assert.equal(prefs?.last_project_id, null);
  });

  it("invalid device projects are skipped and stay on the device", async () => {
    const sql = await db();
    const r = await claimGuestWorkspace(sql, "alice", { projects: [guestProject("guest-x", "  ", {}), guestProject("guest-y", "Ok", { zip: "12" })], custom: [] }, opts);
    assert.equal(r.imported, 0);
    assert.deepEqual(r.importedIds, []);
  });

  it("claim keys: only non-empty, bounded string ids", () => {
    assert.equal(guestClaimKey("abc"), "abc");
    assert.equal(guestClaimKey(""), null);
    assert.equal(guestClaimKey(42), null);
    assert.equal(guestClaimKey("x".repeat(129)), null);
  });
});
