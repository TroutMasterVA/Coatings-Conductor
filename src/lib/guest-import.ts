/** Import guest jobs only into an empty account. Jobs or a custom library both block. One-way. */
export function accountRejectsGuestImport(projectCount: number, customCount: number): boolean {
  return projectCount > 0 || customCount > 0;
}

/** Skip leaves device jobs in place. Import is one-way: guest store is cleared only after a lift. */
export function guestMigrateResult(opts: { guestHasData: boolean; skipped: boolean }): {
  outcome: "empty" | "skipped" | "imported";
  clearGuest: boolean;
} {
  if (!opts.guestHasData) return { outcome: "empty", clearGuest: false };
  if (opts.skipped) return { outcome: "skipped", clearGuest: false };
  return { outcome: "imported", clearGuest: true };
}

/** Other people's jobs look like missing jobs. No new screen. */
export const NOT_YOUR_JOB_MESSAGE = "Project not found.";

type GuestSite = {
  customMitigationIds?: string[];
  [key: string]: unknown;
};

export type GuestImportShape<P extends { id?: string; site?: GuestSite }, C extends { id?: string }> = {
  projects: P[];
  custom: C[];
  lastProjectId?: string | null;
};

/**
 * Guest ids stay on the device. The account always gets fresh server ids so a
 * leaked local UUID cannot collide with or point at someone else's row.
 */
export function remapGuestImportInput<P extends { id?: string; site?: GuestSite }, C extends { id?: string }>(
  input: GuestImportShape<P, C>,
  mint: () => string = () => crypto.randomUUID(),
): {
  projects: Array<P & { id: string }>;
  custom: Array<C & { id: string }>;
  lastProjectId: string | null;
} {
  const customMap = new Map<string, string>();
  const projectMap = new Map<string, string>();

  const custom = input.custom.map((item) => {
    const serverId = mint();
    if (typeof item.id === "string" && item.id.length > 0) customMap.set(item.id, serverId);
    return { ...item, id: serverId };
  });

  const projects = input.projects.map((item) => {
    const serverId = mint();
    if (typeof item.id === "string" && item.id.length > 0) projectMap.set(item.id, serverId);
    const site = item.site
      ? {
          ...item.site,
          customMitigationIds: (item.site.customMitigationIds ?? []).map((id) => customMap.get(id) ?? id),
        }
      : item.site;
    return { ...item, id: serverId, site };
  });

  const lastProjectId = input.lastProjectId ? (projectMap.get(input.lastProjectId) ?? null) : null;
  return { projects, custom, lastProjectId };
}
