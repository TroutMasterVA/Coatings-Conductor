import { copyFileSync, existsSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// PGLite loads its .wasm/.data files from next to its bundled module, which the
// bundler does not copy. Copy them into every server output that exists:
// Vercel (default preset) and Nitro node-server (Docker, NITRO_PRESET=node-server).
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const srcDir = join(root, "node_modules/@electric-sql/pglite/dist");
const destDirs = [
  join(root, ".vercel/output/functions/__server.func/_libs"),
  join(root, ".output/server/_libs"),
];
if (!existsSync(srcDir)) process.exit(0);
const assets = readdirSync(srcDir).filter(
  (name) => name.endsWith(".wasm") || name.endsWith(".data"),
);
for (const destDir of destDirs) {
  if (!existsSync(destDir)) continue;
  for (const name of assets) copyFileSync(join(srcDir, name), join(destDir, name));
}
