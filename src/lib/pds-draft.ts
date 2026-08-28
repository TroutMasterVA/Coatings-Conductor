/** Survives Grok-preview iframe remount when the native file picker opens. */
import type { FieldCardData } from "./types";

const KEY = "cc.pds-draft.v1";

export type PdsDraft = {
  projectId: string | null;
  text: string;
  fileName?: string;
  card?: FieldCardData;
  at: number;
};

export function savePdsDraft(draft: Omit<PdsDraft, "at">) {
  if (typeof window === "undefined") return;
  const payload: PdsDraft = { ...draft, at: Date.now() };
  try {
    sessionStorage.setItem(KEY, JSON.stringify(payload));
  } catch {
    /* quota */
  }
}

export function loadPdsDraft(): PdsDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PdsDraft;
    if (!parsed?.text || parsed.text.trim().length < 40) return null;
    if (Date.now() - parsed.at > 30 * 60 * 1000) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearPdsDraft() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(KEY);
}
