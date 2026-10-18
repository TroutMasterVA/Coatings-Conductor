import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import type { Sql } from "./db.ts";
import type { SavedExtract } from "./extract/provider.ts";
import { applyExtractOnSave, decodeSavedExtract, parseSavedExtract, readJobExtract, writeJobExtract } from "./job-extract.ts";

const EXTRACT: SavedExtract = {
  provider: "on-device",
  provenance: {
    "environmentals.dewPointSpreadMinF": { page: 2, quote: "Surface must be at least 5°F above the dew point." },
    "environmentals.windMaxMph": "not-stated",
  },
  warnings: [{ code: "AZURE_NOT_CONFIGURED", message: "Azure reader is not set up; showing the on-device read." }],
  extractedAt: "2026-10-18T19:20:00.000Z",
  draft: true,
  unverifiedTemps: false,
};

async function db(): Promise<Sql> {
  const pg = new PGlite();
  for (const f of ["0002_projects.sql", "0003_job_extract.sql"]) {
    await pg.exec(readFileSync(new URL(`../../migrations/${f}`, import.meta.url), "utf8"));
  }
  const run = async <T>(text: string, params: unknown[] = []) => (await pg.query<T>(text, params)).rows;
  const sql = (async (strings: TemplateStringsArray, ...values: unknown[]) => {
    let text = strings[0]!;
    values.forEach((_, i) => (text += `$${i + 1}${strings[i + 1]}`));
    return run(text, values);
  }) as Sql;
  sql.query = run as Sql["query"];
  for (const [id, user] of [["job-a", "alice"], ["job-b", "bob"]]) {
    await sql`insert into projects (id, user_id, name, zip, calibration_json, site_json) values (${id}, ${user}, 'Job', '22030', '{}', '{}')`;
  }
  return sql;
}

describe("saved extract on the job (BE-3 persistence)", () => {
  it("round-trips provenance, provider and flags", async () => {
    const sql = await db();
    assert.equal(await writeJobExtract(sql, "alice", "job-a", EXTRACT), true);
    assert.deepEqual(await readJobExtract(sql, "alice", "job-a"), EXTRACT);
  });

  it("another user cannot read or overwrite it", async () => {
    const sql = await db();
    await writeJobExtract(sql, "alice", "job-a", EXTRACT);
    assert.equal(await readJobExtract(sql, "bob", "job-a"), null);
    assert.equal(await writeJobExtract(sql, "bob", "job-a", { ...EXTRACT, provider: "azure" }), false);
    assert.equal((await readJobExtract(sql, "alice", "job-a"))?.provider, "on-device");
  });

  it("older jobs have no extract (null)", async () => {
    const sql = await db();
    assert.equal(await readJobExtract(sql, "bob", "job-b"), null);
  });

  it("rejects malformed records and defaults missing flags to false", () => {
    assert.equal(parseSavedExtract({ ...EXTRACT, provider: "azure:gpt-4o" }), null);
    assert.equal(parseSavedExtract({ ...EXTRACT, provenance: { a: { quote: 5 } } }), null);
    assert.equal(parseSavedExtract({ ...EXTRACT, extractedAt: "yesterday" }), null);
    assert.equal(decodeSavedExtract("{not json"), null);
    const { draft: _d, unverifiedTemps: _u, ...rest } = EXTRACT;
    const p = parseSavedExtract(rest);
    assert.ok(p && p.draft === false && p.unverifiedTemps === false);
  });
});

describe("save rule for extract (autosave keeps quotes)", () => {
  it("a field edit then autosave without extract keeps the stored quotes", async () => {
    const sql = await db();
    await writeJobExtract(sql, "alice", "job-a", EXTRACT);
    await sql`update projects set card_json = ${'{"product":"edited"}'} where id = ${"job-a"} and user_id = ${"alice"}`;
    assert.equal(await applyExtractOnSave(sql, "alice", "job-a", undefined), "kept");
    assert.deepEqual(await readJobExtract(sql, "alice", "job-a"), EXTRACT);
  });

  it("explicit null clears", async () => {
    const sql = await db();
    await writeJobExtract(sql, "alice", "job-a", EXTRACT);
    assert.equal(await applyExtractOnSave(sql, "alice", "job-a", null), "cleared");
    assert.equal(await readJobExtract(sql, "alice", "job-a"), null);
  });

  it("a new extract replaces", async () => {
    const sql = await db();
    await writeJobExtract(sql, "alice", "job-a", EXTRACT);
    const next = { ...EXTRACT, provider: "azure" as const, deployment: "gpt-4o", draft: false };
    assert.equal(await applyExtractOnSave(sql, "alice", "job-a", next), "replaced");
    assert.equal((await readJobExtract(sql, "alice", "job-a"))?.provider, "azure");
  });

  it("malformed extract is rejected and the stored one survives", async () => {
    const sql = await db();
    await writeJobExtract(sql, "alice", "job-a", EXTRACT);
    await assert.rejects(() => applyExtractOnSave(sql, "alice", "job-a", { provider: "x" }), /malformed/);
    assert.deepEqual(await readJobExtract(sql, "alice", "job-a"), EXTRACT);
  });

  it("another user's save cannot clear it", async () => {
    const sql = await db();
    await writeJobExtract(sql, "alice", "job-a", EXTRACT);
    await applyExtractOnSave(sql, "bob", "job-a", null);
    assert.deepEqual(await readJobExtract(sql, "alice", "job-a"), EXTRACT);
  });
});
