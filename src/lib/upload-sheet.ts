/**
 * "Upload sheet" pick → visible state. Browser-neutral: no reliance on file.type or the
 * input's accept filter (DuckDuckGo/iOS WebKit and Android WebView often hand over an
 * empty or application/octet-stream type). A PDF is recognised by its .pdf name, its
 * application/pdf type, OR its first five bytes ("%PDF-"), read with the standard File API.
 * Every pick ends in Uploading → Loaded or Failed; nothing is swallowed.
 */
import { ACCEPT_ATTR, GUEST_NEEDS_SIGN_IN, mimeTypeFor, type ExtractState } from "./extract-client.ts";

export type UploadStatus =
  | { kind: "idle" }
  | { kind: "uploading"; name: string }
  | { kind: "loaded"; name: string; chars?: number }
  | { kind: "failed"; name: string; message: string; signIn?: boolean };

/** What the page's reader reports back once it has finished with the file. */
export type UploadOutcome = { ok: true } | { ok: false; message: string; signIn?: boolean };

export type PickKind = "pdf" | "text" | "other" | "unsupported";

export const PDF_MAGIC = "%PDF-";
/** On-device pdf.js read gives up after this, so a hung worker can't leave the user with nothing. */
export const PDF_READ_TIMEOUT_MS = 20_000;
export const NOT_SUPPORTED_MESSAGE =
  "That file isn’t a PDF, photo or scan (PNG, JPG, TIFF), Word (.docx) or text file.";
export const EMPTY_FILE_MESSAGE = "That file is empty. Pick the data sheet again.";
export const PICKER_ACCEPT = `${ACCEPT_ATTR},.txt,.md,application/pdf`;

type Blobish = { name: string; type?: string; size: number; slice(start?: number, end?: number): Blob };

/** True when the first five bytes are "%PDF-" (standard Blob.arrayBuffer, works on every browser). */
export async function hasPdfMagic(file: Pick<Blobish, "slice">): Promise<boolean> {
  try {
    const head = new Uint8Array(await file.slice(0, 5).arrayBuffer());
    return String.fromCharCode(...head) === PDF_MAGIC;
  } catch {
    return false;
  }
}

export async function classifyPick(file: Blobish): Promise<PickKind> {
  const lower = file.name.toLowerCase();
  if (lower.endsWith(".txt") || lower.endsWith(".md") || file.type === "text/plain") return "text";
  if (lower.endsWith(".pdf") || file.type === "application/pdf" || (await hasPdfMagic(file))) return "pdf";
  return mimeTypeFor(file) ? "other" : "unsupported";
}

/** A PDF picked without a .pdf name or type gets one, so every later check (and the server) sees a PDF. */
export function asPdfFile(file: File): File {
  if (file.name.toLowerCase().endsWith(".pdf") && file.type === "application/pdf") return file;
  const name = file.name.toLowerCase().endsWith(".pdf") ? file.name : `${file.name || "sheet"}.pdf`;
  return new File([file], name, { type: "application/pdf", lastModified: file.lastModified });
}

export function withTimeout<T>(p: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(message)), ms);
    p.then(
      (v) => { clearTimeout(t); resolve(v); },
      (e) => { clearTimeout(t); reject(e); },
    );
  });
}

export type PickDeps = {
  setStatus: (s: UploadStatus) => void;
  onText: (v: string) => void;
  /** pdf.js page text; may throw or hang (bounded by PDF_READ_TIMEOUT_MS). */
  readPdf: (file: File) => Promise<{ pages: string[]; text: string }>;
  /** The page's reader (on-device for guests, server for signed-in). */
  onUpload: (file: File, text: string, pages?: string[]) => Promise<UploadOutcome> | UploadOutcome | void;
  timeoutMs?: number;
};

/** One pick, start to finish. Always leaves a loaded or failed status. Never throws. */
export async function processPick(raw: File | undefined | null, deps: PickDeps): Promise<UploadStatus> {
  const done = (s: UploadStatus) => {
    deps.setStatus(s);
    return s;
  };
  if (!raw) return done({ kind: "idle" });
  const name = raw.name || "file";
  deps.setStatus({ kind: "uploading", name });
  try {
    if (!raw.size) return done({ kind: "failed", name, message: EMPTY_FILE_MESSAGE });
    const kind = await classifyPick(raw);
    if (kind === "unsupported") return done({ kind: "failed", name, message: NOT_SUPPORTED_MESSAGE });
    if (kind === "text") {
      const body = await raw.text();
      deps.onText(body);
      return done({ kind: "loaded", name, chars: body.length });
    }
    const file = kind === "pdf" ? asPdfFile(raw) : raw;
    let text = "";
    let pages: string[] | undefined;
    if (kind === "pdf") {
      try {
        const read = await withTimeout(deps.readPdf(file), deps.timeoutMs ?? PDF_READ_TIMEOUT_MS, "pdf read timed out");
        text = read.text;
        pages = read.pages;
      } catch {
        text = "";
      }
      // Little or no text on-device is fine to send: the reader decides how to read it.
      if (text.replace(/\s/g, "").length < 80) {
        text = "";
        pages = undefined;
      }
      if (text) deps.onText(text);
    }
    const out = await deps.onUpload(file, text, pages);
    if (out && !out.ok) return done({ kind: "failed", name, message: out.message, signIn: out.signIn });
    return done({ kind: "loaded", name, chars: text ? text.length : undefined });
  } catch (err) {
    const message = err instanceof Error && err.message ? `Couldn’t read ${name}: ${err.message}` : `Couldn’t read ${name}.`;
    return done({ kind: "failed", name, message });
  }
}

export function statusText(s: UploadStatus): string | null {
  switch (s.kind) {
    case "idle":
      return null;
    case "uploading":
      return `Uploading ${s.name}…`;
    case "loaded":
      return s.chars ? `Loaded ${s.name} (${s.chars.toLocaleString()} characters).` : `Loaded ${s.name}.`;
    case "failed":
      return `Failed: ${s.message}`;
  }
}

/** The page's finished read → what the upload line shows. null = superseded by a newer pick/sample. */
export function uploadOutcome(state: ExtractState | null, signedIn: boolean): UploadOutcome {
  if (!state || state.kind === "done") return { ok: true };
  if (state.kind === "unauthenticated") return { ok: false, message: "Your sign-in ran out. Sign in again to upload.", signIn: true };
  if (state.kind === "error")
    return { ok: false, message: state.message, signIn: !signedIn && state.message === GUEST_NEEDS_SIGN_IN };
  return { ok: true };
}

/** Take the picked file and clear the input at once, so the same file picked again still fires change. */
export function takePickedFile(input: { files: ArrayLike<File> | null; value: string }): File | undefined {
  const file = input.files?.[0];
  input.value = "";
  return file;
}
