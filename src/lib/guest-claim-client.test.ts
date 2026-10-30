import { beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";

// Minimal browser storage: localStorage (device, shared by tabs) and sessionStorage (this tab).
const mem = new Map<string, string>();
const tab = new Map<string, string>();
const store = (m: Map<string, string>) => ({
  getItem: (k: string) => m.get(k) ?? null,
  setItem: (k: string, v: string) => void m.set(k, v),
  removeItem: (k: string) => void m.delete(k),
});
(globalThis as Record<string, unknown>).window = globalThis;
(globalThis as Record<string, unknown>).localStorage = store(mem);
(globalThis as Record<string, unknown>).sessionStorage = store(tab);

const gw = await import("./guest-workspace.ts");

type Importer = Parameters<typeof gw.claimGuestJobs>[1];

describe("guest carry-over prompt shows once and fires once (P1 duplicates / P2 double prompt)", () => {
  beforeEach(() => {
    mem.clear();
    tab.clear();
  });

  it("two overlapping claims (remount / double click) share one prompt and one request", async () => {
    const a = gw.guestCreateProject("Tank 4", "22902");
    let asked = 0;
    let calls = 0;
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const importer: Importer = async () => {
      calls++;
      await gate;
      return { imported: 1, skipped: false, importedIds: [a.id], customOk: true };
    };
    const first = gw.claimGuestJobs(() => (asked++, "move" as const), importer, "user-a");
    const second = gw.claimGuestJobs(() => (asked++, "move" as const), importer, "user-a");
    release();
    const [r1, r2] = await Promise.all([first, second]);
    assert.equal(asked, 1);
    assert.equal(calls, 1);
    assert.deepEqual(r1, r2);
    assert.equal(r1.outcome, "imported");
    assert.equal(gw.guestJobCount(), 0);
  });

  it("after a move, a reload asks nothing (the device copy is gone)", async () => {
    const a = gw.guestCreateProject("Tank 4", "22902");
    await gw.claimGuestJobs(() => "move" as const, async () => ({ imported: 1, skipped: false, importedIds: [a.id], customOk: true }), "user-a");
    let asked = 0;
    const again = await gw.claimGuestJobs(() => (asked++, "move" as const), async () => ({ imported: 0, skipped: false, importedIds: [], customOk: true }), "user-a");
    assert.equal(again.outcome, "empty");
    assert.equal(asked, 0);
  });

  it("reload while the move was in flight: asks again, the server reports it already moved, the device clears", async () => {
    const a = gw.guestCreateProject("Tank 4", "22902");
    // The first request's reply was lost to a refresh, so the device copy is still here. The new page
    // asks once more; the server answers that the job is already in the account (nothing written).
    const r = await gw.claimGuestJobs(
      () => "move" as const,
      async () => ({ imported: 0, alreadyMoved: 1, skipped: false, importedIds: [a.id], customOk: true }),
      "user-a",
    );
    assert.equal(r.outcome, "imported");
    assert.equal(gw.guestJobCount(), 0);
  });

  it("a second tab does not prompt while the first tab is asking", async () => {
    gw.guestCreateProject("Tank 4", "22902");
    let finish!: (v: "move" | "not-now") => void;
    let asked = 0;
    const firstTab = gw.claimGuestJobs(() => (asked++, new Promise<"move" | "not-now">((r) => (finish = r))), undefined, "user-a");
    await Promise.resolve();
    // Another tab: its own in-memory state, the same device storage (lock held).
    const lockHeld = mem.get(`${gw.CLAIM_LOCK_KEY}:user-a`);
    assert.ok(lockHeld, "first tab holds the device lock while asking");
    finish("not-now");
    const r1 = await firstTab;
    assert.equal(r1.outcome, "declined");
    assert.equal(asked, 1);
    assert.equal(mem.get(`${gw.CLAIM_LOCK_KEY}:user-a`), undefined, "lock released");
  });

  it("a fresh lock from another tab means busy (no prompt); a stale lock is ignored", async () => {
    gw.guestCreateProject("Tank 4", "22902");
    mem.set(`${gw.CLAIM_LOCK_KEY}:user-a`, String(Date.now()));
    let asked = 0;
    const busy = await gw.claimGuestJobs(() => (asked++, "not-now" as const), undefined, "user-a");
    assert.equal(busy.outcome, "busy");
    assert.equal(asked, 0);
    mem.set(`${gw.CLAIM_LOCK_KEY}:user-a`, String(Date.now() - gw.CLAIM_LOCK_TTL_MS - 1));
    const asks = await gw.claimGuestJobs(() => (asked++, "not-now" as const), undefined, "user-a");
    assert.equal(asks.outcome, "declined");
    assert.equal(asked, 1);
  });

  it("'Not now' is asked once per tab session for that account (no second pop-up after a refetch or refresh)", async () => {
    gw.guestCreateProject("Tank 4", "22902");
    let asked = 0;
    await gw.claimGuestJobs(() => (asked++, "not-now" as const), undefined, "user-a");
    const again = await gw.claimGuestJobs(() => (asked++, "move" as const), undefined, "user-a");
    assert.equal(again.outcome, "declined");
    assert.equal(asked, 1);
    // A different account in the same tab is still asked.
    await gw.claimGuestJobs(() => (asked++, "not-now" as const), undefined, "user-b");
    assert.equal(asked, 2);
    assert.equal(gw.guestJobCount(), 1, "nothing moved, device copy kept");
  });
});
