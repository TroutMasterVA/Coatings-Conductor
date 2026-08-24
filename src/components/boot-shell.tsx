export function BootShell({ message = "Opening the stand…" }: { message?: string }) {
  return (
    <main className="min-h-screen bg-bg text-fg">
      <div className="caution-stripe h-1 w-full" />
      <header className="border-b border-border/80 bg-surface/90">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 sm:px-6">
          <img
            src="/mascot.jpg"
            alt=""
            className="size-12 rounded-md object-cover object-top shadow-[0_0_0_1px_rgba(255,183,3,0.45)]"
          />
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-accent">Job-site conductor</p>
            <p className="text-base font-bold tracking-tight">Coatings Conductor</p>
            <p className="text-xs text-muted">{message}</p>
          </div>
        </div>
      </header>
    </main>
  );
}
