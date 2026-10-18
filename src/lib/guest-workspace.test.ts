import { beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";

// Minimal browser storage for the device-local workspace.
const mem = new Map<string, string>();
(globalThis as Record<string, unknown>).window = globalThis;
(globalThis as Record<string, unknown>).localStorage = {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => void mem.set(k, v),
  removeItem: (k: string) => void mem.delete(k),
};

const gw = await import("./guest-workspace.ts");
const { JOB_CLOSED_DELETE_MESSAGE, JOB_CLOSED_MESSAGE } = await import("./job-close.ts");

describe("guest workspace closeout (BE guard, #37)", () => {
  beforeEach(() => mem.clear());
  it("deleting a closed guest job is refused with JOB_CLOSED_DELETE_MESSAGE; archive still works", () => {
    const job = gw.guestCreateProject("Tank", "22202");
    const closed = gw.guestCloseProject(job.id);
    assert.equal(closed.status, "closed");
    assert.equal(closed.closedBy, "This device");
    assert.throws(() => gw.guestDeleteProject(job.id), { message: JOB_CLOSED_DELETE_MESSAGE });
    assert.equal(gw.guestLoadWorkspace().projects.length, 1);
    gw.guestArchiveProject(job.id, true);
    assert.equal(gw.guestLoadWorkspace().projects[0]?.archived, true);
  });
  it("an open guest job still deletes", () => {
    const job = gw.guestCreateProject("Tank", "22202");
    gw.guestDeleteProject(job.id);
    assert.equal(gw.guestLoadWorkspace().projects.length, 0);
  });
  it("saving a closed guest job is refused; close is idempotent; status shows in the list", () => {
    const job = gw.guestCreateProject("Tank", "22202");
    const first = gw.guestCloseProject(job.id);
    assert.equal(gw.guestCloseProject(job.id).closedAt, first.closedAt);
    assert.throws(() => gw.guestSaveProject({ id: job.id, name: "x" }), {
      message: JOB_CLOSED_MESSAGE,
    });
    const row = gw.guestLoadWorkspace().projects[0] as {
      status?: string;
      closedBy?: string | null;
    };
    assert.equal(row.status, "closed");
    assert.equal(row.closedBy, "This device");
  });
});
