# AGENT.md

This file is a pointer. The canonical instructions live in `AGENTS.md`.

## Current Infrastructure

- Database: Neon PostgreSQL via Prisma 6.
- Cache / rate limiting: Upstash Redis REST (`UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`).
- Auth: Supabase Auth (Google OAuth) with a signed role cookie.

## Rules

- Read `AGENTS.md` before changing code.
- Do not add new PrismaClient instances; import `db` from `@/lib/db`.
- Do not expose raw error messages on 500 responses.
- Do not commit secrets or `.env*` files.
- Do not merge to `main` directly.
- Change only what the task explicitly asks for.
