import { useRef, useState } from "react";
import { FileText, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SAMPLE_PDS_TEXT, SAMPLES } from "@/lib/samples";
import { extractPdfText } from "@/lib/pdf-text";
import type { FieldCardData, SavedCard } from "@/lib/types";
import { cn } from "@/lib/utils";

export function PdsIntake({
  text,
  onText,
  onExtract,
  onSample,
  loading,
  recents,
  onOpenRecent,
}: {
  text: string;
  onText: (v: string) => void;
  onExtract: () => void;
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
    if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
      try {
        const extracted = await extractPdfText(file);
        if (extracted.replace(/\s/g, "").length < 80) {
          setFileNote("Could not read this sheet.");
          return;
        }
        onText(extracted);
        setFileNote(`Loaded ${file.name} (${extracted.length.toLocaleString()} characters).`);
      } catch {
        setFileNote("Could not read this sheet.");
      }
      return;
    }
    const raw = await file.text();
    onText(raw);
    setFileNote(`Loaded ${file.name}.`);
  }

  return (
    <section className="rounded-xl bg-surface p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.08)] sm:p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Label htmlFor="pds">Product data sheet</Label>
          <p className="mt-1 text-sm text-muted">Paste the PDS, or drop a PDF. Samples skip the wait.</p>
        </div>
        <div className="flex gap-2">
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.txt,.md,application/pdf,text/plain"
            className="sr-only"
            onChange={(e) => void onFile(e.target.files?.[0])}
          />
          <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
            <Upload />
            PDF / text
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
