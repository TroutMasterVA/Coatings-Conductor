/**
 * Integration-style: the real `publicErrors` server-function middleware wrapped around the same
 * domain handlers closeProject / deleteProject run (closeJob / deleteOpenProject on PGLite with the
 * real migrations), and the API route wrapper around the real /api/health and /api/auth building
 * blocks. The HTTP layer itself is covered by the local production-build probe in the PR body.
 */
import { afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { toCrossJSONAsync } from "seroval";
import type { Sql } from "../db.ts";
import { publicErrors } from "./server-fn-middleware.ts";
import { GENERIC_ERROR_MESSAGE, PublicError, withPublicErrors, type ServerErrorLog } from "./public-error.ts";
import { closeJob, deleteOpenProject, JOB_CLOSED_DELETE_MESSAGE } from "../job-close.ts";
import { NOT_YOUR_JOB_MESSAGE } from "../guest-import.ts";
import { checkHealth, healthResponse } from "../health.ts";
import { loginsOffResponse, secretMode } from "../auth/secret.server.ts";

const MIGRATIONS_DIR = new URL("../../../migrations/", import.meta.url);
const SRC_DIR = fileURLToPath(new URL("../../", import.meta.url));
const REF_RE = /\(Ref: ([A-Z0-9]{10})\)$/;

async function db(): Promise<Sql> {
  const pg = new PGlite();
  for (const f of readdirSync(MIGRATIONS_DIR).filter((f) => /^\d{4}_.*\.sql$/.test(f)).sort()) {
    await pg.exec(readFileSync(new URL(f, MIGRATIONS_DIR), "utf8"));
  }
  const run = async <T>(text: string, params: unknown[] = []) => (await pg.query<T>(text, params)).rows;
  const sql = (async (strings: TemplateStringsArray, ...values: unknown[]) => {
    let text = strings[0]!;
    values.forEach((_, i) => (text += `$${i + 1}${strings[i + 1]}`));
    return run(text, values);
  }) as Sql;
  sql.query = run as Sql["query"];
  await sql`insert into "user" ("id", "name", "email", "emailVerified") values ('alice', 'Alice', 'alice@example.com', true)`;
  await sql`
    insert into projects (id, user_id, name, zip, archived, calibration_json, site_json, card_json, pds_text,
      recents_json, outcomes_json, created_at, updated_at, last_opened_at)
    values ('job-a', 'alice', 'Tank 1', '22030', false, '{}', '{}', null, '', '[]', '[]', now(), now(), now())
  `;
  return sql;
}

/** A database that is down, the way pg reports it (the probe's "connect ECONNREFUSED 127.0.0.1:1"). */
const deadSql = (async () => {
  const err = Object.assign(new Error("connect ECONNREFUSED 10.0.0.5:5432"), { code: "ECONNREFUSED" });
  throw err;
}) as unknown as Sql;

type MwServer = (ctx: { next: () => Promise<unknown>; serverFnMeta?: { name?: string; id?: string } }) => Promise<unknown>;
const runMiddleware = publicErrors.options.server as unknown as MwServer;

/** Run a handler through the real middleware the way TanStack Start does: next() throws the chain's error. */
async function callServerFn<T>(name: string, handler: () => Promise<T>): Promise<{ ok: true; value: T } | { ok: false; error: Error }> {
  try {
    const value = (await runMiddleware({ serverFnMeta: { name }, next: async () => ({ result: await handler() }) })) as { result: T };
    return { ok: true, value: value.result };
  } catch (err) {
    return { ok: false, error: err as Error };
  }
}

let prevEnv: string | undefined;
let logs: ServerErrorLog[] = [];
let origError: typeof console.error;
beforeEach(() => {
  prevEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  logs = [];
  origError = console.error;
  console.error = (...a: unknown[]) => {
    try {
      logs.push(JSON.parse(String(a[0])) as ServerErrorLog);
    } catch {
      origError(...a);
    }
  };
});
afterEach(() => {
  if (prevEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = prevEnv;
  console.error = origError;
});

describe("server functions through publicErrors (production)", () => {
  it("closeProject: a closed job closes again (no error), a missing job keeps 'Project not found.'", async () => {
    const sql = await db();
    const ok = await callServerFn("closeProject", () => closeJob(sql, "alice", "job-a"));
    assert.ok(ok.ok);
    const missing = await callServerFn("closeProject", () => closeJob(sql, "alice", "nope"));
    assert.ok(!missing.ok);
    assert.equal(missing.error.message, NOT_YOUR_JOB_MESSAGE);
    const other = await callServerFn("closeProject", () => closeJob(sql, "mallory", "job-a"));
    assert.ok(!other.ok && other.error.message === NOT_YOUR_JOB_MESSAGE);
    assert.equal(logs.length, 0);
  });

  it("closeProject with the database down: plain message + ref, details only in the log", async () => {
    const res = await callServerFn("closeProject", () => closeJob(deadSql, "alice", "job-a"));
    assert.ok(!res.ok);
    const ref = REF_RE.exec(res.error.message)?.[1];
    assert.ok(ref, res.error.message);
    assert.equal(res.error.message, `${GENERIC_ERROR_MESSAGE} (Ref: ${ref})`);
    assert.equal(res.error.stack, undefined);
    assert.ok(!res.error.message.includes("ECONNREFUSED") && !res.error.message.includes("10.0.0.5"));
    assert.equal(logs.length, 1);
    assert.equal(logs[0]!.ref, ref);
    assert.equal(logs[0]!.where, "serverFn:closeProject");
    assert.equal(logs[0]!.code, "ECONNREFUSED");
  });

  it("deleteProject: a closed job keeps JOB_CLOSED_DELETE_MESSAGE; a missing one keeps 'Project not found.'", async () => {
    const sql = await db();
    await closeJob(sql, "alice", "job-a");
    const closed = await callServerFn("deleteProject", () => deleteOpenProject(sql, "alice", "job-a"));
    assert.ok(!closed.ok && closed.error.message === JOB_CLOSED_DELETE_MESSAGE);
    const missing = await callServerFn("deleteProject", () => deleteOpenProject(sql, "alice", "nope"));
    assert.ok(!missing.ok && missing.error.message === NOT_YOUR_JOB_MESSAGE);
    assert.equal(logs.length, 0);
  });

  it("deleteProject with a schema error: plain message + ref, no SQL text", async () => {
    const broken = (async () => {
      throw new Error('relation "projects" does not exist at character 13 (src/lib/job-close.ts:150)');
    }) as unknown as Sql;
    const res = await callServerFn("deleteProject", () => deleteOpenProject(broken, "alice", "job-a"));
    assert.ok(!res.ok);
    assert.ok(REF_RE.test(res.error.message));
    assert.ok(!/relation|projects|job-close/.test(res.error.message));
    assert.equal(logs[0]!.where, "serverFn:deleteProject");
  });

  it("an open job deletes normally through the middleware", async () => {
    const sql = await db();
    await sql`insert into projects (id, user_id, name, zip, archived, calibration_json, site_json, card_json, pds_text,
      recents_json, outcomes_json, created_at, updated_at, last_opened_at)
      values ('job-b', 'alice', 'Tank 2', '22030', false, '{}', '{}', null, '', '[]', '[]', now(), now(), now())`;
    const res = await callServerFn("deleteProject", () => deleteOpenProject(sql, "alice", "job-b"));
    assert.ok(res.ok);
  });
});

/** Same check as project-access.test.ts (#47): the error serialized the way TanStack Start does (seroval cross-JSON). */
async function body(err: unknown): Promise<string> {
  return JSON.stringify(await toCrossJSONAsync(err, { refs: new Map() }));
}

function assertNoStack(text: string) {
  assert.ok(!text.includes("stack"), `body has a stack field: ${text}`);
  assert.ok(!text.includes(".ts:") && !text.includes(".mjs:"), `body has a source location: ${text}`);
  assert.ok(!/\bat [^\s]+ \(|\n\s+at /.test(text) && !text.includes("    at "), `body has a stack frame: ${text}`);
}

/** Same shape as verify.server.ts's UnauthorizedError (that module builds Better Auth on import). */
class UnauthorizedError extends Error {
  readonly status = 401;
  constructor() {
    super("Unauthorized");
    this.name = "UnauthorizedError";
  }
}

describe("allowlisted errors through publicErrors carry no server stack (production)", () => {
  it("closeJob not-found: message survives, no stack / .ts: / at-frames in the serialized body", async () => {
    const sql = await db();
    // The original really has a server stack with a source path; the body must not.
    let original: Error | undefined;
    try {
      await closeJob(sql, "alice", "nope");
    } catch (err) {
      original = err as Error;
    }
    assert.ok(original?.stack?.includes(".ts:"), "precondition: the original error has a server stack");
    const res = await callServerFn("closeProject", () => closeJob(sql, "alice", "nope"));
    assert.ok(!res.ok);
    assert.equal(res.error.message, NOT_YOUR_JOB_MESSAGE);
    assert.equal(res.error.name, "Error");
    assert.notEqual(res.error, original);
    const text = await body(res.error);
    assert.ok(text.includes(NOT_YOUR_JOB_MESSAGE), text);
    assertNoStack(text);
  });

  it("deleteOpenProject closed job: JOB_CLOSED_DELETE_MESSAGE, no stack", async () => {
    const sql = await db();
    await closeJob(sql, "alice", "job-a");
    const res = await callServerFn("deleteProject", () => deleteOpenProject(sql, "alice", "job-a"));
    assert.ok(!res.ok && res.error.message === JOB_CLOSED_DELETE_MESSAGE);
    assertNoStack(await body(res.error));
  });

  it("UnauthorizedError: message, name and status 401 survive; no stack", async () => {
    const res = await callServerFn("loadWorkspace", async () => {
      throw new UnauthorizedError();
    });
    assert.ok(!res.ok);
    assert.equal(res.error.message, "Unauthorized");
    assert.equal(res.error.name, "UnauthorizedError");
    assert.equal((res.error as { status?: number }).status, 401);
    const text = await body(res.error);
    assert.ok(text.includes("Unauthorized"), text);
    assertNoStack(text);
  });

  it("validator message (createProject 'Enter a 5-digit US ZIP.'): survives without a stack", async () => {
    const res = await callServerFn("createProject", async () => {
      throw new Error("Enter a 5-digit US ZIP.");
    });
    assert.ok(!res.ok && res.error.message === "Enter a 5-digit US ZIP.");
    assertNoStack(await body(res.error));
  });

  it("PublicError: message, name and code survive; no stack, no cause", async () => {
    const res = await callServerFn("extractSheet", async () => {
      throw new PublicError("Too many tries.", { code: "RATE_LIMITED", status: 429 });
    });
    assert.ok(!res.ok);
    assert.equal(res.error.message, "Too many tries.");
    assert.equal(res.error.name, "PublicError");
    assert.equal((res.error as { code?: string }).code, "RATE_LIMITED");
    assert.equal((res.error as { cause?: unknown }).cause, undefined);
    const text = await body(res.error);
    assert.ok(text.includes("RATE_LIMITED"), text);
    assertNoStack(text);
  });

  it("development still returns the original error (with its stack)", async () => {
    process.env.NODE_ENV = "development";
    const sql = await db();
    const res = await callServerFn("closeProject", () => closeJob(sql, "alice", "nope"));
    assert.ok(!res.ok && res.error.stack?.includes(".ts:"));
  });
});

describe("API routes through withPublicErrors (production)", () => {
  it("/api/health 200 and 503 bodies are byte-for-byte unchanged", async () => {
    for (const ping of [async () => {}, async () => Promise.reject(new Error("db down"))]) {
      const direct = healthResponse(await checkHealth({ dbSource: "postgres", env: {}, ping }));
      const wrapped = await withPublicErrors("GET /api/health", async () =>
        healthResponse(await checkHealth({ dbSource: "postgres", env: {}, ping })),
      )();
      assert.equal(wrapped.status, direct.status);
      assert.equal(await wrapped.text(), await direct.text());
    }
  });

  it("/api/auth: the coded 503 (logins off) passes; a missing secret in production becomes a plain 500 + ref", async () => {
    const off = await withPublicErrors("api/auth", () => loginsOffResponse())();
    assert.equal(off.status, 503);
    assert.deepEqual(await off.json(), { code: "LOGINS_NOT_SET_UP", message: "Logins aren't set up on this copy" });

    // The auth route's real first step: secretMode() throws MISSING_SECRET_MESSAGE in production.
    const res = await withPublicErrors("api/auth", () => {
      secretMode({ NODE_ENV: "production" });
      return new Response("unreachable");
    })();
    assert.equal(res.status, 500);
    const text = await res.text();
    assert.ok(!text.includes("BETTER_AUTH_SECRET") && !text.includes("openssl"), text);
    const json = JSON.parse(text) as { message: string; ref: string };
    assert.equal(json.message, `${GENERIC_ERROR_MESSAGE} (Ref: ${json.ref})`);
    assert.equal(logs[0]!.ref, json.ref);
    assert.ok(logs[0]!.message.includes("BETTER_AUTH_SECRET"), "details stay in the server log");
  });
});

describe("coverage guard", () => {
  function files(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
      const p = join(dir, d.name);
      if (d.isDirectory()) return files(p);
      return /\.tsx?$/.test(d.name) && !/\.test\.tsx?$/.test(d.name) ? [p] : [];
    });
  }

  it("every createServerFn has publicErrors as its first middleware", () => {
    const missing: string[] = [];
    let count = 0;
    for (const f of files(SRC_DIR)) {
      const text = readFileSync(f, "utf8");
      const re = /^(?:export )?const (\w+) = createServerFn\(/gm;
      for (let m = re.exec(text); m; m = re.exec(text)) {
        count += 1;
        const chain = text.slice(m.index, text.indexOf(".handler(", m.index));
        if (!/\.middleware\(\[publicErrors\b/.test(chain)) missing.push(`${f.slice(SRC_DIR.length)}:${m[1]}`);
      }
    }
    assert.ok(count >= 12, `expected at least 12 server functions, found ${count}`);
    assert.deepEqual(missing, []);
  });

  it("every API route handler is wrapped", () => {
    const dir = join(SRC_DIR, "routes", "api");
    for (const f of files(dir)) {
      const text = readFileSync(f, "utf8");
      assert.ok(text.includes("withPublicErrors("), `${f} has an unwrapped handler`);
    }
  });
});
