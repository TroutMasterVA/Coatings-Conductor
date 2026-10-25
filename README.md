# Coatings Conductor

A coatings job tool. Upload or paste a product data sheet, get a field card in job order, score weather windows for a US ZIP, then print or download a PDF. Close a job with Archive.

**How sheets are read.** If your company has connected Azure AI Foundry (see [IT: connect your Azure Foundry](#it-connect-your-azure-foundry)), the server reads each sheet with Azure. If Azure is not connected, or Azure fails or times out, the app uses its built-in on-device reader instead and tells the user. Numbers the reader cannot find in the sheet show as **Not stated**; nothing is made up.

Forecast uses public weather data (NWS, with Open-Meteo as fallback).

---

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
- **Sign in** / **Create account** — email and a password of at least 8 characters.

With no `DATABASE_URL`, the app uses an embedded in-memory database. That is fine for trying it out, but everything is wiped when the server stops.

Leave `VITE_AUTH_ENABLED` unset (or anything other than `false`) so email/password works. Set it to `false` only if you want a shared local dev user with no sign-in.

## Checks

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

GitHub runs the same checks on every pull request, plus a Docker build and a container smoke test (see `.github/workflows/ci.yml`). Nothing is pushed or deployed by CI.

---

## Deploy

The app ships as one Docker container. It runs anywhere that runs containers, including Azure Container Apps and Azure App Service for Containers (PAVE). The existing Vercel practice copy still works and is unchanged.

### Required for any real or shared copy: a database and a sign-in secret

**Read this first.** Any copy that more than one person uses, or that has to keep its data, needs **both** of these. That covers the Docker / PAVE container and Vercel alike:

- **`DATABASE_URL`**: the connection string of a real Postgres database.
- **`BETTER_AUTH_SECRET`**: a random value of at least 32 bytes that signs sign-in sessions. Generate one with:

  ```bash
  openssl rand -base64 32
  ```

  Generate it once per copy, store it as a secret, and keep it. If you change it, everyone gets signed out.

**What happens without them:** the app still starts, but it keeps every account, job and record **in memory only**. All of that disappears when the server restarts. On Vercel or any setup with more than one server instance, it also differs from one instance to the next, so people get signed out and then see "Invalid email or password" for an account they just made. A missing secret alone signs people out whenever the server restarts or a request reaches another instance. This fallback is only for local development, automated checks and throwaway previews.

**Set up the database tables before the first sign-up.** A fresh, empty Postgres database needs every migration in `migrations/` applied (`0001` onward, currently `0001`–`0003`, plus any `0004` and later files on your branch) before anyone signs up. The app does **not** create tables by itself when `DATABASE_URL` is set: the self-setup in `src/lib/db.ts` (`ensureDbReady`) only runs for the in-memory database. Run them with:

```bash
DATABASE_URL='postgres://…' npm run db:migrate
```

`npm run db:migrate` (`scripts/migrate.mjs`) applies every `.sql` file in `migrations/` that has not run yet, in filename order. It reads the folder, so new files such as `0004_….sql` are picked up automatically with no list to update. Each file runs once inside a transaction and is recorded in a `_migrations` table, so running it again is safe.

- **Docker / PAVE:** the image already does this. `scripts/docker-entrypoint.sh` runs the migrations each time the container starts, before the server accepts traffic, whenever `DATABASE_URL` is set and `RUN_MIGRATIONS` is not `false`. If a migration fails, the container stops instead of serving. If you would rather run migrations as a separate one-off job, set `RUN_MIGRATIONS=false` and run `npm run db:migrate` (or `node /app/migrate/scripts/migrate.mjs` inside the image) once against the database before starting the app.
- **Vercel:** the build command `npm run build` ends with `npm run db:migrate` (`package.json`), so migrations run during each deploy **only if `DATABASE_URL` is available at build time** in that environment (Preview and/or Production). If it is set only at run time, run `npm run db:migrate` yourself once before the first sign-up.

### What you need

1. **A Postgres database** (version 14 or newer). Azure Database for PostgreSQL – Flexible Server works. Create an empty database and a user that owns it.
2. **A container host** with HTTPS in front of it. Sign-in cookies are marked Secure, so real users must reach the app over `https://`.
3. **The environment variables** below, set in the host's settings. Never put them in git.

### Build and run the container

```bash
# Build (APP_VERSION is optional; it shows up in /api/health)
docker build -t coatings-conductor --build-arg APP_VERSION=$(git rev-parse --short HEAD) .

# Run (copy .env.example to .env first and fill in real values)
docker run -d --name coatings-conductor -p 3000:3000 --env-file .env coatings-conductor
```

Open `http://localhost:3000`, then check `http://localhost:3000/api/health`.

To build without Docker: `npm ci && npm run build:docker && npm start` (listens on `PORT`, default 3000).

### Database setup and migrations

- Point `DATABASE_URL` at your Postgres database.
- **Migrations run automatically when the container starts**, before the server accepts traffic. Each file in `migrations/` is applied once, inside a transaction, and recorded in a `_migrations` table, so restarts are safe.
- If a migration fails, the container stops instead of serving a half-updated database. Check the container logs.
- To run migrations as a separate step instead (for example a one-off job), set `RUN_MIGRATIONS=false` on the app and run `npm run db:migrate` (or the image's `node /app/migrate/scripts/migrate.mjs`) with the same `DATABASE_URL`.
- Without `DATABASE_URL` the container falls back to the in-memory database, and the server logs a loud warning at start. Do not use that for real work.

### Environment variables

Copy [`.env.example`](.env.example) for a commented template.

| Variable | Required | What it is |
|---|---|---|
| `DATABASE_URL` | **Yes**, for any real or shared copy (Docker / PAVE and Vercel) | Postgres connection string, e.g. `postgres://user:pass@host:5432/db?sslmode=require`. Without it, all data and logins live in memory and vanish on restart or across instances. Apply the migrations before the first sign-up (see above). |
| `BETTER_AUTH_SECRET` | **Yes**, for any real or shared copy (Docker / PAVE and Vercel) | Random value of 32+ bytes that signs sign-in sessions. Generate with `openssl rand -base64 32`. Without it, each server instance makes up its own and people get signed out. Changing it signs everyone out. |
| `BETTER_AUTH_URL` | Yes | The public HTTPS address of the app, no trailing slash, e.g. `https://coatings.example.com` |
| `VITE_AUTH_ENABLED` | Recommended | `true` (default). Email/password sign-in is enforced. The Docker image is built with `true`. |
| `PORT` | No | Port inside the container. Default `3000`. |
| `APP_VERSION` | No | Version label in `/api/health`. Set by `--build-arg APP_VERSION`. |
| `RUN_MIGRATIONS` | No | `false` skips migrations at container start. Default runs them. |
| `MAX_UPLOAD_MB` | No | Largest sheet upload accepted, in MB. Default `10` (container / PAVE, what employees use). Set `3` on the Vercel practice copy (Vercel caps request bodies at about 4.5 MB). |
| `AZURE_DOCINTEL_ENDPOINT` | For Azure | Document Intelligence endpoint |
| `AZURE_DOCINTEL_MODEL` | No | Document Intelligence model. Default `prebuilt-layout`. |
| `AZURE_OPENAI_ENDPOINT` | For Azure | Azure OpenAI / Foundry endpoint |
| `AZURE_OPENAI_DEPLOYMENT` | For Azure | Name of the vision-capable (GPT-4o class) deployment |
| `AZURE_OPENAI_API_VERSION` | For Azure | API version that supports `json_schema` output and images, e.g. `2024-10-21` |
| `AZURE_DOCINTEL_KEY` | No | Key fallback only. Prefer managed identity. |
| `AZURE_OPENAI_API_KEY` | No | Key fallback only. Prefer managed identity. |
| `AZURE_AUTH_MODE` | No | `identity` = managed identity only, keys never used. Default `auto` (managed identity, then key). |

All Azure settings stay on the server. The browser never sees endpoints or keys.

### Health check

`GET /api/health` needs no sign-in and returns no secrets.

- `200` `{"status":"ok","db":"ok"}` — the database answered `SELECT 1`.
- `503` `{"status":"degraded","db":"down",…}` — the database did not answer within 3 seconds.

The body carries only these status words: no commit id, database type or reader provider.

The image has a Docker `HEALTHCHECK` on this path. On Azure, point the probes at it:

- **Azure Container Apps:** Ingress target port `3000`. Add liveness and readiness probes: HTTP, path `/api/health`, port `3000`.
- **App Service for Containers:** set app setting `WEBSITES_PORT=3000`, then under *Monitoring → Health check* set the path to `/api/health`.

### Hosting notes (PAVE / Azure)

- Give the container app a **system-assigned managed identity**. That is how it signs in to Azure AI without keys (see the next section).
- Store `BETTER_AUTH_SECRET` and `DATABASE_URL` as secrets (Container Apps secrets or Key Vault references), not plain settings.
- The sheet reader's rate limit (10 extracts per user per minute) is kept in memory per container. With more than one replica, each replica counts separately. For the beta, run **one replica**.
- Uploads are capped by `MAX_UPLOAD_MB` (default 10 MB). If a proxy or gateway sits in front of the container, let it accept request bodies at least that large.
- Allow outbound HTTPS to your Postgres server, your Azure AI endpoints, and `api.weather.gov` / `api.open-meteo.com` (weather forecasts).

### Rolling back a bad release

- **Container hosts:** redeploy the previous image tag. On Azure Container Apps, switch traffic back to the previous revision (*Revisions → Activate / set traffic to 100%*). Tag every image you deploy (for example with the git commit) so the previous one is easy to find.
- Migrations only add; rolling the app back does not undo them. Check the release notes before rolling back across a migration.
- **Vercel practice copy:** see [docs/practice-rollback.md](docs/practice-rollback.md). It never touches production or `main`.

### Vercel (practice copy)

Vercel remains the default build (`npm run build`, Nitro `vercel` preset). Import the GitHub repo into a Vercel project, and set `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` and `VITE_AUTH_ENABLED=true` in the project's environment settings. `DATABASE_URL` and `BETTER_AUTH_SECRET` are **required** for any copy people share, including a practice copy used for testing: without them, accounts and jobs disappear between requests. Make `DATABASE_URL` available at build time too, so the build applies the migrations. Also set `MAX_UPLOAD_MB=3` there, because Vercel rejects request bodies over about 4.5 MB. Pull-request previews without `DATABASE_URL` use the in-memory database.

---

## IT: connect your Azure Foundry

Do this when you are ready for Azure to read the sheets. Until then the app works on its own with the on-device reader.

### 1. Create the Azure resources

In the same Azure subscription (and ideally region) as the app:

1. **Azure AI Document Intelligence** resource (or an Azure AI services multi-service resource). It reads text, tables, page numbers and scanned pages. Note its **endpoint**.
2. **Azure OpenAI** resource, or an **Azure AI Foundry** project with Azure OpenAI. Deploy a **vision-capable GPT-4o-class model** (for example `gpt-4o`, version `2024-08-06` or newer) that supports structured outputs. Note the **endpoint** and the **deployment name**.
3. The **container app** (from [Deploy](#deploy)) with a **system-assigned managed identity** turned on.

### 2. Give the app permission (role assignments)

Assign roles to the app's managed identity:

| Role | Scope |
|---|---|
| **Cognitive Services User** | The Document Intelligence resource |
| **Cognitive Services OpenAI User** | The Azure OpenAI / Foundry resource |

Azure CLI example (fill in your own names):

```bash
APP_ID=$(az containerapp show -g <resource-group> -n <app-name> --query identity.principalId -o tsv)
az role assignment create --assignee "$APP_ID" --role "Cognitive Services User" \
  --scope $(az cognitiveservices account show -g <resource-group> -n <docintel-name> --query id -o tsv)
az role assignment create --assignee "$APP_ID" --role "Cognitive Services OpenAI User" \
  --scope $(az cognitiveservices account show -g <resource-group> -n <openai-name> --query id -o tsv)
```

Role assignments can take a few minutes to take effect.

### 3. Set the environment variables

On the container app, set:

```
AZURE_DOCINTEL_ENDPOINT=https://<docintel-name>.cognitiveservices.azure.com/
AZURE_DOCINTEL_MODEL=prebuilt-layout
AZURE_OPENAI_ENDPOINT=https://<openai-name>.openai.azure.com/
AZURE_OPENAI_DEPLOYMENT=<your-deployment-name>
AZURE_OPENAI_API_VERSION=2024-10-21
```

The app signs in with its managed identity first (`DefaultAzureCredential`). Only if that is not possible, set `AZURE_DOCINTEL_KEY` and `AZURE_OPENAI_API_KEY` as **secrets**. Never commit keys.

When all four required values are set, the Azure reader is used (the card shows no on-device warning).

### 4. Test the connection

```bash
npm run azure:check
```

This checks the settings, the managed identity sign-in, Document Intelligence and the model deployment using a tiny bundled sample, and prints pass/fail for each. It never prints keys or endpoints in full. Run it with the same environment as the app (for example from the container app's console).

> `npm run azure:check` is being added by the backend ticket (BE) in this release. If your copy does not have it yet, upload a sample sheet; the card shows a warning if Azure failed and the on-device reader was used.

### If Azure is not connected or fails

The app keeps working. With missing settings it uses the on-device reader. If Azure errors or times out (60 seconds), that sheet falls back to the on-device reader and the user sees a warning.

---

Do not put secrets in this repo. Only `.env.example` (placeholders) is committed; `.env` and `.env.*` are ignored by git.
