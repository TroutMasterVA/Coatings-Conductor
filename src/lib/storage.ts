import type { FieldCardData, SavedCard } from "./types";

const KEY = "fieldcard.v1";

type Store = {
  zip: string;
  recents: SavedCard[];
};

function read(): Store {
  if (typeof window === "undefined") return { zip: "", recents: [] };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { zip: "", recents: [] };
    return JSON.parse(raw) as Store;
  } catch {
    return { zip: "", recents: [] };
  }
}

function write(store: Store) {
  localStorage.setItem(KEY, JSON.stringify(store));
}

export function loadZip() {
  return read().zip;
}

export function saveZip(zip: string) {
  const s = read();
  s.zip = zip;
  write(s);
}

export function loadRecents(): SavedCard[] {
  return read().recents;
}

export function pushRecent(card: FieldCardData, zip: string) {
  const s = read();
  const entry: SavedCard = { id: card.id, savedAt: new Date().toISOString(), card, zip };
  s.recents = [entry, ...s.recents.filter((r) => r.card.product.name !== card.product.name)].slice(0, 8);
  s.zip = zip || s.zip;
  write(s);
  return s.recents;
}
