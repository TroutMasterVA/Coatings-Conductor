import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { injectGrokPwaHead, grokExtensionsHeadTags } from "./grok-pwa-shared.mjs";

const TEMPLATE_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

test("injector does not add Grok builder or social login chrome", () => {
  const html =
    "<!doctype html><html><head><title>Coatings Conductor</title></head><body>Sign in</body></html>";
  const out = injectGrokPwaHead(html, { projectId: "should-not-appear" });
  assert.equal(out.includes("grok-app-builder"), false);
  assert.equal(out.includes("grok.com/grok-app-builder"), false);
  assert.equal(out.includes("/__grok/"), false);
  assert.equal(out.includes("og.grok.me"), false);
  assert.equal(/continue with google/i.test(out), false);
  assert.equal(/continue with x\b/i.test(out), false);
});

test("Grok extension tags are empty", () => {
  assert.deepEqual(grokExtensionsHeadTags("any"), []);
});

test("login route is email/password only", () => {
  const login = readFileSync(join(TEMPLATE_ROOT, "src/routes/login.tsx"), "utf8");
  assert.match(login, /Sign in/);
  assert.match(login, /Create account/);
  assert.equal(/continue with google/i.test(login), false);
  assert.equal(/continue with x\b/i.test(login), false);
  assert.equal(/genericOAuth/i.test(login), false);
});

test("vite config does not enable the Grok PWA overlay plugin", () => {
  const viteConfig = readFileSync(join(TEMPLATE_ROOT, "vite.config.ts"), "utf8");
  assert.equal(viteConfig.includes("grokPwaPlugin()"), false);
});

test("nitro middleware does not inject Grok chrome", () => {
  const middleware = readFileSync(join(TEMPLATE_ROOT, "server/middleware/grok-pwa.ts"), "utf8");
  assert.match(middleware, /return next\(\)/);
  assert.equal(middleware.includes("grok-app-builder"), false);
  assert.equal(middleware.includes("install-page.html"), false);
});
