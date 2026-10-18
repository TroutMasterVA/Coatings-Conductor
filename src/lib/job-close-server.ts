/**
 * Thin adapter to BE's `closeProject({ id })` server fn (CONTRACT.md "Job closeout").
 * TODO(BE): when BE's closeout PR is on this stack, replace the lookup below with
 *   `import { closeProject } from "@/lib/project-store";  return closeProject({ data: { id } });`
 * Until then the call is looked up at runtime so this compiles, and a copy without it says so honestly.
 */
import { CLOSE_UNAVAILABLE_MESSAGE } from "./job-status.ts";

type CloseFn = (args: { data: { id: string } }) => Promise<unknown>;

export async function callCloseProject(id: string): Promise<unknown> {
  const store = (await import("@/lib/project-store")) as unknown as { closeProject?: unknown };
  const fn = store.closeProject;
  if (typeof fn !== "function") throw new Error(CLOSE_UNAVAILABLE_MESSAGE);
  return (fn as CloseFn)({ data: { id } });
}
