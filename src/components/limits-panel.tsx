import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { DEW_SPREAD_DEFAULT_F } from "../lib/score-windows.ts";
import { LIMIT_FIELDS, LIMIT_LABEL, TEXT_LIMIT_FIELDS, notStatedFlag } from "../lib/limit-fields.ts";
import { editLimit, FROM_SHEET, limitSource, SSPC_DEW_DEFAULT_TEXT, USER_EDITED, type LimitSource } from "../lib/limit-source.ts";
import type { ClientProvenance } from "../lib/extract-client.ts";
import type { Environmentals, FieldCardData } from "../lib/types.ts";

function SourceLine({ src, flag, testId }: { src: LimitSource; flag: string; testId: string }) {
  if (src.kind === "unstated")
    return <p className="mt-0.5 text-[11px] text-caution" data-testid={`${testId}-src`} data-src="unstated">{flag}</p>;
  if (src.kind === "edited")
    return (
      <p className="mt-0.5 text-[11px] text-accent" data-testid={`${testId}-src`} data-src="edited">
        {USER_EDITED}
        {src.sheetQuote ? <span className="text-subtle"> · sheet said {src.sheetQuote}</span> : null}
      </p>
    );
  return (
    <p className="mt-0.5 text-[11px] text-muted" data-testid={`${testId}-src`} data-src="sheet">
      {FROM_SHEET}
      {src.quote ? <span className="text-subtle"> · {src.quote}</span> : null}
    </p>
  );
}

/** Free text edits as a draft and saves on blur / Enter (the card trims, so live saving ate spaces). */
function TextLimit({ label, value, onCommit }: { label: string; value: string; onCommit?: (v: string) => void }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return (
    <Input
      aria-label={label}
      className="mt-1 h-9"
      value={draft}
      disabled={!onCommit}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => onCommit?.(draft)}
      onKeyDown={(e) => {
        if (e.key === "Enter") onCommit?.(draft);
      }}
    />
  );
}

/**
 * Every application-limiting attribute, one field each. Numbers feed every verdict (they are the
 * card's environmentals, which rescoring and the hourly checks read); text limits are shown and editable.
 * Saved with the card through the project's existing autosave (server, or the guest's device store).
 */
export function LimitsPanel({
  card,
  asRead,
  provenance,
  onEnvironmentals,
  onEditField,
}: {
  card: FieldCardData;
  /** Card as the sheet was read; a different value now = user-edited. */
  asRead?: FieldCardData;
  provenance?: ClientProvenance | null;
  onEnvironmentals?: (env: Environmentals) => void;
  onEditField?: (path: string, value: string) => void;
}) {
  const env = card.environmentals;
  return (
    <div data-testid="limits-panel">
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {LIMIT_FIELDS.map(({ key, label, unit }) => {
          const path = `environmentals.${key}`;
          const src = limitSource(path, card, asRead, provenance);
          const dew = key === "dewPointSpreadMinF";
          return (
            <label key={key} className="block" data-testid={`limit-${key}`}>
              <span className="text-xs font-medium text-muted">
                {label} {unit}
              </span>
              <Input
                inputMode="decimal"
                aria-label={`${label} ${unit}`}
                className="mt-1 h-9 font-mono"
                value={env[key] ?? ""}
                placeholder={dew ? String(DEW_SPREAD_DEFAULT_F) : undefined}
                disabled={!onEnvironmentals}
                onChange={(e) => onEnvironmentals?.(editLimit(env, key, e.target.value))}
              />
              <SourceLine src={src} flag={notStatedFlag(LIMIT_LABEL[key])} testId={`limit-${key}`} />
              {dew && env[key] == null ? (
                <p className="text-[11px] text-muted" data-testid="dew-default">Using {SSPC_DEW_DEFAULT_TEXT}</p>
              ) : null}
            </label>
          );
        })}
        <label className="flex items-end gap-2 pb-1 text-sm text-fg">
          <input
            type="checkbox"
            className="size-4 accent-go"
            checked={!env.precipitationAllowed}
            disabled={!onEnvironmentals}
            onChange={(e) => onEnvironmentals?.({ ...env, precipitationAllowed: !e.target.checked })}
          />
          Dry only
        </label>
      </div>
      <p className="mt-4 text-xs font-medium uppercase tracking-wide text-muted">Times &amp; film (editable, not scored)</p>
      <div className="mt-2 grid gap-3 sm:grid-cols-2">
        {TEXT_LIMIT_FIELDS.map(({ path, label }) => {
          const [group, field] = path.split(".") as [keyof FieldCardData, string];
          const value = String(((card[group] as unknown) as Record<string, unknown>)[field] ?? "");
          const testId = `limit-${path.replace(".", "-")}`;
          return (
            <label key={path} className="block" data-testid={testId}>
              <span className="text-xs font-medium text-muted">{label}</span>
              <TextLimit label={label} value={value} onCommit={onEditField ? (v) => onEditField(path, v) : undefined} />
              <SourceLine src={limitSource(path, card, asRead, provenance)} flag={notStatedFlag(label.toLowerCase())} testId={testId} />
            </label>
          );
        })}
      </div>
    </div>
  );
}
