import { useMemo, useState } from "react";
import { hourListLabel, hourReadings, hourText, OUTSIDE_WORK_WINDOW, STRIP_LAST_HOUR, stripHours, stripLabel } from "@/lib/hour-strip";
import { Check, CloudSun, Loader2, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  compatibleMitigations,
  coveringPackage,
  isConflicted,
  isRecommended,
  mitigationById,
  peakExample,
  selectMitigation,
  SUBSTRATES,
  substrateById,
  type MitigationDef,
  type MitigationId,
  type SiteContext,
  type SubstrateId,
} from "@/lib/mitigations";
import { dayCountLabel, detectLimiters, goHourCount, unlockedGoHours } from "@/lib/score-windows";
import { BACKUP_LABEL, type HourCheck, type LimitCheck, type SheetWindow } from "@/lib/noaa";
import type { DayWindow, Environmentals, ForecastBundle, HourWindow, WindowStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import { WINDOWS_PAUSED } from "@/lib/extract-flags";

const selectClass =
  "flex h-11 w-full rounded-md bg-surface-2 px-3 text-sm text-fg shadow-[0_0_0_1px_rgba(255,255,255,0.08)] transition-[box-shadow] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 disabled:opacity-40";

function statusVariant(s: WindowStatus): "go" | "caution" | "nogo" | "default" {
  if (s === "go" || s === "caution" || s === "nogo") return s;
  return "default";
}

function statusFill(s: WindowStatus) {
  if (s === "go") return "bg-go";
  if (s === "caution") return "bg-caution";
  if (s === "nogo") return "bg-nogo";
  return "bg-subtle";
}

const VERDICT_TEXT: Record<HourCheck["verdict"], string> = { go: "GO", nogo: "NO-GO", unavailable: "Unavailable", outside: OUTSIDE_WORK_WINDOW };
const CHECK_TEXT: Record<LimitCheck["status"], string> = {
  pass: "pass",
  fail: "fail",
  unavailable: "unavailable",
  "not-stated": "Not stated",
};

/** NOAA hourly vs the sheet's limits: per-hour verdict, each check's reason, every value's source. */
function SheetLimitChecks({ sheet, timezone, night }: { sheet: SheetWindow; timezone: string; night?: boolean }) {
  const hours = sheet.hours.slice(0, 24);
  return (
    <div className="rounded-xl bg-surface p-4 text-xs shadow-[0_0_0_1px_rgba(255,255,255,0.08)] sm:p-5">
      <p className="text-sm font-medium text-fg">Hourly vs sheet limits (next 24 h)</p>
      <p className="mt-1 text-muted">{hourListLabel(hours.map((h) => h.startIso), timezone, night)}</p>
      <p className="mt-1 text-muted">
        {sheet.backup ? <strong className="text-caution">{BACKUP_LABEL}. </strong> : null}
        Forecast: {sheet.source.label}
      </p>
      <p className="mt-1 text-muted">
        {sheet.now
          ? `Now: ${sheet.now.tempF ?? "—"}°F, RH ${sheet.now.rh ?? "—"}%, dew point ${sheet.now.dewpointF ?? "—"}°F, wind ${sheet.now.windMph ?? "—"} mph · ${sheet.now.label}`
          : "Now: no station observation available."}
      </p>
      <ul className="mt-3 space-y-1.5">
        {hours.map((h) => (
          <li key={h.startIso}>
            <span className="font-mono text-fg">{hourText(h.startIso, timezone)}</span>{" "}
            <Badge variant={h.verdict === "go" ? "go" : h.verdict === "nogo" ? "nogo" : "default"}>{VERDICT_TEXT[h.verdict]}</Badge>{" "}
            <span className="text-fg">{hourReadings(h.hour, h.checks.find((c) => c.name === "Dew-point spread"))}</span>
            {h.verdict === "outside" ? null : (
              <span className="text-muted">
                {" · "}
                {h.checks
                  .filter((c) => c.status !== "pass" || h.verdict === "go")
                  .map((c) => `${CHECK_TEXT[c.status]}: ${c.reason}`)
                  .join(" · ")}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function HourStrip({ hours, night }: { hours: HourWindow[]; night?: boolean }) {
  const usable = stripHours(hours, night);
  const [tip, setTip] = useState<HourWindow | null>(null);
  return (
    <div className="relative">
      <div className="flex h-7 overflow-hidden rounded-sm">
        {usable.map((h) => (
          <button
            key={h.startIso}
            type="button"
            title={`${String(h.hour).padStart(2, "0")}:00 · ${h.status} · ${h.reasons[0] ?? ""}`}
            className={cn("hour-cell min-w-0 flex-1", statusFill(h.status))}
            onMouseEnter={() => setTip(h)}
            onFocus={() => setTip(h)}
            onMouseLeave={() => setTip(null)}
            onBlur={() => setTip(null)}
            aria-label={`${h.hour}:00 ${h.status}`}
          />
        ))}
      </div>
      <div className="mt-1 flex justify-between font-mono text-xs text-muted">
        <span>{night ? "00" : "05"}</span>
        <span>12</span>
        <span>{night ? "24" : String(STRIP_LAST_HOUR + 1)}</span>
      </div>
      {tip ? (
        <p className="mt-1 font-mono text-xs text-fg">
          {String(tip.hour).padStart(2, "0")}:00 · air {tip.tempF ?? "—"}°F
          {tip.substrateF != null ? ` · sub ${tip.substrateF}°F` : ""}
          {tip.rh != null ? ` · ${tip.rh}% RH` : ""} · {tip.reasons[0]}
        </p>
      ) : null}
    </div>
  );
}

function DayCard({ day, night }: { day: DayWindow; night?: boolean }) {
  return (
    <article className="rounded-lg bg-surface-2 p-3 shadow-[0_0_0_1px_rgba(255,255,255,0.06)]">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted">{day.weekday}</p>
          <p className="font-mono text-sm text-fg">{day.dateLabel}</p>
        </div>
        <Badge variant={statusVariant(day.status)}>{day.status}</Badge>
      </div>
      <p className="mt-2 font-mono text-sm text-fg">{day.bestRange ?? "No window"}</p>
      <p className="mt-0.5 text-xs text-muted">
        {dayCountLabel(day)}
      </p>
      {day.limiting[0] ? <p className="mt-1 line-clamp-2 text-xs text-muted">{day.limiting[0]}</p> : null}
      <div className="mt-3">
        <HourStrip hours={day.hours} night={night} />
      </div>
    </article>
  );
}

function numOrNull(v: string): number | null {
  if (v.trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function Limit({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | null;
  onChange: (n: number | null) => void;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-muted">{label}</span>
      <Input
        inputMode="decimal"
        className="mt-1 h-9 font-mono"
        value={value ?? ""}
        onChange={(e) => onChange(numOrNull(e.target.value))}
      />
    </label>
  );
}

function MitPickGrid({
  title,
  blurb,
  items,
  selectedIds,
  recommendedIds,
  locked,
  reasonFor,
  blockedFor,
  gainedFor,
  onToggle,
}: {
  title: string;
  blurb: string;
  items: MitigationDef[];
  selectedIds: MitigationId[];
  recommendedIds: MitigationId[];
  locked?: boolean;
  reasonFor: (m: MitigationDef) => string;
  blockedFor: (m: MitigationDef) => boolean;
  gainedFor: (id: MitigationId) => number | null;
  onToggle: (id: MitigationId) => void;
}) {
  if (!items.length) return null;
  return (
    <div className="mt-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">{title}</p>
      <p className="mt-0.5 text-xs leading-relaxed text-muted">{blurb}</p>
      <ul className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {items.map((m) => {
          const selected = selectedIds.includes(m.id);
          const rec = recommendedIds.includes(m.id);
          const reason = reasonFor(m);
          const blocked = !selected && blockedFor(m);
          const gained = !selected && !blocked ? gainedFor(m.id) : null;
          return (
            <li key={m.id} className="min-w-0">
              <button
                type="button"
                disabled={locked || blocked}
                aria-pressed={selected}
                title={m.summary}
                onClick={() => onToggle(m.id)}
                className={cn(
                  "flex min-h-11 w-full items-start gap-2 rounded-md px-2.5 py-2 text-left transition-[box-shadow] duration-150",
                  selected
                    ? "bg-go/20 shadow-[0_0_0_1px_rgba(63,125,92,0.65)]"
                    : rec
                      ? "bg-go/10 shadow-[0_0_0_1px_rgba(63,125,92,0.4)]"
                      : "bg-surface-2 shadow-[0_0_0_1px_rgba(255,255,255,0.08)] hover:shadow-[0_0_0_1px_rgba(255,255,255,0.13)]",
                  (locked || blocked) && "cursor-not-allowed opacity-45 hover:shadow-[0_0_0_1px_rgba(255,255,255,0.08)]",
                )}
              >
                {selected ? (
                  <Check className="mt-0.5 size-3.5 shrink-0 text-go-soft" />
                ) : (
                  <span className="mt-0.5 size-3.5 shrink-0 rounded-sm shadow-[0_0_0_1px_rgba(255,255,255,0.18)]" />
                )}
                <span className="min-w-0">
                  <span
                    className={cn(
                      "block text-xs font-medium leading-snug",
                      selected || rec ? "text-go-soft" : "text-fg",
                    )}
                  >
                    {m.label}
                  </span>
                  <span className="mt-0.5 block text-xs leading-snug text-muted">
                    {m.owns}
                    {reason ? ` · ${reason}` : ""}
                    {gained && gained > 0 ? ` · +${gained}h` : ""}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function WeatherPanel({
  zip,
  onZip,
  forecast,
  loading,
  error,
  onLoad,
  disabled,
  environmentals,
  onEnvironmentals,
  site,
  onSite,
  paused,
}: {
  zip: string;
  onZip: (v: string) => void;
  forecast: ForecastBundle | null;
  loading: boolean;
  error: string | null;
  onLoad: () => void;
  disabled?: boolean;
  environmentals?: Environmentals;
  onEnvironmentals?: (env: Environmentals) => void;
  site: SiteContext;
  onSite: (site: SiteContext) => void;
  /** Temperature limits not verified on the sheet: no windows are shown (FE-3). */
  paused?: boolean;
}) {
  const days = forecast?.days ?? [];
  const night = site.mitigations.includes("night_shift");
  const sub = substrateById(site.substrate);
  const example = peakExample(site.substrate, 80);
  const available = compatibleMitigations({
    substrate: site.substrate,
    moistureTolerant: site.moistureTolerant,
    discipline: site.discipline,
  });
  const limiters = useMemo(() => {
    if (!forecast || !environmentals) return [];
    return detectLimiters(forecast, environmentals, { ...site, mitigations: [] });
  }, [forecast, environmentals, site.substrate, site.discipline]);

  const recommendedIds = useMemo(() => {
    return available
      .filter((m) => {
        if (site.mitigations.includes(m.id)) return false;
        if (isConflicted(m.id, site.mitigations)) return false;
        const next = selectMitigation(site.mitigations, m.id);
        const unlocks =
          forecast && environmentals
            ? unlockedGoHours(forecast, environmentals, {
                ...site,
                mitigations: next,
              })
            : 0;
        return isRecommended(m, {
          substrate: site.substrate,
          discipline: site.discipline,
          limiters,
          unlocksHours: unlocks,
        });
      })
      .map((m) => m.id);
  }, [available, forecast, environmentals, site, limiters]);

  const summary = useMemo(() => {
    if (!forecast) return null;
    const go = days.filter((d) => d.status === "go").length;
    return { go, total: days.length };
  }, [forecast, days]);

  function addMitigation(id: MitigationId) {
    onSite({ ...site, mitigations: selectMitigation(site.mitigations, id) });
  }

  function toggleMitigation(id: MitigationId) {
    if (site.mitigations.includes(id)) {
      onSite({ ...site, mitigations: site.mitigations.filter((x) => x !== id) });
      return;
    }
    addMitigation(id);
  }

  function hoursGained(id: MitigationId) {
    if (!forecast || !environmentals) return null;
    const next = selectMitigation(site.mitigations, id);
    if (next.length === site.mitigations.length && next.every((m, i) => m === site.mitigations[i])) return 0;
    const withIt: SiteContext = { ...site, mitigations: next };
    return unlockedGoHours(forecast, environmentals, withIt) - unlockedGoHours(forecast, environmentals, site);
  }

  function pickReason(m: MitigationDef) {
    if (site.mitigations.includes(m.id)) return "";
    const cover = coveringPackage(m.id, site.mitigations);
    if (cover) return `covered by ${cover.label}`;
    if (m.kind !== "package" && isConflicted(m.id, site.mitigations)) return "conflicts";
    if (m.kind === "package") {
      const other = site.mitigations
        .map((id) => mitigationById(id))
        .find((x) => x?.kind === "package" && x.id !== m.id && m.conflicts?.includes(x.id));
      if (other) return `replaces ${other.label}`;
    }
    return "";
  }

  function isBlocked(m: MitigationDef) {
    if (site.mitigations.includes(m.id)) return false;
    if (m.kind === "package") return false;
    return isConflicted(m.id, site.mitigations);
  }

  const independent = available.filter((m) => m.kind === "independent");
  const packages = available.filter((m) => m.kind === "package");

  return (
    <aside className="flex flex-col gap-4">
      <div className="rounded-xl bg-surface p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.08)] sm:p-5">
        <div className="flex items-center gap-2 text-accent">
          <CloudSun className="size-4" />
          <p className="text-xs font-semibold uppercase tracking-wide">NOAA application windows</p>
        </div>
        <p className="mt-2 text-sm text-muted">
          Score air, estimated substrate temperature in sun, RH, dew-point spread, wind, and rain. Pick the real
          substrate and the mitigations you will actually field.
        </p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1">
            <Label htmlFor="zip">Job-site ZIP</Label>
            <div className="relative mt-1.5">
              <MapPin className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle" />
              <Input
                id="zip"
                inputMode="numeric"
                maxLength={5}
                placeholder="22202"
                className="pl-9 font-mono tracking-widest"
                value={zip}
                onChange={(e) => onZip(e.target.value.replace(/\D/g, "").slice(0, 5))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") onLoad();
                }}
              />
            </div>
          </div>
          <Button type="button" variant="secondary" onClick={onLoad} disabled={disabled || loading || zip.length !== 5}>
            {loading ? <Loader2 className="animate-spin" /> : null}
            Load windows
          </Button>
        </div>
        {error ? <p className="mt-3 text-sm text-nogo">{error}</p> : null}

        <div className="mt-5 border-t border-border pt-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Substrate</p>
          <select
            id="substrate"
            className={cn(selectClass, "mt-2")}
            value={site.substrate}
            onChange={(e) => onSite({ ...site, substrate: e.target.value as SubstrateId, mitigations: site.mitigations.filter((id) => {
              const m = mitigationById(id);
              const next = substrateById(e.target.value as SubstrateId);
              return !(m?.metalOnly && !next.metal);
            }) })}
          >
            {SUBSTRATES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
          <div className="mt-3">
            <Label htmlFor="measured-surface">Measured surface temp (°F)</Label>
            <Input
              id="measured-surface"
              type="number"
              inputMode="decimal"
              className="mt-1"
              placeholder="Optional gauge reading"
              value={site.measuredSurfaceTempF ?? ""}
              onChange={(e) => {
                const v = e.target.value.trim() === "" ? null : Number(e.target.value);
                onSite({ ...site, measuredSurfaceTempF: v != null && Number.isFinite(v) ? v : null });
              }}
            />
            <p className="mt-1 text-xs text-muted">
              Empty: surface checks use the sun estimate, labelled “estimate, verify with gauge”.
            </p>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-muted">
            {sub.note} On a sunny {example.airF}°F afternoon this face estimates about{" "}
            <span className="font-mono text-fg">{example.substrateF}°F</span>
            {example.gain ? ` (+${example.gain}° solar)` : ""}.
            {environmentals?.substrateTempMaxF != null && example.substrateF > environmentals.substrateTempMaxF
              ? ` That is above the ${environmentals.substrateTempMaxF}°F PDS max without shade or a night shift.`
              : ""}
          </p>
        </div>

        <div className="mt-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted">Mitigation strategy</p>
            {site.bodies?.length ? (
              <p className="text-xs text-muted">
                {site.discipline ?? "coatings"} · {site.bodies.join(" · ")}
              </p>
            ) : null}
          </div>
          <p className="mt-1.5 text-xs leading-relaxed text-muted">
            Independent = one limiter. Package = enclosure that already covers those independents — you cannot stack
            both. Pick a package and it replaces the open kit it covers.
          </p>
          {recommendedIds.length ? (
            <div className="mt-2">
              <p className="text-xs font-medium text-go-soft">Recommended this week</p>
              <ul className="mt-1.5 flex flex-wrap gap-2">
                {recommendedIds.map((id) => {
                  const m = mitigationById(id);
                  const gained = hoursGained(id);
                  return (
                    <li key={id}>
                      <button
                        type="button"
                        className="inline-flex min-h-11 items-center gap-1.5 rounded-md bg-go/20 px-2.5 py-1.5 text-xs font-medium text-go-soft shadow-[0_0_0_1px_rgba(63,125,92,0.65)]"
                        onClick={() => addMitigation(id)}
                      >
                        {m?.label ?? id}
                        <span className="font-normal opacity-80">{m?.owns}</span>
                        {gained && gained > 0 ? <span className="font-mono opacity-80">+{gained}h</span> : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
              <p className="mt-2 text-xs leading-relaxed text-muted">
                {recommendedIds
                  .map((id) => mitigationById(id)?.citation)
                  .filter(Boolean)
                  .slice(0, 2)
                  .join(" ")}
              </p>
            </div>
          ) : null}
          <MitPickGrid
            title="Independent"
            blurb="One limiter each. Canopy + rain tarp + wind block is a valid open kit — it is not a tent."
            items={independent}
            selectedIds={site.mitigations}
            recommendedIds={recommendedIds}
            locked={disabled}
            reasonFor={pickReason}
            blockedFor={isBlocked}
            gainedFor={hoursGained}
            onToggle={toggleMitigation}
          />
          <MitPickGrid
            title="Package"
            blurb="Enclosure. Fulfills the independents it owns — those stay blocked while the package is on."
            items={packages}
            selectedIds={site.mitigations}
            recommendedIds={recommendedIds}
            locked={disabled}
            reasonFor={pickReason}
            blockedFor={isBlocked}
            gainedFor={hoursGained}
            onToggle={toggleMitigation}
          />
          {site.mitigations.length ? (
            <div className="mt-3 space-y-1">
              {site.mitigations.map((id) => {
                const m = mitigationById(id);
                return m ? (
                  <p key={`${id}-note`} className="text-xs text-muted">
                    <span className="font-medium text-fg">
                      {m.kind === "package" ? "Package" : "Independent"} · {m.owns}.
                    </span>{" "}
                    {m.summary} {m.citation}
                  </p>
                ) : null;
              })}
            </div>
          ) : (
            <p className="mt-2 text-xs text-muted">None selected — calendar is unmitigated field conditions.</p>
          )}
          {!paused && forecast && environmentals && site.mitigations.length ? (
            <p className="mt-2 font-mono text-xs text-accent">
              {unlockedGoHours(forecast, environmentals, site)}h reopened from no-go
              {" · "}
              {goHourCount(forecast, environmentals, site)}h go this week
            </p>
          ) : null}
        </div>

        {environmentals && onEnvironmentals ? (
          <div className="mt-5 border-t border-border pt-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted">Window limits (editable)</p>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Limit
                label="Air min °F"
                value={environmentals.ambientTempMinF}
                onChange={(n) => onEnvironmentals({ ...environmentals, ambientTempMinF: n })}
              />
              <Limit
                label="Air max °F"
                value={environmentals.ambientTempMaxF}
                onChange={(n) => onEnvironmentals({ ...environmentals, ambientTempMaxF: n })}
              />
              <Limit
                label="Substrate max °F"
                value={environmentals.substrateTempMaxF}
                onChange={(n) => onEnvironmentals({ ...environmentals, substrateTempMaxF: n })}
              />
              <Limit
                label="Dew spread °F"
                value={environmentals.dewPointSpreadMinF}
                onChange={(n) => onEnvironmentals({ ...environmentals, dewPointSpreadMinF: n })}
              />
              <Limit
                label="RH max %"
                value={environmentals.relativeHumidityMax}
                onChange={(n) => onEnvironmentals({ ...environmentals, relativeHumidityMax: n })}
              />
              <Limit
                label="Wind max mph"
                value={environmentals.windMaxMph}
                onChange={(n) => onEnvironmentals({ ...environmentals, windMaxMph: n })}
              />
              <label className="flex items-end gap-2 pb-1 text-sm text-fg">
                <input
                  type="checkbox"
                  className="size-4 accent-go"
                  checked={!environmentals.precipitationAllowed}
                  onChange={(e) =>
                    onEnvironmentals({ ...environmentals, precipitationAllowed: !e.target.checked })
                  }
                />
                Dry only
              </label>
            </div>
          </div>
        ) : null}
      </div>

      {paused ? (
        <div
          role="status"
          data-testid="windows-paused"
          className="rounded-xl bg-caution-soft px-4 py-6 text-center text-sm font-semibold text-ink"
        >
          {WINDOWS_PAUSED}
          <span className="mt-1 block text-xs font-normal text-muted">
            Limits typed in by hand don't unpause the windows yet.
          </span>
        </div>
      ) : forecast ? (
        <div className="rise-in space-y-4">
          <div className="rounded-xl bg-surface p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.08)] sm:p-5">
            <p className="text-base font-medium leading-snug text-fg">{forecast.headline}</p>
            <p className="mt-2 text-xs text-muted">
              {forecast.city}, {forecast.state} · {forecast.source}
              {summary ? ` · ${summary.go}/${summary.total} go-days` : ""}
              {` · ${sub.label}`}
            </p>
            <p className="mt-2 text-xs leading-relaxed text-muted">
              Model call only. Confirm air, substrate, RH, dew point, and wind at the workface before you mix — the
              slider below opens or hardens this week when the model disagrees with a human inspector.
            </p>
            <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted">
              <span className="inline-flex items-center gap-1.5">
                <i className="size-2.5 rounded-sm bg-go" /> Go
              </span>
              <span className="inline-flex items-center gap-1.5">
                <i className="size-2.5 rounded-sm bg-caution" /> Caution
              </span>
              <span className="inline-flex items-center gap-1.5">
                <i className="size-2.5 rounded-sm bg-nogo" /> No-go
              </span>
              <span>{stripLabel(night)}</span>
            </div>
          </div>
          {forecast.sheet ? <SheetLimitChecks sheet={forecast.sheet} timezone={forecast.timezone} night={night} /> : null}
          <div className="grid gap-3 sm:grid-cols-2">
            {days.map((d) => (
              <DayCard key={d.date} day={d} night={night} />
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-xl bg-surface px-4 py-8 text-center shadow-[0_0_0_1px_rgba(255,255,255,0.08)]">
          <p className="text-sm text-muted">Build a card, then load a ZIP. Mitigations will reopen days the sun would kill.</p>
        </div>
      )}
    </aside>
  );
}
