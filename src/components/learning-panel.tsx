import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  axisImpact,
  catalogHelps,
  dayGoHoursNeeded,
  tightnessLabel,
  type AxisId,
  type Calibration,
  type CustomMitigationInput,
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
  onAddCustom: (input: CustomMitigationInput) => void;
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
    ? forecast.days[0]?.status ?? "unknown"
    : "unknown";

  return (
    <aside className="rounded-xl bg-surface p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.08)] sm:p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-accent">Field learning</p>
      <p className="mt-2 text-sm text-muted">
        This project’s model only. Logged results nudge these sliders — they do not travel to your other jobs. Custom
        methods you add stay in your library for every project.
      </p>
      <p className="mt-2 font-mono text-xs text-fg">
        {tightnessLabel(calibration.master)} · {dayGoHoursNeeded(calibration.master)}h needed for a go-day ·{" "}
        {outcomeCount} logged
      </p>

      <div className="mt-4">
        <label className="flex items-center justify-between gap-3 text-sm text-fg">
          <span>Unlock attributes</span>
          <input
            type="checkbox"
            className="size-4 accent-go"
            checked={!calibration.linked}
            onChange={(e) => onCalibration({ ...calibration, linked: !e.target.checked })}
            disabled={disabled}
          />
        </label>
        <p className="mt-1.5 text-xs leading-relaxed text-muted">
          Linked uses one tightness. Unlock to move solar, thermal, moisture, rain, and wind on their own.
        </p>
      </div>

      <div className="mt-4 space-y-2">
        {calibration.linked ? (
          <SliderRow
            label="Master tightness"
            value={calibration.master}
            disabled={disabled}
            impact={axisImpact("thermal", calibration.master)}
            onChange={(n) =>
              onCalibration({
                ...calibration,
                master: n,
                solar: n,
                thermal: n,
                moisture: n,
                precip: n,
                wind: n,
              })
            }
          />
        ) : (
          AXIS_ORDER.map((id) => (
            <SliderRow
              key={id}
              label={axisImpact(id, calibration[id]).label}
              value={calibration[id]}
              disabled={disabled}
              impact={axisImpact(id, calibration[id])}
              onChange={(n) => onCalibration({ ...calibration, [id]: n })}
            />
          ))
        )}
      </div>

      {custom.length ? (
        <div className="mt-5 border-t border-border pt-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Your mitigation library</p>
          <p className="mt-1 text-xs text-muted">Available on every project. Toggle selects it for this job only.</p>
          <ul className="mt-2 space-y-2">
            {custom.map((c) => {
              const on = customIds.includes(c.id);
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    disabled={disabled}
                    className={cn(
                      "flex min-h-11 w-full items-start justify-between gap-2 rounded-md px-2.5 py-2 text-left text-xs",
                      on
                        ? "bg-go/20 text-go-soft shadow-[0_0_0_1px_rgba(63,125,92,0.65)]"
                        : "bg-surface-2 text-fg shadow-[0_0_0_1px_rgba(255,255,255,0.08)]",
                    )}
                    onClick={() => onToggleCustom(c.id)}
                  >
                    <span>
                      <span className="block font-medium">{c.label}</span>
                      <span className="mt-0.5 block text-muted">{c.summary}</span>
                    </span>
                    <span className="shrink-0 font-mono text-muted">{on ? "on this job" : "library"}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      <div className="mt-5 flex flex-wrap gap-2 border-t border-border pt-4">
        <Button type="button" variant="secondary" size="sm" disabled={disabled} onClick={() => setLogOpen((v) => !v)}>
          {logOpen ? "Hide" : "Log"} a field result
        </Button>
        <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={() => setAddOpen((v) => !v)}>
          {addOpen ? "Hide" : "Add"} a field mitigation
        </Button>
      </div>

      {logOpen ? (
        <form
          className="mt-4 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
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
            setLogOpen(false);
          }}
        >
          <p className="text-xs text-muted">
            Predicted today: <span className="font-mono text-fg">{predicted}</span>. Tell this project’s model what
            actually happened.
          </p>
          <select
            className="flex h-11 w-full rounded-md bg-surface-2 px-3 text-sm text-fg shadow-[0_0_0_1px_rgba(255,255,255,0.08)]"
            value={actual}
            onChange={(e) => setActual(e.target.value as FieldOutcome["actual"])}
          >
            <option value="correct">Model was right</option>
            <option value="false_nogo">Model said no-go, we coated</option>
            <option value="false_go">Model said go, we held</option>
          </select>
          <div className="grid grid-cols-2 gap-2">
            <Input placeholder="Measured air °F" value={measuredAir} onChange={(e) => setMeasuredAir(e.target.value)} />
            <Input placeholder="Measured steel °F" value={measuredSteel} onChange={(e) => setMeasuredSteel(e.target.value)} />
            <Input placeholder="Measured RH %" value={measuredRh} onChange={(e) => setMeasuredRh(e.target.value)} />
            <Input placeholder="Measured dew °F" value={measuredDew} onChange={(e) => setMeasuredDew(e.target.value)} />
          </div>
          <Input placeholder="Notes" value={logNotes} onChange={(e) => setLogNotes(e.target.value)} />
          <Button type="submit" size="sm">
            Save to this project
          </Button>
        </form>
      ) : null}

      {addOpen ? (
        <form
          className="mt-4 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!newLabel.trim()) return;
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
            setNewNotes("");
            setAddOpen(false);
          }}
        >
          <p className="text-xs text-muted">Saved to your library — usable on every project. Turns on for this job.</p>
          <Input placeholder="Name (e.g. south-wall poly fly)" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} />
          <Input placeholder="What it does" value={newSummary} onChange={(e) => setNewSummary(e.target.value)} />
          <div className="flex flex-wrap gap-1.5">
            {catalogHelps().map((h) => {
              const on = helps.includes(h);
              return (
                <button
                  key={h}
                  type="button"
                  className={cn(
                    "rounded-md px-2 py-1 text-xs",
                    on ? "bg-go/20 text-go-soft" : "bg-surface-2 text-muted",
                  )}
                  onClick={() => setHelps(on ? helps.filter((x) => x !== h) : [...helps, h])}
                >
                  {h}
                </button>
              );
            })}
          </div>
          <p className="text-xs text-muted">Before → after (optional numbers). The model learns the delta.</p>
          <div className="grid grid-cols-2 gap-2">
            <Input placeholder="Before air" value={before.air} onChange={(e) => setBefore({ ...before, air: e.target.value })} />
            <Input placeholder="After air" value={after.air} onChange={(e) => setAfter({ ...after, air: e.target.value })} />
            <Input placeholder="Before steel" value={before.steel} onChange={(e) => setBefore({ ...before, steel: e.target.value })} />
            <Input placeholder="After steel" value={after.steel} onChange={(e) => setAfter({ ...after, steel: e.target.value })} />
            <Input placeholder="Before RH" value={before.rh} onChange={(e) => setBefore({ ...before, rh: e.target.value })} />
            <Input placeholder="After RH" value={after.rh} onChange={(e) => setAfter({ ...after, rh: e.target.value })} />
            <Input placeholder="Before dew" value={before.dew} onChange={(e) => setBefore({ ...before, dew: e.target.value })} />
            <Input placeholder="After dew" value={after.dew} onChange={(e) => setAfter({ ...after, dew: e.target.value })} />
            <Input placeholder="Before wind" value={before.wind} onChange={(e) => setBefore({ ...before, wind: e.target.value })} />
            <Input placeholder="After wind" value={after.wind} onChange={(e) => setAfter({ ...after, wind: e.target.value })} />
          </div>
          <Input placeholder="Notes" value={newNotes} onChange={(e) => setNewNotes(e.target.value)} />
          <Button type="submit" size="sm">
            Save to library
          </Button>
        </form>
      ) : null}
    </aside>
  );
}
