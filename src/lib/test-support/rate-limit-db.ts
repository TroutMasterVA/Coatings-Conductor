// Test-only database helpers for the shared limiter (item 3). Never imported by app code.
// - PGLite (always): in-memory, one connection, so queries run one at a time. It proves the
//   app-level logic (reserve before the password check) but not row locking.
// - Real Postgres (only when TEST_DATABASE_URL is set, e.g. CI's postgres:16 service): a pool of
//   real connections, so the statements really overlap. Each run uses its own throwaway schema.
import { readdirSync, readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import pg from "pg";
import type { Sql } from "../db";

const MIGRATIONS_DIR = new URL("../../../migrations/", import.meta.url);

export function migrationFiles(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();
}

function toSql(run: <T>(text: string, params: unknown[]) => Promise<T[]>): Sql {
  const sql = (async (strings: TemplateStringsArray, ...values: unknown[]) => {
    let text = strings[0]!;
    values.forEach((_, i) => (text += `$${i + 1}${strings[i + 1]}`));
    return run(text, values);
  }) as Sql;
  sql.query = ((text: string, params: unknown[] = []) => run(text, params)) as Sql["query"];
  return sql;
}

export type TestDb = { kind: "pglite" | "postgres"; sql: Sql; pglite?: PGlite; pool?: pg.Pool; close: () => Promise<void> };

export async function pgliteDb(): Promise<TestDb> {
  const db = new PGlite();
  for (const f of migrationFiles()) await db.exec(readFileSync(new URL(f, MIGRATIONS_DIR), "utf8"));
  return {
    kind: "pglite",
    pglite: db,
    sql: toSql(async <T>(text: string, params: unknown[]) => (await db.query<T>(text, params)).rows),
    close: () => db.close(),
  };
}

export const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL?.trim() || "";

export async function postgresDb(poolMax = 25): Promise<TestDb> {
  if (!TEST_DATABASE_URL) throw new Error("TEST_DATABASE_URL is not set");
  const schema = `rl_test_${randomBytes(6).toString("hex")}`;
  const admin = new pg.Pool({ connectionString: TEST_DATABASE_URL, max: 1 });
  await admin.query(`create schema ${schema}`);
  const pool = new pg.Pool({
    connectionString: TEST_DATABASE_URL,
    max: poolMax,
    options: `-c search_path=${schema}`,
  });
  for (const f of migrationFiles()) await pool.query(readFileSync(new URL(f, MIGRATIONS_DIR), "utf8"));
  return {
    kind: "postgres",
    pool,
    sql: toSql(async <T>(text: string, params: unknown[]) => (await pool.query(text, params)).rows as T[]),
    close: async () => {
      await pool.end();
      await admin.query(`drop schema ${schema} cascade`);
      await admin.end();
    },
  };
}
