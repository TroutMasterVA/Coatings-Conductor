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
} from "./job-close.ts";
import {
  applyExtractOnSave,
  readJobExtract,
  saveJobCard,
  writeJobExtract,
  type JobSaveFields,
} from "./job-extract.ts";
import { runExtract } from "./extract/extract-core.ts";
import { onDeviceProvider } from "./extract/on-device-provider.ts";
import type { SavedExtract } from "./extract/provider.ts";
import type { FieldCardData } from "./types.ts";
import { listProjectRows, openProjectRow, readProjectRow, toRowSummary } from "./project-rows.ts";

const MIGRATIONS = [
  "0001_auth.sql",
  "0002_projects.sql",
  "0003_job_extract.sql",
  "0004_job_status.sql",
];

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

const EXTRACT: SavedExtract = {
  provider: "on-device",
  provenance: { "environmentals.windMaxMph": "not-stated" },
  warnings: [],
  extractedAt: "2026-10-18T19:20:00.000Z",
  draft: true,
  unverifiedTemps: false,
};

const FIELDS: JobSaveFields = {
  name: "Renamed",
  zip: "22030",
  calibrationJson: "{}",
  siteJson: "{}",
  pdsText: "edited",
  recentsJson: "[]",
  outcomesJson: "[]",
};

/** The saveProject write path: card + extract + fields in one checked statement. */
function save(
  sql: Sql,
  user: string,
  id: string,
  input: { card?: FieldCardData | null; extract?: unknown } = {},
  fields: JobSaveFields | undefined = FIELDS,
) {
  return saveJobCard(sql, user, id, input, AT.toISOString(), "test-secret", fields);
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
    await assert.rejects(save(sql, "alice", "job-a"), { message: JOB_CLOSED_MESSAGE });
    assert.deepEqual(await readProjectRow(sql, "alice", "job-a"), before);
  });

  it("saveJobCard (card edit / autosave) on a closed job is refused and the card is unchanged", async () => {
    const sql = await db();
    await closeJob(sql, "alice", "job-a", AT);
    const card = { productName: "Edited by hand" } as unknown as FieldCardData;
    await assert.rejects(save(sql, "alice", "job-a", { card }, undefined), {
      message: JOB_CLOSED_MESSAGE,
    });
    assert.equal((await readProjectRow(sql, "alice", "job-a"))?.card_json, null);
  });

  it("extract-on-save on a closed job is refused and the row is unchanged", async () => {
    const sql = await db();
    await closeJob(sql, "alice", "job-a", AT);
    const before = await readProjectRow(sql, "alice", "job-a");
    await assert.rejects(save(sql, "alice", "job-a", { extract: EXTRACT }), {
      message: JOB_CLOSED_MESSAGE,
    });
    await assert.rejects(save(sql, "alice", "job-a", { extract: null }), {
      message: JOB_CLOSED_MESSAGE,
    });
    await assert.rejects(writeJobExtract(sql, "alice", "job-a", EXTRACT), {
      message: JOB_CLOSED_MESSAGE,
    });
    await assert.rejects(applyExtractOnSave(sql, "alice", "job-a", EXTRACT), {
      message: JOB_CLOSED_MESSAGE,
    });
    assert.deepEqual(await readProjectRow(sql, "alice", "job-a"), before);
    assert.equal(await readJobExtract(sql, "alice", "job-a"), null);
  });

  it("a close that lands after the save's read still blocks the write (status is in the UPDATE)", async () => {
    const base = await db();
    let closed = false;
    // Close the job right after saveJobCard reads the row, before its UPDATE runs.
    const racing = (async (strings: TemplateStringsArray, ...values: unknown[]) => {
      const rows = await base(strings, ...values);
      if (!closed && strings.join("?").includes("select card_json, extract_json, status")) {
        closed = true;
        await closeJob(base, "alice", "job-a", AT);
      }
      return rows;
    }) as Sql;
    racing.query = base.query;
    await assert.rejects(save(racing, "alice", "job-a", { extract: EXTRACT }), {
      message: JOB_CLOSED_MESSAGE,
    });
    const row = await readProjectRow(base, "alice", "job-a");
    assert.equal(row?.name, "Tank 1");
    assert.equal(row?.extract_json, null);
    assert.equal(statusFields(row!).status, "closed");
  });

  it("save on an open job still works in one statement; a non-owner save changes nothing", async () => {
    const sql = await db();
    const plan = await save(sql, "alice", "job-a", { extract: EXTRACT });
    assert.equal(plan?.action, "replaced");
    const row = await readProjectRow(sql, "alice", "job-a");
    assert.equal(row?.name, "Renamed");
    assert.equal(row?.pds_text, "edited");
    assert.ok(row?.extract_json);
    assert.equal(await save(sql, "bob", "job-a"), null);
    assert.equal(await writeJobExtract(sql, "bob", "job-a", EXTRACT), false);
    assert.equal((await readProjectRow(sql, "alice", "job-a"))?.name, "Renamed");
  });

  it("extractSheet (runExtract) on a closed job returns { ok:false, error:{ code:'JOB_CLOSED' } }", async () => {
    const sql = await db();
    await closeJob(sql, "alice", "job-a", AT);
    const deps = (userId: string) => ({
      userId,
      input: {
        jobId: "job-a",
        text: "Surface: 35°F minimum",
        fileName: "sheet.pdf",
        mimeType: "application/pdf",
      },
      azure: null,
      onDevice: onDeviceProvider,
      rate: new Map(),
      jobClosed: (id: string) => isJobClosed(sql, userId, id),
    });
    const res = await runExtract(deps("alice"));
    assert.deepEqual(res, {
      ok: false,
      error: { code: "JOB_CLOSED", message: JOB_CLOSED_MESSAGE },
    });
    const other = await runExtract(deps("bob"));
    assert.ok(
      other.ok || other.error.code !== "JOB_CLOSED",
      "another user's id is not a closed job for them",
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

  it("statusFields turns an invalid closedAt into null up front (guest import then uses the import time)", () => {
    assert.deepEqual(statusFields({ status: "closed", closed_at: "not a date", closed_by: "x" }), {
      status: "closed",
      closedAt: null,
      closedBy: "x",
    });
  });
});
