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
- Without `DATABASE_URL` the container falls back to the in-memory database. Do not use that for real work.

### Environment variables

Copy [`.env.example`](.env.example) for a commented template.

| Variable | Required | What it is |
|---|---|---|
| `DATABASE_URL` | Yes (real use) | Postgres connection string, e.g. `postgres://user:pass@host:5432/db?sslmode=require` |
| `BETTER_AUTH_SECRET` | Yes | Long random string that signs sign-in sessions. Generate with `openssl rand -hex 32`. Changing it signs everyone out. |
| `BETTER_AUTH_URL` | Yes | The public HTTPS address of the app, no trailing slash, e.g. `https://coatings.example.com` |
| `VITE_AUTH_ENABLED` | Recommended | `true` (default). Email/password sign-in is enforced. The Docker image is built with `true`. |
| `PORT` | No | Port inside the container. Default `3000`. |
| `APP_VERSION` | No | Version label in `/api/health`. Set by `--build-arg APP_VERSION`. |
| `RUN_MIGRATIONS` | No | `false` skips migrations at container start. Default runs them. |
| `AZURE_DOCINTEL_ENDPOINT` | For Azure | Document Intelligence endpoint |
| `AZURE_DOCINTEL_MODEL` | No | Document Intelligence model. Default `prebuilt-layout`. |
| `AZURE_OPENAI_ENDPOINT` | For Azure | Azure OpenAI / Foundry endpoint |
| `AZURE_OPENAI_DEPLOYMENT` | For Azure | Name of the vision-capable (GPT-4o class) deployment |
| `AZURE_OPENAI_API_VERSION` | For Azure | API version that supports `json_schema` output and images, e.g. `2024-10-21` |
| `AZURE_DOCINTEL_KEY` | No | Key fallback only. Prefer managed identity. |
| `AZURE_OPENAI_API_KEY` | No | Key fallback only. Prefer managed identity. |

All Azure settings stay on the server. The browser never sees endpoints or keys.

### Health check

`GET /api/health` needs no sign-in and returns no secrets.

- `200` `{"status":"ok","db":"ok","dbSource":"postgres","extractProvider":"azure","version":"…"}` — the database answered `SELECT 1`.
- `503` `{"status":"degraded","db":"down",…}` — the database did not answer within 3 seconds.

`extractProvider` is `azure` when the Azure settings are complete, otherwise `on-device`. `dbSource` is `postgres` or `pglite` (in-memory fallback).

The image has a Docker `HEALTHCHECK` on this path. On Azure, point the probes at it:

- **Azure Container Apps:** Ingress target port `3000`. Add liveness and readiness probes: HTTP, path `/api/health`, port `3000`.
- **App Service for Containers:** set app setting `WEBSITES_PORT=3000`, then under *Monitoring → Health check* set the path to `/api/health`.

### Hosting notes (PAVE / Azure)

- Give the container app a **system-assigned managed identity**. That is how it signs in to Azure AI without keys (see the next section).
- Store `BETTER_AUTH_SECRET` and `DATABASE_URL` as secrets (Container Apps secrets or Key Vault references), not plain settings.
- The sheet reader's rate limit (10 extracts per user per minute) is kept in memory per container. With more than one replica, each replica counts separately. For the beta, run **one replica**.
- Allow outbound HTTPS to your Postgres server, your Azure AI endpoints, and `api.weather.gov` / `api.open-meteo.com` (weather forecasts).

### Rolling back a bad release

- **Container hosts:** redeploy the previous image tag. On Azure Container Apps, switch traffic back to the previous revision (*Revisions → Activate / set traffic to 100%*). Tag every image you deploy (for example with the git commit) so the previous one is easy to find.
- Migrations only add; rolling the app back does not undo them. Check the release notes before rolling back across a migration.
- **Vercel practice copy:** see [docs/practice-rollback.md](docs/practice-rollback.md). It never touches production or `main`.

### Vercel (practice copy)

Vercel remains the default build (`npm run build`, Nitro `vercel` preset). Import the GitHub repo into a Vercel project, and set `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` and `VITE_AUTH_ENABLED=true` in the project's environment settings for a lasting copy. Pull-request previews without `DATABASE_URL` use the in-memory database.

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

When all four required values are set, `/api/health` reports `"extractProvider":"azure"`.

### 4. Test the connection

```bash
npm run azure:check
```

This checks the settings, the managed identity sign-in, Document Intelligence and the model deployment using a tiny bundled sample, and prints pass/fail for each. It never prints keys or endpoints in full. Run it with the same environment as the app (for example from the container app's console).

> `npm run azure:check` is being added by the backend ticket (BE) in this release. If your copy does not have it yet, check `/api/health` for `"extractProvider":"azure"` and upload a sample sheet; the card shows a warning if Azure failed and the on-device reader was used.

### If Azure is not connected or fails

The app keeps working. With missing settings it uses the on-device reader. If Azure errors or times out (60 seconds), that sheet falls back to the on-device reader and the user sees a warning.

---

Do not put secrets in this repo. Only `.env.example` (placeholders) is committed; `.env` and `.env.*` are ignored by git.
