/**
 * Client IP for the per-IP limiters (login, Better Auth's own limiter, forecast). Pure; no I/O.
 *
 * Rules (item 3, SEC):
 * - `x-forwarded-for` is read from the RIGHT. `TRUSTED_PROXY_HOPS` (default 1) is how many trusted
 *   proxies append to it; the client IP is `ips[len - hops]`. The left part is client-written and is
 *   never used. Vercel overwrites XFF with the real client IP, so 1 is right for the practice copy.
 *   On PAVE, set it from IT's answer about the proxy chain.
 * - `CLIENT_IP_HEADER` (optional) names a header the ingress sets itself (e.g. `x-azure-clientip`);
 *   when set it is the only header read. `x-real-ip` is never read on its own.
 * - Header missing, too short or invalid -> the socket peer address, when the runtime gives one.
 * - Still nothing usable -> `null`. Callers SKIP their per-IP limits for that request instead of
 *   sharing one bucket between every user (PO rule); the per-email lockout still applies.
 */
import { isIP } from "node:net";

export const DEFAULT_TRUSTED_PROXY_HOPS = 1;

export type ClientIpConfig = {
  /** Trusted proxies that append to x-forwarded-for. 0 = ignore the header. */
  hops: number;
  /** Lower-case header name the ingress sets itself, or null. */
  clientIpHeader: string | null;
  /** In production a loopback peer is a local proxy, not a client, so it is not used. */
  production: boolean;
};

type Env = Record<string, string | undefined>;

export function clientIpConfigFromEnv(env: Env = process.env): ClientIpConfig {
  const raw = env.TRUSTED_PROXY_HOPS?.trim();
  const n = raw ? Number(raw) : DEFAULT_TRUSTED_PROXY_HOPS;
  const hops = Number.isInteger(n) && n >= 0 && n <= 10 ? n : DEFAULT_TRUSTED_PROXY_HOPS;
  const header = env.CLIENT_IP_HEADER?.trim().toLowerCase();
  return {
    hops,
    clientIpHeader: header ? header : null,
    production: env.NODE_ENV === "production",
  };
}

/** Strip `:port` (`1.2.3.4:5678`, `[2001:db8::1]:443`) and brackets; null when not an IP. */
export function cleanIp(value: string | null | undefined): string | null {
  if (!value) return null;
  let v = value.trim();
  if (!v) return null;
  if (v.startsWith("[")) {
    const end = v.indexOf("]");
    if (end < 0) return null;
    v = v.slice(1, end);
  } else if (/^\d{1,3}(\.\d{1,3}){3}:\d+$/.test(v)) {
    v = v.slice(0, v.lastIndexOf(":"));
  }
  const zone = v.indexOf("%");
  if (zone > 0) v = v.slice(0, zone);
  return isIP(v) ? v : null;
}

function expandV6(ip: string): string[] {
  let text = ip.toLowerCase();
  // Embedded IPv4 tail (e.g. ::ffff:1.2.3.4) -> two hex groups.
  const v4 = text.match(/(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (v4) {
    const o = v4[1]!.split(".").map(Number);
    text = text.slice(0, -v4[1]!.length) + `${((o[0]! << 8) | o[1]!).toString(16)}:${((o[2]! << 8) | o[3]!).toString(16)}`;
  }
  const [left, right] = text.includes("::") ? text.split("::") : [text, undefined];
  const l = left ? left.split(":") : [];
  const r = right ? right.split(":") : [];
  const fill = right === undefined ? [] : Array(8 - l.length - r.length).fill("0");
  return [...l, ...fill, ...r].map((g) => g.padStart(4, "0"));
}

/**
 * Stable bucket form: IPv4 as is; IPv4-mapped IPv6 -> IPv4; other IPv6 grouped by /64 (one
 * household or office usually owns a whole /64, and rotating inside it must not reset a limit).
 */
export function normalizeIp(ip: string): string {
  if (isIP(ip) === 4) return ip;
  const g = expandV6(ip);
  if (g.slice(0, 5).every((x) => x === "0000") && g[5] === "ffff") {
    const a = parseInt(g[6]!, 16);
    const b = parseInt(g[7]!, 16);
    return `${a >> 8}.${a & 255}.${b >> 8}.${b & 255}`;
  }
  return `${g.slice(0, 4).join(":")}::/64`;
}

function isLoopback(ip: string): boolean {
  return ip === "::1" || ip.startsWith("127.") || ip === "0000:0000:0000:0000::/64";
}

type HeaderSource = Pick<Headers, "get"> | null | undefined;

export type ClientIpResult = { ip: string; source: "header" | "xff" | "peer" } | { ip: null; reason: string };

export function resolveClientIp(
  headers: HeaderSource,
  peer: string | null | undefined,
  config: ClientIpConfig,
): ClientIpResult {
  let reason = "no-header";
  if (config.clientIpHeader) {
    const value = headers?.get(config.clientIpHeader);
    // A single value only: a list here means the header is not the ingress's own.
    const ip = value && !value.includes(",") ? cleanIp(value) : null;
    if (ip) return { ip: normalizeIp(ip), source: "header" };
    reason = value ? "bad-client-ip-header" : "no-client-ip-header";
  } else if (config.hops > 0) {
    const fwd = headers?.get("x-forwarded-for");
    if (fwd) {
      const list = fwd.split(",").map((s) => s.trim()).filter(Boolean);
      if (list.length >= config.hops) {
        const ip = cleanIp(list[list.length - config.hops]);
        if (ip) return { ip: normalizeIp(ip), source: "xff" };
        reason = "bad-xff-entry";
      } else {
        reason = "xff-shorter-than-hops";
      }
    }
  } else {
    reason = "hops-0";
  }
  const p = cleanIp(peer);
  if (p) {
    const n = normalizeIp(p);
    if (!(config.production && isLoopback(n))) return { ip: n, source: "peer" };
    reason = `${reason}+loopback-peer`;
  }
  return { ip: null, reason };
}

/**
 * Would Better Auth's own limiter (no `trustedProxies` configured) fail to find an IP and fall back
 * to its single shared `no-trusted-ip` bucket? It trusts x-forwarded-for only when it is ONE valid
 * IP (port not allowed), and uses 127.0.0.1 outside production. Used to skip that limiter instead.
 */
export function betterAuthWouldShareBucket(headers: HeaderSource, production: boolean): boolean {
  if (!production) return false;
  const fwd = headers?.get("x-forwarded-for");
  if (!fwd) return true;
  const list = fwd.split(",").map((s) => s.trim()).filter(Boolean);
  return !(list.length === 1 && isIP(list[0]!) !== 0);
}

let warned = false;
/** One warn line per process, no PII: only the reason code. */
export function warnNoClientIpOnce(reason: string, log: (line: string) => void = console.warn): void {
  if (warned) return;
  warned = true;
  log(`[rate-limit] client IP unknown (${reason}); per-IP limits skipped for such requests. Set TRUSTED_PROXY_HOPS / CLIENT_IP_HEADER from IT's answer.`);
}

/** Test-only reset of the once-flag. */
export function resetNoClientIpWarning(): void {
  warned = false;
}
