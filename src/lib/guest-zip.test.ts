import { describe, it } from "node:test";
import assert from "node:assert/strict";

const mem = new Map<string, string>();
(globalThis as Record<string, unknown>).window ??= globalThis;
(globalThis as Record<string, unknown>).localStorage ??= {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => void mem.set(k, v),
  removeItem: (k: string) => void mem.delete(k),
};
const gw = await import("./guest-workspace.ts");
const { ZIP_00000_MESSAGE } = await import("./zip-check.ts");

describe("guest project create refuses ZIP 00000 (QA P3)", () => {
  it("throws the clear message and saves nothing", () => {
    assert.throws(() => gw.guestCreateProject("Tank farm", "00000"), { message: ZIP_00000_MESSAGE });
    assert.equal(gw.guestLoadWorkspace().projects.length, 0);
  });
  it("a real ZIP still creates", () => {
    assert.equal(gw.guestCreateProject("Tank farm", "22201").zip, "22201");
  });
});
