import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import type { Sql } from "./db.ts";
import { NOT_YOUR_JOB_MESSAGE } from "./guest-import.ts";
import {
  closeJob,
  closedByLabel,
  deleteOpenProject,
  JOB_CLOSED_DELETE_MESSAGE,
  isJobClosed,
  JOB_CLOSED_MESSAGE,
  statusFields,
  writeOpenProject,
  type ProjectWriteValues,
} from "./job-close.ts";
import {
  listProjectRows,
  openProjectRow,
  readProjectRow,
  toRowSummary,
  type ProjectRow,
} from "./project-rows.ts";

const MIGRATIONS = ["0001_auth.sql", "0002_projects.sql", "0004_job_status.sql"];

async function db(): Promise<Sql> {
  const pg = new PGlite();
  for (const f of MIGRATIONS) {
    await pg.exec(readFileSync(new URL(`../../migrations/${f}`, import.meta.url), "utf8"));
  }
  const run = async <T>(text: string, params: unknown[] = []) =>
    (await pg.query<T>(text, params)).rows;
  const sql = (async (strings: TemplateStringsArray, ...values: unknown[]) => {
    let text = strings[0]!;
    values.forEach((_, i) => (text += `$${i + 1}${strings[i + 1]}`));
    return run(text, values);
  }) as Sql;
  sql.query = run as Sql["query"];
  await sql`insert into "user" ("id", "name", "email", "emailVerified") values ('alice', 'Alice Inspector', 'alice@example.com', true)`;
  await sql`insert into "user" ("id", "name", "email", "emailVerified") values ('bob', '  ', 'bob@example.com', true)`;
  // Same column list createProject uses: status is left to the database default.
  for (const [id, user] of [
    ["job-a", "alice"],
    ["job-b", "bob"],
  ]) {
    await sql`
      insert into projects (id, user_id, name, zip, archived, calibration_json, site_json, card_json, pds_text,
        recents_json, outcomes_json, created_at, updated_at, last_opened_at)
      values (${id}, ${user}, 'Tank 1', '22030', false, '{}', '{}', null, 'sheet text', '[]', '[]', now(), now(), now())
    `;
  }
  return sql;
}

function valuesFrom(row: ProjectRow, patch: Partial<ProjectWriteValues> = {}): ProjectWriteValues {
  return {
    name: row.name,
    zip: row.zip,
    calibrationJson: row.calibration_json,
    siteJson: row.site_json,
    cardJson: row.card_json,
    pdsText: row.pds_text,
    recentsJson: row.recents_json,
    outcomesJson: row.outcomes_json,
    ...patch,
  };
}

const AT = new Date("2026-10-18T20:15:00.000Z");

describe("job closeout (CONTRACT.md Job closeout, 5b2d320)", () => {
  it("a new job defaults to open", async () => {
    const sql = await db();
    const row = await readProjectRow(sql, "alice", "job-a");
    assert.deepEqual(statusFields(row!), { status: "open", closedAt: null, closedBy: null });
  });

  it("the owner closes: status closed, server time, display name", async () => {
    const sql = await db();
    const res = await closeJob(sql, "alice", "job-a", AT);
    assert.deepEqual(res, {
      ok: true,
      status: "closed",
      closedAt: AT.toISOString(),
      closedBy: "Alice Inspector",
    });
    assert.equal(await isJobClosed(sql, "alice", "job-a"), true);
  });

  it("closedBy falls back to email when the display name is blank", async () => {
    const sql = await db();
    const res = await closeJob(sql, "bob", "job-b", AT);
    assert.equal(res.closedBy, "bob@example.com");
    assert.equal(closedByLabel({ name: "", email: "x@example.com" }), "x@example.com");
  });

  it("a second close is idempotent (same closedAt/closedBy)", async () => {
    const sql = await db();
    const first = await closeJob(sql, "alice", "job-a", AT);
    const second = await closeJob(sql, "alice", "job-a", new Date("2026-10-18T21:00:00.000Z"));
    assert.deepEqual(second, first);
  });

  it("a non-owner or missing job throws NOT_YOUR_JOB_MESSAGE and nothing changes", async () => {
    const sql = await db();
    await assert.rejects(closeJob(sql, "bob", "job-a", AT), { message: NOT_YOUR_JOB_MESSAGE });
    await assert.rejects(closeJob(sql, "alice", "no-such-job", AT), {
      message: NOT_YOUR_JOB_MESSAGE,
    });
    assert.equal(await isJobClosed(sql, "alice", "job-a"), false);
  });

  it("save on a closed job throws JOB_CLOSED_MESSAGE and the data is unchanged", async () => {
    const sql = await db();
    await closeJob(sql, "alice", "job-a", AT);
    const before = await readProjectRow(sql, "alice", "job-a");
    await assert.rejects(
      writeOpenProject(
        sql,
        "alice",
        "job-a",
        valuesFrom(before!, { name: "Renamed", pdsText: "edited" }),
        new Date().toISOString(),
      ),
      { message: JOB_CLOSED_MESSAGE },
    );
    assert.deepEqual(await readProjectRow(sql, "alice", "job-a"), before);
  });

  it("a card edit / autosave carrying a card on a closed job is refused too", async () => {
    const sql = await db();
    await closeJob(sql, "alice", "job-a", AT);
    const before = await readProjectRow(sql, "alice", "job-a");
    const card = JSON.stringify({ productName: "Edited by hand" });
    await assert.rejects(
      writeOpenProject(
        sql,
        "alice",
        "job-a",
        valuesFrom(before!, { cardJson: card }),
        AT.toISOString(),
      ),
      {
        message: JOB_CLOSED_MESSAGE,
      },
    );
    assert.equal((await readProjectRow(sql, "alice", "job-a"))?.card_json, null);
  });

  it("a close that lands after the save read still blocks the write (status is in the WHERE)", async () => {
    const sql = await db();
    const staleRead = await readProjectRow(sql, "alice", "job-a"); // save read it while open
    await closeJob(sql, "alice", "job-a", AT); // close wins the race
    await assert.rejects(
      writeOpenProject(
        sql,
        "alice",
        "job-a",
        valuesFrom(staleRead!, { name: "Late" }),
        AT.toISOString(),
      ),
      {
        message: JOB_CLOSED_MESSAGE,
      },
    );
    assert.equal((await readProjectRow(sql, "alice", "job-a"))?.name, "Tank 1");
  });

  it("save on an open job still works; a non-owner save gets NOT_YOUR_JOB_MESSAGE", async () => {
    const sql = await db();
    const row = await readProjectRow(sql, "alice", "job-a");
    const saved = await writeOpenProject<ProjectRow>(
      sql,
      "alice",
      "job-a",
      valuesFrom(row!, { name: "Tank 1 east" }),
      AT.toISOString(),
    );
    assert.equal(saved.name, "Tank 1 east");
    await assert.rejects(
      writeOpenProject(sql, "bob", "job-a", valuesFrom(row!), AT.toISOString()),
      { message: NOT_YOUR_JOB_MESSAGE },
    );
  });

  it("extract attach checks isJobClosed (envelope { ok:false, code:'JOB_CLOSED' } in extractSheet)", async () => {
    const sql = await db();
    assert.equal(await isJobClosed(sql, "alice", "job-a"), false);
    await closeJob(sql, "alice", "job-a", AT);
    assert.equal(await isJobClosed(sql, "alice", "job-a"), true);
    assert.equal(
      await isJobClosed(sql, "bob", "job-a"),
      false,
      "another user's job is not visible",
    );
  });

  it("a closed job still opens and reads (it's a record)", async () => {
    const sql = await db();
    await closeJob(sql, "alice", "job-a", AT);
    const opened = await openProjectRow(sql, "alice", "job-a", new Date().toISOString());
    assert.ok(opened);
    assert.equal(opened.pds_text, "sheet text");
    assert.deepEqual(statusFields(opened), {
      status: "closed",
      closedAt: AT.toISOString(),
      closedBy: "Alice Inspector",
    });
    assert.equal(await openProjectRow(sql, "bob", "job-a", new Date().toISOString()), null);
  });

  it("the list shows status, closedAt and closedBy", async () => {
    const sql = await db();
    await sql`
      insert into projects (id, user_id, name, zip, calibration_json, site_json)
      values ('job-c', 'alice', 'Bridge deck', '22030', '{}', '{}')
    `;
    await closeJob(sql, "alice", "job-a", AT);
    const list = (await listProjectRows(sql, "alice")).map(toRowSummary);
    const byId = Object.fromEntries(list.map((p) => [p.id, p]));
    assert.equal(list.length, 2);
    assert.deepEqual(
      {
        status: byId["job-a"]!.status,
        closedAt: byId["job-a"]!.closedAt,
        closedBy: byId["job-a"]!.closedBy,
      },
      { status: "closed", closedAt: AT.toISOString(), closedBy: "Alice Inspector" },
    );
    assert.deepEqual(
      {
        status: byId["job-c"]!.status,
        closedAt: byId["job-c"]!.closedAt,
        closedBy: byId["job-c"]!.closedBy,
      },
      { status: "open", closedAt: null, closedBy: null },
    );
  });

  it("the database rejects any status other than open/closed", async () => {
    const sql = await db();
    await assert.rejects(sql`update projects set status = 'reopened' where id = 'job-a'`);
  });

  it("the migration is safe to re-run", async () => {
    const pg = new PGlite();
    for (const f of [...MIGRATIONS, "0004_job_status.sql"]) {
      await pg.exec(readFileSync(new URL(`../../migrations/${f}`, import.meta.url), "utf8"));
    }
  });

  it("statusFields treats pre-0004 / guest rows as open", () => {
    assert.deepEqual(statusFields({}), { status: "open", closedAt: null, closedBy: null });
    assert.deepEqual(
      statusFields({ status: "open", closed_at: "2026-10-18T20:15:00.000Z", closed_by: "x" }),
      {
        status: "open",
        closedAt: null,
        closedBy: null,
      },
    );
  });

  it("deleting a closed job throws JOB_CLOSED_DELETE_MESSAGE and the row still exists", async () => {
    const sql = await db();
    await closeJob(sql, "alice", "job-a", AT);
    const before = await readProjectRow(sql, "alice", "job-a");
    await assert.rejects(deleteOpenProject(sql, "alice", "job-a"), {
      message: JOB_CLOSED_DELETE_MESSAGE,
    });
    assert.deepEqual(await readProjectRow(sql, "alice", "job-a"), before);
  });

  it("a non-owner deleting a closed job gets NOT_YOUR_JOB_MESSAGE (no hint it exists)", async () => {
    const sql = await db();
    await closeJob(sql, "alice", "job-a", AT);
    await assert.rejects(deleteOpenProject(sql, "bob", "job-a"), { message: NOT_YOUR_JOB_MESSAGE });
    await assert.rejects(deleteOpenProject(sql, "bob", "no-such-job"), {
      message: NOT_YOUR_JOB_MESSAGE,
    });
    assert.ok(await readProjectRow(sql, "alice", "job-a"));
  });

  it("deleting an open job still works", async () => {
    const sql = await db();
    await deleteOpenProject(sql, "alice", "job-a");
    assert.equal(await readProjectRow(sql, "alice", "job-a"), null);
  });

  it("archiving a closed job still works (same UPDATE archiveProject runs)", async () => {
    const sql = await db();
    await closeJob(sql, "alice", "job-a", AT);
    const rows = await sql<{ id: string }>`
      update projects set archived = ${true}, updated_at = ${AT.toISOString()}
      where id = ${"job-a"} and user_id = ${"alice"}
      returning id
    `;
    assert.equal(rows[0]?.id, "job-a");
    const row = await readProjectRow(sql, "alice", "job-a");
    assert.equal(row?.archived, true);
    assert.equal(statusFields(row!).status, "closed");
  });
});
