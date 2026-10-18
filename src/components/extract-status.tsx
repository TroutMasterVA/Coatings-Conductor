import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  displayWarnings,
  IMAGE_ONLY_NOTICE,
  ISSUE_COPY,
  needsAzureReader,
  providerLabel,
  provenanceRows,
  retryCopy,
  type ExtractState,
  type ServerIssue,
} from "@/lib/extract-client";

/** Seconds left from a server retryAfterSec, ticking down once a second. */
function useCountdown(seconds: number | undefined): number | undefined {
  const [left, setLeft] = useState(seconds);
  useEffect(() => {
    setLeft(seconds);
    if (!seconds || seconds <= 0) return;
    const started = Date.now();
    const id = window.setInterval(() => {
      const next = Math.max(0, seconds - Math.floor((Date.now() - started) / 1000));
      setLeft(next);
      if (next <= 0) window.clearInterval(id);
    }, 1000);
    return () => window.clearInterval(id);
  }, [seconds]);
  return left;
}

function issueText(issue: ServerIssue, left: number | undefined): string {
  if (issue !== "RATE_LIMITED") return ISSUE_COPY[issue];
  return left === 0
    ? `${ISSUE_COPY[issue]} You can try again now.`
    : `${ISSUE_COPY[issue]} ${retryCopy(left)}`;
}

/** Above the card: loading, error, rate-limited / server issue, image-only notice. Never prints. */
export function ExtractNotice({ state }: { state: ExtractState }) {
  const retry = state.kind === "done" || state.kind === "error" ? state.retryAfterSec : undefined;
  const left = useCountdown(retry);
  if (state.kind === "loading") {
    return (
      <p
        role="status"
        className="no-print mb-3 flex items-center gap-2 rounded-lg bg-surface-2 px-3 py-2 text-sm text-muted"
      >
        <Loader2 className="size-4 animate-spin" />
        Reading the sheet… this can take up to a minute.
      </p>
    );
  }
  if (state.kind === "error") {
    const message = state.issue === "RATE_LIMITED" ? issueText(state.issue, left) : state.message;
    return (
      <p role="alert" className="no-print mb-3 rounded-lg bg-nogo-soft px-3 py-2 text-sm text-ink">
        {message}
      </p>
    );
  }
  if (state.kind !== "done") return null;
  const imageOnly = needsAzureReader(state.result);
  const issue = state.issue;
  if (!imageOnly && !issue) return null;
  return (
    <div className="no-print mb-3 space-y-2">
      {imageOnly ? (
        <p role="status" className="rounded-lg bg-caution-soft px-3 py-2 text-sm text-ink">
          {IMAGE_ONLY_NOTICE}
        </p>
      ) : null}
      {issue ? (
        <p role="status" className="rounded-lg bg-caution-soft px-3 py-2 text-sm text-ink">
          {issueText(issue, left)}
        </p>
      ) : null}
    </div>
  );
}

/** Under the card: provider + warnings note, and the collapsed provenance list. Never prints. */
export function ProvenancePanel({ state }: { state: ExtractState }) {
  if (state.kind !== "done") return null;
  const rows = provenanceRows(state.result.provenance);
  const warnings = displayWarnings(state.result);
  return (
    <div className="no-print mt-3 space-y-2">
      <div className="text-xs text-muted">
        <p>{providerLabel(state)}</p>
        {warnings.length ? (
          <ul className="mt-1 list-disc pl-4">
            {warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        ) : null}
      </div>
      <details className="rounded-lg bg-surface shadow-[0_0_0_1px_rgba(255,255,255,0.08)]">
        <summary className="cursor-pointer select-none px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted">
          Where each value came from
        </summary>
        {rows.length ? (
          <dl className="divide-y divide-border border-t border-border px-3 text-sm">
            {rows.map((r) => (
              <div key={r.fieldPath} className="grid gap-1 py-2 sm:grid-cols-[minmax(0,12rem)_1fr]">
                <dt className="text-xs text-muted" title={r.fieldPath}>
                  {r.label}
                </dt>
                <dd className={r.stated ? "text-fg" : "text-subtle"}>{r.text}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="border-t border-border px-3 py-2 text-sm text-muted">
            No quotes recorded for this read. Check each value against the sheet.
          </p>
        )}
      </details>
    </div>
  );
}
