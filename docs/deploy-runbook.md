# Deploy and rollback

Coatings Conductor ships on Vercel. There are no app servers to SSH into.
The git SHA is the artifact: a Vercel deployment is one SHA in one environment.

## Environments

| Environment | How it appears | Database |
| --- | --- | --- |
| Preview | Every pull request | PGlite (no `DATABASE_URL`) |
| Production | Merge to `main` | Postgres (`DATABASE_URL` from Vercel) |

Do not deploy from a laptop or from a one-off Vercel CLI session. That is a snowflake.

## CI (the product Platform ships to BE/FE)

GitHub Actions workflow `.github/workflows/ci.yml` runs on every PR and on `main`:

- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run build`

`npm run check:auth` is a local/dev invariant (it needs a running `npm run dev`). It is not a GitHub required check. Playwright / browser-smoke is QA, not this pipeline.

A PR is not mergeable until `lint-typecheck-test-build` is green. Platform will require that check on `main` (no direct pushes).

## Who can trigger production

1. Feature branch, one PR per ticket.
2. CI green.
3. QA and AppSec have commented.
4. Tech Lead recommends merge.
5. Merge to `main` is the production button. Vercel builds that SHA.

Platform owns the mechanic (branch protection, Vercel production branch = `main`). Lead recommends; Platform does not waive dual-control.

A deploy that needs a one-off data fix is a backend ticket. Do not patch production data from this runbook.

## Rollback (reversible)

Production rollback is "promote the previous successful Vercel production deployment," not a new build and not a `git revert` unless you also need the git history to match.

1. In Vercel: Project → Deployments → Production.
2. Open the last known-good deployment (confirm the git SHA).
3. Promote / Instant Rollback.
4. Confirm the production URL serves that SHA.

If the bad release included a forward-only migration, rollback of the app without a matching data plan is a backend ticket. Do not run ad-hoc SQL against prod from Platform.

## Provenance

- GitHub: every CI run is tied to `github.sha`.
- Vercel: each deployment records the git SHA and is inspectable in the dashboard (runtime logs live there).
- To answer "what is in prod?" use the current production deployment's SHA, not a guess from `main` if a rollback has happened.

## Observability baseline

- Vercel runtime logs for the production deployment.
- Deployment list filtered by SHA after a release or rollback.
- Deeper APM/error tracking is an AppSec/Platform follow-up, not a snowflake agent on a box.
