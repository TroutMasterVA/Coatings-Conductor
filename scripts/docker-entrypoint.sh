#!/bin/sh
# Container start: apply pending DB migrations (when DATABASE_URL is set), then
# start the Nitro node-server. Set RUN_MIGRATIONS=false to skip the migrate step
# (for example when a separate release job runs migrations).
set -eu

if [ -n "${DATABASE_URL:-}" ] && [ "${RUN_MIGRATIONS:-true}" != "false" ]; then
  node /app/migrate/scripts/migrate.mjs
elif [ -z "${DATABASE_URL:-}" ]; then
  echo "[entrypoint] DATABASE_URL not set — using the embedded in-memory database (data is lost on restart; not for real use)."
fi

exec node /app/.output/server/index.mjs
