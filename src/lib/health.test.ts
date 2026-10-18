import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  appVersionFromEnv,
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
      dbSource: "postgres",
      extractProvider: "on-device",
      version: "1.2.3",
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

    const res = await checkHealth({ dbSource: "postgres", env: AZURE_ENV, ping: async () => {} });
    assert.equal(res.body.extractProvider, "azure");
    const text = JSON.stringify(res.body);
    for (const value of Object.values(AZURE_ENV)) {
      assert.ok(!text.includes(value), `health body leaked ${value}`);
    }
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
        dbSource: "pglite",
        extractProvider: "on-device",
        version: "dev",
      },
    });
    assert.equal(res.status, 503);
    assert.equal(res.headers.get("cache-control"), "no-store");
    assert.match(res.headers.get("content-type") ?? "", /application\/json/);
    assert.equal((await res.json()).db, "down");
  });
});
