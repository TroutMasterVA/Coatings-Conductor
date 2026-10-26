// Test-only loader so node:test can render .tsx components (no new deps: uses the repo's typescript).
// Usage: node --import ./scripts/tsx-test-hooks.mjs --test src/components/*.test.tsx
import { register } from "node:module";

register("./tsx-test-loader.mjs", import.meta.url);
