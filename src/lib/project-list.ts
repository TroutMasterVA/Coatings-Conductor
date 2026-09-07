import type { ProjectSummary } from "@/lib/project-store";

/** One row per project id — open must not prepend a second copy. */
export function upsertProjectSummary(list: ProjectSummary[], summary: ProjectSummary): ProjectSummary[] {
  let found = false;
  const next = list.map((p) => {
    if (p.id !== summary.id) return p;
    found = true;
    return { ...p, ...summary };
  });
  return found ? next : [...next, summary];
}

export function dedupeProjectsById(list: ProjectSummary[]): ProjectSummary[] {
  const seen = new Set<string>();
  const out: ProjectSummary[] = [];
  for (const p of list) {
    if (!p?.id || seen.has(p.id)) continue;
    seen.add(p.id);
    out.push(p);
  }
  return out;
}
