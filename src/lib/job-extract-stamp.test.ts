import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import type { Sql } from "./db.ts";
import type { SavedExtract } from "./extract/provider.ts";
import { heuristicExtract } from "./heuristic-extract.ts";
import { parseSavedExtract, planExtractSave, readJobExtract, saveJobCard, writeJobExtract } from "./job-extract.ts";
import type { FieldCardData } from "./types.ts";

const SHEET = `Product data sheet. Epoxy coating.
Mix Ratio: 1:1 by volume
Pot life: 4 hours at 77°F
Surface temperature 35°F minimum. At least 5°F above the dew point.`;

function baseCard(): FieldCardData {
  const c = heuristicExtract(SHEET);
  c.environmentals.substrateTempMinF = 35;
  c.environmentals.dewPointSpreadMinF = 5;
  return c;
}

const EXTRACT: SavedExtract = {
  provider: "on-device",
  provenance: {
    "environmentals.substrateTempMinF": { page: 1, quote: "Surface temperature 35°F minimum." },
    "environmentals.dewPointSpreadMinF": { page: 1, quote: "At least 5°F above the dew point." },
    "environmentals.windMaxMph": "not-stated",
  },
  warnings: [],
  extractedAt: "2026-10-18T19:20:00.000Z",
  draft: true,
  unverifiedTemps: false,
};

async function db(): Promise<Sql> {
  const pg = new PGlite();
  for (const f of ["0001_auth.sql", "0002_projects.sql", "0003_job_extract.sql"]) {
    await pg.exec(readFileSync(new URL(`../../migrations/${f}`, import.meta.url), "utf8"));
  }
  const run = async <T>(text: string, params: unknown[] = []) => (await pg.query<T>(text, params)).rows;
  const sql = (async (strings: TemplateStringsArray, ...values: unknown[]) => {
    let text = strings[0]!;
    values.forEach((_, i) => (text += `$${i + 1}${strings[i + 1]}`));
    return run(text, values);
  }) as Sql;
  sql.query = run as Sql["query"];
  await sql`insert into "user" ("id", "name", "email", "emailVerified") values ('alice', 'Alice Inspector', 'alice@example.com', true)`;
  await sql`insert into "user" ("id", "name", "email", "emailVerified") values ('bob', '', 'bob@example.com', true)`;
  for (const [id, user] of [["job-a", "alice"], ["job-b", "bob"]]) {
    await sql`insert into projects (id, user_id, name, zip, calibration_json, site_json, card_json)
              values (${id}, ${user}, 'Job', '22030', '{}', '{}', ${JSON.stringify(baseCard())})`;
    await writeJobExtract(sql, user!, id!, EXTRACT);
  }
  return sql;
}

const T1 = "2026-10-18T19:45:00.000Z";
const T2 = "2026-10-18T19:50:00.000Z";

function edited(card: FieldCardData, f: (c: FieldCardData) => void): FieldCardData {
  const c = structuredClone(card);
  f(c);
  return c;
}

describe("server edit stamp on save (CONTRACT.md 'Edit stamp')", () => {
  it("a changed field is stamped with the server's user and time, keeping the prior sheet quote", async () => {
    const sql = await db();
    const card = edited(baseCard(), (c) => (c.environmentals.substrateTempMinF = 40));
    const plan = await saveJobCard(sql, "alice", "job-a", { card }, T1);
    assert.equal(plan?.action, "kept");
    const saved = await readJobExtract(sql, "alice", "job-a");
    assert.deepEqual(saved?.provenance["environmentals.substrateTempMinF"], {
      edited: { by: "Alice Inspector", at: T1 },
      sheetQuote: { page: 1, quote: "Surface temperature 35°F minimum." },
    });
  });

  it("untouched fields keep their quote or not-stated", async () => {
    const sql = await db();
    const card = edited(baseCard(), (c) => (c.environmentals.substrateTempMinF = 40));
    await saveJobCard(sql, "alice", "job-a", { card }, T1);
    const saved = await readJobExtract(sql, "alice", "job-a");
    assert.deepEqual(saved?.provenance["environmentals.dewPointSpreadMinF"], EXTRACT.provenance["environmentals.dewPointSpreadMinF"]);
    assert.equal(saved?.provenance["environmentals.windMaxMph"], "not-stated");
  });

  it("a field with no prior quote gets a stamp without sheetQuote", async () => {
    const sql = await db();
    const card = edited(baseCard(), (c) => (c.environmentals.windMaxMph = 15));
    await saveJobCard(sql, "alice", "job-a", { card }, T1);
    const saved = await readJobExtract(sql, "alice", "job-a");
    assert.deepEqual(saved?.provenance["environmentals.windMaxMph"], { edited: { by: "Alice Inspector", at: T1 } });
  });

  it("a client-forged `edited` is replaced (same read) or dropped (new read)", async () => {
    const sql = await db();
    const forged = {
      ...EXTRACT,
      provenance: {
        ...EXTRACT.provenance,
        "environmentals.dewPointSpreadMinF": { edited: { by: "Mallory", at: "2020-01-01T00:00:00.000Z" } },
        "environmentals.substrateTempMinF": { edited: { by: "Mallory", at: "2020-01-01T00:00:00.000Z" } },
      },
    };
    const card = edited(baseCard(), (c) => (c.environmentals.substrateTempMinF = 41));
    await saveJobCard(sql, "alice", "job-a", { card, extract: forged }, T1);
    let saved = await readJobExtract(sql, "alice", "job-a");
    // untouched field: the stored quote, not Mallory's stamp
    assert.deepEqual(saved?.provenance["environmentals.dewPointSpreadMinF"], EXTRACT.provenance["environmentals.dewPointSpreadMinF"]);
    // changed field: the server's stamp, not Mallory's
    assert.deepEqual((saved?.provenance["environmentals.substrateTempMinF"] as { edited: unknown }).edited, {
      by: "Alice Inspector",
      at: T1,
    });

    // A new read (different extractedAt) carrying forged stamps: stamps are dropped, nothing is stamped.
    await saveJobCard(sql, "alice", "job-a", { card: baseCard(), extract: { ...forged, extractedAt: T2 } }, T2);
    saved = await readJobExtract(sql, "alice", "job-a");
    assert.equal(saved?.extractedAt, T2);
    assert.ok(Object.values(saved!.provenance).every((v) => !(v && typeof v === "object" && "edited" in v)));
  });

  it("a second edit restamps by/at and keeps the original sheet quote", async () => {
    const sql = await db();
    const c1 = edited(baseCard(), (c) => (c.environmentals.substrateTempMinF = 40));
    await saveJobCard(sql, "alice", "job-a", { card: c1 }, T1);
    const c2 = edited(c1, (c) => (c.environmentals.substrateTempMinF = 45));
    await saveJobCard(sql, "alice", "job-a", { card: c2 }, T2);
    const saved = await readJobExtract(sql, "alice", "job-a");
    assert.deepEqual(saved?.provenance["environmentals.substrateTempMinF"], {
      edited: { by: "Alice Inspector", at: T2 },
      sheetQuote: { page: 1, quote: "Surface temperature 35°F minimum." },
    });
  });

  it("saving the same card again does not restamp", async () => {
    const sql = await db();
    const c1 = edited(baseCard(), (c) => (c.environmentals.substrateTempMinF = 40));
    await saveJobCard(sql, "alice", "job-a", { card: c1 }, T1);
    await saveJobCard(sql, "alice", "job-a", { card: c1 }, T2);
    const saved = await readJobExtract(sql, "alice", "job-a");
    assert.equal((saved?.provenance["environmentals.substrateTempMinF"] as { edited: { at: string } }).edited.at, T1);
  });

  it("by falls back to email when there is no display name", async () => {
    const sql = await db();
    const card = edited(baseCard(), (c) => (c.environmentals.dewPointSpreadMinF = 9));
    await saveJobCard(sql, "bob", "job-b", { card }, T1);
    const saved = await readJobExtract(sql, "bob", "job-b");
    assert.equal((saved?.provenance["environmentals.dewPointSpreadMinF"] as { edited: { by: string } }).edited.by, "bob@example.com");
  });

  it("another user cannot stamp or change the card", async () => {
    const sql = await db();
    const card = edited(baseCard(), (c) => (c.environmentals.substrateTempMinF = 99));
    assert.equal(await saveJobCard(sql, "bob", "job-a", { card }, T1), null);
    const saved = await readJobExtract(sql, "alice", "job-a");
    assert.deepEqual(saved, EXTRACT);
    const rows = await sql<{ card_json: string }>`select card_json from projects where id = 'job-a'`;
    assert.equal(JSON.parse(rows[0]!.card_json).environmentals.substrateTempMinF, 35);
  });

  it("card and extract are written by the same statement (card saved with its stamp)", async () => {
    const sql = await db();
    const card = edited(baseCard(), (c) => (c.mixing.potLife = "6 hours at 77°F"));
    await saveJobCard(sql, "alice", "job-a", { card }, T1);
    const rows = await sql<{ card_json: string; extract_json: string }>`select card_json, extract_json from projects where id = 'job-a'`;
    assert.equal(JSON.parse(rows[0]!.card_json).mixing.potLife, "6 hours at 77°F");
    assert.deepEqual(JSON.parse(rows[0]!.extract_json).provenance["mixing.potLife"], { edited: { by: "Alice Inspector", at: T1 } });
  });

  it("extract: null still clears; no stored extract means nothing to stamp", async () => {
    const sql = await db();
    await saveJobCard(sql, "alice", "job-a", { extract: null }, T1);
    assert.equal(await readJobExtract(sql, "alice", "job-a"), null);
    const card = edited(baseCard(), (c) => (c.environmentals.substrateTempMinF = 40));
    const plan = await saveJobCard(sql, "alice", "job-a", { card }, T2);
    assert.equal(plan?.extract, null);
  });
});

describe("parseSavedExtract accepts the edited shape", () => {
  it("write → read round-trip keeps stamps (the extract does not vanish on reopen)", async () => {
    const sql = await db();
    const x: SavedExtract = {
      ...EXTRACT,
      provenance: {
        ...EXTRACT.provenance,
        "environmentals.substrateTempMinF": {
          edited: { by: "Alice Inspector", at: T1 },
          sheetQuote: { page: 1, quote: "Surface temperature 35°F minimum." },
        },
        "mixing.potLife": { edited: { by: "Alice Inspector", at: T1 } },
      },
    };
    assert.equal(await writeJobExtract(sql, "alice", "job-a", x), true);
    assert.deepEqual(await readJobExtract(sql, "alice", "job-a"), x);
  });

  it("round-trips a stamp with and without sheetQuote", () => {
    const x = {
      ...EXTRACT,
      provenance: {
        a: { edited: { by: "Alice", at: T1 }, sheetQuote: { page: 2, quote: "35°F" } },
        b: { edited: { by: "Alice", at: T1 } },
      },
    };
    assert.deepEqual(parseSavedExtract(x)?.provenance, x.provenance);
  });
  it("rejects a malformed stamp", () => {
    assert.equal(parseSavedExtract({ ...EXTRACT, provenance: { a: { edited: { by: "", at: T1 } } } }), null);
    assert.equal(parseSavedExtract({ ...EXTRACT, provenance: { a: { edited: { by: "A", at: "yesterday" } } } }), null);
    assert.equal(parseSavedExtract({ ...EXTRACT, provenance: { a: { edited: { by: "A", at: T1 }, sheetQuote: { page: 0, quote: "x" } } } }), null);
  });
  it("planExtractSave is pure and stamps structural-free paths only", () => {
    const card = baseCard();
    const next = edited(card, (c) => {
      c.id = "other-id";
      c.extractedAt = T2;
      c.environmentals.substrateTempMinF = 50;
    });
    const plan = planExtractSave({ storedCard: card, storedExtract: EXTRACT, card: next, extract: undefined, editor: { by: "A", at: T1 } });
    const stamped = Object.keys(plan.extract!.provenance).filter((k) => {
      const v = plan.extract!.provenance[k];
      return v && typeof v === "object" && "edited" in v;
    });
    assert.deepEqual(stamped, ["environmentals.substrateTempMinF"]);
  });
});
