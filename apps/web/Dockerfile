# syntax=docker/dockerfile:1.7
# Builds ONLY the `web` app out of the pnpm + turbo monorepo.
#
# IMPORTANT: the build context must be the MONOREPO ROOT, not apps/web — the
# lockfile, pnpm-workspace.yaml, and the @kanbi/shared package all live there.
# Build it with:   docker build -f apps/web/Dockerfile .   (run from repo root)

FROM node:20-alpine AS base
RUN corepack enable
WORKDIR /app

# ---- deps: install only what `web` (and its workspace deps) need ----
FROM base AS deps
# Manifests first for layer caching. All workspace manifests are required so
# pnpm can validate the frozen lockfile, even though we only install `web...`.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc turbo.json ./
COPY apps/web/package.json ./apps/web/package.json
COPY apps/focus/package.json ./apps/focus/package.json
COPY packages/shared/package.json ./packages/shared/package.json
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --filter web...

# ---- builder: produce the standalone bundle for web only ----
FROM base AS builder
COPY --from=deps /app ./
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1 SKIP_ENV_VALIDATION=1
RUN pnpm --filter web build

# ---- runner: minimal standalone server ----
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs

# Standalone output is rooted at the monorepo (outputFileTracingRoot), so the
# server entrypoint lands at apps/web/server.js with node_modules at the root.
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public

USER nextjs
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
