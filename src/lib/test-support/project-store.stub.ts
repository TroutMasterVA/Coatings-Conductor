// Stub for "@/lib/project-store" in node:test (the real module pulls in server fns).
export function defaultSite() {
  return { substrate: "bare_steel", mitigations: [], customMitigationIds: [] };
}
export async function importGuestWorkspace(): Promise<{ imported: number; skipped: boolean }> {
  return { imported: 0, skipped: true };
}
