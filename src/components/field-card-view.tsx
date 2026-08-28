import type { ReactNode } from "react";
import type { FieldCardData } from "@/lib/types";
import { STEP_RAIL } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

function join(items: string[] | undefined) {
  return (items ?? []).filter(Boolean).join(" · ");
}

function Cell({ label, value }: { label: string; value?: string | null }) {
  const stated = Boolean(value && value.trim());
  return (
    <div className="min-w-0">
      <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-ink-muted">{label}</div>
      <div className={cn("mt-0.5 text-sm leading-snug", stated ? "text-ink" : "text-ink-muted")}>
        {stated ? value : "Not stated"}
      </div>
    </div>
  );
}

function Section({
  n,
  title,
  children,
}: {
  n: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="grid grid-cols-[2.5rem_1fr] gap-3 border-b border-paper-edge py-3 last:border-b-0 sm:grid-cols-[3.25rem_1fr] sm:gap-4">
      <div className="pt-0.5 font-mono text-xs font-medium text-rail">{n}</div>
      <div className="min-w-0">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink">{title}</h3>
        <div className="mt-2 space-y-2">{children}</div>
      </div>
    </section>
  );
}

export function FieldCardView({ card }: { card: FieldCardData }) {
  const env = card.environmentals;
  const envLine = [
    env.ambientTempMinF != null || env.ambientTempMaxF != null
      ? `Air ${env.ambientTempMinF ?? "\u2014"}\u2013${env.ambientTempMaxF ?? "\u2014"}\u00b0F`
      : null,
    env.substrateTempMinF != null || env.substrateTempMaxF != null
      ? `Substrate ${env.substrateTempMinF ?? "\u2014"}\u2013${env.substrateTempMaxF ?? "\u2014"}\u00b0F`
      : null,
    env.dewPointSpreadMinF != null ? `Dew spread \u2265 ${env.dewPointSpreadMinF}\u00b0F` : "Dew spread not stated",
    env.relativeHumidityMax != null ? `RH \u2264 ${env.relativeHumidityMax}%` : null,
    env.relativeHumidityMin != null ? `RH \u2265 ${env.relativeHumidityMin}%` : null,
    env.precipitationAllowed === false ? "No precipitation" : null,
    env.windMaxMph != null ? `Wind \u2264 ${env.windMaxMph} mph` : null,
  ].filter(Boolean);

  return (
    <article
      id="field-card-print"
      className="print-sheet overflow-hidden rounded-xl bg-paper text-ink shadow-[0_0_0_1px_rgba(22,24,28,0.08),0_24px_60px_-32px_rgba(0,0,0,0.5)]"
    >
      <div className="caution-stripe h-1.5 w-full" />
      <div className="flex">
        <div className="hidden w-2.5 shrink-0 bg-rail sm:block" />
        <div className="min-w-0 flex-1 p-5 sm:p-7">
          <header className="flex flex-wrap items-start justify-between gap-3 border-b border-rail/80 pb-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-rail">Coatings Conductor \u00b7 field card</p>
              <h2 className="mt-2 font-sans text-2xl font-semibold leading-tight tracking-tight text-ink sm:text-3xl">
                {card.product.name || "Unnamed product"}
              </h2>
              <p className="mt-1 text-sm text-ink-muted">
                {[card.product.manufacturer, card.product.productType, card.product.service].filter(Boolean).join(" \u00b7 ") ||
                  "Not stated"}
              </p>
            </div>
            <div className="flex flex-col items-end gap-1.5">
              <Badge variant="paper">{card.confidence} extract</Badge>
              {card.product.mixRatio ? (
                <span className="font-mono text-xs text-ink-muted">{card.product.mixRatio}</span>
              ) : null}
            </div>
          </header>

          <nav className="no-print mt-4 flex gap-1 overflow-x-auto pb-1" aria-label="Card sections">
            {STEP_RAIL.map((s) => (
              <a
                key={s.id}
                href={`#step-${s.id}`}
                className="shrink-0 rounded-sm px-2 py-1 font-mono text-[10px] text-ink-muted hover:bg-paper-edge hover:text-ink"
              >
                {s.n} {s.label}
              </a>
            ))}
          </nav>

          <div className="mt-2">
            <div id="step-store" />
            <Section n="01" title="Store & shelf life">
              <div className="grid gap-3 sm:grid-cols-2">
                <Cell label="Storage" value={card.storage.temperatureRange} />
                <Cell label="Unopened shelf" value={card.shelfLife.unopened} />
                <Cell label="Opened" value={card.shelfLife.opened} />
                <Cell label="Mixed / pot life" value={card.shelfLife.mixedPotLife} />
              </div>
              {card.storage.conditions.length ? (
                <p className="text-sm text-ink">{join(card.storage.conditions)}</p>
              ) : null}
              {card.storage.notes || card.shelfLife.notes ? (
                <p className="text-sm text-ink-muted">{card.storage.notes || card.shelfLife.notes}</p>
              ) : null}
            </Section>

            <div id="step-creds" />
            <Section n="02" title="Qualify \u00b7 credentials">
              {card.credentials.required.length ? (
                <ul className="space-y-1 text-sm">
                  {card.credentials.required.map((c) => (
                    <li key={c} className="flex gap-2">
                      <span className="mt-2 size-1 shrink-0 rounded-full bg-rail" />
                      <span>{c}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-ink-muted">None stated in the PDS \u2014 follow the project spec.</p>
              )}
              {card.credentials.notes ? <p className="text-sm text-ink-muted">{card.credentials.notes}</p> : null}
            </Section>

            <div id="step-prep" />
            <Section n="03" title="Surface preparation">
              <div className="grid gap-3 sm:grid-cols-2">
                <Cell label="Substrates" value={join(card.surfacePrep.substrates)} />
                <Cell label="Methods" value={join(card.surfacePrep.methods)} />
                <Cell label="Profile" value={card.surfacePrep.profile} />
                <Cell label="Cleanliness" value={card.surfacePrep.cleanliness} />
                <Cell label="Moisture" value={card.surfacePrep.moisture} />
              </div>
              {card.surfacePrep.notes ? <p className="text-sm text-ink-muted">{card.surfacePrep.notes}</p> : null}
            </Section>

            <div id="step-ambnt" />
            <Section n="04" title="Ambient & environmentals">
              {envLine.length ? (
                <div className="flex flex-wrap gap-1.5">
                  {envLine.map((item) => (
                    <span
                      key={item}
                      className="rounded-sm bg-paper-edge px-2 py-1 font-mono text-xs text-ink"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-ink-muted">Not stated</p>
              )}
              {env.notes ? <p className="text-sm text-ink-muted">{env.notes}</p> : null}
              {env.directSunNotes ? <p className="text-sm text-ink-muted">{env.directSunNotes}</p> : null}
            </Section>

            <div id="step-mix" />
            <Section n="05" title="Mix">
              <div className="grid gap-3 sm:grid-cols-2">
                <Cell label="Components" value={card.mixing.components} />
                <Cell label="Ratio" value={card.mixing.ratio} />
                <Cell label="Induction" value={card.mixing.inductionTime} />
                <Cell label="Pot life" value={card.mixing.potLife} />
                <Cell label="Thinning" value={card.mixing.thinning} />
              </div>
              {card.mixing.notes ? <p className="text-sm text-ink-muted">{card.mixing.notes}</p> : null}
            </Section>

            <div id="step-apply" />
            <Section n="06" title="Install / apply">
              <div className="grid gap-3 sm:grid-cols-2">
                <Cell label="Methods" value={join(card.installation.methods)} />
                <Cell label="Film" value={card.installation.filmThickness} />
                <Cell label="Coverage" value={card.installation.coverage} />
                <Cell label="Coats" value={card.installation.numberOfCoats} />
              </div>
              {card.installation.sequence.length ? (
                <ol className="space-y-1 text-sm">
                  {card.installation.sequence.map((s, i) => (
                    <li key={s} className="flex gap-2">
                      <span className="font-mono text-xs text-rail">{String(i + 1).padStart(2, "0")}</span>
                      <span>{s}</span>
                    </li>
                  ))}
                </ol>
              ) : null}
              {card.installation.notes ? <p className="text-sm text-ink-muted">{card.installation.notes}</p> : null}
            </Section>

            <div id="step-hold" />
            <Section n="07" title="Hold points">
              <ol className="space-y-2.5">
                {card.holdPoints.map((h) => (
                  <li key={`${h.step}-${h.name}`} className="grid grid-cols-[1.5rem_1fr] gap-2 text-sm">
                    <span className="font-mono text-xs text-rail">{String(h.step).padStart(2, "0")}</span>
                    <div>
                      <div className="flex flex-wrap items-baseline gap-2">
                        <span className="font-medium">{h.name}</span>
                        <span className="text-xs text-ink-muted">
                          {h.owner}
                          {h.source === "inferred" ? " \u00b7 inferred" : ""}
                        </span>
                      </div>
                      <p className="text-ink-muted">{h.criteria}</p>
                      {h.timing ? <p className="text-xs text-ink-muted">{h.timing}</p> : null}
                    </div>
                  </li>
                ))}
              </ol>
            </Section>

            <div id="step-insp" />
            <Section n="08" title="Inspection">
              <Cell label="Methods" value={join(card.inspection.methods)} />
              <Cell label="Acceptance" value={join(card.inspection.acceptance)} />
              <Cell label="Record" value={card.inspection.documentation} />
            </Section>

            <div id="step-cure" />
            <Section n="09" title="Cure & recoat">
              <div className="grid gap-3 sm:grid-cols-2">
                <Cell label="Touch" value={card.cure.touch} />
                <Cell label="Handle" value={card.cure.handle} />
                <Cell label="Recoat min" value={card.cure.recoatMin} />
                <Cell label="Recoat max" value={card.cure.recoatMax} />
                <Cell label="Full cure" value={card.cure.fullCure} />
                <Cell label="Immersion" value={card.cure.immersionService} />
              </div>
              {card.cure.temperatureDependence ? (
                <p className="text-sm text-ink-muted">{card.cure.temperatureDependence}</p>
              ) : null}
            </Section>

            <div id="step-safe" />
            <Section n="10" title="Safety">
              <Cell label="PPE" value={join(card.safety.ppe)} />
              <Cell label="Ventilation" value={card.safety.ventilation} />
              <Cell label="Hazards" value={join(card.safety.hazards)} />
            </Section>
          </div>

          {card.extractionNotes.length ? (
            <p className={cn("mt-4 text-xs leading-relaxed text-ink-muted")}>{card.extractionNotes.join(" ")}</p>
          ) : null}
        </div>
      </div>
    </article>
  );
}

export function EmptyCardSkeleton() {
  return (
    <article className="overflow-hidden rounded-xl bg-paper text-ink shadow-[0_0_0_1px_rgba(22,24,28,0.08)]">
      <div className="caution-stripe h-1.5 w-full" />
      <div className="flex min-h-[28rem]">
        <div className="hidden w-2.5 shrink-0 bg-rail sm:block" />
        <div className="flex-1 p-5 sm:p-7">
          <div className="flex items-start gap-3">
            <img src="/mascot.jpg" alt="" className="size-14 rounded-md object-cover object-top" />
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-rail">Coatings Conductor \u00b7 waiting on PDS</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight">Whistle ready. Paste a PDS.</h2>
            </div>
          </div>
          <p className="mt-3 max-w-md text-sm text-ink-muted">
            The card fills in process order: store, qualify, prep, ambient, mix, apply, hold, inspect, cure, safety.
          </p>
          <ol className="mt-8 space-y-0">
            {STEP_RAIL.map((s) => (
              <li
                key={s.id}
                className="grid grid-cols-[2.75rem_1fr] gap-3 border-b border-paper-edge py-2.5 text-sm last:border-0"
              >
                <span className="font-mono text-xs text-rail">{s.n}</span>
                <span className="font-medium uppercase tracking-[0.14em] text-ink-muted">{s.label}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </article>
  );
}
