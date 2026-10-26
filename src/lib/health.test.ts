import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  appVersionFromEnv,
  buildIdFromEnv,
  checkHealth,
  extractProviderFromEnv,
  healthResponse,
} from "./health.ts";

const AZURE_ENV = {
  AZURE_DOCINTEL_ENDPOINT: "https://example-docintel.cognitiveservices.azure.com/",
  AZURE_OPENAI_ENDPOINT: "https://example-openai.openai.azure.com/",
  AZURE_OPENAI_DEPLOYMENT: "vision-deployment",
  AZURE_OPENAI_API_VERSION: "2024-10-21",
  AZURE_OPENAI_API_KEY: "placeholder-not-a-real-key",
};

describe("health check", () => {
  it("returns 200 ok when the DB ping succeeds", async () => {
    let pinged = 0;
    const res = await checkHealth({
      dbSource: "postgres",
      env: { APP_VERSION: "1.2.3" },
      ping: async () => {
        pinged += 1;
      },
    });
    assert.equal(pinged, 1);
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, {
      status: "ok",
      db: "ok",
      build: "dev",
    });
  });

  it("returns 503 degraded when the DB ping rejects", async () => {
    const res = await checkHealth({
      dbSource: "postgres",
      env: {},
      ping: async () => {
        throw new Error("connect ECONNREFUSED postgres://user:secret@db:5432/app");
      },
    });
    assert.equal(res.status, 503);
    assert.equal(res.body.status, "degraded");
    assert.equal(res.body.db, "down");
    // The error text (which may contain a connection string) must not leak.
    assert.ok(!JSON.stringify(res.body).includes("secret"));
  });

  it("returns 503 when the DB ping throws synchronously", async () => {
    const res = await checkHealth({
      dbSource: "pglite",
      env: {},
      ping: () => {
        throw new Error("boom");
      },
    });
    assert.equal(res.status, 503);
  });

  it("returns 503 when the DB ping hangs past the timeout", async () => {
    const res = await checkHealth({
      dbSource: "postgres",
      env: {},
      timeoutMs: 20,
      ping: () => new Promise(() => {}),
    });
    assert.equal(res.status, 503);
    assert.equal(res.body.db, "down");
  });

  it("reports azure only when the full Azure config is present, never its values", async () => {
    assert.equal(extractProviderFromEnv({}), "on-device");
    assert.equal(
      extractProviderFromEnv({ ...AZURE_ENV, AZURE_OPENAI_DEPLOYMENT: "  " }),
      "on-device",
    );
    assert.equal(extractProviderFromEnv(AZURE_ENV), "azure");

    const res = await checkHealth({ dbSource: "postgres", env: { ...AZURE_ENV, GITHUB_SHA: "deadbeef1234" }, ping: async () => {} });
    // SEC: public body is status words plus a 7-char build id only — no full commit id, DB type
    // or reader provider. (Intended: PO-approved short build id, Oct 26.)
    assert.deepEqual(Object.keys(res.body).sort(), ["build", "db", "status"]);
    assert.equal(res.body.build, "deadbee");
    const text = JSON.stringify(res.body);
    for (const value of Object.values(AZURE_ENV)) {
      assert.ok(!text.includes(value), `health body leaked ${value}`);
    }
    for (const leak of ["deadbeef", "postgres", "azure", "version"]) assert.ok(!text.includes(leak), leak);
  });

  it("derives a short, printable version", () => {
    assert.equal(appVersionFromEnv({}), "dev");
    assert.equal(appVersionFromEnv({ GITHUB_SHA: "abc123" }), "abc123");
    assert.equal(appVersionFromEnv({ APP_VERSION: "v1", GITHUB_SHA: "abc" }), "v1");
    assert.equal(appVersionFromEnv({ APP_VERSION: "<script>" }), "script");
    assert.ok(appVersionFromEnv({ APP_VERSION: "x".repeat(500) }).length <= 64);
  });

  it("builds a no-store JSON response", async () => {
    const res = healthResponse({
      status: 503,
      body: {
        status: "degraded",
        db: "down",
        build: "dev",
      },
    });
    assert.equal(res.status, 503);
    assert.equal(res.headers.get("cache-control"), "no-store");
    assert.match(res.headers.get("content-type") ?? "", /application\/json/);
    assert.equal((await res.json()).db, "down");
  });

  it("health includes a short build id from the deploy commit, else 'dev'", async () => {
    const sha = "f8f6228b463ad48b3a655b69b6bc166b0199cde6";
    const res = await checkHealth({ dbSource: "postgres", env: { VERCEL_GIT_COMMIT_SHA: sha }, ping: async () => {} });
    assert.equal(res.body.build, "f8f6228");
    assert.ok(!JSON.stringify(res.body).includes(sha));
    assert.equal(buildIdFromEnv({}), "dev");
    assert.equal(buildIdFromEnv({ VERCEL_GIT_COMMIT_SHA: "<script>" }), "dev");
    const down = await checkHealth({ dbSource: "postgres", env: { GITHUB_SHA: sha }, ping: async () => { throw new Error("x"); } });
    assert.equal(down.body.build, "f8f6228");
  });
});
