import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { PREVIEW_ALLOWED_HOSTS } from "./preview.ts";

describe("practice copy trusted hosts", () => {
  it("allows Vercel preview hosts so sign-up is not Invalid origin", () => {
    assert.equal(PREVIEW_ALLOWED_HOSTS.includes("*.vercel.app"), true);
  });

  it("does not trust grok.me", () => {
    assert.equal(
      PREVIEW_ALLOWED_HOSTS.some((host) => host.includes("grok.me")),
      false,
    );
  });
});
