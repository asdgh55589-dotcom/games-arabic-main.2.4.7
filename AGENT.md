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

### Current Phase:
- 🔄 API Error Foundation (branch: `fix/api-error-foundation`)
  - RFC 7807 adoption
  - Eliminate error.message leaks
  - Add CORS policy

### Next Phases:
- ⏳ Phase 2: Observability & Logging (pino-only, lifecycle logs, RED metrics)
- ⏳ Phase 3: Performance (ETag, Cache-Control, rate-limit headers)
- ⏳ Phase 4: Advanced (Sparse Fieldsets, HATEOAS, Versioning, OpenAPI)

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
