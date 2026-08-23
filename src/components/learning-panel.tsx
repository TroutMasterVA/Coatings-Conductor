import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  axisImpact,
  catalogHelps,
  dayGoHoursNeeded,
  tightnessLabel,
  upsertCustomMitigation,
  type AxisId,
  type Calibration,
} from "@/lib/learning";
import type { Limiter } from "@/lib/mitigations";
import type { CustomMitigation, FieldOutcome, ForecastBundle, WindowStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const rangeClass =
  "h-2 w-full cursor-pointer appearance-none rounded-full bg-surface-2 accent-primary [&::-webkit-slider-thumb]:size-4";

const AXIS_ORDER: AxisId[] = ["solar", "thermal", "moisture", "precip", "wind"];

function SliderRow({
  label,
  value,
  onChange,
  disabled,
  impact,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  disabled?: boolean;
  impact: ReturnType<typeof axisImpact>;
}) {
  return (
    <div className={cn("rounded-lg bg-surface-2 p-3 shadow-[0_0_0_1px_rgba(255,255,255,0.06)]", disabled && "opacity-40")}>
      <label className="block">
        <span className="flex justify-between text-xs text-muted">
          <span className="font-medium text-fg">{label}</span>
          <span className="font-mono text-fg">{Math.round(value * 100)}</span>
        </span>
        <span className="mt-1 flex justify-between text-xs text-subtle">
          <span>Open</span>
          <span>Spec-hard</span>
        </span>
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          disabled={disabled}
          className={cn(rangeClass, "mt-1.5 bg-border")}
          value={Math.round(value * 100)}
          onChange={(e) => onChange(Number(e.target.value) / 100)}
          aria-label={label}
        />
      </label>
      <p className="mt-2 text-xs font-medium leading-snug text-accent">{impact.live}</p>
      <p className="mt-1 text-xs leading-relaxed text-muted">{impact.why}</p>
      <p className="mt-1.5 text-xs leading-snug text-subtle">
        Left: {impact.left}. Right: {impact.right}.
      </p>
    </div>
  );
}

function num(v: string): number | null {
  if (v.trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function LearningPanel({
  calibration,
  onCalibration,
  custom,
  customIds,
  onToggleCustom,
  onAddCustom,
  onLogOutcome,
  outcomeCount,
  product,
  zip,
  substrateLabel,
  mitigationsInPlay,
  forecast,
  disabled,
}: {
  calibration: Calibration;
  onCalibration: (c: Calibration) => void;
  custom: CustomMitigation[];
  customIds: string[];
  onToggleCustom: (id: string) => void;
  onAddCustom: (input: Parameters<typeof upsertCustomMitigation>[0]) => void;
  onLogOutcome: (input: Omit<FieldOutcome, "id" | "at">) => void;
  outcomeCount: number;
  product: string;
  zip: string;
  substrateLabel: string;
  mitigationsInPlay: string[];
  forecast: ForecastBundle | null;
  disabled?: boolean;
}) {
  const [logOpen, setLogOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [actual, setActual] = useState<FieldOutcome["actual"]>("correct");
  const [measuredAir, setMeasuredAir] = useState("");
  const [measuredSteel, setMeasuredSteel] = useState("");
  const [measuredRh, setMeasuredRh] = useState("");
  const [measuredDew, setMeasuredDew] = useState("");
  const [logNotes, setLogNotes] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [newSummary, setNewSummary] = useState("");
  const [helps, setHelps] = useState<Limiter[]>([]);
  const [before, setBefore] = useState({ air: "", steel: "", rh: "", dew: "", wind: "" });
  const [after, setAfter] = useState({ air: "", steel: "", rh: "", dew: "", wind: "" });
  const [newNotes, setNewNotes] = useState("");

  const peak = forecast?.days[0]?.hours.find((h) => h.hour === 13) ?? forecast?.days[0]?.hours[0];
  const predicted: WindowStatus | "mixed" = forecast
    ? forecast.days.some((d) => d.status === "go") && forecast.days.some((d) => d.status === "nogo")
      ? "mixed"
      : (forecast.days[0]?.status ?? "unknown")
    : "unknown";

  function setMaster(n: number) {
    if (calibration.linked) {
      onCalibration({
        ...calibration,
        master: n,
        solar: n,
        thermal: n,
        moisture: n,
        precip: n,
        wind: n,
      });
    } else {
      onCalibration({ ...calibration, master: n });
    }
  }

  function setUnlocked(unlocked: boolean) {
    if (unlocked && calibration.linked) {
      onCalibration({
        ...calibration,
        linked: false,
        solar: calibration.master,
        thermal: calibration.master,
        moisture: calibration.master,
        precip: calibration.master,
        wind: calibration.master,
      });
      return;
    }
    onCalibration({ ...calibration, linked: !unlocked });
  }

  const goHoursNeed = dayGoHoursNeeded(calibration.master);
  const axisValue: Record<AxisId, number> = {
    solar: calibration.solar,
    thermal: calibration.thermal,
    moisture: calibration.moisture,
    precip: calibration.precip,
    wind: calibration.wind,
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-surface p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.08)] sm:p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-accent">Call tightness</p>
        <p className="mt-2 text-sm text-muted">
          NOAA + the PDS model will miss a thermometer on the steel. Open the call when field judgment has been
          right; harden it after a miss. Always measure air, substrate, RH, and dew point at the workface before you
          mix.
        </p>
        <div className="mt-4">
          <span className="flex justify-between text-xs text-muted">
            <span>Field judgment</span>
            <span className="font-mono text-fg">{tightnessLabel(calibration.master)}</span>
            <span>Spec-hard</span>
          </span>
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            className={cn(rangeClass, "mt-2")}
            value={Math.round(calibration.master * 100)}
            onChange={(e) => setMaster(Number(e.target.value) / 100)}
            disabled={disabled}
            aria-label="Call tightness"
          />
          <p className="mt-2 text-xs leading-relaxed text-muted">
            {calibration.linked
              ? `All five limiters follow this slider. A calendar day is GO only with ${goHoursNeed} in-window hours.`
              : `Unlocked: this slider only sets the day call — GO needs ${goHoursNeed} in-window hours. Hour scoring uses the attribute sliders below.`}
          </p>
        </div>
        <label className="relative mt-3 flex min-h-11 cursor-pointer items-start gap-2.5 text-sm text-fg">
          <input
            type="checkbox"
            className="relative z-10 mt-0.5 size-4 shrink-0 accent-go"
            checked={!calibration.linked}
            onChange={(e) => setUnlocked(e.target.checked)}
          />
          <span>
            <span className="font-medium">Unlock attributes</span>
            <span className="mt-0.5 block text-xs leading-relaxed text-muted">
              Score solar, temperature, dew/RH, rain, and wind on their own. Leave off to keep them locked to the
              master tightness.
            </span>
          </span>
        </label>
        {calibration.linked ? null : (
          <div className="mt-3 space-y-3">
            <p className="text-xs leading-relaxed text-muted">
              Left opens the window (NOAA + PDS tend conservative). Right hardens to the number the inspector will
              log. These do not rewrite the PDS limits — they change how close an hour must be before it flips caution
              or no-go, and how hard we bake the substrate in sun.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {AXIS_ORDER.map((id) => {
                const impact = axisImpact(id, axisValue[id]);
                return (
                  <SliderRow
                    key={id}
                    label={impact.label}
                    value={axisValue[id]}
                    disabled={disabled}
                    impact={impact}
                    onChange={(n) => onCalibration({ ...calibration, [id]: n })}
                  />
                );
              })}
            </div>
          </div>
        )}
        <p className="mt-3 font-mono text-xs text-muted">{outcomeCount} field result{outcomeCount === 1 ? "" : "s"} logged — they nudge this model.</p>
      </div>

      <div className="rounded-xl bg-surface p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.08)] sm:p-5">
        <button type="button" className="text-xs font-semibold uppercase tracking-wide text-accent" onClick={() => setLogOpen((v) => !v)}>
          {logOpen ? "Hide" : "Log"} field result
        </button>
        {logOpen ? (
          <div className="mt-3 space-y-3">
            <p className="text-xs text-muted">
              Tell the model if today’s call matched the workface. A false no-go opens the window; a failed go hardens
              it. Measured steel vs forecast steel trains solar gain.
            </p>
            <label className="block">
              <span className="text-xs font-medium text-muted">What happened</span>
              <select
                className="mt-1 flex h-11 w-full rounded-md bg-surface-2 px-3 text-sm text-fg shadow-[0_0_0_1px_rgba(255,255,255,0.08)]"
                value={actual}
                onChange={(e) => setActual(e.target.value as FieldOutcome["actual"])}
              >
                <option value="correct">Call was right</option>
                <option value="false_nogo">No-go / caution — but we worked it and it was fine</option>
                <option value="false_go">Go — but the workface was actually out</option>
              </select>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label>
                <span className="text-xs text-muted">Measured air °F</span>
                <Input className="mt-1 h-9 font-mono" value={measuredAir} onChange={(e) => setMeasuredAir(e.target.value)} inputMode="decimal" />
              </label>
              <label>
                <span className="text-xs text-muted">Measured substrate °F</span>
                <Input className="mt-1 h-9 font-mono" value={measuredSteel} onChange={(e) => setMeasuredSteel(e.target.value)} inputMode="decimal" />
              </label>
              <label>
                <span className="text-xs text-muted">Measured RH %</span>
                <Input className="mt-1 h-9 font-mono" value={measuredRh} onChange={(e) => setMeasuredRh(e.target.value)} inputMode="decimal" />
              </label>
              <label>
                <span className="text-xs text-muted">Measured dew °F</span>
                <Input className="mt-1 h-9 font-mono" value={measuredDew} onChange={(e) => setMeasuredDew(e.target.value)} inputMode="decimal" />
              </label>
            </div>
            <Input placeholder="Notes — hold point, inspector, spec call" value={logNotes} onChange={(e) => setLogNotes(e.target.value)} />
            <Button
              type="button"
              variant="secondary"
              disabled={disabled}
              onClick={() => {
                onLogOutcome({
                  product,
                  zip,
                  substrate: substrateLabel,
                  mitigations: mitigationsInPlay,
                  predicted,
                  actual,
                  forecastAir: peak?.tempF ?? null,
                  forecastSteel: peak?.substrateF ?? null,
                  measuredAir: num(measuredAir),
                  measuredSteel: num(measuredSteel),
                  measuredRh: num(measuredRh),
                  measuredDew: num(measuredDew),
                  notes: logNotes,
                });
                setLogNotes("");
              }}
            >
              Save result into the model
            </Button>
          </div>
        ) : null}
      </div>

      <div className="rounded-xl bg-surface p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.08)] sm:p-5">
        <button type="button" className="text-xs font-semibold uppercase tracking-wide text-accent" onClick={() => setAddOpen((v) => !v)}>
          {addOpen ? "Hide" : "Add"} a field mitigation
        </button>
        {custom.length ? (
          <ul className="mt-3 flex flex-wrap gap-2">
            {custom.map((c) => {
              const on = customIds.includes(c.id);
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    className={cn(
                      "inline-flex h-9 items-center rounded-md px-2.5 text-xs",
                      on
                        ? "bg-go/20 font-medium text-go-soft shadow-[0_0_0_1px_rgba(63,125,92,0.65)]"
                        : "bg-surface-2 text-fg shadow-[0_0_0_1px_rgba(255,255,255,0.08)]",
                    )}
                    onClick={() => onToggleCustom(c.id)}
                  >
                    {c.label}
                    <span className="ml-1.5 font-mono text-[10px] opacity-70">n={c.samples}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-2 text-xs text-muted">None learned yet. Log before/after readings so the next job can use it.</p>
        )}
        {addOpen ? (
          <div className="mt-3 space-y-3">
            <Input placeholder="Name — e.g. Ice pig / evaporative fans" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} />
            <Input placeholder="What it does on this workface" value={newSummary} onChange={(e) => setNewSummary(e.target.value)} />
            <div className="flex flex-wrap gap-2">
              {catalogHelps().map((h) => {
                const on = helps.includes(h);
                return (
                  <button
                    key={h}
                    type="button"
                    className={cn(
                      "h-8 rounded-md px-2 text-xs",
                      on ? "bg-go/20 text-go-soft" : "bg-surface-2 text-muted",
                    )}
                    onClick={() => setHelps(on ? helps.filter((x) => x !== h) : [...helps, h])}
                  >
                    {h}
                  </button>
                );
              })}
            </div>
            <p className="text-xs font-medium text-muted">Original conditions</p>
            <div className="grid grid-cols-5 gap-1.5">
              {(["air", "steel", "rh", "dew", "wind"] as const).map((k) => (
                <label key={`b-${k}`}>
                  <span className="text-[10px] uppercase text-muted">{k}</span>
                  <Input className="mt-1 h-9 font-mono" inputMode="decimal" value={before[k]} onChange={(e) => setBefore({ ...before, [k]: e.target.value })} />
                </label>
              ))}
            </div>
            <p className="text-xs font-medium text-muted">After mitigation</p>
            <div className="grid grid-cols-5 gap-1.5">
              {(["air", "steel", "rh", "dew", "wind"] as const).map((k) => (
                <label key={`a-${k}`}>
                  <span className="text-[10px] uppercase text-muted">{k}</span>
                  <Input className="mt-1 h-9 font-mono" inputMode="decimal" value={after[k]} onChange={(e) => setAfter({ ...after, [k]: e.target.value })} />
                </label>
              ))}
            </div>
            <Input placeholder="Notes" value={newNotes} onChange={(e) => setNewNotes(e.target.value)} />
            <Button
              type="button"
              disabled={disabled || newLabel.trim().length < 2}
              onClick={() => {
                onAddCustom({
                  label: newLabel,
                  summary: newSummary,
                  helps,
                  before: {
                    air: num(before.air),
                    steel: num(before.steel),
                    rh: num(before.rh),
                    dew: num(before.dew),
                    wind: num(before.wind),
                  },
                  after: {
                    air: num(after.air),
                    steel: num(after.steel),
                    rh: num(after.rh),
                    dew: num(after.dew),
                    wind: num(after.wind),
                  },
                  notes: newNotes,
                });
                setNewLabel("");
                setNewSummary("");
                setHelps([]);
                setBefore({ air: "", steel: "", rh: "", dew: "", wind: "" });
                setAfter({ air: "", steel: "", rh: "", dew: "", wind: "" });
                setNewNotes("");
              }}
            >
              Learn this mitigation
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
