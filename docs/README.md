# Documentation Index

> **Last Updated:** 2026-09-13

Welcome to the Games Arabic project documentation. This index links to all documentation files.

## Quick Links

| Document | Description |
|----------|-------------|
| [../ARCHITECTURE.md](../ARCHITECTURE.md) | High-level architecture overview (file-based routing) |
| [../TECHNICAL.md](../TECHNICAL.md) | Comprehensive technical documentation |
| [API-STANDARDIZATION.md](./API-STANDARDIZATION.md) | API response format — 147 handlers, pagination, auth helpers |
| [ZOD-SCHEMAS.md](./ZOD-SCHEMAS.md) | Centralized Zod schemas (`src/lib/schemas.ts`) |
| [AUTH-SYSTEM.md](./AUTH-SYSTEM.md) | Supabase OAuth + JWT `ga_admin_role` + `tokenVersion` + IP ban |
| [ROUTING-ARCHITECTURE.md](./ROUTING-ARCHITECTURE.md) | File-based routing, `generateMetadata`, 301 redirects |
| [FRONTEND-ARCHITECTURE.md](./FRONTEND-ARCHITECTURE.md) | AppShell, 26 views, `useFetch`, providers |
| [DATABASE.md](./DATABASE.md) | Prisma schema — 53 models, singleton, Aiven/Neon migrations |
| [DEVELOPMENT-GUIDE.md](./DEVELOPMENT-GUIDE.md) | Local setup, adding features, testing |
| [DEPLOYMENT.md](./DEPLOYMENT.md) | Standalone build, Caddy, env, monitoring |
| [CHANGELOG.md](./CHANGELOG.md) | Architectural decisions (ADRs) + changelog |
| [NOTIFICATION_ARCHITECTURE.md](./NOTIFICATION_ARCHITECTURE.md) | Notification Clean Architecture (Domain/Application/Infrastructure) |
| [NOTIFICATION_TYPES.md](./NOTIFICATION_TYPES.md) | 20 notification types reference |

## Legacy / Detailed

| Document | Description |
|----------|-------------|
| [AUTHENTICATION.md](./AUTHENTICATION.md) | Auth overview (OAuth flows) — legacy, see AUTH-SYSTEM.md |
| [ADMIN-AUTH.md](./ADMIN-AUTH.md) | Admin login system — legacy |
| [TELEGRAM-AUTH.md](./TELEGRAM-AUTH.md) | Telegram Deep Link auth — legacy |

## For New Developers

Start here:
1. Read [../ARCHITECTURE.md](../ARCHITECTURE.md) for a 5-minute overview
2. Read [DEVELOPMENT-GUIDE.md](./DEVELOPMENT-GUIDE.md) to set up locally
3. Read [API-STANDARDIZATION.md](./API-STANDARDIZATION.md) to understand the API layer
4. Read [AUTH-SYSTEM.md](./AUTH-SYSTEM.md) for auth patterns

## For AI Agents

This project uses AGENTS.md at the root for agent instructions. Key conventions:
- API responses use `{ data }` / `{ error: { code, message } }` format
- Validation via Zod schemas in `src/lib/schemas.ts`
- Auth via `requireAuth()` / `getOptionalSession()` from `src/lib/auth.ts`
- Middleware runs in Edge runtime — no Prisma imports allowed
- RTL layout (Arabic-first) with `dir="rtl"` on `<html>`
