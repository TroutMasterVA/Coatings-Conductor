// @ts-check
/**
 * Practice-copy rollback. The practice copy is a Vercel *preview*.
 * Undo is the previous preview. Never main. Never grok.me. Never production.
 *
 * Isaiah/PO must approve a final copy later. This script does not promote.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const FORBIDDEN_MAIN = "Practice rollback never targets main.";
export const FORBIDDEN_GROK = "Practice rollback never targets grok.me.";
export const FORBIDDEN_PRODUCTION =
  "Practice rollback never targets production. Undo is the previous Vercel preview.";
export const NO_PREVIOUS = "No previous Vercel preview to restore.";

/**
 * @param {string} value
 * @returns {string}
 */
export function hostOf(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  try {
    return new URL(raw.includes("://") ? raw : `https://${raw}`).hostname.toLowerCase();
  } catch {
    return raw.toLowerCase();
  }
}

/**
 * @param {{ url?: string, host?: string, gitBranch?: string, target?: string | null }} input
 * @returns {string | null}
 */
export function forbiddenPracticeTarget(input) {
  const host = hostOf(input.host || input.url || "");
  const url = String(input.url ?? "").toLowerCase();
  const branch = String(input.gitBranch ?? "").trim().toLowerCase();
  const target = String(input.target ?? "").trim().toLowerCase();

  if (host === "grok.me" || host.endsWith(".grok.me") || url.includes("grok.me")) {
    return FORBIDDEN_GROK;
  }
  if (branch === "main" || branch === "master") return FORBIDDEN_MAIN;
  if (target === "production" || target === "prod") return FORBIDDEN_PRODUCTION;
  return null;
}

/**
 * @param {string} value
 * @returns {string}
 */
function normalizeUrl(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  try {
    const u = new URL(raw.includes("://") ? raw : `https://${raw}`);
    u.hash = "";
    u.search = "";
    return u.toString().replace(/\/$/, "");
  } catch {
    return raw.replace(/\/$/, "");
  }
}

/**
 * @typedef {{ url?: string, uid?: string, target?: string | null, state?: string, gitBranch?: string, host?: string }} Deployment
 */

/**
 * @param {Deployment} d
 * @returns {boolean}
 */
export function isPracticePreview(d) {
  if (!d) return false;
  if (d.state && d.state !== "READY" && d.state !== "ready") return false;
  if (forbiddenPracticeTarget(d)) return false;
  const target = String(d.target ?? "").trim().toLowerCase();
  return target === "" || target === "preview" || target === "staging";
}

/**
 * Deployments newest-first. Current preview restores the next older preview.
 * @param {Deployment[]} deployments
 * @param {string} currentUrl
 * @returns {Deployment | null}
 */
export function pickPreviousPreview(deployments, currentUrl) {
  const previews = (deployments ?? []).filter(isPracticePreview);
  const current = normalizeUrl(currentUrl);
  let idx = previews.findIndex(
    (d) => normalizeUrl(d.url ?? "") === current || d.uid === currentUrl,
  );
  if (idx === -1) idx = 0;
  return previews[idx + 1] ?? null;
}

/**
 * @param {{ current: Deployment, deployments: Deployment[] }} input
 * @returns {{ ok: true, previous: Deployment, host: string, command: string[] } | { ok: false, error: string, command: null }}
 */
export function planPracticeRollback({ current, deployments }) {
  const blocked = forbiddenPracticeTarget(current);
  if (blocked) return { ok: false, error: blocked, command: null };
  const previous = pickPreviousPreview(deployments, current.url ?? current.uid ?? "");
  if (!previous?.url) return { ok: false, error: NO_PREVIOUS, command: null };
  const host = hostOf(current.url || current.host || "");
  if (!host) return { ok: false, error: NO_PREVIOUS, command: null };
  // Alias the practice preview host onto the previous preview deployment.
  // Never `vercel rollback` / `vercel promote` — those are production.
  const command = ["vercel", "alias", previous.url, host];
  return { ok: true, previous, host, command };
}

/**
 * @param {string} raw
 * @returns {Deployment[]}
 */
export function parseDeploymentsJson(raw) {
  const parsed = JSON.parse(raw);
  if (Array.isArray(parsed)) return parsed;
  if (Array.isArray(parsed?.deployments)) return parsed.deployments;
  return [];
}

function flag(argv, name) {
  const i = argv.indexOf(name);
  return i === -1 ? undefined : argv[i + 1];
}

function isMainModule(url) {
  try {
    return fileURLToPath(url) === process.argv[1];
  } catch {
    return false;
  }
}

async function main(argv) {
  const currentUrl = flag(argv, "--current");
  const listPath = flag(argv, "--deployments");
  if (!currentUrl || !listPath) {
    console.error(
      "Usage: node scripts/practice-rollback.mjs --current <preview-url> --deployments <vercel-ls.json>",
    );
    process.exit(2);
  }
  const deployments = parseDeploymentsJson(readFileSync(listPath, "utf8"));
  const current = { url: currentUrl };
  const plan = planPracticeRollback({ current, deployments });
  if (!plan.ok) {
    console.error(plan.error);
    process.exit(plan.error.includes("never") ? 2 : 1);
  }
  console.log(`Practice copy: ${currentUrl}`);
  console.log(`Restore previous preview: ${plan.previous.url}`);
  console.log(`Command: ${plan.command.join(" ")}`);
  console.log("Never main. Never grok.me. Not production.");
}

if (isMainModule(import.meta.url)) {
  await main(process.argv.slice(2));
}
