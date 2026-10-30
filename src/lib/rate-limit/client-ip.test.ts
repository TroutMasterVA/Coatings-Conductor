import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_TRUSTED_PROXY_HOPS,
  betterAuthWouldShareBucket,
  cleanIp,
  clientIpConfigFromEnv,
  normalizeIp,
  resetNoClientIpWarning,
  resolveClientIp,
  warnNoClientIpOnce,
  type ClientIpConfig,
} from "./client-ip.ts";

const h = (init: Record<string, string> = {}) => new Headers(init);
const cfg = (over: Partial<ClientIpConfig> = {}): ClientIpConfig => ({
  hops: 1,
  clientIpHeader: null,
  production: true,
  ...over,
});

describe("TRUSTED_PROXY_HOPS / CLIENT_IP_HEADER config", () => {
  it("defaults to 1 hop (Vercel overwrites x-forwarded-for with the client IP)", () => {
    assert.equal(DEFAULT_TRUSTED_PROXY_HOPS, 1);
    assert.equal(clientIpConfigFromEnv({}).hops, 1);
    assert.equal(clientIpConfigFromEnv({ TRUSTED_PROXY_HOPS: "" }).hops, 1);
  });
  it("reads explicit hops and ignores garbage", () => {
    assert.equal(clientIpConfigFromEnv({ TRUSTED_PROXY_HOPS: "2" }).hops, 2);
    assert.equal(clientIpConfigFromEnv({ TRUSTED_PROXY_HOPS: "0" }).hops, 0);
    assert.equal(clientIpConfigFromEnv({ TRUSTED_PROXY_HOPS: "-1" }).hops, 1);
    assert.equal(clientIpConfigFromEnv({ TRUSTED_PROXY_HOPS: "1.5" }).hops, 1);
    assert.equal(clientIpConfigFromEnv({ TRUSTED_PROXY_HOPS: "abc" }).hops, 1);
  });
  it("lower-cases CLIENT_IP_HEADER and treats blank as unset", () => {
    assert.equal(clientIpConfigFromEnv({ CLIENT_IP_HEADER: " X-Azure-ClientIP " }).clientIpHeader, "x-azure-clientip");
    assert.equal(clientIpConfigFromEnv({ CLIENT_IP_HEADER: " " }).clientIpHeader, null);
  });
});

describe("x-forwarded-for is read from the right", () => {
  it("Vercel: a single value is the client", () => {
    assert.deepEqual(resolveClientIp(h({ "x-forwarded-for": "198.51.100.7" }), null, cfg()), { ip: "198.51.100.7", source: "xff" });
  });
  it("1 hop: a forged left part is ignored", () => {
    const r = resolveClientIp(h({ "x-forwarded-for": "1.1.1.1, 2.2.2.2, 198.51.100.7" }), null, cfg());
    assert.equal(r.ip, "198.51.100.7");
  });
  it("2 hops: the entry the client could not write", () => {
    const r = resolveClientIp(h({ "x-forwarded-for": "6.6.6.6, 198.51.100.7, 10.0.0.4" }), null, cfg({ hops: 2 }));
    assert.equal(r.ip, "198.51.100.7");
  });
  it("strips the :port Azure App Service adds, and bracketed IPv6 ports", () => {
    assert.equal(resolveClientIp(h({ "x-forwarded-for": "198.51.100.7:51234" }), null, cfg()).ip, "198.51.100.7");
    assert.equal(cleanIp("[2001:db8::1]:443"), "2001:db8::1");
    assert.equal(cleanIp("2001:db8::1"), "2001:db8::1");
  });
  it("too few entries falls back to the peer, never the forged left entry", () => {
    const r = resolveClientIp(h({ "x-forwarded-for": "6.6.6.6" }), "203.0.113.5", cfg({ hops: 2 }));
    assert.deepEqual(r, { ip: "203.0.113.5", source: "peer" });
  });
  it("an invalid entry falls back to the peer", () => {
    const r = resolveClientIp(h({ "x-forwarded-for": "not-an-ip" }), "203.0.113.5", cfg());
    assert.equal(r.ip, "203.0.113.5");
  });
  it("hops 0 ignores x-forwarded-for entirely", () => {
    const r = resolveClientIp(h({ "x-forwarded-for": "6.6.6.6" }), "203.0.113.5", cfg({ hops: 0 }));
    assert.equal(r.ip, "203.0.113.5");
  });
  it("never reads x-real-ip on its own", () => {
    const r = resolveClientIp(h({ "x-real-ip": "6.6.6.6" }), null, cfg());
    assert.equal(r.ip, null);
  });
});

describe("CLIENT_IP_HEADER", () => {
  it("is the only source when set", () => {
    const headers = h({ "x-azure-clientip": "198.51.100.9", "x-forwarded-for": "6.6.6.6" });
    assert.deepEqual(resolveClientIp(headers, null, cfg({ clientIpHeader: "x-azure-clientip" })), { ip: "198.51.100.9", source: "header" });
  });
  it("a list in it is not trusted; falls back to the peer", () => {
    const headers = h({ "x-azure-clientip": "6.6.6.6, 198.51.100.9" });
    assert.equal(resolveClientIp(headers, "203.0.113.5", cfg({ clientIpHeader: "x-azure-clientip" })).ip, "203.0.113.5");
  });
});

describe("no shared bucket (PO rule)", () => {
  it("no header and no peer gives null, not a shared placeholder", () => {
    const r = resolveClientIp(h(), null, cfg());
    assert.equal(r.ip, null);
    assert.ok("reason" in r && r.reason.length > 0);
  });
  it("undefined headers gives null", () => {
    assert.equal(resolveClientIp(undefined, undefined, cfg()).ip, null);
  });
  it("in production a loopback peer (a local proxy) is not used as everyone's IP", () => {
    assert.equal(resolveClientIp(h(), "127.0.0.1", cfg()).ip, null);
    assert.equal(resolveClientIp(h(), "::1", cfg()).ip, null);
    assert.equal(resolveClientIp(h(), "::ffff:127.0.0.1", cfg()).ip, null);
  });
  it("outside production a loopback peer is fine (local dev)", () => {
    assert.equal(resolveClientIp(h(), "127.0.0.1", cfg({ production: false })).ip, "127.0.0.1");
  });
  it("different clients never resolve to the same key", () => {
    const a = resolveClientIp(h({ "x-forwarded-for": "198.51.100.1" }), null, cfg()).ip;
    const b = resolveClientIp(h({ "x-forwarded-for": "198.51.100.2" }), null, cfg()).ip;
    assert.notEqual(a, b);
  });
  it("Better Auth's limiter is skipped when it would use its shared no-trusted-ip bucket", () => {
    assert.equal(betterAuthWouldShareBucket(h(), true), true);
    assert.equal(betterAuthWouldShareBucket(h({ "x-forwarded-for": "1.1.1.1, 2.2.2.2" }), true), true);
    assert.equal(betterAuthWouldShareBucket(h({ "x-forwarded-for": "1.1.1.1:443" }), true), true);
    assert.equal(betterAuthWouldShareBucket(h({ "x-forwarded-for": "198.51.100.7" }), true), false);
    assert.equal(betterAuthWouldShareBucket(h(), false), false);
  });
  it("warns once with a reason code and no address", () => {
    resetNoClientIpWarning();
    const lines: string[] = [];
    warnNoClientIpOnce("no-header", (l) => lines.push(l));
    warnNoClientIpOnce("no-header", (l) => lines.push(l));
    assert.equal(lines.length, 1);
    assert.match(lines[0]!, /no-header/);
    assert.doesNotMatch(lines[0]!, /\d+\.\d+\.\d+\.\d+/);
    resetNoClientIpWarning();
  });
});

describe("normalizeIp", () => {
  it("keeps IPv4, unwraps IPv4-mapped IPv6, groups IPv6 by /64", () => {
    assert.equal(normalizeIp("198.51.100.7"), "198.51.100.7");
    assert.equal(normalizeIp("::ffff:198.51.100.7"), "198.51.100.7");
    assert.equal(normalizeIp("2001:db8:1:2:aaaa::1"), normalizeIp("2001:DB8:1:2:bbbb::9"));
    assert.notEqual(normalizeIp("2001:db8:1:2::1"), normalizeIp("2001:db8:1:3::1"));
  });
});
