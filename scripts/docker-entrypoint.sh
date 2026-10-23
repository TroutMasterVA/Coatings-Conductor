#!/bin/sh
# Container start: apply pending DB migrations (when DATABASE_URL is set), then
# start the Nitro node-server. Set RUN_MIGRATIONS=false to skip the migrate step
# (for example when a separate release job runs migrations).
set -eu

# SEC: a shared container never runs on a random per-instance secret or the in-memory DB.
if [ -z "${BETTER_AUTH_SECRET:-}" ]; then
  echo "[entrypoint] BETTER_AUTH_SECRET is not set. Refusing to start (set a long random value, e.g. openssl rand -base64 32)." >&2
  exit 1
fi
if [ -z "${DATABASE_URL:-}" ]; then
  echo "[entrypoint] DATABASE_URL is not set. Refusing to start (the container needs Postgres)." >&2
  exit 1
fi

if [ -n "${DATABASE_URL:-}" ] && [ "${RUN_MIGRATIONS:-true}" != "false" ]; then
  node /app/migrate/scripts/migrate.mjs
fi

exec node /app/.output/server/index.mjs
