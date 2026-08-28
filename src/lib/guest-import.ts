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
