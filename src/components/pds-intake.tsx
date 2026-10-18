import { useRef, useState } from "react";
import { FileText, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SAMPLE_PDS_TEXT, SAMPLES } from "@/lib/samples";
import { ACCEPT_ATTR, isPdf } from "@/lib/extract-client";
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
}: {
  text: string;
  onText: (v: string) => void;
  onExtract: () => void;
  /** PDF, photo/scan, or Word file picked: hand the file (for the server reader) plus any on-device text. */
  onUpload: (file: File, text: string, pages?: string[]) => void;
  onSample: (card: FieldCardData, raw: string) => void;
  loading: boolean;
  recents: SavedCard[];
  onOpenRecent: (card: FieldCardData) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileNote, setFileNote] = useState<string | null>(null);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setFileNote(null);
    const lower = file.name.toLowerCase();
    if (lower.endsWith(".txt") || lower.endsWith(".md") || file.type === "text/plain") {
      const raw = await file.text();
      onText(raw);
      setFileNote(`Loaded ${file.name}.`);
      return;
    }
    let extracted = "";
    let pages: string[] | undefined;
    if (isPdf(file)) {
      try {
        const read = await extractPdfPages(file);
        // FE-2 per-page text → contract's `pages: string[]` (index 0 = page 1).
        pages = read.map((p) => p.text);
        extracted = joinPages(read);
      } catch {
        extracted = "";
      }
      // Little or no text on-device is fine to send: the server decides how to read it.
      if (extracted.replace(/\s/g, "").length < 80) {
        extracted = "";
        pages = undefined;
      }
      if (extracted) onText(extracted);
    }
    setFileNote(
      extracted ? `Loaded ${file.name} (${extracted.length.toLocaleString()} characters).` : `Loaded ${file.name}.`,
    );
    onUpload(file, extracted, pages);
  }

  return (
    <section className="rounded-xl bg-surface p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.08)] sm:p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Label htmlFor="pds">Product data sheet</Label>
          <p className="mt-1 text-sm text-muted">Paste the PDS, or upload a PDF, photo or scan, or Word file. Samples skip the wait.</p>
        </div>
        <div className="flex gap-2">
          <input
            ref={fileRef}
            type="file"
            accept={`${ACCEPT_ATTR},.txt,.md`}
            className="sr-only"
            onChange={(e) => void onFile(e.target.files?.[0])}
          />
          <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
            <Upload />
            Upload sheet
          </Button>
        </div>
      </div>

      <Textarea
        id="pds"
        value={text}
        onChange={(e) => onText(e.target.value)}
        placeholder="Paste the full PDS here — storage, ambients, dew point, mix, DFT, recoat, credentials…"
        className="mt-3 min-h-44 font-mono text-[13px] leading-relaxed"
      />
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
        <span>{fileNote ?? `${text.length.toLocaleString()} / 40,000`}</span>
        <Button type="button" onClick={onExtract} disabled={loading || text.trim().length < 40}>
          {loading ? <Loader2 className="animate-spin" /> : <FileText />}
          Build job card
        </Button>
      </div>

      <div className="mt-5">
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">Sample products</p>
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
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">Recent cards</p>
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
