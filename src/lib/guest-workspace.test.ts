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

describe("guest jobs vs a signed-in list (QA item 4 / SEC HIGH)", () => {
  beforeEach(() => mem.clear());
  const server = [{ id: "srv-a1", name: "A job" }];
  it("a signed-in list never includes device (guest) jobs, even if one leaks into the payload", () => {
    const g = gw.guestCreateProject("Guest tank", "22202");
    const list = gw.signedInJobList([...server, { id: g.id, name: g.name }]);
    assert.deepEqual(list.map((p) => p.id), ["srv-a1"]);
  });
  it("prompt text names the count and the jobs (truncated when long)", () => {
    assert.equal(
      gw.claimPromptText(2, ["Tank 4", "Bridge"]),
      "This browser has 2 jobs made while signed out (Tank 4, Bridge). They may not be yours. Move them into your account?",
    );
    assert.match(gw.claimPromptText(5, ["a", "b", "c", "d", "e"]), /\(a, b, c, \+2 more\)/);
  });
  it("'don't ask again' sets the device flag, imports nothing, and suppresses the prompt next time", async () => {
    gw.guestCreateProject("Guest tank", "22202");
    let imported = 0;
    let asked = 0;
    const importer = async () => (imported++, { imported: 1, skipped: false, importedIds: [], customOk: true });
    const r = await gw.claimGuestJobs(() => (asked++, "dont-ask" as const), importer);
    assert.equal(r.outcome, "declined");
    assert.equal(mem.get(gw.CLAIM_DONT_ASK_KEY), "1");
    const again = await gw.claimGuestJobs(() => (asked++, "move" as const), importer);
    assert.equal(again.outcome, "suppressed");
    assert.equal(asked, 1);
    assert.equal(imported, 0);
    assert.equal(gw.guestJobCount(), 1);
    assert.deepEqual(gw.signedInJobList([{ id: "srv" }]).map((p) => p.id), ["srv"]);
  });
  it("declining imports nothing and leaves the device copy", async () => {
    gw.guestCreateProject("Guest tank", "22202");
    let called = 0;
    const r = await gw.claimGuestJobs(() => false, async () => {
      called++;
      return { imported: 1, skipped: false, importedIds: [], customOk: true };
    });
    assert.equal(r.outcome, "declined");
    assert.equal(called, 0);
    assert.equal(gw.guestJobCount(), 1);
  });
  it("confirming imports them (claim: true) and clears the device", async () => {
    const a = gw.guestCreateProject("One", "22202");
    const b = gw.guestCreateProject("Two", "22202");
    let asked = 0;
    let sent: { claim?: boolean; projects: { id: string }[] } | null = null;
    const r = await gw.claimGuestJobs((n) => (asked = n, true), async ({ data }) => {
      sent = data;
      return { imported: 2, skipped: false, importedIds: [a.id, b.id], customOk: true };
    });
    assert.equal(asked, 2);
    assert.equal(sent!.claim, true);
    assert.equal(r.outcome, "imported");
    assert.equal(gw.guestJobCount(), 0);
    assert.equal(mem.get("fieldcard.projects.v1"), JSON.stringify({ lastProjectId: null, projects: [], custom: [] }));
  });
  it("partial failure keeps only the jobs that did not import, and says so", async () => {
    const a = gw.guestCreateProject("One", "22202");
    const b = gw.guestCreateProject("Two", "22202");
    const r = await gw.claimGuestJobs(() => true, async () => ({ imported: 1, skipped: false, importedIds: [a.id], customOk: true }));
    assert.equal(r.outcome, "partial");
    assert.equal(r.kept, 1);
    assert.deepEqual(gw.guestDump().projects.map((p) => p.id), [b.id]);
  });
  it("an importer error keeps every device job", async () => {
    gw.guestCreateProject("One", "22202");
    const r = await gw.claimGuestJobs(() => true, async () => { throw new Error("down"); });
    assert.equal(r.outcome, "partial");
    assert.equal(gw.guestJobCount(), 1);
  });
});
