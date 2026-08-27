import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Archive, FolderOpen, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ProjectSummary } from "@/lib/project-store";
import { cn } from "@/lib/utils";

function digitsZip(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, 5);
}

export function ProjectHome({
  projects,
  creating,
  error,
  guest,
  onCreate,
  onOpen,
  onArchive,
  onDelete,
}: {
  projects: ProjectSummary[];
  creating?: boolean;
  error?: string | null;
  guest?: boolean;
  onCreate: (name: string, zip: string) => void;
  onOpen: (id: string) => void;
  onArchive: (id: string, archived: boolean) => void;
  onDelete: (id: string) => void;
}) {
  const [name, setName] = useState("");
  const [zip, setZip] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const active = projects.filter((p) => !p.archived);
  const archived = projects.filter((p) => p.archived);
  const zipOk = zip.length === 5;
  const nameOk = name.trim().length > 0;
  const ready = nameOk && zipOk && !creating;

  const hint = useMemo(() => {
    if (!nameOk && !zipOk) return "Name the job and enter a 5-digit US ZIP.";
    if (!nameOk) return "Project name is required.";
    if (!zipOk) return `ZIP needs 5 digits (${zip.length}/5).`;
    return "Ready — create this job without signing in.";
  }, [nameOk, zipOk, zip.length]);

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6 sm:px-6">
      <section className="rise-in">
        <h1 className="text-3xl font-bold tracking-tight">Projects</h1>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted sm:text-base">
          Each project is one job site — name, ZIP, card, and its own nudged model. Field results on Houston do not
          move Arlington. Custom mitigations you learn stay in your library for every job.
        </p>
      </section>

      {guest ? (
        <aside className="flex flex-col gap-3 rounded-xl bg-surface p-4 shadow-[0_0_0_1px_rgba(255,183,3,0.28)] sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <p className="max-w-xl text-sm leading-relaxed text-muted">
            Working on this device. Sign-in is optional — you can create a project right now. Create an account only if
            you want these jobs to follow you after a cache clear.
          </p>
          <Button asChild size="sm" className="shrink-0">
            <Link to="/login" search={{ mode: "up" }}>
              Create account
            </Link>
          </Button>
        </aside>
      ) : null}

      <section className="rounded-xl bg-surface p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.08)] sm:p-5">
        <p className="text-xs font-medium uppercase tracking-wide text-muted">New project</p>
        <form
          className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            const nextName = name.trim();
            const nextZip = digitsZip(zip);
            if (!nextName) {
              setLocalError("Project name is required.");
              return;
            }
            if (nextZip.length !== 5) {
              setLocalError("Enter a 5-digit US ZIP (digits only).");
              return;
            }
            setLocalError(null);
            onCreate(nextName, nextZip);
          }}
        >
          <label className="min-w-0 flex-1">
            <Label htmlFor="proj-name">Project name</Label>
            <Input
              id="proj-name"
              className="mt-1.5"
              placeholder="Tank farm — Houston"
              value={name}
              autoComplete="off"
              onChange={(e) => {
                setName(e.target.value);
                setLocalError(null);
              }}
              required
            />
          </label>
          <label className="sm:w-36">
            <Label htmlFor="proj-zip">ZIP (5 digits)</Label>
            <Input
              id="proj-zip"
              type="text"
              inputMode="numeric"
              autoComplete="postal-code"
              pattern="[0-9]*"
              maxLength={5}
              className="mt-1.5 font-mono tracking-widest"
              placeholder="70808"
              value={zip}
              onChange={(e) => {
                setZip(digitsZip(e.target.value));
                setLocalError(null);
              }}
              required
            />
          </label>
          <Button
            type="submit"
            className={cn(
              "h-11 w-full sm:w-auto",
              ready && "shadow-[0_0_0_2px_rgba(255,183,3,0.55)]",
            )}
            disabled={!ready}
            aria-disabled={!ready}
          >
            <Plus />
            {creating ? "Creating…" : "Create"}
          </Button>
        </form>
        <p className={cn("mt-3 text-sm", ready ? "text-accent" : "text-muted")}>{hint}</p>
        {localError || error ? <p className="mt-2 text-sm text-nogo">{localError || error}</p> : null}
      </section>

      <section>
        <p className="text-xs font-medium uppercase tracking-wide text-muted">Active</p>
        {active.length === 0 ? (
          <p className="mt-3 text-sm text-muted">No active projects. Create one to call a coating window.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {active.map((p) => (
              <li key={p.id}>
                <ProjectRow
                  project={p}
                  confirm={confirmId === p.id}
                  onConfirm={(v) => setConfirmId(v ? p.id : null)}
                  onOpen={() => onOpen(p.id)}
                  onArchive={() => onArchive(p.id, true)}
                  onDelete={() => onDelete(p.id)}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      {archived.length ? (
        <section>
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Archived</p>
          <ul className="mt-3 space-y-2">
            {archived.map((p) => (
              <li key={p.id}>
                <ProjectRow
                  project={p}
                  confirm={confirmId === p.id}
                  onConfirm={(v) => setConfirmId(v ? p.id : null)}
                  onOpen={() => onArchive(p.id, false)}
                  onArchive={() => onArchive(p.id, false)}
                  onDelete={() => onDelete(p.id)}
                />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function ProjectRow({
  project,
  confirm,
  onConfirm,
  onOpen,
  onArchive,
  onDelete,
}: {
  project: ProjectSummary;
  confirm: boolean;
  onConfirm: (v: boolean) => void;
  onOpen: () => void;
  onArchive: () => void;
  onDelete: () => void;
}) {
  const opened = project.lastOpenedAt ? new Date(project.lastOpenedAt) : null;
  const openedLabel =
    opened && !Number.isNaN(opened.getTime())
      ? opened.toLocaleDateString(undefined, { month: "short", day: "numeric" })
      : "—";
  return (
    <article
      className={cn(
        "rounded-lg bg-surface p-3 shadow-[0_0_0_1px_rgba(255,255,255,0.06)] sm:p-4",
        project.archived && "opacity-70",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-fg">{project.name}</p>
          <p className="mt-0.5 font-mono text-xs text-muted">
            {project.zip}
            {project.hasCard ? " · card on stand" : " · no card yet"}
            {" · "}
            {project.archived ? "archived" : `opened ${openedLabel}`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {project.archived ? (
            <Button type="button" variant="secondary" size="sm" onClick={onArchive}>
              Restore
            </Button>
          ) : (
            <>
              <Button type="button" size="sm" onClick={onOpen}>
                <FolderOpen />
                Open
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={onArchive}>
                <Archive />
                Archive
              </Button>
            </>
          )}
          {confirm ? (
            <Button
              type="button"
              variant="rail"
              size="sm"
              onClick={() => {
                onDelete();
                onConfirm(false);
              }}
            >
              Delete forever
            </Button>
          ) : (
            <Button type="button" variant="ghost" size="sm" onClick={() => onConfirm(true)}>
              <Trash2 />
              Remove
            </Button>
          )}
        </div>
      </div>
    </article>
  );
}
