// Test-only resolve hook (node:test, never bundled): maps "@/x" to src/x.ts and extensionless relative imports to .ts, and
// swaps the server-fn module for a stub so browser-side modules (guest-workspace) load in node:test.
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const SRC = new URL("../src/", import.meta.url);
const STUBS = { "@/lib/project-store": new URL("../src/lib/test-support/project-store.stub.ts", import.meta.url).href };

function withTs(url) {
  const path = fileURLToPath(url);
  if (existsSync(path)) return url;
  if (existsSync(`${path}.ts`)) return `${url}.ts`;
  if (existsSync(`${path}.tsx`)) return `${url}.tsx`;
  return url;
}

export async function resolve(specifier, context, next) {
  if (STUBS[specifier]) return { url: STUBS[specifier], shortCircuit: true };
  if (specifier.startsWith("@/")) {
    return { url: withTs(new URL(specifier.slice(2), SRC).href), shortCircuit: true };
  }
  if (
    (specifier.startsWith("./") || specifier.startsWith("../")) &&
    context.parentURL?.startsWith("file:")
  ) {
    const url = new URL(specifier, context.parentURL).href;
    if (!/\.[cm]?[jt]sx?$/.test(specifier)) return { url: withTs(url), shortCircuit: true };
  }
  return next(specifier, context);
}
