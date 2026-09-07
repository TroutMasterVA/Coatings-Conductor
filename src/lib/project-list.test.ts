import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { dedupeProjectsById, upsertProjectSummary } from "../routes/index.tsx";
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
