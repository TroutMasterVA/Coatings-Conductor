import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { trustedHostsFromEnv, trustedOriginsFromEnv } from "./preview.ts";

describe("auth trusted origins (exact hosts from env only)", () => {
  it("rejects wildcard origins", () => {
    const o = trustedOriginsFromEnv({
      NODE_ENV: "production",
      AUTH_TRUSTED_ORIGINS: "https://*.vercel.app,*.grok-sandbox.com, *",
    });
    assert.deepEqual(o, []);
    assert.equal(trustedOriginsFromEnv({}).some((x) => x.includes("*")), false);
  });

  it("accepts the exact env host and Vercel's own hosts", () => {
    const env = {
      NODE_ENV: "production",
      VERCEL: "1",
      AUTH_TRUSTED_ORIGINS: "https://cc.example.com",
      VERCEL_BRANCH_URL: "app-git-branch-team.vercel.app",
      VERCEL_URL: "app-abc123-team.vercel.app",
    };
    assert.deepEqual(trustedOriginsFromEnv(env), [
      "https://cc.example.com",
      "https://app-git-branch-team.vercel.app",
      "https://app-abc123-team.vercel.app",
    ]);
    assert.equal(trustedHostsFromEnv(env).includes("evil.vercel.app"), false);
  });

  it("adds loopback dev origins only outside production", () => {
    assert.ok(trustedOriginsFromEnv({}).includes("http://localhost:8080"));
    assert.equal(trustedOriginsFromEnv({ NODE_ENV: "production" }).includes("http://localhost:8080"), false);
  });

  it("never trusts grok.me", () => {
    assert.equal(trustedOriginsFromEnv({ AUTH_TRUSTED_ORIGINS: "x.example" }).some((h) => h.includes("grok.me")), false);
  });
});
