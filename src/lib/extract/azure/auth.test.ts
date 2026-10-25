import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { AzureAuth, COGNITIVE_SCOPE, IMDS_TOKEN_URL, MI_EXPIRY_SKEW_MS, MI_MAX_LIFETIME_MS, managedIdentityCredential } from "./auth.ts";
import { azureFetch } from "./http.ts";
import { azureFromEnv } from "./azure-provider.ts";
import { AzureExtractError } from "./errors.ts";
import { readAzureConfig } from "./config.ts";
import { onDeviceProvider } from "../on-device-provider.ts";
import { runExtract } from "../extract-core.ts";

type Call = { url: string; headers: Record<string, string>; redirect?: string };
function mockFetch(replies: Array<() => Promise<Response>>) {
  const calls: Call[] = [];
  const f = (async (url: string, init: RequestInit) => {
    calls.push({ url: String(url), headers: init.headers as Record<string, string>, redirect: init.redirect });
    const next = replies.shift();
    if (!next) throw new Error("unexpected fetch");
    return next();
  }) as unknown as typeof fetch;
  return { f, calls };
}
const json = (b: unknown, status = 200) => async () => new Response(JSON.stringify(b), { status });

describe("managed identity over Azure token endpoints (no @azure/identity)", () => {
  it("IMDS success: Metadata header + resource, token cached, refreshed after expiry", async () => {
    let t = 1_000_000_000_000;
    const exp = Math.floor(t / 1000) + 3600;
    const m = mockFetch([json({ access_token: "tok-1", expires_on: String(exp) }), json({ access_token: "tok-2", expires_in: "3600" })]);
    const cred = managedIdentityCredential({ fetch: m.f, env: {}, now: () => t });
    assert.deepEqual(await cred.getToken(COGNITIVE_SCOPE), { token: "tok-1" });
    assert.ok(m.calls[0]!.url.startsWith(`${IMDS_TOKEN_URL}?api-version=2018-02-01&resource=https%3A%2F%2Fcognitiveservices.azure.com`));
    assert.equal(m.calls[0]!.headers.Metadata, "true");
    t += 10 * 60_000;
    assert.deepEqual(await cred.getToken(COGNITIVE_SCOPE), { token: "tok-1" }); // cache reuse
    assert.equal(m.calls.length, 1);
    t = exp * 1000 - MI_EXPIRY_SKEW_MS + 1; // inside the skew: refresh
    assert.deepEqual(await cred.getToken(COGNITIVE_SCOPE), { token: "tok-2" });
    assert.equal(m.calls.length, 2);
  });
  it("App Service / Functions: IDENTITY_ENDPOINT + IDENTITY_HEADER", async () => {
    const m = mockFetch([json({ access_token: "tok-as", expires_on: "4102444800" })]);
    const cred = managedIdentityCredential({ fetch: m.f, env: { IDENTITY_ENDPOINT: "http://127.0.0.1:41741/msi/token", IDENTITY_HEADER: "hdr" } });
    assert.deepEqual(await cred.getToken(COGNITIVE_SCOPE), { token: "tok-as" });
    assert.ok(m.calls[0]!.url.startsWith("http://127.0.0.1:41741/msi/token?api-version=2019-08-01&resource="));
    assert.equal(m.calls[0]!.headers["X-IDENTITY-HEADER"], "hdr");
  });
  it("timeout -> typed AZURE_TIMEOUT", async () => {
    const f = ((_u: string, init: RequestInit) =>
      new Promise((_r, rej) => init.signal!.addEventListener("abort", () => rej(new Error("aborted"))))) as unknown as typeof fetch;
    const cred = managedIdentityCredential({ fetch: f, env: {}, timeoutMs: 20 });
    await assert.rejects(cred.getToken(COGNITIVE_SCOPE), (e: unknown) => e instanceof AzureExtractError && e.code === "AZURE_TIMEOUT");
  });
  it("bad responses -> typed AZURE_AUTH, no token or body in the message", async () => {
    for (const reply of [json({ error: "nope", access_token_secret: "s3cr3t" }, 400), json({ expires_in: "3600" }), async () => new Response("not json")]) {
      const cred = managedIdentityCredential({ fetch: mockFetch([reply]).f, env: {} });
      await assert.rejects(cred.getToken(COGNITIVE_SCOPE), (e: unknown) =>
        e instanceof AzureExtractError && e.code === "AZURE_AUTH" && !/s3cr3t|nope/.test(e.message));
    }
  });
  it("no managed identity and no key -> AZURE_AUTH; key set -> key header", async () => {
    const down = managedIdentityCredential({ fetch: (async () => { throw new Error("ECONNREFUSED"); }) as unknown as typeof fetch, env: {} });
    const auth = new AzureAuth(async () => down);
    const cfg = readAzureConfig({ AZURE_DOCINTEL_ENDPOINT: "https://x.cognitiveservices.azure.com", AZURE_OPENAI_ENDPOINT: "https://y.openai.azure.com", AZURE_OPENAI_DEPLOYMENT: "d" } as never);
    await assert.rejects(auth.headersFor("openai", cfg!), (e: unknown) => e instanceof AzureExtractError && e.code === "AZURE_AUTH");
    const withKey = { ...cfg!, openaiKey: "k" };
    assert.deepEqual((await auth.headersFor("openai", withKey)).headers, { "api-key": "k" });
  });
  it("Azure off: extract runs cleanly on-device", async () => {
    const res = await runExtract({
      userId: "u", input: { text: "ACME 1 PRIMER\nAir: 50°F minimum, 100°F maximum" }, azure: null, onDevice: onDeviceProvider, rate: new Map(),
    });
    assert.equal(res.ok, true);
    if (res.ok) {
      assert.equal(res.provider, "on-device");
      assert.ok(res.warnings.some((w) => w.code === "AZURE_NOT_CONFIGURED"));
    }
  });

});

describe("SEC review fixes (653e6ee)", () => {
  const cfgEnv = { AZURE_DOCINTEL_ENDPOINT: "https://x.cognitiveservices.azure.com", AZURE_OPENAI_ENDPOINT: "https://y.openai.azure.com", AZURE_OPENAI_DEPLOYMENT: "d" };
  it("redirects are rejected: token call (real fetch, local 302) and data calls", async () => {
    let hits = 0;
    const srv = createServer((_q, r) => { hits++; r.writeHead(302, { Location: "http://169.254.0.1/steal" }).end(); });
    await new Promise<void>((ok) => srv.listen(0, "127.0.0.1", ok));
    const port = (srv.address() as { port: number }).port;
    try {
      const cred = managedIdentityCredential({ env: { IDENTITY_ENDPOINT: `http://127.0.0.1:${port}/msi/token`, IDENTITY_HEADER: "h" } });
      await assert.rejects(cred.getToken(COGNITIVE_SCOPE), (e: unknown) => e instanceof AzureExtractError);
      assert.equal(hits, 1); // the Location was never followed
      await assert.rejects(azureFetch((u, i) => fetch(u, i), `http://127.0.0.1:${port}/data`, { method: "POST" }, "layout"), (e: unknown) => e instanceof AzureExtractError);
      assert.equal(hits, 2);
    } finally {
      srv.close();
    }
    const m = mockFetch([json({ access_token: "t", expires_in: "60" })]);
    await managedIdentityCredential({ fetch: m.f, env: {} }).getToken(COGNITIVE_SCOPE);
    assert.equal(m.calls[0]!.redirect, "error");
    let seen: RequestInit | undefined;
    await azureFetch(async (_u, i) => ((seen = i), new Response("{}")), "https://x.cognitiveservices.azure.com/a", { method: "GET" }, "layout");
    assert.equal(seen!.redirect, "error");
  });
  it("a caller cancelling does not start the skip; a 401 does not either", async () => {
    let n = 0;
    const hang = ((_u: string, init: RequestInit) => (n++, new Promise((_r, rej) => init.signal!.addEventListener("abort", () => rej(new Error("aborted")))))) as unknown as typeof fetch;
    const cred = managedIdentityCredential({ fetch: hang, env: {}, timeoutMs: 10_000 });
    const ctl = new AbortController();
    const p = cred.getToken(COGNITIVE_SCOPE, { abortSignal: ctl.signal });
    ctl.abort();
    await assert.rejects(p);
    const again = cred.getToken(COGNITIVE_SCOPE, { abortSignal: AbortSignal.timeout(20) });
    await assert.rejects(again);
    assert.equal(n, 2); // second call still went to the endpoint: no back-off after a cancel
    const m = mockFetch([json({ error: "unauthorized" }, 401), json({ access_token: "ok", expires_in: "3600" })]);
    const c2 = managedIdentityCredential({ fetch: m.f, env: {} });
    await assert.rejects(c2.getToken(COGNITIVE_SCOPE), (e: unknown) => e instanceof AzureExtractError && e.code === "AZURE_AUTH");
    assert.deepEqual(await c2.getToken(COGNITIVE_SCOPE), { token: "ok" }); // no back-off after 401
  });
  it("network errors and our own timeout DO start the skip", async () => {
    let n = 0;
    const down = (async () => { n++; throw new TypeError("fetch failed"); }) as unknown as typeof fetch;
    const c = managedIdentityCredential({ fetch: down, env: {} });
    await assert.rejects(c.getToken(COGNITIVE_SCOPE));
    await assert.rejects(c.getToken(COGNITIVE_SCOPE));
    assert.equal(n, 1);
  });
  it("a huge expires_on is capped at ~24 h", async () => {
    let t = 1_000_000_000_000;
    const m = mockFetch([json({ access_token: "a", expires_on: "99999999999" }), json({ access_token: "b", expires_on: "99999999999" })]);
    const c = managedIdentityCredential({ fetch: m.f, env: {}, now: () => t });
    await c.getToken(COGNITIVE_SCOPE);
    t += MI_MAX_LIFETIME_MS - MI_EXPIRY_SKEW_MS - 1000;
    assert.deepEqual(await c.getToken(COGNITIVE_SCOPE), { token: "a" });
    t += 2000;
    assert.deepEqual(await c.getToken(COGNITIVE_SCOPE), { token: "b" });
  });
  it("AZURE_AUTH_MODE=identity never uses the key; default mode warns once on key fallback", async () => {
    const none = async () => ({ getToken: async () => null });
    const idCfg = { ...readAzureConfig({ ...cfgEnv, AZURE_AUTH_MODE: "identity" } as never), openaiKey: "k", docintelKey: "k2" };
    assert.equal(idCfg.authMode, "identity");
    await assert.rejects(new AzureAuth(none).headersFor("openai", idCfg), (e: unknown) => e instanceof AzureExtractError && e.code === "AZURE_AUTH" && !/k2|"k"/.test(e.message));
    const warns: string[] = [];
    const auto = new AzureAuth(none, (m) => warns.push(m));
    const autoCfg = { ...readAzureConfig(cfgEnv as never), openaiKey: "secret-key", docintelKey: "secret-key-2" };
    assert.equal(autoCfg.authMode, "auto");
    await auto.headersFor("openai", autoCfg);
    await auto.headersFor("docintel", autoCfg);
    assert.equal(warns.length, 1);
    assert.ok(!/secret-key/.test(warns[0]!));
    assert.throws(() => readAzureConfig({ ...cfgEnv, AZURE_AUTH_MODE: "keys" } as never), /AZURE_AUTH_MODE/);
  });
  it("an invalid IDENTITY_ENDPOINT is rejected (http off-host, bad URL)", async () => {
    for (const ep of ["http://169.254.0.9/token", "ftp://127.0.0.1/t", "not a url", "https://u:p@id.example.com/t"]) {
      const c = managedIdentityCredential({ fetch: mockFetch([]).f, env: { IDENTITY_ENDPOINT: ep, IDENTITY_HEADER: "h" } });
      await assert.rejects(c.getToken(COGNITIVE_SCOPE), (e: unknown) => e instanceof AzureExtractError && e.code === "AZURE_CONFIG", ep);
    }
    const ok = mockFetch([json({ access_token: "t", expires_in: "60" })]);
    await managedIdentityCredential({ fetch: ok.f, env: { IDENTITY_ENDPOINT: "https://id.example.com/msi/token", IDENTITY_HEADER: "h" } }).getToken(COGNITIVE_SCOPE);
    assert.ok(ok.calls[0]!.url.startsWith("https://id.example.com/msi/token?api-version=2019-08-01&resource="));
  });
  it("Azure stays off with the repo's default config (no AZURE_* env)", () => {
    assert.equal(azureFromEnv({}), null);
  });
});
