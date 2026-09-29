# 🤖 AGENT INSTRUCTIONS — READ THIS FIRST

This file contains cross-agent instructions and context for any AI agent working on this project.
For full tech-stack / architecture details, read `AGENTS.md` (canonical). This file covers
repository, git workflow, and conventions every agent MUST follow.

## 📋 REPOSITORY

- **Repository:** `asdgh55589-dotcom/games-arabic-main.2.4.7`
- **Default Branch:** main
- **Current Work Branch:** `fix/api-error-foundation`
- **Authentication:** GitHub CLI (`gh`) — installed at `~/.local/bin/gh` (v2.45.0, Ubuntu build, no sudo needed).
  Authenticate once via `gh auth login` (or `gh auth login --with-token` with a PAT:
  scopes `repo`, `workflow`, `read:org`), then `gh auth setup-git`.
- **Git Remote:** `origin` → `https://github.com/asdgh55589-dotcom/games-arabic-main.2.4.7.git` (already configured)

## 🔄 GIT WORKFLOW RULES (STRICT)

### Commit Messages (MANDATORY FORMAT)
ALL commits MUST follow this format — no exceptions:

```
<type>(<scope>): <short summary>

## What Changed
- Bullet point 1 (file:line — what was done)
- Bullet point 2 (file:line — what was done)
- ...

## Why (Motivation)
- Reason 1
- Reason 2

## Impact
- Expected impact on the system
- Performance/security/stability implications

## Testing
- Tests added/updated: [list]
- Tests run: [pass/fail count]
```

**Example:**

```
fix(db): eliminate connection pool leaks and enforce sizing

## What Changed
- Removed 2 rogue PrismaClient instances (notification-container.ts:19, notifications-health/route.ts:6)
- Updated pool settings in .env and .env.local to connection_limit=5
- Changed db.ts defaults from 20/60/30 to 5/10/10/15000
- Added boot warm-up with withDatabaseRetry

## Why
- P2024 pool exhaustion errors were occurring under load
- 3 concurrent pools were opening 15 connections against Aiven's limit of 5
- 60s pool_timeout was causing request hangs

## Impact
- Eliminates P2024 errors
- Reduces connection count from 15 to 5 per process
- Faster failure instead of 60s hangs

## Testing
- Tests updated: aiven-db.test.ts, aiven-env.test.ts
- Tests run: 47/47 pass
```

### Allowed Commit Types:
- `feat` — new feature
- `fix` — bug fix
- `refactor` — code refactoring (no behavior change)
- `perf` — performance improvement
- `test` — adding/updating tests
- `docs` — documentation only
- `chore` — maintenance, tooling, config
- `security` — security-related changes

### Allowed Scopes:
- `db` — database layer
- `api` — API routes/handlers
- `auth` — authentication
- `ui` — frontend/UI
- `infra` — infrastructure/deployment
- `test` — test utilities

### Push Rules:
- ALWAYS use `gh` for push operations (no credentials needed once authenticated):

```bash
git push origin <branch>
# OR
gh pr create --title "..." --body "..."
```

- For main branch: use Pull Requests, not direct push
- For feature branches: push directly, then create PR

## 🗂️ PROJECT STRUCTURE (Key Directories)

```
.
├── src/
│   ├── app/
│   │   └── api/           # API routes (Next.js App Router)
│   ├── lib/               # Shared libraries
│   │   ├── db.ts          # Database singleton (Prisma) — ONLY PrismaClient, import { db }
│   │   ├── logger.ts      # Pino logger — use logger.*, never console.*
│   │   ├── api-response.ts # Response helpers (RFC 7807 envelope)
│   │   └── auth.ts        # Auth utilities
│   ├── proxy.ts           # Edge middleware (NO Prisma / Node-fs imports)
│   └── infrastructure/    # DI and observability (adapters, config, di, observability, repositories)
├── prisma/
│   └── schema.prisma      # Database schema (81 models)
├── docs/                  # Project documentation
├── scripts/               # Utility scripts
├── AGENTS.md              # Canonical tech-stack / architecture reference
└── AGENT.md               # THIS FILE — read first
```

## 🔑 KEY TECHNICAL DECISIONS

### Database
- **Engine:** PostgreSQL 16 on Aiven
- **ORM:** Prisma 6.11.1
- **Connection Limit:** 5 (matches Aiven pool size — `src/lib/db.ts` enforces `connection_limit=5`)
- **Pool Timeout:** 10s (fail fast, not hang — `pool_timeout=10`)
- **Statement Timeout:** 15s (`statement_timeout=15000`, prevents runaway queries)
- **SSL:** Required (sslmode=require)

### Error Handling
- **Standard:** RFC 7807 (Problem Details) — additive layer
- **Envelope:** `{error: {code, message, ...}, problem: {type, title, status, ...}}`
- **Validation:** 422 (not 400) with structured field details
- **500s:** NEVER expose raw error.message

### Logging
- **Library:** Pino (src/lib/logger.ts)
- **Correlation:** x-request-id header
- **DO NOT use:** console.log/error/warn (use logger.*)

## 📝 ACTIVE WORK IN PROGRESS

### Completed Phases:
- ✅ Phase 1 (Database Foundation): Pool leaks fixed, sizing enforced (commit `9ff635d`)
- ✅ Phase 1 (API Error Foundation): RFC 7807 adopted (additive problem field), 20+ error.message leaks eliminated, CORS + OPTIONS added, validation→422, Retry-After on all 429s (merge `b007563`, tests `85559bd`)
- ✅ Phase 2 (Database Performance): /api/home 27→8 sequential queries, reports/stats bursts ≤3, author:true→select projections (secret leak fixed), sitemap paginated, home-cache→Redis 300s, ledger negative cache (merge `9936170`, PR #2, tests 2065/2074 — 9 failures pre-existing on HEAD)
- ✅ Phase 2 (API Logging): pino standardization (186 route files), lifecycle logs + RED metrics wired, file/line diagnostics (merge `0b8bb64`, PR #3, tests 2078/2080 — 2 failures pre-existing: missing prisma 20260907 migration SQL)

### Current Phase:
- ⏳ None — Phase 2 API Logging merged to main; awaiting next assignment

### Next Phases:
- ⏳ Phase 3 (API Performance): ETag, Cache-Control, rate-limit headers
- ⏳ Phase 4: Advanced (Sparse Fieldsets, HATEOAS, Versioning, OpenAPI)
- ⏳ Fix pre-existing test failures (missing prisma 20260907 migration SQL files)

## ⚠️ CRITICAL WARNINGS FOR AGENTS

1. **Do NOT create new PrismaClient instances** — use `import { db } from '@/lib/db'`
2. **Do NOT expose error.message on 500s** — use `internalError()` helper
3. **Do NOT use console.log/error** — use `logger.info/warn/error`
4. **Do NOT modify connection pool settings without updating docs**
5. **Do NOT commit secrets, API keys, or .env files**
6. **Do NOT merge to main directly** — always use Pull Requests
7. **Always run tests before committing** — `npx jest` must pass
8. **Do NOT touch what you weren't asked to** (see AGENTS.md Critical Rule) — change ONLY what was requested

## 🔗 USEFUL COMMANDS

```bash
# Run dev server
bun run dev

# Run all tests (Jest with ts-jest, tests in src/__tests__/)
npx jest

# Type check
bun run typecheck

# Lint
bun run lint

# Database operations
bun run db:generate
bun run db:push
bun run db:migrate

# Push current branch
git push origin $(git branch --show-current)

# Create Pull Request
gh pr create --title "feat(scope): description" --body "..."

# View PR checks
gh pr checks
```

## 🔌 MCP-AIVEN INTEGRATION

MCP (Model Context Protocol) server for Aiven is installed and configured (`mcp-aiven`, stdio, **read-only + pg-scoped**).
Full guide: `docs/MCP-AIVEN.md`. Client config: `.mcp.json` (env-only, no secrets).

### Available Tools (read-only surface):
- `aiven_pg_read` — Execute read-only SQL queries
- `aiven_service_list` / `aiven_service_get` — List / inspect services
- `aiven_service_metrics_fetch` — View performance metrics
- `aiven_project_get_service_logs` — View recent logs
- `aiven_service_query_activity` — Currently running queries
- `aiven_pg_service_query_statistics` — Slow-query statistics

### Usage Guidelines:
- ALWAYS use read-only queries through MCP (`AIVEN_READ_ONLY=true` enforced)
- For schema changes, use Prisma migrations (not MCP)
- For large tables, add LIMIT; keep statement_timeout ≤ 15s
- Never expose credentials or raw connection strings (`AIVEN_ALLOW_SECRETS` stays false)

### Example Queries:
- Pool pressure: `SELECT count(*) AS active, state FROM pg_stat_activity GROUP BY state`
- Slow queries: `SELECT query, calls FROM pg_stat_statements ORDER BY total_exec_time DESC LIMIT 10`
- Table sizes: `SELECT schemaname, tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) FROM pg_tables WHERE schemaname='public' LIMIT 20`

## 🆘 ESCALATION

If you're unsure about something:
1. Read `docs/` directory for project documentation
2. Check `src/lib/` for canonical implementations
3. Search for existing patterns before creating new ones
4. Ask the human (مؤمن هاني) for clarification if critical
5. Add a `TODO` comment and flag it in the commit message

---

**Last updated:** 2026-09-29
**Last updated by:** Database Foundation Agent
