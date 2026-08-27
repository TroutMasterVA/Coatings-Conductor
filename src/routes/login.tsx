import { useState, type FormEvent } from "react";
import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { GROK_PROVIDERS, authClient, authEnabled, signIn } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>): { mode: "in" | "up" } => ({
    mode: search.mode === "in" ? "in" : "up",
  }),
  component: Login,
});

function Login() {
  const { user } = useCurrentUserState();
  const search = Route.useSearch();
  const [mode, setMode] = useState<"in" | "up">(search.mode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (user) return <Navigate to="/" />;

  async function handleEmail(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (!authEnabled) throw new Error("Sign-in is disabled.");
      const mail = email.trim().toLowerCase();
      if (!mail || password.length < 8) {
        throw new Error("Email and a password of at least 8 characters.");
      }
      if (mode === "up") {
        const { error: err } = await authClient.signUp.email({
          email: mail,
          password,
          name: mail.split("@")[0] || "Conductor",
        });
        if (err) throw new Error(err.message ?? "Could not create the account.");
      } else {
        const { error: err } = await authClient.signIn.email({ email: mail, password });
        if (err) throw new Error(err.message ?? "Sign-in failed.");
      }
      await authClient.getSession();
      window.location.href = "/";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed.");
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-bg text-fg">
      <header className="border-b border-border/80 bg-surface/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link to="/" className="flex min-w-0 items-center gap-3">
            <img
              src="/mascot.jpg"
              alt="Coatings Conductor mascot — hard-hat conductor blowing a whistle"
              className="size-12 rounded-md object-cover object-top shadow-[0_0_0_1px_rgba(255,183,3,0.45)]"
            />
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-accent">Job-site conductor</p>
              <p className="text-base font-bold tracking-tight">Coatings Conductor</p>
            </div>
          </Link>
          <Button asChild variant="ghost" size="sm">
            <Link to="/">Continue without an account</Link>
          </Button>
        </div>
        <div className="caution-stripe h-1 w-full" />
      </header>

      <div className="mx-auto grid max-w-md place-items-start px-4 py-10 sm:place-items-center">
        <div className="w-full rounded-xl bg-surface p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.08)] sm:p-6">
          <h1 className="text-lg font-bold tracking-tight">{mode === "up" ? "Create account" : "Sign in"}</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Optional. Email and a password — that’s it. Without an account, jobs stay on this device.
          </p>

          {authEnabled ? (
            <>
              <form className="mt-5 space-y-3" onSubmit={(e) => void handleEmail(e)}>
                <label className="block">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="username"
                    className="mt-1.5"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </label>
                <label className="block">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    autoComplete={mode === "up" ? "new-password" : "current-password"}
                    className="mt-1.5"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    minLength={8}
                    required
                  />
                </label>
                {error ? <p className="text-sm text-nogo">{error}</p> : null}
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy ? "Working…" : mode === "up" ? "Create account" : "Sign in"}
                </Button>
              </form>
              <button
                type="button"
                className="mt-3 w-full text-center text-sm text-muted hover:text-fg"
                onClick={() => {
                  setMode(mode === "in" ? "up" : "in");
                  setError(null);
                }}
              >
                {mode === "in" ? "New here? Create an account" : "Have an account? Sign in"}
              </button>
              <div className="mt-5 flex items-center gap-3 text-xs text-subtle">
                <span className="h-px flex-1 bg-border" />
                or
                <span className="h-px flex-1 bg-border" />
              </div>
              <div className="mt-3 space-y-2">
                {GROK_PROVIDERS.map((p) => (
                  <Button
                    key={p.providerId}
                    type="button"
                    variant="secondary"
                    className="w-full"
                    disabled={busy}
                    onClick={() => {
                      setBusy(true);
                      void signIn(p.providerId, { callbackURL: "/" }).catch((err) => {
                        setError(err instanceof Error ? err.message : "Sign-in failed.");
                        setBusy(false);
                      });
                    }}
                  >
                    Continue with {p.label}
                  </Button>
                ))}
              </div>
            </>
          ) : (
            <p className="mt-4 text-sm text-muted">Sign-in is disabled.</p>
          )}
        </div>
      </div>
    </main>
  );
}
