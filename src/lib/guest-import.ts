/** Import guest jobs only into an empty account. Jobs or a custom library both block. One-way. */
export function accountRejectsGuestImport(projectCount: number, customCount: number): boolean {
  return projectCount > 0 || customCount > 0;
}
