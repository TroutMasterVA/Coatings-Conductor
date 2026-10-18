import { EXTRACT_MIME_TYPES, type ExtractMimeType } from "./provider.ts";

export const DOCX_MIME: ExtractMimeType =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

const ALIASES: Record<string, ExtractMimeType> = {
  "image/jpg": "image/jpeg",
  "image/pjpeg": "image/jpeg",
  "image/tif": "image/tiff",
};

/** Lower-case, drop parameters, map common aliases. Returns null for anything not accepted. */
export function normalizeMime(raw: unknown): ExtractMimeType | null {
  if (typeof raw !== "string") return null;
  const m = raw.split(";")[0]!.trim().toLowerCase();
  const mapped = ALIASES[m] ?? m;
  return (EXTRACT_MIME_TYPES as readonly string[]).includes(mapped) ? (mapped as ExtractMimeType) : null;
}

function startsWith(b: Uint8Array, sig: number[], at = 0): boolean {
  if (b.length < at + sig.length) return false;
  return sig.every((v, i) => b[at + i] === v);
}

const WORD_DOC = new TextEncoder().encode("word/document.xml");

/** Byte search; zip local-header file names are stored uncompressed. */
function contains(b: Uint8Array, needle: Uint8Array): boolean {
  outer: for (let i = 0; i + needle.length <= b.length; i++) {
    for (let j = 0; j < needle.length; j++) if (b[i + j] !== needle[j]) continue outer;
    return true;
  }
  return false;
}

/** What the bytes actually are, from magic numbers. Null when it is none of the accepted types. */
export function sniffFileType(b: Uint8Array): ExtractMimeType | null {
  // %PDF- may follow a little junk; the PDF spec lets readers look in the first 1 KB.
  const head = b.subarray(0, 1024);
  if (contains(head, new TextEncoder().encode("%PDF-"))) return "application/pdf";
  if (startsWith(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (startsWith(b, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith(b, [0x49, 0x49, 0x2a, 0x00]) || startsWith(b, [0x4d, 0x4d, 0x00, 0x2a])) return "image/tiff";
  if (startsWith(b, [0x50, 0x4b, 0x03, 0x04]) && contains(b, WORD_DOC)) return DOCX_MIME;
  return null;
}

export function isImageMime(m: ExtractMimeType): boolean {
  return m.startsWith("image/");
}

/** Max base64 string length for a decoded cap (4 chars per 3 bytes, plus padding slack). */
export function maxBase64Length(maxBytes: number): number {
  return Math.ceil((maxBytes * 4) / 3) + 4;
}

const B64 = /^[A-Za-z0-9+/]*={0,2}$/;

/** Strip an optional `data:...;base64,` prefix and whitespace. Null if it is not valid base64. */
export function cleanBase64(raw: string): string | null {
  const comma = raw.startsWith("data:") ? raw.indexOf(",") : -1;
  const s = (comma >= 0 ? raw.slice(comma + 1) : raw).replace(/\s/g, "");
  if (!s || s.length % 4 === 1 || !B64.test(s)) return null;
  return s;
}
