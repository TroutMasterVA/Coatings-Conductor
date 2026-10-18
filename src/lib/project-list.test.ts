import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { dedupeProjectsById, summaryOfFull, upsertProjectSummary } from "./project-list.ts";
import type { ProjectSummary } from "./project-store.ts";

function row(id: string, name: string): ProjectSummary {
  return {
    id,
    name,
    zip: "22902",
    archived: false,
    lastOpenedAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    hasCard: true,
  };
}

describe("project list identity", () => {
  it("upserts by id without prepending a duplicate", () => {
    const list = [row("a", "Tank 1"), row("b", "Bridge deck")];
    const next = upsertProjectSummary(list, {
      ...row("a", "Tank 1"),
      lastOpenedAt: "2026-09-07T00:00:00.000Z",
      hasCard: true,
    });
    assert.equal(next.length, 2);
    assert.equal(next[0]?.id, "a");
    assert.equal(next[1]?.id, "b");
    assert.equal(next[0]?.lastOpenedAt, "2026-09-07T00:00:00.000Z");
  });

  it("appends when the id is new", () => {
    const list = [row("b", "Bridge deck")];
    const next = upsertProjectSummary(list, row("a", "Tank 1"));
    assert.deepEqual(
      next.map((p) => p.id),
      ["b", "a"],
    );
  });

  it("dedupes repeated ids keeping the first row", () => {
    const list = [row("a", "Tank 1"), row("a", "Tank 1 copy"), row("b", "Bridge deck")];
    const next = dedupeProjectsById(list);
    assert.deepEqual(
      next.map((p) => p.id),
      ["a", "b"],
    );
    assert.equal(next[0]?.name, "Tank 1");
  });
});

describe("summaryOfFull (index.tsx list row from an opened job)", () => {
  const full = (extra: Record<string, unknown>) =>
    ({ ...row("a", "Tank 1"), card: null, ...extra }) as unknown as Parameters<
      typeof summaryOfFull
    >[0];
  it("passes status, closedAt and closedBy through", () => {
    const s = summaryOfFull(
      full({ status: "closed", closedAt: "2026-10-18T20:00:00.000Z", closedBy: "Isaiah Chester" }),
    );
    assert.equal(s.status, "closed");
    assert.equal(s.closedAt, "2026-10-18T20:00:00.000Z");
    assert.equal(s.closedBy, "Isaiah Chester");
    assert.equal(s.hasCard, false);
  });
  it("missing status = open, no stray closed fields", () => {
    const s = summaryOfFull(full({ closedAt: "2026-10-18T20:00:00.000Z" }));
    assert.deepEqual([s.status, s.closedAt, s.closedBy], ["open", null, null]);
  });
});
