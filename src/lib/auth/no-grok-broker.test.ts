import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { GROK_PROVIDERS } from "./providers.ts";
import { emailAndPasswordEnabled } from "./email-password.ts";

const here = dirname(fileURLToPath(import.meta.url));

function readAuth(name: string): string {
  return readFileSync(join(here, name), "utf8");
}

describe("Grok auth broker is not in the running app", () => {
  it("has no broker upstreams", () => {
    assert.equal(GROK_PROVIDERS.length, 0);
  });

  it("keeps email and password on", () => {
    assert.equal(emailAndPasswordEnabled, true);
  });

  it("does not register genericOAuth or federate to auth.grok.me", () => {
    const server = readAuth("server.ts");
    assert.equal(server.includes("genericOAuth"), false);
    assert.equal(server.includes("GROK_AUTH_ISSUER"), false);
    assert.equal(server.includes("GROK_AUTH_CLIENT"), false);
    assert.equal(server.includes("auth.grok.me"), false);
    assert.equal(server.includes("signInWithOAuth2"), false);
  });

  it("does not start leftover OAuth popups", () => {
    const popup = readAuth("popup.server.ts");
    assert.equal(popup.includes("signInWithOAuth2"), false);
    assert.equal(popup.includes("genericOAuth"), false);
    assert.match(popup, /OAuth sign-in is disabled/);
  });

  it("does not bake a Grok broker client secret", () => {
    const preview = readAuth("preview.ts");
    assert.equal(preview.includes("PREVIEW_CLIENT_SECRET"), false);
    assert.equal(preview.includes("GROK_ISSUER_DEFAULT"), false);
    assert.equal(preview.includes("auth.grok.me"), false);
  });
});

describe("no preview-gate auto sign-in (SEC)", () => {
  const server = readAuth("server.ts");
  it("does not register the gate session plugin", () => {
    assert.equal(/gateIdentitySessions\s*\(/.test(server), false);
    assert.equal(server.includes("gate-session.server"), false);
    assert.equal(server.includes("GATE_PROVIDER_ID"), false);
  });
  it("turns account linking off and does not trust a host-header gate identity", () => {
    assert.match(server, /accountLinking:\s*\{\s*enabled:\s*false\s*\}/);
    assert.equal(server.includes("x-grok-identity"), false);
  });
  it("leaves email + password as the only sign-in", () => {
    assert.equal(emailAndPasswordEnabled, true);
    assert.equal(GROK_PROVIDERS.length, 0);
  });
});
