# syntax=docker/dockerfile:1
#
# Coatings Conductor — standalone container (Nitro node-server preset).
#
#   docker build -t coatings-conductor .
#   docker run -p 3000:3000 --env-file .env coatings-conductor
#
# The Vercel build is untouched: only this image sets NITRO_PRESET=node-server.
# No secrets are baked in; every key/URL comes from the runtime environment.

ARG NODE_VERSION=22

# ---------- build ----------
FROM node:${NODE_VERSION}-bookworm-slim AS build
WORKDIR /app
ENV NITRO_PRESET=node-server \
    VITE_AUTH_ENABLED=true \
    NODE_OPTIONS=--max-old-space-size=4096

COPY package.json package-lock.json ./
# Optional dependencies stay ON: @napi-rs/canvas (server-side PDF page images,
# BE-2) ships prebuilt native binaries as per-platform optional packages.
# Build and runtime both use Debian bookworm (glibc), so the binary matches.
RUN npm ci --no-audit --no-fund

COPY . .
# DATABASE_URL is deliberately unset here, so `npm run build`'s migrate step
# skips; migrations run when the container starts (see docker-entrypoint.sh).
RUN npm run build

# If @napi-rs/canvas is a dependency, prove Nitro traced its native binary into
# .output/server/node_modules and that it loads (fails the build otherwise).
RUN if node -e "const p=require('./package.json');process.exit((p.dependencies||{})['@napi-rs/canvas']||(p.optionalDependencies||{})['@napi-rs/canvas']?0:1)"; then \
      cd .output/server && node -e "import('@napi-rs/canvas').then(m=>{m.createCanvas(1,1);console.log('[docker] @napi-rs/canvas OK')})"; \
    else echo "[docker] @napi-rs/canvas not a dependency yet; skipping check"; fi

# Tiny, self-contained migrator: scripts/migrate.mjs + migrations/ + pg only.
RUN mkdir -p /migrate/scripts \
 && cp scripts/migrate.mjs scripts/migration-plan.mjs /migrate/scripts/ \
 && cp -r migrations /migrate/migrations \
 && cd /migrate \
 && printf '{"name":"cc-migrate","private":true,"type":"module"}\n' > package.json \
 && npm install --no-audit --no-fund --omit=dev "pg@$(node -p "require('/app/node_modules/pg/package.json').version")"

# ---------- runtime ----------
FROM node:${NODE_VERSION}-bookworm-slim AS runtime
ARG APP_VERSION=dev
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000 \
    APP_VERSION=${APP_VERSION}
WORKDIR /app

COPY --from=build --chown=node:node /app/.output ./.output
COPY --from=build --chown=node:node /migrate ./migrate
COPY --chown=node:node scripts/docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod 0755 ./docker-entrypoint.sh

USER node
EXPOSE 3000

# Node has fetch built in, so no curl is needed in the image.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["./docker-entrypoint.sh"]
