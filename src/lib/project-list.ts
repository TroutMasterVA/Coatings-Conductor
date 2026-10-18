import type { ProjectFull, ProjectSummary } from "@/lib/project-store";
import { jobStatusOf, type JobStatusFields } from "./job-status.ts";

/** One row per project id — open must not prepend a second copy. */
export function upsertProjectSummary<T extends ProjectSummary>(list: T[], summary: T): T[] {
  let found = false;
  const next = list.map((p) => {
    if (p.id !== summary.id) return p;
    found = true;
    return { ...p, ...summary };
  });
  return found ? next : [...next, summary];
}

export function dedupeProjectsById<T extends ProjectSummary>(list: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const p of list) {
    if (!p?.id || seen.has(p.id)) continue;
    seen.add(p.id);
    out.push(p);
  }
  return out;
}

/** List row from an opened job, carrying status / closedAt / closedBy (missing = open). */
export function summaryOfFull(
  full: ProjectFull & JobStatusFields,
): ProjectSummary & {
  status: "open" | "closed";
  closedAt: string | null;
  closedBy: string | null;
} {
  return {
    id: full.id,
    name: full.name,
    zip: full.zip,
    archived: full.archived,
    lastOpenedAt: full.lastOpenedAt,
    updatedAt: full.updatedAt,
    hasCard: Boolean(full.card),
    ...jobStatusOf(full),
  };
}
