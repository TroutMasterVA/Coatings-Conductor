import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Download, FolderOpen, Printer } from "lucide-react";
import { toast } from "sonner";
import { BootShell } from "@/components/boot-shell";
import { Button } from "@/components/ui/button";
import { EmptyCardSkeleton, FieldCardView } from "@/components/field-card-view";
import { LearningPanel } from "@/components/learning-panel";
import { PdsIntake } from "@/components/pds-intake";
import { ProjectHome } from "@/components/project-home";
import { WeatherPanel } from "@/components/weather-panel";
import { isUnauthorized, returnToLogin } from "@/lib/auth/expired";
import { UserButton } from "@/lib/auth/gates";
import { useCurrentUserState, type AppUser } from "@/lib/auth/use-current-user";
import { buildCardFromPds } from "@/lib/on-device-extract";
import { loadForecast } from "@/lib/forecast";
import {
  DEFAULT_CALIBRATION,
  loadLegacyLearning,
  recordOutcome,
  type CustomMitigationInput,
} from "@/lib/learning";
import {
  inferProductRules,
  inferSubstrate,
  isMoistureTolerant,
  mitigationById,
  sanitizeMitigations,
  substrateById,
  type Limiter,
  type SiteContext,
} from "@/lib/mitigations";
import { downloadFieldCard, selectedMitigationLabels } from "@/lib/pdf-card";
import {
  guestCreateProject,
  guestLoadWorkspace,
  guestOpenProject,
  guestSaveCustom,
  guestSaveProject,
  guestArchiveProject,
  guestDeleteProject,
  migrateGuestToAccount,
} from "@/lib/guest-workspace";
import {
  archiveProject,
  createProject,
  defaultSite,
  deleteProject,
  loadWorkspace,
  openProject,
  saveCustomMitigation,
  saveProject,
  type ProjectFull,
  type ProjectSummary,
} from "@/lib/project-store";
import { rescoreForecast } from "@/lib/score-windows";
import { loadZip } from "@/lib/storage";
import type { Calibration, CustomMitigation, FieldCardData, FieldOutcome, ForecastBundle, SavedCard } from "@/lib/types";

export const Route = createFileRoute("/")({ component: Home });

function bounceExpired<T>(promise: Promise<T>): Promise<T> {
  return promise.catch((err: unknown) => {
    if (isUnauthorized(err)) {
      returnToLogin();
      return new Promise<T>(() => {});
    }
    throw err;
  });
}

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
    mitigations: sanitizeMitigations(
      (prev?.substrate === substrate ? prev.mitigations : []).filter((id) => Boolean(mitigationById(id))),
    ),
    customMitigationIds: prev?.customMitigationIds ?? [],
    moistureTolerant: isMoistureTolerant(notes),
    discipline: rules.discipline,
    bodies: rules.bodies,
  };
}

function Home() {
  const { user, isPending } = useCurrentUserState();
  if (isPending) return <BootShell message="Opening the stand…" />;
  return <App key={user?.id ?? "guest"} user={user} />;
}

function App({ user }: { user: AppUser | null }) {
  const signedIn = Boolean(user);
  const api = useMemo(() => workspaceApi(signedIn), [signedIn]);
  const [mode, setMode] = useState<"boot" | "home" | "job">("boot");
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [projectName, setProjectName] = useState("");
  const [text, setText] = useState("");
  const [zip, setZip] = useState("");
  const [card, setCard] = useState<FieldCardData | null>(null);
  const [forecast, setForecast] = useState<ForecastBundle | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [wxLoading, setWxLoading] = useState(false);
  const [wxError, setWxError] = useState<string | null>(null);
  const [recents, setRecents] = useState<SavedCard[]>([]);
  const [downloading, setDownloading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [homeError, setHomeError] = useState<string | null>(null);
  const [site, setSite] = useState<SiteContext>(defaultSite());
  const [calibration, setCalibration] = useState<Calibration>(DEFAULT_CALIBRATION);
  const [custom, setCustom] = useState<CustomMitigation[]>([]);
  const [outcomes, setOutcomes] = useState<FieldOutcome[]>([]);
  const hydrated = useRef(false);
  const persistTimer = useRef<number | undefined>(undefined);

  const applyFull = useCallback((full: ProjectFull) => {
    setProjectId(full.id);
    setProjectName(full.name);
    setZip(full.zip);
    setCard(full.card);
    setText(full.pdsText);
    setSite(full.site);
    setCalibration(full.calibration);
    setRecents(full.recents);
    setOutcomes(full.outcomes);
    setForecast(null);
    setWxError(null);
    setMode("job");
    setProjects((prev) => {
      const rest = prev.filter((p) => p.id !== full.id);
      return [toSummary(full), ...rest];
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        if (signedIn) {
          const lifted = await migrateGuestToAccount();
          if (cancelled) return;
          if (lifted === "imported") toast.success("Moved this device’s jobs into your account.");
          if (lifted === "skipped") {
            toast("This account already has jobs, so work from this browser was not added.");
          }
        }
        const ws = await api.load();
        if (cancelled) return;
        setProjects(ws.projects);
        setCustom(ws.custom);
        const last = ws.lastProjectId;
        const openable = last && ws.projects.some((p) => p.id === last && !p.archived);
        if (openable && last) {
          const full = await api.open(last);
          if (cancelled) return;
          applyFull(full);
        } else if (ws.projects.filter((p) => !p.archived).length === 0) {
          const legacy = loadLegacyLearning();
          const legacyZip = loadZip();
          const hasLegacy =
            legacy.outcomes.length > 0 ||
            legacy.custom.length > 0 ||
            legacyZip.length === 5 ||
            legacy.calibration.master !== DEFAULT_CALIBRATION.master;
          if (hasLegacy) {
            const seeded = await api.create({
              name: "Existing job",
              zip: legacyZip.length === 5 ? legacyZip : "22202",
              seed: {
                calibration: legacy.calibration,
                outcomes: legacy.outcomes,
                site: defaultSite(),
              },
            });
            if (legacy.custom.length) {
              for (const c of legacy.custom) {
                await api.saveCustom({
                  label: c.label,
                  summary: c.summary,
                  helps: (c.helps ?? []) as Limiter[],
                  before: { air: null, steel: null, rh: null, dew: null, wind: null },
                  after: { air: c.dAirF, steel: c.dSubstrateF, rh: c.dRh, dew: c.dDewF, wind: c.dWindMph },
                  notes: c.notes,
                });
              }
              const refreshed = await api.load();
              if (!cancelled) setCustom(refreshed.custom);
            }
            if (cancelled) return;
            applyFull(seeded);
            toast.success("Moved your previous local job into a project.");
          } else {
            setMode("home");
          }
        } else {
          setMode("home");
        }
      } catch (err) {
        if (cancelled) return;
        if (isUnauthorized(err)) {
          returnToLogin();
          return;
        }
        toast.error(err instanceof Error ? err.message : "Could not load projects.");
        setMode("home");
      } finally {
        hydrated.current = true;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [api, applyFull, signedIn]);

  const persist = useCallback(() => {
    if (!projectId || !hydrated.current) return;
    void api
      .save({
        id: projectId,
        name: projectName,
        zip,
        calibration,
        site,
        card,
        pdsText: text,
        recents,
        outcomes,
      })
      .then((summary) => {
        setProjects((prev) => prev.map((p) => (p.id === summary.id ? { ...p, ...summary } : p)));
      })
      .catch((err) => {
        if (isUnauthorized(err)) {
          returnToLogin();
          return;
        }
        toast.error(err instanceof Error ? err.message : "Could not save project.");
      });
  }, [api, projectId, projectName, zip, calibration, site, card, text, recents, outcomes]);

  useEffect(() => {
    if (!projectId || !hydrated.current || mode !== "job") return;
    window.clearTimeout(persistTimer.current);
    persistTimer.current = window.setTimeout(() => persist(), 600);
    return () => window.clearTimeout(persistTimer.current);
  }, [projectId, projectName, zip, calibration, site, card, text, recents, outcomes, mode, persist]);

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
    const entry: SavedCard = { id: next.id, savedAt: new Date().toISOString(), card: next, zip: nextZip };
    setRecents((prev) => [entry, ...prev.filter((r) => r.card.product.name !== next.product.name)].slice(0, 8));
  }

  function applyCard(next: FieldCardData) {
    setCard(next);
    setSite((prev) => siteFromCard(next, prev));
  }

  function handleExtract() {
    setExtracting(true);
    try {
      const next = buildCardFromPds(text);
      applyCard(next);
      remember(next, zip);
      toast.success("Review every field.");
      if (zip.length === 5) void handleForecast(next, zip);
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
      await downloadFieldCard(card, scored, scoringSite, zip);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "PDF failed");
    } finally {
      setDownloading(false);
    }
  }

  async function handleCreate(name: string, nextZip: string) {
    setCreating(true);
    setHomeError(null);
    try {
      if (projectId && hydrated.current) {
        window.clearTimeout(persistTimer.current);
        await api.save({
          id: projectId,
          name: projectName,
          zip,
          calibration,
          site,
          card,
          pdsText: text,
          recents,
          outcomes,
        });
      }
      const full = await api.create({ name, zip: nextZip });
      applyFull(full);
      toast.success(`${full.name} is on the stand — factory model, this ZIP only.`);
    } catch (err) {
      if (isUnauthorized(err)) {
        returnToLogin();
        return;
      }
      setHomeError(err instanceof Error ? err.message : "Could not create project.");
    } finally {
      setCreating(false);
    }
  }

  async function handleOpen(id: string) {
    try {
      if (projectId && hydrated.current) {
        window.clearTimeout(persistTimer.current);
        await api.save({
          id: projectId,
          name: projectName,
          zip,
          calibration,
          site,
          card,
          pdsText: text,
          recents,
          outcomes,
        });
      }
      const full = await api.open(id);
      applyFull(full);
    } catch (err) {
      if (isUnauthorized(err)) {
        returnToLogin();
        return;
      }
      toast.error(err instanceof Error ? err.message : "Could not open project.");
    }
  }

  async function handleArchive(id: string, archived: boolean) {
    try {
      await api.archive(id, archived);
      setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, archived } : p)));
      if (archived && projectId === id) {
        setProjectId(null);
        setMode("home");
        setForecast(null);
      }
      toast.success(archived ? "Archived. Memory kept." : "Restored.");
    } catch (err) {
      if (isUnauthorized(err)) {
        returnToLogin();
        return;
      }
      toast.error(err instanceof Error ? err.message : "Could not update project.");
    }
  }

  async function handleDelete(id: string) {
    try {
      await api.remove(id);
      setProjects((prev) => prev.filter((p) => p.id !== id));
      if (projectId === id) {
        setProjectId(null);
        setMode("home");
        setForecast(null);
      }
      toast.success("Project removed.");
    } catch (err) {
      if (isUnauthorized(err)) {
        returnToLogin();
        return;
      }
      toast.error(err instanceof Error ? err.message : "Could not remove project.");
    }
  }

  return (
    <main className="min-h-screen bg-bg text-fg">
      <header className="no-print border-b border-border/80 bg-surface/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <img
              src="/mascot.jpg"
              alt="Coatings Conductor mascot — hard-hat conductor blowing a whistle"
              className="size-12 rounded-md object-cover object-top shadow-[0_0_0_1px_rgba(255,183,3,0.45)] sm:size-14"
            />
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-accent">Job-site conductor</p>
              <p className="text-base font-bold tracking-tight sm:text-lg">Coatings Conductor</p>
              <p className="truncate text-xs text-muted">
                {mode === "job" && projectName ? (
                  <>
                    {projectName} · {zip || "no ZIP"}
                  </>
                ) : (
                  "PDS job card · NOAA windows · per-project models"
                )}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {mode === "job" ? (
              <Button type="button" variant="outline" size="sm" onClick={() => setMode("home")}>
                <FolderOpen />
                Projects
              </Button>
            ) : null}
            {mode === "job" ? (
              <>
                <Button type="button" variant="outline" size="sm" disabled={!card} onClick={() => window.print()}>
                  <Printer />
                  Print
                </Button>
                <Button type="button" size="sm" disabled={!card || downloading} onClick={() => void handlePdf()}>
                  <Download />
                  Download PDF
                </Button>
              </>
            ) : null}
            {user ? (
              <div className="max-w-[10.5rem] overflow-hidden rounded-md bg-surface-2 px-2 py-1 shadow-[0_0_0_1px_rgba(255,255,255,0.08)] [&_span.text-sm]:block [&_span.text-sm]:truncate">
                <UserButton />
              </div>
            ) : (
              <>
                <Button asChild variant="ghost" size="sm">
                  <Link to="/login" search={{ mode: "in" }}>
                    Sign in
                  </Link>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link to="/login" search={{ mode: "up" }}>
                    Create account
                  </Link>
                </Button>
              </>
            )}
          </div>
        </div>
        <div className="caution-stripe h-1 w-full" />
      </header>

      {mode === "boot" ? (
        <p className="mx-auto max-w-3xl px-4 py-10 text-sm text-muted">Loading your projects…</p>
      ) : null}

      {mode === "home" ? (
        <ProjectHome
          projects={projects}
          creating={creating}
          error={homeError}
          guest={!signedIn}
          onCreate={(n, z) => void handleCreate(n, z)}
          onOpen={(id) => void handleOpen(id)}
          onArchive={(id, archived) => void handleArchive(id, archived)}
          onDelete={(id) => void handleDelete(id)}
        />
      ) : null}

      {mode === "job" ? (
        <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(20rem,0.95fr)]">
          <div className="no-print space-y-6 lg:col-start-1 lg:row-start-1">
            <section className="rise-in flex items-start gap-4">
              <img
                src="/mascot.jpg"
                alt=""
                className="hidden size-20 shrink-0 rounded-lg object-cover object-top shadow-[0_0_0_1px_rgba(232,93,4,0.45)] sm:block"
              />
              <div>
                <h1 className="max-w-xl text-3xl font-bold tracking-tight sm:text-4xl">Call the coating window.</h1>
                <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted sm:text-base">
                  {projectName} at {zip || "this ZIP"}. Storage through safety in job order, then NOAA windows scored
                  against the real substrate — this project’s model only.
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
            {card ? (
              <FieldCardView
                card={card}
                zip={zip}
                headline={scored?.headline}
                mitigations={selectedMitigationLabels(scoringSite)}
              />
            ) : (
              <EmptyCardSkeleton />
            )}
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
              onCalibration={setCalibration}
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
                void api
                  .saveCustom(input)
                  .then((created) => {
                    setCustom((prev) => {
                      const rest = prev.filter((c) => c.id !== created.id && c.label.toLowerCase() !== created.label.toLowerCase());
                      return [created, ...rest];
                    });
                    const cur = site.customMitigationIds ?? [];
                    setSite({
                      ...site,
                      customMitigationIds: cur.includes(created.id) ? cur : [...cur, created.id],
                    });
                    toast.success(`${created.label} is in your library and on for this job.`);
                  })
                  .catch((err) => {
                    if (isUnauthorized(err)) {
                      returnToLogin();
                      return;
                    }
                    toast.error(err instanceof Error ? err.message : "Could not save mitigation.");
                  });
              }}
              onLogOutcome={(input) => {
                const result = recordOutcome(input, calibration, outcomes);
                setCalibration(result.calibration);
                setOutcomes(result.outcomes);
                toast.success("Logged on this project. Tightness sliders moved with that result.");
              }}
              outcomeCount={outcomes.length}
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
      ) : null}
    </main>
  );
}

function toSummary(full: ProjectFull): ProjectSummary {
  return {
    id: full.id,
    name: full.name,
    zip: full.zip,
    archived: full.archived,
    lastOpenedAt: full.lastOpenedAt,
    updatedAt: full.updatedAt,
    hasCard: Boolean(full.card),
  };
}

function workspaceApi(signedIn: boolean) {
  const wrap = <T,>(p: Promise<T>) => (signedIn ? bounceExpired(p) : p);
  return {
    load() {
      return wrap(signedIn ? loadWorkspace() : Promise.resolve(guestLoadWorkspace()));
    },
    create(data: { name: string; zip: string; seed?: Partial<ProjectFull> }) {
      return wrap(signedIn ? createProject({ data }) : Promise.resolve(guestCreateProject(data.name, data.zip, data.seed)));
    },
    open(id: string) {
      return wrap(signedIn ? openProject({ data: id }) : Promise.resolve(guestOpenProject(id)));
    },
    save(data: Parameters<typeof guestSaveProject>[0]) {
      return wrap(signedIn ? saveProject({ data }) : Promise.resolve(guestSaveProject(data)));
    },
    archive(id: string, archived: boolean) {
      return wrap(signedIn ? archiveProject({ data: { id, archived } }) : Promise.resolve(guestArchiveProject(id, archived)));
    },
    remove(id: string) {
      return wrap(signedIn ? deleteProject({ data: id }) : Promise.resolve(guestDeleteProject(id)));
    },
    saveCustom(data: CustomMitigationInput) {
      return wrap(signedIn ? saveCustomMitigation({ data }) : Promise.resolve(guestSaveCustom(data)));
    },
  };
}
