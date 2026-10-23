// Resolve "@/..." to src/ and extensionless TS imports; transpile .ts/.tsx with typescript (JSX react-jsx).
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import ts from "typescript";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const EXTS = ["", ".ts", ".tsx", "/index.ts", "/index.tsx"];

function tryFile(base) {
  for (const ext of EXTS) {
    const p = base + ext;
    if (existsSync(p) && !p.endsWith("/")) {
      try {
        if (readFileSync(p) !== undefined) return p;
      } catch {
        /* directory */
      }
    }
  }
  return null;
}

export async function resolve(specifier, context, next) {
  let base = null;
  if (specifier.startsWith("@/")) base = path.join(root, "src", specifier.slice(2));
  else if (
    (specifier.startsWith("./") || specifier.startsWith("../")) &&
    context.parentURL?.startsWith("file:")
  ) {
    const parent = fileURLToPath(context.parentURL);
    if (/\.(ts|tsx)$/.test(parent)) base = path.resolve(path.dirname(parent), specifier);
  }
  if (base) {
    const hit = tryFile(base);
    if (hit) return { url: pathToFileURL(hit).href, shortCircuit: true };
  }
  return next(specifier, context);
}

export async function load(url, context, next) {
  if (/\.(ts|tsx)$/.test(url) && url.startsWith("file:") && !url.includes("/node_modules/")) {
    const source = readFileSync(fileURLToPath(url), "utf8");
    const out = ts.transpileModule(source, {
      fileName: fileURLToPath(url),
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
        allowImportingTsExtensions: true,
        verbatimModuleSyntax: false,
      },
    });
    return { format: "module", source: out.outputText, shortCircuit: true };
  }
  return next(url, context);
}
