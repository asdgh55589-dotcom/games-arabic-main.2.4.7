# Initial Dashboard Audit & Gap Analysis

> Branch: `chore/initial-dashboard-audit`  
> Scope: Administration dashboard (`/admin/*`, `/api/admin/*`) — exploration & reporting only, no code changes.  
> Generated: 2026-10-18  
> Sources: `src/app/admin` (72 pages), `src/app/api/admin` (175 routes / 264 method handlers), `prisma/schema.prisma` (95 models), `src/lib/admin-pages.ts` (49 registered pages).

---

## Part A — Technical Answers

### 1. Tech stack
- **Frontend:** Next.js 16 (App Router, standalone), React 19, TypeScript 5, Tailwind CSS 4, shadcn/ui (Radix), Recharts (code-split), lucide-react, dnd-kit, react-hook-form (sparse).
- **Backend:** Next.js Route Handlers (Node runtime) + Edge proxy (`src/proxy.ts`).
- **Database:** PostgreSQL (Aiven) via Prisma 6 (95 models, 233 `@@index`, 21 `@@unique`, 14 migrations).
- **Cache/Session:** Upstash Redis (IP ban cache, tokenVersion cache, rate limiting).
- **Auth:** Supabase OAuth + Telegram deep-link; JWT role cookie `ga_admin_role` (HS256, 7d).
- **Observability:** Sentry, OpenTelemetry, Lighthouse CI, knip.

### 2. Monolith vs API
Monolith (Next.js full-stack). Frontend and backend co-located in one repo; admin UI calls same-origin `/api/admin/*` Route Handlers. No separate backend service.

### 3. RTL support
Arabic-first: `<html dir="rtl">`, Tailwind logical/RTL utilities, global CSS. Per-component text uses Arabic strings; i18n is hardcoded AR (no i18n library for admin; `studio-i18n` is separate creator module). No LTR fallback toggle in admin.

### 4. Auth & roles
- Roles: `member < creator < publisher < moderator < admin < manager < owner` (`src/lib/roles.ts`).
- Permission system: `src/lib/permissions.ts` (`PERMISSION_MIN_ROLE`, `can()`).
- Admin gate in Edge proxy requires staff role (moderator+) for `/admin/*` and `/api/admin/*`; tokenVersion check fail-closed on admin tier.
- `StaffPageAccess` + JWT `pages` claim for per-page access; owner bypasses.
- MFA (TOTP + recovery codes) implemented but **disabled by default** (`MFA_ENFORCED` unset).
- API keys (`src/lib/api-key-auth.ts`) cannot bypass admin proxy gate.

### 5. Tests, CI/CD, linters
- **Tests:** Jest + ts-jest; 251 test files.
- **CI:** Only `.github/workflows/notifications.yml` (path-scoped to notification changes) runs typecheck + biome + notification tests. No full-app CI gate.
- **Lint/Format:** Biome (very permissive — `no-explicit-any`, `no-unused-vars`, `exhaustive-deps` all off).
- **Typecheck:** `tsc --noEmit` (strict but `noImplicitAny: false`).
- **Other:** knip, Lighthouse CI, Sentry.

### 6. Top security vulnerabilities
See backend audit §5. Summary (redacted secrets; locations only):

| # | Severity | Issue | Location |
|---|---|---|---|
| 1 | High | Backup filename path traversal (owner-only) | `src/lib/backup.ts` (`deleteBackup`), `src/app/api/admin/backup/route.ts` |
| 2 | Medium | MFA not enforced for staff by default | `src/proxy.ts` (`MFA_ENFORCED`), env |
| 3 | Medium | CSRF reliance on SameSite cookies only | `src/proxy.ts`, cookie auth |
| 4 | Medium | Arbitrary settings keys/groups writable by manager+ | `src/app/api/admin/settings/route.ts` (PUT) |
| 5 | Medium | Cross-user file deletion by moderators | `src/app/api/storage/delete-image/route.ts` |
| 6 | Medium | Most admin mutations lack route-level rate limiting | 167/175 admin routes |
| 7 | Medium | Fail-open IP ban when Redis unavailable | `src/proxy.ts`, `src/lib/ip-ban-cache.ts` |
| 8 | Medium | CSP `unsafe-inline`/`unsafe-eval` | `src/proxy.ts` (security headers) |
| 9 | Low | Admin setup endpoint unauthenticated (mitigated) | `src/app/api/admin/setup/route.ts` |
| 10 | Low | Maintenance settings key mismatch (bug) | `src/app/api/admin/maintenance/route.ts` |

### 7. Performance status
- **Dashboard** (`/api/admin/dashboard`): 12 parallel Prisma queries (counts/aggregates + 3 `findMany` take 5) — acceptable, indexed. No pagination beyond recent 5. `Cache-Control: private, max-age=15`.
- **Frontend:** Recharts code-split via `next/dynamic`; `optimizePackageImports` covers lucide/radix/recharts. But admin layout statically imports ~45 lucide icons; 14 `<img>` bypass `next/image`; no root `admin/loading.tsx`; `AdminDataTable` not memoized.
- **Data fetching:** Manual `fetch` + `useState`/`useEffect` (182 `fetch(` calls, 58 files with manual effects); no React Query/SWR/Zustand despite docs. No cache/dedupe/background revalidation; repeated `/api/auth/me`.
- **Pagination:** `AdminDataTable` supports pagination/filters; many pages fetch full lists (users, mods, files) — risk of large payloads.

---

## Part B — Page-by-Page Gap Analysis

Shared gaps across ALL admin pages (apply unless noted):
- **Missing features:** no bulk export (CSV/Excel) on most lists; no column chooser; no saved filters; no audit-trail link per row.
- **Security:** role gating via proxy + `require*`; per-page access via `StaffPageAccess`; ensure every mutation calls `requireModerator`+ and logs to `AuditLog`.
- **UX/UI:** native `confirm()` (42) / `alert()` (12) instead of shadcn AlertDialog; inconsistent page headers; dead topbar search & bell (`layout-client.tsx:607-621`); only 1 route-level `loading.tsx` (telegram); sortable headers not keyboard-accessible.
- **Performance:** manual fetch without AbortController on many pages; no `loading.tsx` skeleton for most routes; `<img>` instead of `next/image` in several lists.

### General / Overview

#### `/admin` — Main Dashboard Overview
- **Missing features:** time-range selector for charts; KPI drill-down links; real-time refresh; revenue/engagement widgets; configurable widget layout; export snapshot.
- **Security:** requires moderator+ (`requireModerator`) — OK. Dashboard data includes user emails? No (only usernames) — OK.
- **UX/UI:** KPI cards lack trend deltas; charts (GrowthChart, PlatformDonut) load with skeletons (good). Recent lists lack empty states in some sections; no error retry button (only error text).
- **Performance:** 5 concurrent fetches (dashboard + 2 charts + sessions + audit) without AbortController on chart fetches; `activeSessions`/`audit` fetched separately. Consider consolidating or parallel with timeout. `console.time` left in production route (`src/app/api/admin/dashboard/route.ts`).

#### `/admin/login`
- **Missing features:** "remember me"; password visibility toggle (exists?); MFA challenge flow when enforced; account lockout messaging.
- **Security:** `?from=` sanitized (`src/app/admin/login/client.tsx:32-35`) — good. No rate limit visible on client; server-side auth POST rate-limited (10/min) in proxy.
- **UX/UI:** Good example of react-hook-form + zod + ARIA (`aria-invalid`, `aria-live`); reuse as template for other forms.
- **Performance:** fine.

### Content Management

#### `/admin/mods` (+ `/admin/mods/new`, `/admin/mods/[id]/edit`)
- **Missing features:** advanced filters (status/platform/game/author), bulk edit, duplicate, version history UI, scheduling, preview, SEO fields, changelog editor; drag-and-drop reorder.
- **Security:** mutations must verify ownership (creator vs admin); moderator can edit? Check `requireAdmin` on delete; IDOR risk if edit by slug/id without ownership check.
- **UX/UI:** uses AdminDataTable (good). Empty/error states present. Missing loading skeleton per route.
- **Performance:** list fetch likely unpaginated or large; N+1 if includes game/author without select.

#### `/admin/sections`
- **Missing features:** reorder (dnd-kit available), icon picker, per-platform visibility, bulk delete.
- **Security:** moderator+ writes; validate slug uniqueness.
- **UX/UI:** consistent with AdminDataTable.
- **Performance:** small dataset; fine.

#### `/admin/series` (+ edit)
- **Missing features:** cover image upload, mod count, ordering, archive.
- **Security:** ownership/moderator.
- **UX/UI:** standard.
- **Performance:** fine.

#### `/admin/teams` (+ dashboard/edit/rewards)
- **Missing features:** team analytics drill-down, member management bulk, achievement assignment, quality score breakdown, reward distribution history.
- **Security:** team-scoped permissions; ensure non-owner cannot edit other teams.
- **UX/UI:** nested routes; consistent.
- **Performance:** dashboard aggregates may be heavy; check N+1.

#### `/admin/ads`
- **Missing features:** scheduling (start/end), targeting, impressions/clicks stats, A/B variants, preview.
- **Security:** ads rendered via `sanitizeHTML` (`src/components/ad-section.tsx:298`, `src/lib/sanitize-html.ts`) allowing `style` + `data:` img — review; admin-trusted only.
- **UX/UI:** stats card present.
- **Performance:** fine.

#### `/admin/news` (+ edit)
- **Missing features:** rich text editor, scheduling, categories/tags, featured, SEO, preview.
- **Security:** XSS via content; sanitize server-side.
- **UX/UI:** standard.
- **Performance:** fine.

#### `/admin/files`
- **Missing features:** folder view, preview, bulk delete (exists), storage quota, orphan cleanup, search by name/type.
- **Security:** moderator delete any file (`src/app/api/storage/delete-image/route.ts`) — cross-user risk; restrict to owner or asset owner.
- **UX/UI:** standard.
- **Performance:** storage-stats aggregation; pagination.

#### `/admin/images/health`
- **Missing features:** auto-fix broken images, re-scan, export report.
- **Security:** admin+.
- **UX/UI:** standard.
- **Performance:** scan can be heavy; ensure background job.

#### `/admin/docs`
- **Missing features:** versioning, search, categories.
- **Security:** admin+.
- **UX/UI:** standard.
- **Performance:** fine.

### Community Management

#### `/admin/comments`
- **Missing features:** bulk moderate, spam filter, search, thread view, export.
- **Security:** moderator+; ensure delete logs audit.
- **UX/UI:** standard.
- **Performance:** pagination.

#### `/admin/endorsements`
- **Missing features:** bulk approve/reject, fraud detection.
- **Security:** admin+.
- **UX/UI:** standard.
- **Performance:** fine.

#### `/admin/reports` (+ `[id]`)
- **Missing features:** SLA timers, assignment, export, stats dashboard (exists stats endpoint).
- **Security:** admin+; ensure report status transitions validated.
- **UX/UI:** detail page.
- **Performance:** stats aggregation.

#### `/admin/tickets` (+ new, `[id]`)
- **Missing features:** SLA, canned responses, assignment, priority, attachments preview, internal notes.
- **Security:** moderator+; ensure only assigned/owner can reply.
- **UX/UI:** standard.
- **Performance:** fine.

#### `/admin/users` (+ `[id]`, special-roles)
- **Missing features:** advanced search/filter, bulk actions, export, activity timeline, impersonate (dangerous), password reset audit.
- **Security:** admin+; recover endpoint returns temp password (must not log); IDOR risk on `[id]` routes; ensure role changes require owner/manager.
- **UX/UI:** standard.
- **Performance:** unpaginated lists risk; pagination via AdminDataTable.

#### `/admin/admins` (+ new)
- **Missing features:** page-permission editor (exists via StaffPageAccess), MFA enrollment status, last login, session management.
- **Security:** admin+ create; role assignment must enforce hierarchy (cannot create higher/equal role); credentials endpoint sensitive.
- **UX/UI:** standard.
- **Performance:** fine.

#### `/admin/creators` (+ new, requests)
- **Missing features:** approval workflow, bulk approve, stats, payout/earnings (if any).
- **Security:** admin+.
- **UX/UI:** standard.
- **Performance:** fine.

#### `/admin/publication-requests`
- **Missing features:** bulk approve/reject, diff view, scheduling.
- **Security:** moderator+.
- **UX/UI:** standard.
- **Performance:** fine.

#### `/admin/mod-requests`
- **Missing features:** assignment, SLA, bulk.
- **Security:** moderator+.
- **UX/UI:** standard.
- **Performance:** fine.

#### `/admin/analytics`
- **Missing features:** date range, export, drill-down, real-time.
- **Security:** admin+.
- **UX/UI:** charts code-split.
- **Performance:** heavy aggregations; ensure caching.

### Tiers & Rewards

#### `/admin/tiers`, `/admin/special-roles`, `/admin/tier-history`, `/admin/rewards`
- **Missing features:** rule editor, simulation/preview, history filters, manual override audit, export.
- **Security:** admin+ writes; validate tier rules.
- **UX/UI:** standard.
- **Performance:** aggregations; ensure indexed queries.

### Social Media

#### `/admin/social`, `/admin/social/channels`, `/admin/social/telegram/*` (overview, posts, new, [id], templates, archive, templates/archive, destinations, routing)
- **Missing features:** post preview, scheduling calendar, bulk publish, retry failed, analytics per post, template variables preview.
- **Security:** manager+ for posts/templates/destinations/routing/archive; moderator+ read.
- **UX/UI:** only telegram route has `loading.tsx`; inconsistent.
- **Performance:** media uploads; pagination.

### Scheduled Publishing

#### `/admin/publish/schedule`
- **Missing features:** calendar view, conflict detection, bulk reschedule, retry.
- **Security:** manager+.
- **UX/UI:** standard.
- **Performance:** fine.

### System

#### `/admin/search`
- **Missing features:** saved searches, export, advanced filters.
- **Security:** admin+.
- **UX/UI:** standard.
- **Performance:** Meilisearch integration; ensure debounced input.

#### `/admin/api-keys`
- **Missing features:** scopes, rotation, expiry, usage stats, revoke.
- **Security:** admin+; keys hashed at rest (SHA-256) — good; role cap enforced.
- **UX/UI:** standard.
- **Performance:** fine.

#### `/admin/templates` (notification templates)
- **Missing features:** version diff, publish workflow, localization, preview with sample data.
- **Security:** manager+.
- **UX/UI:** standard.
- **Performance:** fine.

#### `/admin/notifications/send`, `/admin/notifications/analytics`, `/admin/notifications-health`, `/admin/notifications/history`
- **Missing features:** audience segmentation, scheduling, A/B, retry failed, export.
- **Security:** manager+ send; admin+ read.
- **UX/UI:** standard.
- **Performance:** export endpoints can be heavy.

#### `/admin/sessions`
- **Missing features:** revoke all, filter by user, export.
- **Security:** admin+; session invalidation increments tokenVersion.
- **UX/UI:** standard.
- **Performance:** fine.

#### `/admin/scheduler`
- **Missing features:** job history, manual trigger, pause/resume.
- **Security:** admin+; cron auth timing-safe (minor convoluted length branch).
- **UX/UI:** standard.
- **Performance:** fine.

#### `/admin/quotas`
- **Missing features:** override UI, usage charts.
- **Security:** admin+.
- **UX/UI:** standard.
- **Performance:** fine.

#### `/admin/download-settings`
- **Missing features:** validation of trusted domains, test fetch.
- **Security:** admin+.
- **UX/UI:** standard.
- **Performance:** fine.

#### `/admin/backup`
- **Missing features:** schedule, incremental, restore UI, verification, download link expiry.
- **Security:** owner-only; path traversal in `deleteBackup` (High); `pg_dump` credentials in process list.
- **UX/UI:** standard.
- **Performance:** heavy; background job.

#### `/admin/settings`
- **Missing features:** typed settings, validation, grouping, change history, rollback.
- **Security:** owner-only page but PUT allows manager+ (mismatch); arbitrary keys/groups injectable.
- **UX/UI:** standard.
- **Performance:** fine.

#### `/admin/audit`
- **Missing features:** filters, export, search, retention config.
- **Security:** owner-only.
- **UX/UI:** standard.
- **Performance:** pagination.

#### `/admin/security`
- **Missing features:** MFA enrollment UI for staff, IP ban management, session anomaly alerts.
- **Security:** owner/admin; MFA disabled by default.
- **UX/UI:** TOTP secret shown plaintext temporarily.
- **Performance:** fine.

#### `/admin/games` (+ new, `[id]/edit`)
- **Missing features:** bulk import, platform assignment, cover upload, stats.
- **Security:** moderator/admin writes.
- **UX/UI:** standard.
- **Performance:** fine.

---

## Part C — Prioritized Roadmap

Starting with the Main Dashboard Overview Page (`/admin`), then follow-up pages.

### Phase 0 — Foundation (applies to all pages)
1. Adopt `useFetch` (or add React Query) across admin pages for cache/dedupe/abort + mutation invalidation.
2. Replace native `confirm()`/`alert()` with shadcn AlertDialog; wire or remove dead topbar search/bell.
3. Add `src/app/admin/loading.tsx` and standardize page header/empty/error components.
4. Convert avatar `<img>` to `next/image` (or explicit dimensions + meaningful alt).
5. Make sortable table headers keyboard-accessible (`role="button"`, Enter/Space).
6. Standardize forms on react-hook-form + zod with consistent ARIA; add skip link + focus management.
7. Audit sanitizer allowed schemes (drop `data:` for img if unused); memoize `AdminDataTable` rows.
8. Expand CI to run full typecheck/tests/build on PRs.

### Phase 1 — Main Dashboard Overview (`/admin`) [FIRST]
- Consolidate 5 fetches; add AbortController/timeouts to all.
- Add time-range selector + trend deltas on KPI cards; drill-down links.
- Add error retry button; ensure empty states.
- Remove `console.time` from production route.
- Add unit/integration tests for `/api/admin/dashboard`.
- Security: verify no PII in payload (already OK).

### Phase 2 — High-risk security fixes
1. Fix backup filename path traversal (`src/lib/backup.ts`).
2. Enforce MFA for staff (`MFA_ENFORCED=1`) after enrollment UX.
3. Add Origin/Referer or CSRF token checks for cookie-auth state-changing endpoints.
4. Restrict `delete-image` to owner or asset owner.
5. Validate allowlisted settings keys in settings PUT; audit changes.
6. Add route-level rate limits to destructive admin mutations.
7. Tighten CSP (nonce-based) where feasible.

### Phase 3 — Page-by-page PRs (suggested order)
1. `/admin/users` (IDOR/role changes, pagination, export)
2. `/admin/mods` (ownership, bulk, versions)
3. `/admin/files` + storage delete (cross-user deletion)
4. `/admin/settings` (key allowlist)
5. `/admin/backup` (path traversal, scheduling)
6. `/admin/security` (MFA enrollment)
7. `/admin/teams` (scoping, rewards)
8. `/admin/reports` + `/admin/tickets` (SLA, assignment)
9. `/admin/comments` + `/admin/endorsements`
10. `/admin/analytics` + `/admin/notifications/*`
11. Social/telegram publishing pages
12. Remaining system pages (search, api-keys, quotas, scheduler, sessions, audit, docs, games, sections, series, ads, news, creators, admins, tiers/special-roles/tier-history/rewards, mods/sections, publication/mod requests, images/health, download-settings, publish/schedule)

### Phase 4 — Polish
- Accessibility pass (skip link, keyboard sortable headers, ARIA forms).
- Performance pass (memoization, image optimization, loading skeletons).
- Observability (audit log coverage, Sentry tags).

---

## Appendix — Counts
- Admin pages: 72 `page.tsx` under `src/app/admin`.
- Registered admin pages: 49 (`ADMIN_PAGE_GROUPS`).
- Admin API routes: 175 under `src/app/api/admin` (264 method handlers).
- Total API routes: 354 (482 method handlers).
- DB models: 95; indexes: 233; unique: 21; migrations: 14.
- Tests: 251 files. CI workflows: 1 (notifications only).

*No application code, config, or schema was modified. Secrets redacted; locations noted only.*
