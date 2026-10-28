import { useRef, useState } from "react";
import { FileText, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SAMPLE_PDS_TEXT, SAMPLES } from "@/lib/samples";
import { processPick, takePickedFile, statusText, PICKER_ACCEPT, type UploadOutcome, type UploadStatus } from "@/lib/upload-sheet";
import { joinPages } from "@/lib/pdf-lines";
import { extractPdfPages } from "@/lib/pdf-text";
import type { FieldCardData, SavedCard } from "@/lib/types";
import { cn } from "@/lib/utils";

export function PdsIntake({
  text,
  onText,
  onExtract,
  onUpload,
  onSample,
  loading,
  recents,
  onOpenRecent,
  onSignIn,
}: {
  text: string;
  onText: (v: string) => void;
  onExtract: () => void;
  /** PDF, photo/scan, or Word file picked: hand the file (for the server reader) plus any on-device text. */
  onUpload: (file: File, text: string, pages?: string[]) => Promise<UploadOutcome> | UploadOutcome | void;
  /** Guests only: where the Failed line's "Sign in" button goes. */
  onSignIn?: () => void;
  onSample: (card: FieldCardData, raw: string) => void;
  loading: boolean;
  recents: SavedCard[];
  onOpenRecent: (card: FieldCardData) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [upload, setUpload] = useState<UploadStatus>({ kind: "idle" });
  const busy = upload.kind === "uploading";

  async function onPick(input: HTMLInputElement) {
    const file = takePickedFile(input);
    await processPick(file, {
      setStatus: setUpload,
      onText,
      readPdf: async (f) => {
        const read = await extractPdfPages(f);
        return { pages: read.map((p) => p.text), text: joinPages(read) };
      },
      onUpload,
    });
  }

  return (
    <section className="rounded-xl bg-surface p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.08)] sm:p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Label htmlFor="pds">Product data sheet</Label>
          <p className="mt-1 text-sm text-muted">
            Paste the PDS, or upload a PDF, photo or scan, or Word file. Samples skip the wait.
          </p>
        </div>
        <div className="flex gap-2">
          <input
            ref={fileRef}
            type="file"
            accept={PICKER_ACCEPT}
            className="sr-only"
            data-testid="sheet-file"
            onChange={(e) => void onPick(e.currentTarget)}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
          >
            {busy ? <Loader2 className="animate-spin" /> : <Upload />}
            {busy ? "Uploading…" : "Upload sheet"}
          </Button>
        </div>
      </div>
      <UploadStatusLine status={upload} onSignIn={onSignIn} />

      <Textarea
        id="pds"
        value={text}
        onChange={(e) => onText(e.target.value)}
        placeholder="Paste the full PDS here — storage, ambients, dew point, mix, DFT, recoat, credentials…"
        className="mt-3 min-h-44 font-mono text-[13px] leading-relaxed"
      />
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
        <span>{`${text.length.toLocaleString()} / 40,000`}</span>
        <Button type="button" onClick={onExtract} disabled={loading || text.trim().length < 40}>
          {loading ? <Loader2 className="animate-spin" /> : <FileText />}
          Build job card
        </Button>
      </div>

      <div className="mt-5">
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">
          Sample products
        </p>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          {SAMPLES.map((s) => (
            <button
              key={s.key}
              type="button"
              className={cn(
                "rounded-lg bg-surface-2 px-3 py-3 text-left shadow-[0_0_0_1px_rgba(255,255,255,0.06)]",
                "transition-[background-color,box-shadow,transform] duration-150 ease-out hover:shadow-[0_0_0_1px_rgba(232,93,4,0.55)] active:scale-[0.98]",
              )}
              onClick={() => onSample(s.card(), SAMPLE_PDS_TEXT[s.key] ?? "")}
            >
              <span className="block text-sm font-medium text-fg">{s.title}</span>
              <span className="mt-1 block text-xs text-muted">{s.blurb}</span>
            </button>
          ))}
        </div>
      </div>

      {recents.length ? (
        <div className="mt-5">
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">
            Recent cards
          </p>
          <ul className="mt-2 divide-y divide-border">
            {recents.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-3 py-2.5 text-left text-sm hover:text-accent"
                  onClick={() => onOpenRecent(r.card)}
                >
                  <span className="truncate">{r.card.product.name}</span>
                  <span className="shrink-0 font-mono text-xs text-muted">{r.zip || "—"}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

/** Uploading (spinner) · Loaded (file name) · Failed (plain reason). Exported for tests. */
export function UploadStatusLine({ status, onSignIn }: { status: UploadStatus; onSignIn?: () => void }) {
  const line = statusText(status);
  if (!line) return null;
  return (
    <div
      role={status.kind === "failed" ? "alert" : "status"}
      aria-live="polite"
      data-testid="upload-status"
      data-state={status.kind}
      className={cn(
        "mt-3 flex flex-wrap items-center gap-2 rounded-md px-3 py-2 text-sm",
        status.kind === "failed" ? "bg-nogo/10 text-nogo" : "bg-surface-2 text-fg",
      )}
    >
      {status.kind === "uploading" ? <Loader2 className="size-4 animate-spin" /> : null}
      <span>{line}</span>
      {status.kind === "failed" && status.signIn && onSignIn ? (
        <Button type="button" size="sm" variant="outline" onClick={onSignIn}>
          Sign in to upload
        </Button>
      ) : null}
    </div>
  );
}
