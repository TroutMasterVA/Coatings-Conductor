import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { authSecret, loginsAvailable, loginsOffResponse, secretMode } from "./secret.server.ts";

describe("auth secret modes (SEC: no random secret in production)", () => {
  it("uses BETTER_AUTH_SECRET when set", () => {
    assert.equal(authSecret({ BETTER_AUTH_SECRET: " s3cret " , NODE_ENV: "production" }), "s3cret");
  });
  it("refuses to start in production / Docker without a secret", () => {
    assert.throws(() => secretMode({ NODE_ENV: "production" }), /BETTER_AUTH_SECRET is not set/);
    assert.throws(() => authSecret({ NODE_ENV: "production" }), /Refusing to start/);
  });
  it("refuses on Vercel Production without a secret", () => {
    assert.throws(() => secretMode({ VERCEL: "1", VERCEL_ENV: "production", NODE_ENV: "production" }));
  });
  it("turns logins off (503) on a Vercel Preview without a secret instead of crashing", async () => {
    const env = { VERCEL: "1", VERCEL_ENV: "preview", NODE_ENV: "production" };
    assert.equal(secretMode(env).kind, "logins-off");
    assert.equal(loginsAvailable(env), false);
    const res = loginsOffResponse();
    assert.equal(res.status, 503);
    assert.match((await res.json()).message, /Logins aren't set up on this copy/);
  });
  it("keeps a dev secret only for local non-production runs", () => {
    assert.equal(secretMode({}).kind, "dev");
    assert.equal(loginsAvailable({ BETTER_AUTH_SECRET: "x", VERCEL: "1", VERCEL_ENV: "preview" }), true);
  });
});
