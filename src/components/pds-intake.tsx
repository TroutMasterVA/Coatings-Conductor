import { useRef, useState } from "react";
import { FileText, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { extractPdfBytes } from "@/lib/pdf-text";
import { savePdsDraft } from "@/lib/pds-draft";
import type { FieldCardData } from "@/lib/types";
import { cn } from "@/lib/utils";

export function PdsIntake({
  text,
  onText,
  onExtract,
  loading,
  recents,
  onOpenRecent,
  projectId,
}: {
  text: string;
  onText: (v: string) => void;
  onExtract: (raw?: string) => void;
  loading: boolean;
  recents: { id: string; card: FieldCardData; zip?: string }[];
  onOpenRecent: (card: FieldCardData) => void;
  projectId?: string | null;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileNote, setFileNote] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  async function applyExtracted(extracted: string, label: string) {
    const compact = extracted.replace(/\s/g, "");
    if (compact.length < 80) {
      setFileNote("Could not read this PDF — it looks scanned or empty. Paste the selectable text instead.");
      return;
    }
    savePdsDraft({ projectId: projectId ?? null, text: extracted, fileName: label });
    onText(extracted);
    setFileNote(`Loaded ${label} (${extracted.length.toLocaleString()} characters).`);
    onExtract(extracted);
  }

  async function readPdfBytes(bytes: Uint8Array, label: string) {
    const extracted = await extractPdfBytes(bytes);
    await applyExtracted(extracted, label);
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    setFileNote("Reading file…");
    setReading(true);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const magic = String.fromCharCode(...bytes.slice(0, 5));
      const looksPdf =
        magic.startsWith("%PDF") ||
        file.type === "application/pdf" ||
        file.name.toLowerCase().endsWith(".pdf") ||
        file.type === "application/octet-stream" ||
        !file.type;
      if (looksPdf && (magic.startsWith("%PDF") || file.name.toLowerCase().endsWith(".pdf"))) {
        await readPdfBytes(bytes, file.name || "sheet.pdf");
        return;
      }
      const raw = new TextDecoder().decode(bytes);
      savePdsDraft({ projectId: projectId ?? null, text: raw, fileName: file.name });
      onText(raw);
      setFileNote(`Loaded ${file.name}.`);
      onExtract(raw);
    } catch {
      setFileNote("Could not read this file. Use a selectable (not scanned) PDF, or paste the PDS text.");
    } finally {
      setReading(false);
    }
  }

  const busy = loading || reading;

  return (
    <section className="rounded-xl bg-surface p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.08)] sm:p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Label htmlFor="pds">Product data sheet</Label>
          <p className="mt-1 text-sm text-muted">
            Upload a PDF or paste the PDS. Any manufacturer. The card is built from this sheet only.
          </p>
        </div>
        <input
          ref={fileRef}
          id="pds-file"
          data-testid="pds-file"
          type="file"
          accept=".pdf,.txt,.md,application/pdf,text/plain,application/octet-stream"
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            void onFile(f);
          }}
        />
      </div>

      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          void onFile(e.dataTransfer.files?.[0]);
        }}
        disabled={busy}
        className={cn(
          "mt-3 flex w-full min-h-24 flex-col items-center justify-center gap-1 rounded-lg px-3 py-6 text-center",
          "shadow-[0_0_0_1px_rgba(255,255,255,0.08)] transition-colors",
          dragOver ? "bg-accent/15" : "bg-surface-2",
          busy && "opacity-70",
        )}
      >
        {reading ? <Loader2 className="size-5 animate-spin text-accent" /> : <Upload className="size-5 text-accent" />}
        <span className="text-sm font-medium text-fg">{reading ? "Reading sheet…" : "Drop PDF here or tap to upload"}</span>
        <span className="text-xs text-muted">PDF or .txt · stays on this device · then tap Build if you pasted text</span>
      </button>

      <Textarea
        id="pds"
        value={text}
        onChange={(e) => onText(e.target.value)}
        placeholder="Or paste the full PDS here — mixing, application conditions, dew point, DFT, cure…"
        className="mt-3 min-h-44 font-mono text-[13px] leading-relaxed"
      />
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
        <span>{fileNote ?? `${text.length.toLocaleString()} / 40,000`}</span>
        <Button type="button" onClick={() => onExtract()} disabled={busy || text.trim().length < 40}>
          {busy ? <Loader2 className="animate-spin" /> : <FileText />}
          Build job card
        </Button>
      </div>

      {recents.length ? (
        <div className="mt-5">
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">Recent cards this job</p>
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
