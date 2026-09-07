/**
 * Grok builder chrome is disabled. injectGrokPwaHead is a no-op so the
 * running app does not load grok-app-builder, /__grok, or social login overlay.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const DEFAULT_APP_NAME = "Grok App";
export const OG_SERVICE_URL_DEFAULT = "https://og.grok.me";
export const OG_SITE_REL_PATH = "src/lib/og/site.json";
export const GROK_EXTENSIONS_SCRIPT_SRC = "https://grok.com/grok-app-builder/extensions.js";

export function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function grokPwaHeadTags(_appName = DEFAULT_APP_NAME) {
  return [];
}

export function grokExtensionsHeadTags(_projectId = "") {
  return [];
}

export function injectGrokPwaHead(html, _ctx = {}) {
  if (typeof html !== "string") return html;
  return html;
}

export function createHeadInjector(_ctx = {}) {
  return {
    push(chunk) {
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      return [buf];
    },
    flush() {
      return [];
    },
  };
}

export function isInstallQuery(url) {
  const query = String(url ?? "").split("?", 2)[1] ?? "";
  const params = new URLSearchParams(query);
  const install = params.get("install");
  const platform = (params.get("platform") ?? "").toLowerCase();
  return (install === "1" || install === "true") && platform === "ios";
}

export function isDocumentPath(pathname) {
  const path = String(pathname ?? "");
  return (
    !path.startsWith("/__grok/") &&
    !path.startsWith("/api/") &&
    !path.startsWith("/@") &&
    !path.startsWith("/node_modules") &&
    !/\.[a-z0-9]+$/i.test(path)
  );
}

export function acceptsHtml(accept) {
  const value = String(accept ?? "");
  return value === "" || value.includes("text/html") || value.includes("*/*");
}

export function stripInstallParams(url) {
  const [path = "/", query = ""] = String(url ?? "/").split("?", 2);
  const params = new URLSearchParams(query);
  params.delete("install");
  params.delete("platform");
  const rest = params.toString();
  return rest ? `${path}?${rest}` : path;
}

export function appNameFromHost(_hostHeader) {
  return DEFAULT_APP_NAME;
}

export function publicAppHost(_hostHeader) {
  return "";
}

export function renderWebManifest(_hostHeader) {
  return JSON.stringify({ name: DEFAULT_APP_NAME, short_name: DEFAULT_APP_NAME, start_url: "/" });
}

export function renderInstallPageHtml(template) {
  return String(template);
}

export function resolveOgCardAsset() {
  return "";
}

export function snapshotOgIdentity() {
  return { site: {} };
}

export function grokXCreatorHeadTags() {
  return [];
}

export function readGrokProjectId() {
  return "";
}

export function readOgSite() {
  return {};
}

export function ogCardPublicPath() {
  return "";
}

void existsSync;
void readFileSync;
void join;
