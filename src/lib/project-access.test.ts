import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { toCrossJSONAsync } from "seroval";
import type { Sql } from "./db.ts";
import { NOT_YOUR_JOB_MESSAGE } from "./guest-import.ts";
import { openOwnedProject, PROJECT_NOT_FOUND_STATUS, readOwnedProject } from "./project-access.ts";

const MIGRATIONS = ["0001_auth.sql", "0002_projects.sql", "0003_job_extract.sql", "0004_job_status.sql"];

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
  await sql`insert into "user" ("id", "name", "email", "emailVerified") values ('alice', 'Alice', 'alice@example.com', true)`;
  await sql`insert into "user" ("id", "name", "email", "emailVerified") values ('bob', 'Bob', 'bob@example.com', true)`;
  await sql`
    insert into projects (id, user_id, name, zip, archived, calibration_json, site_json, card_json, pds_text,
      recents_json, outcomes_json, created_at, updated_at, last_opened_at)
    values ('job-a', 'alice', 'Alice Tank 7', '22030', false, '{}', '{}', null, 'alice sheet text', '[]', '[]', now(), now(), now())
  `;
  return sql;
}

/**
 * What the server-function handler sends: the status set during the call (200 if none) and the
 * error body serialized the same way TanStack Start does (seroval cross-JSON), or the row.
 */
async function call(fn: (setStatus: (s: number) => void) => Promise<unknown>) {
  let status = 200;
  try {
    const result = await fn((s) => (status = s));
    return { status, body: JSON.stringify(result) };
  } catch (err) {
    return { status, body: JSON.stringify(await toCrossJSONAsync(err, { refs: new Map() })) };
  }
}

const NOW = "2026-10-28T15:00:00.000Z";
const LEAKS = ["Alice Tank 7", "22030", "alice sheet text", "alice@example.com", "job-a"];

for (const [label, open] of [
  ["open", (sql: Sql, user: string, id: string, set: (s: number) => void) => openOwnedProject(sql, user, id, NOW, set)],
  ["read for save", (sql: Sql, user: string, id: string, set: (s: number) => void) => readOwnedProject(sql, user, id, set)],
] as const) {
  describe(`project by id (${label}): other user's and missing projects get the same 404`, () => {
    it("other user's project -> 404 with no project data", async () => {
      const sql = await db();
      const res = await call((set) => open(sql, "bob", "job-a", set));
      assert.equal(res.status, PROJECT_NOT_FOUND_STATUS);
      assert.equal(res.status, 404);
      assert.ok(res.body.includes(NOT_YOUR_JOB_MESSAGE), res.body);
      for (const s of LEAKS) assert.ok(!res.body.includes(s), `body leaks ${s}: ${res.body}`);
      assert.ok(!res.body.includes("stack") && !res.body.includes(".ts:"), `body leaks a server stack: ${res.body}`);
    });

    it("missing id -> 404, deep-equal to the other-user response", async () => {
      const sql = await db();
      const other = await call((set) => open(sql, "bob", "job-a", set));
      const missing = await call((set) => open(sql, "bob", "no-such-job", set));
      assert.equal(missing.status, 404);
      assert.deepEqual(missing, other);
    });

    it("owner still gets the project (200, with data)", async () => {
      const sql = await db();
      const res = await call((set) => open(sql, "alice", "job-a", set));
      assert.equal(res.status, 200);
      assert.ok(res.body.includes("Alice Tank 7"));
      assert.ok(res.body.includes("alice sheet text"));
    });
  });
}
