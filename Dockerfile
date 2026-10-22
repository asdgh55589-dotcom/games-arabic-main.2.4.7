# Games Arabic — standalone production image (Bun + Next.js standalone).
#
# Secrets are NEVER baked in: pass them at runtime
# (--env-file .env) or as build args for the build step only.
# `bun run build` runs `next build` only; migrations are a separate deploy step
# (`prisma migrate deploy` with DATABASE_URL + DIRECT_URL) and are not run here.

FROM oven/bun:1-alpine AS base

FROM base AS deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Needs DATABASE_URL (+ build-time NEXT_PUBLIC_*) — pass via --build-arg.
RUN bun run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

# Backups (src/lib/backup.ts + /api/cron/weekly-backup) need pg_dump/pg_restore/psql.
# oven/bun:1-alpine currently resolves to Alpine 3.22.x, where the package is
# `postgresql17-client` (verified: Alpine 3.22.5, postgresql17-client 17.11-r0).
# If the base image moves to an Alpine release that drops that package name,
# install the PostgreSQL 17 client package for that release or pin the base.
RUN apk add --no-cache postgresql17-client

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs \
  && mkdir -p /app/backups \
  && chown nextjs:nodejs /app/backups \
  && chmod 700 /app/backups

# .next/standalone already contains server.js + .next/static + public
# (the build script copies them in — see package.json `build`).
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD bun -e "fetch('http://127.0.0.1:3000/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["bun", "server.js"]
