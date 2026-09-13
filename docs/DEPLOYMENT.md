# Deployment Guide

> **Last Updated:** 2026-09-13 — Standalone output, 147 handlers, Aiven + Supabase + Upstash

## Overview

- **Runtime:** Next.js 16 standalone output
- **Database:** Aiven PostgreSQL (primary) / Neon (legacy fallback)
- **Auth:** Supabase (hosted)
- **Cache:** Upstash Redis (serverless)
- **Email:** Emitlo

## Environment Variables

All required environment variables for production (see `.env.example` — never commit `.env`):

```env
# Database — Aiven (primary) / Neon (fallback) — add ?sslmode=require&connection_limit=5&pool_timeout=10
DATABASE_URL="postgresql://user:password@host:5432/games_arabic?connection_limit=5&pool_timeout=10&sslmode=require"
# Aiven cutover: set this to override DATABASE_URL on deploy day (takes priority when non-empty)
# AIVEN_DATABASE_URL="postgresql://user:password@host:5432/games_arabic?sslmode=require&connection_limit=5&pool_timeout=10&connect_timeout=10"
DIRECT_URL="postgresql://user:password@host:5432/games_arabic?sslmode=require" # for prisma migrate

# Supabase
NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key"
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"

# Auth
JWT_SECRET="openssl rand -hex 32 — used to sign ga_admin_role (HMAC-SHA256 via jose)"
# Owner seed — required, no hardcoded fallback
OWNER_USERNAME="owner"
OWNER_EMAIL="owner@example.com"
OWNER_PASSWORD="your-secure-password-here"

# Site
NEXT_PUBLIC_SITE_URL="https://yourdomain.com"

# Optional — only if used
# Upstash Redis (rate limiting + IP ban + tokenVersion cache)
UPSTASH_REDIS_REST_URL="https://..."
UPSTASH_REDIS_REST_TOKEN="..."
# Email (Emitlo)
EMITLO_API_KEY="em_..."
# Telegram Deep Link
TELEGRAM_BOT_TOKEN="..."
TELEGRAM_BOT_NAME="..."
# YouTube metadata via yt-dlp (server must have yt-dlp installed)
YT_DLP_PATH="/usr/local/bin/yt-dlp"
# Cookie domain for production
COOKIE_DOMAIN="yourdomain.com"
```

OAuth providers (Google, Discord) are configured in Supabase Dashboard → Auth → Providers (no `GOOGLE_CLIENT_ID` env needed in app).

## Build Process

```bash
# Full build command
bun run build
```

This runs:
1. `prisma generate` — Generate Prisma client
2. `prisma migrate deploy` — Apply pending migrations
3. `next build` — Build Next.js with standalone output
4. Copy static assets to standalone directory

### Standalone Output

The build produces a self-contained server at `.next/standalone/`:

```
.next/standalone/
├── server.js              # Entry point
├── .next/
│   └── static/            # Static assets
├── public/                # Public assets
└── node_modules/          # Minimal dependencies
```

## Deployment Options

### Option 1: Docker

```dockerfile
FROM node:18-alpine AS base
WORKDIR /app

# Install dependencies
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Build
COPY . .
RUN bun run build

# Production
FROM node:18-alpine AS runner
WORKDIR /app
COPY --from=base /app/.next/standalone .
COPY --from=base /app/.next/static ./.next/static
COPY --from=base /app/public ./public

EXPOSE 3000
CMD ["node", "server.js"]
```

### Option 2: Node.js Server

```bash
# Build
bun run build

# Start
NODE_ENV=production bun .next/standalone/server.js
```

### Option 3: Vercel

The project uses `output: 'standalone'` in `next.config.ts`, which is compatible with Vercel's serverless deployment.

## Production Checklist

### Before Deploying

- [ ] All environment variables set
- [ ] Database migrations applied (`bun run db:push` or `bun run db:migrate`)
- [ ] Prisma client generated (`bun run db:generate`)
- [ ] Build passes (`bun run build`)
- [ ] Lint passes (`bun run lint`)

### OAuth Configuration

Update redirect URLs in:

1. **Supabase Dashboard** → Authentication → Providers
   - Google: Add `https://yourdomain.com/api/auth/callback`
   - Discord: Add `https://yourdomain.com/api/auth/callback`

2. **Google Cloud Console** → Credentials
   - Add `https://yourdomain.com/api/auth/callback` to Authorized redirect URIs

3. **Discord Developer Portal** → OAuth2
   - Add `https://yourdomain.com/api/auth/callback` to Redirects

4. **Telegram Bot** → Set webhook
   - `https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://yourdomain.com/api/auth/telegram/webhook`

### DNS/SSL

- Ensure domain points to your server
- SSL/TLS enabled (required for secure cookies)
- `COOKIE_DOMAIN` set to your domain

## Aiven PostgreSQL (Production)

> See `docs/AIVEN-CONFIG.md` for full configuration, PITR, and backup details.

### Connection string

```env
# Aiven — production primary (set AIVEN_DATABASE_URL; DATABASE_URL fallback also works)
AIVEN_DATABASE_URL="postgresql://avnadmin:PASSWORD@pg-xxxxx-ew1.aivencloud.com:26974/defaultdb?sslmode=require&connection_limit=5&pool_timeout=10&connect_timeout=10"
```

**Key requirements:**
- `sslmode=require` — mandatory; `src/lib/db.ts` throws if missing
- `connection_limit=5` — keep ≤ Aiven pool size (5)
- `pool_timeout=10` — seconds to wait for a pool connection
- `connect_timeout=10` — injected automatically if missing by `ensureSslmode`

### Pool tuning

Aiven console → Service → Pools → set pool size to **5** (matches `connection_limit`).
See `docs/AIVEN-CONFIG.md` §Pool & Prisma tuning for full parameter table.

### PITR

Aiven provides continuous WAL archiving for point-in-time recovery.
Enable in: Aiven UI → Databases → Backup & Restore → Enable PITR.
Retention: 7 days minimum. See `docs/AIVEN-CONFIG.md` §PITR for restore procedure and RPO/RTO targets.

### Migration to Aiven

1. Dump Neon: `pg_dump "$DATABASE_URL" | gzip > neon-dump.sql.gz`
2. Restore to Aiven: `gunzip -c neon-dump.sql.gz | psql "$AIVEN_DATABASE_URL"`
3. Apply migrations: `AIVEN_DATABASE_URL=<url> npx prisma migrate deploy`
4. Verify: `npx prisma migrate status` → "Database schema is up to date!"
5. Update env vars, rebuild, smoke test. See `docs/CUTOVER-CHECKLIST.md`.

## Database Migration in Production

```bash
# Apply pending migrations
npx prisma migrate deploy

# Or push schema changes (dev only, not recommended for production)
npx prisma db push
```

**Important:** Always use `migrate deploy` in production, not `db push`.

## Monitoring

### Logs

The app logs to stdout/stderr. In production:

```bash
# View logs
tail -f server.log

# Or if using Docker
docker logs <container-id>
```

### Error Tracking

Consider adding:
- Sentry for error tracking
- Vercel Analytics for performance
- Custom audit logging (already implemented via `AuditLog` model)

### Health Check

```bash
curl https://yourdomain.com/api
# Should return: { "data": { "message": "Hello, world!" } }
```

## Rollback Procedure

### Database Rollback

1. Check current migration status:
   ```bash
   npx prisma migrate status
   ```

2. If needed, reset to a previous state:
   ```bash
   npx prisma migrate reset
   ```

3. Re-apply migrations from the desired point

### Code Rollback

1. Revert to previous commit:
   ```bash
   git revert HEAD
   ```

2. Rebuild and redeploy:
   ```bash
   bun run build
   # Deploy again
   ```

### Full Rollback

1. Revert code to last known good state
2. Revert database to last known good migration
3. Redeploy

## Performance Considerations

### Caching

API routes include Cache-Control headers:

```typescript
'Cache-Control': 'public, max-age=60, stale-while-revalidate=300'
```

### Database

- Connection pooling: 5 connections, 30s timeout
- Indexes on frequently queried fields
- Use `select` instead of `include` when possible

### Build Optimization

- Standalone output reduces deployment size
- Static assets served separately
- Code splitting via `next/dynamic`

## Security

- HttpOnly cookies for JWT
- Secure cookies in production
- SameSite Lax for CSRF protection
- Rate limiting via Upstash Redis
- IP ban system
- Security headers in `next.config.ts`:
  - X-Frame-Options: SAMEORIGIN
  - X-Content-Type-Options: nosniff
  - Referrer-Policy: strict-origin-when-cross-origin
  - Content-Security-Policy configured

## Troubleshooting

### Build Fails in Production

1. Check Node.js version (18+)
2. Ensure all env vars are set
3. Try clean build:
   ```bash
   rm -rf .next node_modules
   bun install
   bun run build
   ```

### Database Connection Issues

1. Verify `DATABASE_URL` is correct
2. Ensure `sslmode=require` is in the URL (Aiven rejects non-SSL connections)
3. Check Aiven/Neon dashboard for connection limits
4. See [AIVEN-CONFIG.md](./AIVEN-CONFIG.md) for Aiven-specific pool tuning, SSL, and cutover details

### OAuth Callback Errors

1. Verify redirect URLs match exactly
2. Check OAuth provider configuration in Supabase Dashboard
3. Ensure `NEXT_PUBLIC_SUPABASE_URL` is correct

### Cookies Not Working

1. Ensure `COOKIE_DOMAIN` is set correctly
2. Check that HTTPS is enabled
3. Verify `JWT_SECRET` is set and consistent
