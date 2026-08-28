# Coatings Conductor

A coatings job tool. Paste or upload a product data sheet, get a field card in job order, score weather windows for a US ZIP, then print or download a PDF. Close a job with Archive.

The running app does not use Grok, ChatGPT, xAI, or any other AI. The sheet is read on this device.

## Run it locally

You need [Node.js 22](https://nodejs.org/) and npm.

```bash
git clone https://github.com/TroutMasterVA/Coatings-Conductor.git
cd Coatings-Conductor
npm install
npm run dev
```

Open [http://localhost:8080](http://localhost:8080).

- **Continue without an account** — jobs stay in this browser on this device.
- **Sign in** / **Create account** — email and a password of at least 8 characters. Optional.

Leave `VITE_AUTH_ENABLED` unset (or anything other than `false`) so email/password works. Set it to `false` only if you want a shared local dev user with no sign-in.

## Host it

This repo is meant to run on Vercel from GitHub. This ticket does not turn on real hosting.

1. Import the GitHub repo into a Vercel project (Git integration, not a one-off laptop deploy).
2. Each pull request gets a preview. Previews use an embedded database (no `DATABASE_URL`).
3. A lasting host needs Postgres. Set these in the host’s environment settings, never in git:
   - `DATABASE_URL` — Postgres connection string
   - `BETTER_AUTH_SECRET` — session signing secret
   - `BETTER_AUTH_URL` — the public site URL (example: `https://your-app.vercel.app`)
   - `VITE_AUTH_ENABLED=true` — email/password on

Forecast uses public weather data (NWS, with Open-Meteo as fallback). No AI keys.

A bad release is undone by promoting the previous good Vercel production deployment. Do not put secrets in this repo.

## Checks

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```
