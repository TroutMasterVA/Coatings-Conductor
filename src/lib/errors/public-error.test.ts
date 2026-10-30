import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  GENERIC_ERROR_MESSAGE,
  PUBLIC_MESSAGES,
  PublicError,
  REF_LENGTH,
  buildServerErrorLog,
  isProductionEnv,
  isPublicError,
  makeRef,
  publicMessageOr,
  redact,
  sanitize,
  toBrowserError,
  withPublicErrors,
  type ServerErrorLog,
} from "./public-error.ts";
import { NOT_YOUR_JOB_MESSAGE } from "../guest-import.ts";
import { JOB_CLOSED_DELETE_MESSAGE, JOB_CLOSED_MESSAGE } from "../job-close.ts";
import { FORECAST_RATE_LIMIT_MESSAGE } from "../forecast-cap.ts";
import { FORECAST_UNAVAILABLE_MESSAGE, ForecastUnavailableError } from "../forecast-sources.ts";
import { NO_SHEET_MESSAGE, SHEET_UNREADABLE_MESSAGE } from "../sheet-gate.ts";

const REF_RE = /\(Ref: ([A-Z0-9]{10})\)$/;

/** An internal error like the ones the local production probe leaked before this change. */
function internalError(): Error {
  const err = new Error("connect ECONNREFUSED 127.0.0.1:5432 for postgres://app:hunter2@db.internal:5432/cc");
  err.stack = `${err.message}\n    at Pool.connect (/var/task/.output/server/_libs/pg.mjs:3553:11)\n    at loadWorkspace (/workspace/cc-err/src/lib/project-store.ts:108:5)`;
  (err as { code?: string }).code = "ECONNREFUSED";
  return err;
}

function capture() {
  const logs: ServerErrorLog[] = [];
  return { logs, logger: (e: ServerErrorLog) => logs.push(e) };
}

function assertNoInternals(text: string) {
  for (const leak of ["ECONNREFUSED", "127.0.0.1", "postgres://", "hunter2", ".mjs", ".ts:", "/workspace/", "/var/task/", "    at "]) {
    assert.ok(!text.includes(leak), `browser text must not include ${JSON.stringify(leak)}: ${text}`);
  }
}

describe("public-error: unexpected errors in production", () => {
  it("become the plain message plus a ref id, with no stack, paths or internal message", () => {
    const { logs, logger } = capture();
    const out = toBrowserError(internalError(), { where: "serverFn:loadWorkspace", production: true, logger });
    assert.ok(out instanceof Error);
    const m = REF_RE.exec(out.message);
    assert.ok(m, `ref id missing: ${out.message}`);
    assert.equal(out.message, `${GENERIC_ERROR_MESSAGE} (Ref: ${m[1]})`);
    assert.equal(out.stack, undefined, "sanitized error carries no stack");
    assert.equal((out as { code?: unknown }).code, undefined);
    assert.equal((out as { cause?: unknown }).cause, undefined);
    assertNoInternals(JSON.stringify({ ...out, message: out.message, stack: out.stack }));
    assert.equal(logs.length, 1);
  });

  it("a TypeError from bad input (the probe's createProject(null) case) is sanitized too", () => {
    const { logger } = capture();
    let thrown: unknown;
    try {
      (null as unknown as { name: string }).name.trim();
    } catch (err) {
      thrown = err;
    }
    const out = toBrowserError(thrown, { where: "serverFn:createProject", production: true, logger }) as Error;
    assert.ok(REF_RE.test(out.message));
    assert.ok(!out.message.includes("Cannot read properties"));
  });

  it("non-Error throws (strings, objects) are sanitized", () => {
    const { logger } = capture();
    for (const thrown of ["db password=hunter2 failed", { message: "relation \"projects\" does not exist" }, 42]) {
      const out = toBrowserError(thrown, { where: "x", production: true, logger }) as Error;
      assert.ok(REF_RE.test(out.message), String(out.message));
      assert.ok(!out.message.includes("hunter2") && !out.message.includes("relation"));
    }
  });

  it("ref ids are random and the expected length", () => {
    const refs = new Set(Array.from({ length: 200 }, () => makeRef()));
    assert.equal(refs.size, 200);
    for (const r of refs) assert.match(r, new RegExp(`^[A-Z0-9]{${REF_LENGTH}}$`));
  });

  it("in-band messages ({ ok: false, error }) are sanitized the same way", () => {
    const { logs, logger } = capture();
    const msg = publicMessageOr(new TypeError("Cannot read properties of null (reading 'ambientTempMinF')"), {
      where: "serverFn:loadForecast",
      production: true,
      logger,
      fallback: "Forecast unavailable: something went wrong on our side. This is not a GO. Try again later.",
    });
    assert.match(msg, /^Forecast unavailable: .*This is not a GO.* \(Ref: [A-Z0-9]{10}\)$/);
    assert.ok(!msg.includes("ambientTempMinF"));
    assert.equal(logs[0]!.ref, REF_RE.exec(msg)![1]);
  });
});

describe("public-error: the ref id and details go to the server log only", () => {
  it("logs the same ref id with name, message, code and stack", () => {
    const { logs, logger } = capture();
    const out = toBrowserError(internalError(), { where: "serverFn:closeProject", production: true, logger }) as Error;
    const ref = REF_RE.exec(out.message)![1];
    assert.equal(logs.length, 1);
    const entry = logs[0]!;
    assert.equal(entry.ref, ref);
    assert.equal(entry.where, "serverFn:closeProject");
    assert.equal(entry.event, "server_error");
    assert.equal(entry.code, "ECONNREFUSED");
    assert.ok(entry.message.includes("ECONNREFUSED"));
    assert.ok(entry.stack?.includes("project-store.ts:108"), "stack is kept in the server log");
  });

  it("the default logger writes one JSON line with the ref id to console.error", () => {
    const lines: string[] = [];
    const orig = console.error;
    console.error = (...a: unknown[]) => void lines.push(a.map(String).join(" "));
    try {
      const out = toBrowserError(new Error("boom inside"), { where: "serverFn:deleteProject", production: true }) as Error;
      const ref = REF_RE.exec(out.message)![1]!;
      assert.equal(lines.length, 1);
      const parsed = JSON.parse(lines[0]!) as ServerErrorLog;
      assert.equal(parsed.ref, ref);
      assert.equal(parsed.message, "boom inside");
    } finally {
      console.error = orig;
    }
  });

  it("removes emails, passwords, tokens and URL credentials from the log", () => {
    const err = new Error(
      'login failed for inspector@example.com password=hunter2 {"password":"s3cret"} Authorization: Bearer abc.def.ghi via postgres://app:pw@db:5432/cc token=xyz',
    );
    const entry = buildServerErrorLog(err, "api/auth", "ABCDEFGHJK");
    for (const secret of ["inspector@example.com", "hunter2", "s3cret", "abc.def.ghi", "app:pw", "xyz"]) {
      assert.ok(!entry.message.includes(secret), `${secret} leaked into the log: ${entry.message}`);
      assert.ok(!(entry.stack ?? "").includes(secret), `${secret} leaked into the logged stack`);
    }
    assert.ok(entry.message.includes("[email]"));
    assert.equal(redact("plain text stays"), "plain text stays");
  });
});

describe("public-error: intentional errors pass through unchanged", () => {
  it("every allowlisted message is kept, same object, in production", () => {
    for (const message of PUBLIC_MESSAGES) {
      const { logs, logger } = capture();
      const err = new Error(message);
      assert.equal(toBrowserError(err, { where: "x", production: true, logger }), err, message);
      assert.equal(logs.length, 0, "public errors are not logged as server errors");
    }
  });

  it("the allowlist matches the app's exported message constants", () => {
    for (const m of [
      NOT_YOUR_JOB_MESSAGE,
      JOB_CLOSED_MESSAGE,
      JOB_CLOSED_DELETE_MESSAGE,
      FORECAST_RATE_LIMIT_MESSAGE,
      FORECAST_UNAVAILABLE_MESSAGE,
      SHEET_UNREADABLE_MESSAGE,
      NO_SHEET_MESSAGE,
    ]) {
      assert.ok(PUBLIC_MESSAGES.has(m), `missing from PUBLIC_MESSAGES: ${m}`);
    }
    assert.equal(NOT_YOUR_JOB_MESSAGE, "Project not found.");
  });

  it("coded error classes keep their message (Unauthorized, cross-site 403, forecast unavailable)", () => {
    const unauthorized = Object.assign(new Error("Unauthorized"), { name: "UnauthorizedError", status: 401 });
    const crossSite = Object.assign(new Error("Forbidden: cross-site request blocked"), { name: "CrossSiteRequestError" });
    const fu = new ForecastUnavailableError("Forecast unavailable: custom text");
    for (const err of [unauthorized, crossSite, fu]) {
      assert.ok(isPublicError(err));
      assert.equal(toBrowserError(err, { where: "x", production: true, logger: () => {} }), err);
    }
  });

  it("a PublicError keeps its message and code", () => {
    const err = new PublicError("Too many tries. Wait 15 minutes.", { code: "ACCOUNT_LOCKED", status: 429 });
    const out = toBrowserError(err, { where: "x", production: true, logger: () => {} });
    assert.equal(out, err);
    assert.equal((out as PublicError).code, "ACCOUNT_LOCKED");
  });

  it("an already-sanitized message is not sanitized twice", () => {
    const first = toBrowserError(new Error("x"), { where: "a", production: true, logger: () => {} }) as Error;
    const second = toBrowserError(first, { where: "b", production: true, logger: () => {} }) as Error;
    assert.equal(second.message, first.message);
  });

  it("redirect / notFound control flow passes untouched", () => {
    const notFound = { isNotFound: true };
    const redirect = new Response(null, { status: 307, headers: { Location: "/" } });
    assert.equal(toBrowserError(notFound, { where: "x", production: true }), notFound);
    assert.equal(toBrowserError(redirect, { where: "x", production: true }), redirect);
  });
});

describe("public-error: development keeps details", () => {
  it("outside production the original error is returned (still logged with a ref)", () => {
    const { logs, logger } = capture();
    const err = internalError();
    assert.equal(toBrowserError(err, { where: "x", production: false, logger }), err);
    assert.equal(logs.length, 1);
    assert.equal(publicMessageOr(err, { where: "x", production: false, logger }), err.message);
  });

  it("production is NODE_ENV=production, not VERCEL", () => {
    assert.equal(isProductionEnv({ NODE_ENV: "production" }), true);
    assert.equal(isProductionEnv({ NODE_ENV: "development" }), false);
    assert.equal(isProductionEnv({ VERCEL: "1" } as { NODE_ENV?: string }), false);
    assert.equal(isProductionEnv(undefined), false);
  });

  it("sanitize() reports public vs unexpected", () => {
    assert.deepEqual(sanitize(new Error("Project not found."), { where: "x" }), { public: true, message: "Project not found." });
    const s = sanitize(new Error("nope"), { where: "x", logger: () => {} });
    assert.equal(s.public, false);
  });
});

describe("public-error: API route wrapper", () => {
  it("passes returned responses through unchanged (coded 4xx/5xx bodies)", async () => {
    const body = JSON.stringify({ status: "degraded", db: "down", build: "dev" });
    const h = withPublicErrors("GET /api/health", () => new Response(body, { status: 503 }), { production: true });
    const res = await h();
    assert.equal(res.status, 503);
    assert.equal(await res.text(), body);
  });

  it("turns a thrown error into a 500 { message, ref } JSON body in production", async () => {
    const { logs, logger } = capture();
    const h = withPublicErrors("api/auth", async (_: { request: Request }) => {
      throw internalError();
    }, { production: true, logger });
    const res = await h({ request: new Request("http://x/api/auth/get-session") });
    assert.equal(res.status, 500);
    assert.equal(res.headers.get("cache-control"), "no-store");
    const text = await res.text();
    assertNoInternals(text);
    const json = JSON.parse(text) as { message: string; ref: string };
    assert.equal(Object.keys(json).sort().join(","), "message,ref");
    assert.match(json.ref, /^[A-Z0-9]{10}$/);
    assert.equal(json.message, `${GENERIC_ERROR_MESSAGE} (Ref: ${json.ref})`);
    assert.equal(logs[0]!.ref, json.ref);
    assert.equal(logs[0]!.where, "api/auth");
  });

  it("rethrows in development, and rethrows Better Auth APIErrors unchanged", async () => {
    const err = internalError();
    await assert.rejects(withPublicErrors("x", () => Promise.reject(err), { production: false, logger: () => {} })(), err);
    const apiErr = Object.assign(new Error("Too many requests"), { name: "APIError", statusCode: 429 });
    await assert.rejects(withPublicErrors("x", () => Promise.reject(apiErr), { production: true })(), apiErr);
  });

  it("a public error thrown from a route keeps its message and status", async () => {
    const h = withPublicErrors("x", () => {
      throw Object.assign(new Error("Unauthorized"), { name: "UnauthorizedError", status: 401 });
    }, { production: true });
    const res = await h();
    assert.equal(res.status, 401);
    assert.deepEqual(await res.json(), { message: "Unauthorized" });
  });
});
