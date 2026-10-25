import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { AzureAuth, COGNITIVE_SCOPE, IMDS_TOKEN_URL, MI_EXPIRY_SKEW_MS, managedIdentityCredential } from "./auth.ts";
import { AzureExtractError } from "./errors.ts";
import { readAzureConfig } from "./config.ts";
import { onDeviceProvider } from "../on-device-provider.ts";
import { runExtract } from "../extract-core.ts";

type Call = { url: string; headers: Record<string, string> };
function mockFetch(replies: Array<() => Promise<Response>>) {
  const calls: Call[] = [];
  const f = (async (url: string, init: RequestInit) => {
    calls.push({ url: String(url), headers: init.headers as Record<string, string> });
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
