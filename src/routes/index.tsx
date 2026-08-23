import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Download, Printer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { EmptyCardSkeleton, FieldCardView } from "@/components/field-card-view";
import { LearningPanel } from "@/components/learning-panel";
import { PdsIntake } from "@/components/pds-intake";
import { WeatherPanel } from "@/components/weather-panel";
import { extractPds } from "@/lib/extract-pds";
import { loadForecast } from "@/lib/forecast";
import {
  DEFAULT_CALIBRATION,
  recordOutcome,
  saveCalibration,
  loadLearning,
  upsertCustomMitigation,
} from "@/lib/learning";
import { inferProductRules, inferSubstrate, isMoistureTolerant, mitigationById, substrateById, type SiteContext } from "@/lib/mitigations";
import { downloadFieldCard } from "@/lib/pdf-card";
import { rescoreForecast } from "@/lib/score-windows";
import { loadRecents, loadZip, pushRecent, saveZip } from "@/lib/storage";
import type { Calibration, CustomMitigation, FieldCardData, ForecastBundle, SavedCard } from "@/lib/types";

export const Route = createFileRoute("/")({ component: Home });

function siteFromCard(card: FieldCardData, prev?: SiteContext): SiteContext {
  const notes = [
    card.product.name,
    card.product.productType,
    card.product.service,
    card.surfacePrep.notes,
    card.surfacePrep.moisture,
    card.surfacePrep.cleanliness,
    card.environmentals.notes,
    card.credentials.notes,
    ...card.credentials.required,
    ...card.surfacePrep.substrates,
    ...card.inspection.methods,
  ].join(" ");
  const substrate = inferSubstrate(card.surfacePrep.substrates, card.product.productType);
  const rules = inferProductRules(notes);
  return {
    substrate,
    mitigations: (prev?.substrate === substrate ? prev.mitigations : []).filter((id) => Boolean(mitigationById(id))),
    customMitigationIds: prev?.customMitigationIds ?? [],
    moistureTolerant: isMoistureTolerant(notes),
    discipline: rules.discipline,
    bodies: rules.bodies,
  };
}

function Home() {
  const [text, setText] = useState("");
  const [zip, setZip] = useState("");
  const [card, setCard] = useState<FieldCardData | null>(null);
  const [forecast, setForecast] = useState<ForecastBundle | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [wxLoading, setWxLoading] = useState(false);
  const [wxError, setWxError] = useState<string | null>(null);
  const [recents, setRecents] = useState<SavedCard[]>([]);
  const [downloading, setDownloading] = useState(false);
  const [site, setSite] = useState<SiteContext>({
    substrate: "bare_steel",
    mitigations: [],
  });
  const [calibration, setCalibration] = useState<Calibration>(DEFAULT_CALIBRATION);
  const [custom, setCustom] = useState<CustomMitigation[]>([]);
  const [outcomeCount, setOutcomeCount] = useState(0);

  useEffect(() => {
    setZip(loadZip());
    setRecents(loadRecents());
    const learned = loadLearning();
    setCalibration(learned.calibration);
    setCustom(learned.custom);
    setOutcomeCount(learned.outcomes.length);
  }, []);

  useEffect(() => {
    if (!card) return;
    const node = document.getElementById("field-card-print");
    if (!node) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    node.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  }, [card?.id]);

  const scoringSite = useMemo(
    () => ({ ...site, calibration, customMitigations: custom }),
    [site, calibration, custom],
  );

  const scored = useMemo(() => {
    if (!forecast || !card) return forecast;
    return rescoreForecast(forecast, card.environmentals, scoringSite);
  }, [forecast, card, scoringSite]);

  function remember(next: FieldCardData, nextZip: string) {
    setRecents(pushRecent(next, nextZip));
  }

  function applyCard(next: FieldCardData) {
    setCard(next);
    setSite((prev) => siteFromCard(next, prev));
  }

  async function handleExtract() {
    setExtracting(true);
    try {
      const result = await extractPds({ data: { text } });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      applyCard(result.card);
      remember(result.card, zip);
      toast.success(result.usedAi ? "Card on the stand." : "Card built with a fallback parse — review every field.");
      if (zip.length === 5) void handleForecast(result.card, zip);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Extract failed");
    } finally {
      setExtracting(false);
    }
  }

  async function handleForecast(active: FieldCardData | null = card, nextZip = zip) {
    if (!active) {
      toast.error("Build a card first.");
      return;
    }
    if (nextZip.length !== 5) {
      toast.error("Enter a 5-digit US ZIP.");
      return;
    }
    saveZip(nextZip);
    setWxLoading(true);
    setWxError(null);
    try {
      const result = await loadForecast({
        data: { zip: nextZip, environmentals: active.environmentals },
      });
      if (!result.ok) {
        setWxError(result.error);
        return;
      }
      setForecast(result.forecast);
      remember(active, nextZip);
    } catch (err) {
      setWxError(err instanceof Error ? err.message : "Forecast failed");
    } finally {
      setWxLoading(false);
    }
  }

  async function handlePdf() {
    if (!card) return;
    setDownloading(true);
    try {
      await downloadFieldCard(card, scored, site);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "PDF failed");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <main className="min-h-screen bg-bg text-fg">
      <header className="no-print border-b border-border/80 bg-surface/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <img
              src="/mascot.jpg"
              alt="Coatings Conductor mascot — hard-hat conductor blowing a whistle"
              className="size-12 rounded-md object-cover object-top shadow-[0_0_0_1px_rgba(255,183,3,0.45)] sm:size-14"
            />
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-accent">Job-site conductor</p>
              <p className="text-base font-bold tracking-tight sm:text-lg">Coatings Conductor</p>
              <p className="text-xs text-muted">PDS job card · NOAA windows · mitigations</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!card}
              onClick={() => window.print()}
            >
              <Printer />
              Print
            </Button>
            <Button type="button" size="sm" disabled={!card || downloading} onClick={() => void handlePdf()}>
              <Download />
              Download PDF
            </Button>
          </div>
        </div>
        <div className="caution-stripe h-1 w-full" />
      </header>

      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(20rem,0.95fr)]">
        <div className="no-print space-y-6 lg:col-start-1 lg:row-start-1">
          <section className="rise-in flex items-start gap-4">
            <img
              src="/mascot.jpg"
              alt=""
              className="hidden size-20 shrink-0 rounded-lg object-cover object-top shadow-[0_0_0_1px_rgba(232,93,4,0.45)] sm:block"
            />
            <div>
              <h1 className="max-w-xl text-3xl font-bold tracking-tight sm:text-4xl">
                Call the coating window.
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted sm:text-base">
                Storage through safety in job order, then NOAA windows scored against the real substrate — steel in the
                sun is not air at the ZIP — and the mitigations you will field.
              </p>
            </div>
          </section>
          <PdsIntake
            text={text}
            onText={setText}
            onExtract={() => void handleExtract()}
            onSample={(next, raw) => {
              setText(raw);
              applyCard(next);
              remember(next, zip);
              if (zip.length === 5) void handleForecast(next, zip);
            }}
            loading={extracting}
            recents={recents}
            onOpenRecent={(next) => applyCard(next)}
          />
        </div>

        <div className="min-w-0 lg:col-start-1 lg:row-start-2">
          {card ? <FieldCardView card={card} /> : <EmptyCardSkeleton />}
        </div>

        <div className="no-print space-y-4 lg:col-start-2 lg:row-start-1 lg:row-span-2">
          <WeatherPanel
            zip={zip}
            onZip={setZip}
            forecast={scored}
            loading={wxLoading}
            error={wxError}
            onLoad={() => void handleForecast()}
            disabled={!card}
            environmentals={card?.environmentals}
            onEnvironmentals={
              card
                ? (env) => {
                    setCard({ ...card, environmentals: env });
                  }
                : undefined
            }
            site={scoringSite}
            onSite={setSite}
          />
          <LearningPanel
            calibration={calibration}
            onCalibration={(c) => {
              setCalibration(c);
              saveCalibration(c);
            }}
            custom={custom}
            customIds={site.customMitigationIds ?? []}
            onToggleCustom={(id) => {
              const cur = site.customMitigationIds ?? [];
              setSite({
                ...site,
                customMitigationIds: cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id],
              });
            }}
            onAddCustom={(input) => {
              const created = upsertCustomMitigation(input);
              setCustom(loadLearning().custom);
              const cur = site.customMitigationIds ?? [];
              setSite({
                ...site,
                customMitigationIds: cur.includes(created.id) ? cur : [...cur, created.id],
              });
              toast.success(`${created.label} is in the catalog. Calendar will use the learned deltas.`);
            }}
            onLogOutcome={(input) => {
              const result = recordOutcome(input, calibration);
              setCalibration(result.calibration);
              setOutcomeCount(result.count);
              toast.success("Logged. Tightness sliders moved with that result.");
            }}
            outcomeCount={outcomeCount}
            product={card?.product.name ?? ""}
            zip={zip}
            substrateLabel={substrateById(site.substrate).label}
            mitigationsInPlay={[
              ...site.mitigations,
              ...custom.filter((c) => (site.customMitigationIds ?? []).includes(c.id)).map((c) => c.label),
            ]}
            forecast={scored}
            disabled={!card}
          />
        </div>
      </div>
    </main>
  );
}
