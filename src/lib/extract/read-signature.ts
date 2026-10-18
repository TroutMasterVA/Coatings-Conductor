/**
 * Signed reads (CONTRACT.md "Signed reads"). SERVER-ONLY: the client passes `serverRead` back
 * untouched and never builds one. extractSheet signs what it returned; on save, a field whose value
 * and quote still match its signature (for THIS user) counts as a fresh read and is saved unstamped.
 * Anything else is compared with the stored card and stamped when it changed. The client's
 * `extractedAt` is never trusted.
 *
 * Previews with no BETTER_AUTH_SECRET use a per-instance secret, so a read signed on one instance
 * fails on another and its fields get stamped. That is fail-safe and accepted.
 */
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import type { FieldCardData } from "../types.ts";
import type { ProvenanceQuote, ServerRead } from "./provider.ts";
import { leaves } from "./provenance.ts";

const DOMAIN = "cc-extract-read:v1";

type Entry = ProvenanceQuote | "not-stated" | undefined | { edited: unknown };
type Meta = { provider: string; deployment?: string; draft?: boolean; unverifiedTemps?: boolean };

function mac(secret: string, parts: (string | number | boolean | null)[]): string {
  return createHmac("sha256", secret)
    .update(JSON.stringify([DOMAIN, ...parts]))
    .digest("base64url");
}

function entryKey(e: Entry): string {
  if (e === undefined) return "none";
  if (e === "not-stated") return "not-stated";
  if ("edited" in e) return "edited"; // a stamp is never a signed read
  return JSON.stringify([e.page ?? null, e.quote]);
}

const metaParts = (id: string, userId: string, m: Meta) => [
  "meta",
  id,
  userId,
  m.provider,
  m.deployment ?? null,
  m.draft === true,
  m.unverifiedTemps === true,
];

const fieldParts = (id: string, userId: string, path: string, value: unknown, e: Entry) => [
  "field",
  id,
  userId,
  path,
  JSON.stringify(value ?? null),
  entryKey(e),
];

/** Sign a read for `userId`: one MAC over the read's flags, one per card field (value + quote). */
export function signRead(
  secret: string,
  userId: string,
  r: Meta & { card: FieldCardData; provenance: Record<string, Entry> },
  id: string = randomUUID(),
): ServerRead {
  const fields: Record<string, string> = {};
  for (const l of leaves(r.card))
    fields[l.path] = mac(secret, fieldParts(id, userId, l.path, l.value, r.provenance[l.path]));
  return { id, sig: mac(secret, metaParts(id, userId, r)), fields };
}

function same(a: string | undefined, b: string): boolean {
  if (typeof a !== "string") return false;
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export type ReadTrust = { meta: boolean; fields: Set<string> };
export const NO_TRUST: ReadTrust = { meta: false, fields: new Set() };

/** Which fields of `card` are proven to come, unchanged, from a read signed for `userId`. */
export function verifyRead(
  secret: string,
  userId: string,
  extract: Meta & { serverRead?: ServerRead; provenance: Record<string, Entry> },
  card: FieldCardData | null | undefined,
): ReadTrust {
  const sr = extract.serverRead;
  if (!sr || !card || !secret) return NO_TRUST;
  if (!same(sr.sig, mac(secret, metaParts(sr.id, userId, extract)))) return NO_TRUST;
  const fields = new Set<string>();
  for (const l of leaves(card)) {
    if (
      same(
        sr.fields[l.path],
        mac(secret, fieldParts(sr.id, userId, l.path, l.value, extract.provenance[l.path])),
      )
    ) {
      fields.add(l.path);
    }
  }
  return { meta: true, fields };
}
