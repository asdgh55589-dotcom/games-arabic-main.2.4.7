# Creator Dashboard Audit Report

**Date:** 2026-09-16
**Branch:** `main` @ `6485a2e`
**Scope:** Read-only discovery and gap analysis of the Creator Dashboard

---

## 1. Executive Summary

The Creator Dashboard is a substantial, well-structured feature built on Next.js App Router with a sidebar-based studio shell. It covers core content management (mods, comments, likes, requests, reports, news) with proper authentication and ownership checks. **However, it has a critical gap: there is no creator-facing team management functionality.** Team CRUD, member management, and invitations exist only in the admin panel. There is no `TeamInvitation` model, no invite flow, and no way for a creator to create/manage a team, invite translators, or assign team roles from the dashboard.

**Critical findings:**
- **P0:** No creator-facing team/translator/moderator management UI or API
- **P0:** No invitation system (no model, no flow, no UI)
- **P1:** No media library page (uploads exist but no browse/delete interface)
- **P1:** Settings page is read-only (profile edit redirects to global settings)
- **P2:** Dashboard home has no error/loading/empty states for the data table

---

## 2. Repository State

| Item | Value |
|------|-------|
| Branch | `main` |
| Commit | `6485a2e` |
| Latest feature | `feat: migrate avatar/banner uploads from Supabase to Cloudinary` |
| Uncommitted files | `next-env.d.ts`, backup dumps, `docs/design-home.html`, unrelated markdown |
| Working tree | Clean (only generated/backup files untracked) |

---

## 3. Route Inventory

### Creator Dashboard Routes (`/creator/(studio)/`)

| URL | File | Auth | Ownership | Status |
|-----|------|------|-----------|--------|
| `/creator` | `src/app/creator/(studio)/page.tsx` | `requireCreatorStudio` (layout) | N/A | **Complete** — section cards + chart + data table |
| `/creator/mods` | `src/app/creator/(studio)/mods/page.tsx` | creator role check | `authorId` filter | **Complete** — list with search/pagination |
| `/creator/mods/new` | `src/app/creator/(studio)/mods/new/page.tsx` | creator role check | N/A | **Complete** — full mod creation form |
| `/creator/mods/[id]/edit` | `src/app/creator/(studio)/mods/[id]/edit/page.tsx` | creator role check | `mod.authorId !== user.id` → forbidden | **Complete** — edit with ownership check |
| `/creator/stats` | `src/app/creator/(studio)/stats/page.tsx` | creator role check | `authorId` filter | **Complete** — analytics + totals + top mods |
| `/creator/requests` | `src/app/creator/(studio)/requests/page.tsx` | creator role check | N/A | **Complete** — accept/cancel/complete requests |
| `/creator/comments` | `src/app/creator/(studio)/comments/page.tsx` | creator role check | mod `authorId` check | **Complete** — moderate comments on own mods |
| `/creator/likes` | `src/app/creator/(studio)/likes/page.tsx` | creator role check | N/A | **Complete** — likes received |
| `/creator/news` | `src/app/creator/(studio)/news/page.tsx` | publisher role gate | `authorId` filter | **Complete** — publisher-only news authoring |
| `/creator/reports` | `src/app/creator/(studio)/reports/page.tsx` | creator role check | N/A | **Complete** — view reports on own mods |
| `/creator/settings` | `src/app/creator/(studio)/settings/page.tsx` | creator role check | N/A | **Partial** — read-only profile + notification settings |
| `/creator/docs` | `src/app/creator/(studio)/docs/page.tsx` | accessible to all creator roles | N/A | **Complete** — documentation |
| `/creator/suspended` | `src/app/creator/suspended/page.tsx` | None (post-redirect) | N/A | **Complete** — ban reason display |

### Creator API Routes (`/api/creator/`)

| Endpoint | Method | Auth | Ownership | Status |
|----------|--------|------|-----------|--------|
| `/api/creator/mods` | GET/POST | `requireCreatorStudio` | `authorId: user.id` | **Complete** |
| `/api/creator/mods/[id]` | GET/PATCH | `requireCreatorStudio` | `mod.authorId !== user.id` → 403 | **Complete** |
| `/api/creator/mods/[id]/workflow` | GET | `requireCreatorStudio` | `mod.authorId !== user.id` → 403 | **Complete** |
| `/api/creator/mods/[id]/versions` | GET | `requireCreatorStudio` | `mod.authorId !== user.id` → 403 | **Complete** |
| `/api/creator/mods/[id]/actions` | POST | `requireCreatorStudio` | ownership check | **Complete** |
| `/api/creator/analytics` | GET | `requireCreatorStudio` | `authorId` filter | **Complete** |
| `/api/creator/analytics/top-mods` | GET | `requireCreatorStudio` | `authorId` filter | **Complete** |
| `/api/creator/analytics/history` | GET | `requireCreatorStudio` | `authorId` filter | **Complete** |
| `/api/creator/stats` | GET | `requireCreatorStudio` | `authorId` filter | **Complete** |
| `/api/creator/comments` | GET | `requireCreatorStudio` | `authorId` filter | **Complete** |
| `/api/creator/comments/[id]` | PATCH/DELETE | `requireCreatorStudio` | `comment.mod.authorId !== user.id` → 403 | **Complete** |
| `/api/creator/comments/bulk` | POST | `requireCreatorStudio` | bulk ownership check | **Complete** |
| `/api/creator/likes` | GET | `requireCreatorStudio` | N/A | **Complete** |
| `/api/creator/news` | GET/POST | `requireCreatorStudio` | `authorId` filter | **Complete** |
| `/api/creator/news/[id]` | GET/PATCH/DELETE | `requireCreatorStudio` | `authorId` check | **Complete** |
| `/api/creator/reports` | GET | `requireCreatorStudio` | `authorId` filter | **Complete** |
| `/api/creator/requests` | GET | `requireCreatorStudio` | N/A (open requests) | **Complete** |
| `/api/creator/requests/[id]` | PATCH | `requireCreatorStudio` | ownership/action checks | **Complete** |

### Team Routes (Public + Admin)

| Endpoint | Method | Auth | Status |
|----------|--------|------|--------|
| `/api/teams` | GET | None | **Complete** — public list |
| `/api/teams/[slug]` | GET | None | **Complete** — public detail |
| `/api/teams/[slug]/follow` | GET/POST/DELETE | session | **Complete** |
| `/api/teams/[slug]/leave` | POST | session | **Complete** |
| `/api/admin/teams` | GET/POST | `requireModerator` | **Complete** |
| `/api/admin/teams/[id]` | GET/PUT/DELETE | `requireModerator` | **Complete** |
| `/api/admin/teams/[id]/members` | POST/PUT/DELETE | `requireModerator` | **Complete** |
| `/api/admin/teams/[id]/members/[memberId]/link` | PUT/DELETE | `requireModerator` | **Complete** |
| `/api/admin/teams/[id]/mods` | GET | `requireModerator` | **Complete** |
| `/api/admin/teams/[id]/dashboard` | GET | `requireModerator` | **Complete** |
| `/api/admin/teams/[id]/rewards` | GET | `requireModerator` | **Complete** |
| `/api/admin/teams/[id]/achievements` | GET | `requireModerator` | **Complete** |
| `/api/admin/teams/[id]/quality-report` | GET | `requireModerator` | **Complete** |

---

## 4. Feature Completeness Matrix

| Feature | Status | Evidence | Missing | Priority |
|---------|--------|----------|---------|----------|
| Dashboard home | **Complete** | `src/app/creator/(studio)/page.tsx` | — | — |
| Creator profile/settings | **Partial** | `src/app/creator/(studio)/settings/page.tsx` | Read-only; redirects to `/settings` for edit; no bio/social editing from dashboard | P2 |
| Content management (CRUD) | **Complete** | `src/components/creator/mods-list-client.tsx`, `mod-form.tsx` | — | — |
| Content approval workflow | **Complete** | `src/app/api/creator/mods/[id]/workflow/route.ts`, `src/app/api/creator/mods/[id]/actions/route.ts` | — | — |
| Creator requests (translation requests) | **Complete** | `src/components/creator/requests-manager.tsx` | — | — |
| Cloudinary upload | **Partial** | `src/lib/cloudinary.ts`, `src/components/creator/uppy-uploader.tsx` | Avatar/banner only; no media library browse/delete | P1 |
| Media library | **Missing** | — | No media library page; no way to browse/delete uploaded assets | P1 |
| Team management | **Missing** | — | No creator-facing team CRUD UI; no team page in dashboard | **P0** |
| Translator management | **Missing** | — | `ModTeamMember` is per-mod metadata only; no user-to-team assignment from dashboard | **P0** |
| Moderator management | **Missing** | — | No creator-facing UI to manage team moderators | **P0** |
| Invitations | **Missing** | — | No `TeamInvitation` model; no invite flow; no UI | **P0** |
| Role management (team) | **Missing** | — | Team roles managed only via admin; `TeamMembership.role` exists but no creator UI | P1 |
| Permission enforcement | **Partial** | `src/lib/permissions.ts`, `src/lib/team-permissions.ts` | Permissions defined but team permissions not enforced in creator API | P1 |
| Notifications | **Complete** | `src/views/creator-notification-settings.tsx` | — | — |
| Analytics/statistics | **Complete** | `src/components/creator/stats-client.tsx` | — | — |
| Audit logs | **Partial** | `src/lib/audit.ts` | Admin-only; no creator-visible audit log | P3 |
| Error/loading/empty states | **Partial** | `EmptyState` used in most components | Dashboard home has no error/loading/empty states for data table | P2 |
| Form validation | **Complete** | `src/lib/schemas.ts` (Zod schemas) | — | — |
| Success/error toasts | **Complete** | `useToast()` used throughout | — | — |

---

## 5. Missing Pages / Orphan Pages / Dead Links

### Missing Pages (Expected but don't exist)
- `/creator/team` or `/creator/teams` — No creator-facing team management page
- `/creator/team/[id]` — No team detail/edit page for creators
- `/creator/team/members` — No team member management page
- `/creator/team/invite` — No invitation management page
- `/creator/media` — No media library / asset management page

### Orphan Pages (Exist but unlinked from navigation)
- None identified — all dashboard pages are linked from the sidebar

### Dead Links
- None identified — all navigation targets exist

---

## 6. Team & Translator Management Gap Analysis

### Database Models — Present ✓
| Model | Status | File |
|-------|--------|------|
| `Team` | ✓ Present | `prisma/schema.prisma:604` |
| `TeamMembership` | ✓ Present | `prisma/schema.prisma:651` |
| `TeamFollow` | ✓ Present | `prisma/schema.prisma:638` |
| `TeamContactLink` | ✓ Present | `prisma/schema.prisma:667` |
| `TeamCustomTab` | ✓ Present | `prisma/schema.prisma:679` |
| `ModTeamMember` | ✓ Present (per-mod metadata) | `prisma/schema.prisma:537` |

### Missing Database Models
| Model | Status | Needed For |
|-------|--------|------------|
| `TeamInvitation` | **Missing** | Invite flow with tokens, expiry, acceptance |
| `TeamRole` | **Missing** (uses string enum on `TeamMembership.role`) | Structured role definitions with permissions |

### Creator-Facing Features — All Missing

| Feature | Status | Evidence |
|---------|--------|----------|
| Create team | **Missing** | No creator API route; admin-only via `/api/admin/teams` |
| Edit team settings | **Missing** | No creator API route |
| Add team member | **Missing** | No creator API route; admin-only |
| Remove team member | **Missing** | No creator API route |
| Change member role | **Missing** | No creator API route |
| Invite member (email/token) | **Missing** | No invitation model or flow |
| Accept invitation | **Missing** | No invitation model or flow |
| Reject invitation | **Missing** | No invitation model or flow |
| Leave team | **Partial** | `POST /api/teams/[slug]/leave` exists (public API) |
| View team (public) | **Complete** | `/teams/[slug]` page exists |
| Follow team | **Complete** | `/api/teams/[slug]/follow` exists |
| Assign translator to mod | **Partial** | `teamId` field on `Mod` model; selectable in mod form |

### Admin-Facing Features — Complete

| Feature | Status | Evidence |
|---------|--------|----------|
| Create team | **Complete** | `POST /api/admin/teams` |
| Edit team | **Complete** | `PUT /api/admin/teams/[id]` |
| Delete team | **Complete** | `DELETE /api/admin/teams/[id]` |
| Add member | **Complete** | `POST /api/admin/teams/[id]/members` |
| Edit member | **Complete** | `PUT /api/admin/teams/[id]/members` |
| Remove member | **Complete** | `DELETE /api/admin/teams/[id]/members` |
| Link phantom member | **Complete** | `PUT /api/admin/teams/[id]/members/[memberId]/link` |
| Unlink member | **Complete** | `DELETE /api/admin/teams/[id]/members/[memberId]/link` |
| View team dashboard | **Complete** | Admin team dashboard page |
| Team quality report | **Complete** | Admin API endpoint |

---

## 7. Cloudinary Gap Analysis

| Item | Status | Evidence |
|------|--------|----------|
| Configuration | ✓ | `src/lib/cloudinary.ts` — `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` |
| API secret server-side only | ✓ | No client-side usage; all in `src/lib/cloudinary.ts` |
| Upload flow | ✓ | Server-side via `uploadToCloudinary()` |
| File type validation | ✓ | Configured per upload context |
| File size limits | ✓ | Checked in upload flow |
| Circuit breaker | ✓ | 5 failures/60s → half-open after 60s |
| Retry policy | ✓ | 1 retry on transient failures |
| Usage monitoring | ✓ | `getCloudinaryUsage()` + admin health page |
| Avatar/banner uploads | ✓ | `src/app/api/users/[username]/avatar/route.ts`, `banner/route.ts` |
| Media library | **Missing** | No page to browse/delete Cloudinary assets |
| Asset deletion | **Partial** | `deleteFromCloudinary()` exists but no UI |
| Mod images | **Different system** | Mod images use FreeImage, not Cloudinary (by design) |
| Quota enforcement | **Partial** | `checkAvatarQuota()` exists but not wired into routes (per code comment) |

---

## 8. Approval / Request Gap Analysis

### Creator Request Flow (Become Creator)

| Item | Status | Evidence |
|------|--------|----------|
| Apply page | ✓ | `/become-creator/apply` |
| Status page | ✓ | `/become-creator/status` |
| Apply API | ✓ | `src/app/api/creator-requests/route.ts` |
| Admin review | ✓ | `src/app/api/admin/creator-requests/[id]/route.ts` |
| Approval logic | ✓ | `src/lib/creator-requests.ts` — `approveCreatorRequest()` |
| Rejection logic | ✓ | `src/lib/creator-requests.ts` — `rejectCreatorRequest()` |
| Role assignment on approval | ✓ | `roleForTrack()` maps track → role |
| Session invalidation on approval | ✓ | `invalidateUserSessions()` |
| Email notification | ✓ | `sendCreatorApprovalEmail()` |
| In-app notification | ✓ | Creates `Notification` record |
| Bulk admin actions | ✓ | `src/app/api/admin/creator-requests/bulk/route.ts` |
| Tests | ✓ | `creator-phase4-*.test.ts` (6 test files) |

### Mod Request Flow (Translation Requests)

| Item | Status | Evidence |
|------|--------|----------|
| Request creation | ✓ | Public API + dashboard |
| Request listing | ✓ | `src/components/creator/requests-manager.tsx` |
| Accept request | ✓ | `PATCH /api/creator/requests/[id]` with atomic claim |
| Complete request | ✓ | With mod linking |
| Cancel request | ✓ | With ownership check |
| Boost request | ✓ | With spam guard (1/hour/user/request) |
| IDOR protection | ✓ | Tested in `actions.test.ts` |
| Notifications | ✓ | In-app notifications for accept/complete |

---

## 9. Design & UX Issues

| Page/Component | Issue | Severity | Evidence | Fix |
|----------------|-------|----------|----------|-----|
| Dashboard home | No error state when API fails | Medium | `src/app/creator/(studio)/page.tsx:51` — empty catch | Add error UI |
| Dashboard home | No loading skeleton | Medium | `src/app/creator/(studio)/page.tsx` — no loading indicator | Add skeleton |
| Dashboard home | No empty state for new creators | Medium | `src/components/creator-dashboard/data-table.tsx` | Add empty state |
| Settings page | Read-only profile section | Medium | `src/app/creator/(studio)/settings/page.tsx:55` — link to global `/settings` | Inline edit |
| Settings page | No bio/social media editing | Medium | Only shows bio, website, links to global settings | Add inline edit |
| Mod form | Excessive `any` types | Low | `src/components/creator/mod-form.tsx:73-268` — 30+ `any` casts | Type properly |
| Sidebar | Missing team management link | **High** | `src/components/creator-dashboard/app-sidebar.tsx` | Add team link |
| News page | Emoji in heading | Low | `src/app/creator/(studio)/requests/page.tsx:34` — emoji in h1 | Remove emoji |
| Requests page | Emoji in heading | Low | `src/app/creator/(studio)/requests/page.tsx:34` | Remove emoji |
| Dashboard home | Status only shows PUBLISHED vs IN_PROGRESS | Low | `src/app/creator/(studio)/page.tsx:30` — binary status | Show all statuses |
| RTL layout | Studio shell uses `dir="rtl"` implicitly | OK | Global `<html dir="rtl">` | Verified correct |
| Mobile responsive | Most pages have mobile variants | OK | `*-mobile.tsx` files exist | Good |

---

## 10. Architecture & Code Quality Issues

| Area | Current State | Problem | Recommended Refactor | Priority |
|------|---------------|---------|---------------------|----------|
| Dashboard organization | Feature-based (`creator/`, `creator-dashboard/`) | Well organized | No refactor needed | — |
| Server actions vs API routes | API routes only | No server actions used | Consider server actions for mutations | P3 |
| Prisma calls | Centralized via `src/lib/db.ts` | Good | No refactor needed | — |
| Types | Prisma-generated types used | Good | No refactor needed | — |
| Validation schemas | Centralized in `src/lib/schemas.ts` | Good | No refactor needed | — |
| Reusable components | shadcn/ui + `src/components/ui/` | Good | No refactor needed | — |
| Large components | `src/components/creator/mod-form.tsx` (31KB) | Complex, 30+ `any` casts | Break into smaller typed sub-components | P2 |
| Large components | `src/views/settings.tsx` (76KB) | Very large | Break into sections | P2 |
| Empty catch blocks | Multiple in `src/components/creator/` | Errors silently swallowed | Log or show user-facing error | P2 |
| Data fetching pattern | Client-side `fetch()` + `useEffect` | Inconsistent with server components | Consider server-side fetching where possible | P3 |
| `any` types | 30+ in `mod-form.tsx` | Type safety reduced | Create proper interfaces | P2 |
| Raw SQL | `src/app/api/admin/reports/stats/route.ts` | Uses `$queryRaw` (parameterized) | Low risk but document | P3 |
| Environment variables | No validation schema | Missing vars cause runtime errors | Add env validation (e.g., `@t3-oss/env-nextjs`) | P3 |

---

## 11. Security Findings

| # | Severity | Finding | Evidence | Exploit Scenario | Recommended Fix |
|---|----------|---------|----------|-----------------|-----------------|
| S1 | **Medium** | Team management API only protected by `requireModerator` — no ownership check on team ID | `src/app/api/admin/teams/[id]/members/route.ts:16` | A moderator could add members to any team, not just teams they own/lead | Add `team.ownerId` check or team-scoped permissions |
| S2 | **Medium** | No creator-facing team API means no ownership enforcement exists for team management | Missing `/api/creator/teams/*` routes | N/A (feature missing) | Implement with proper ownership checks |
| S3 | **Low** | `console.error` used in production API routes | Multiple files in `src/app/api/` | Information leakage in logs | Use structured logger only |
| S4 | **Low** | Dashboard home page is `'use client'` — all data fetched client-side | `src/app/creator/(studio)/page.tsx:1` | Data visible in network tab (not secret, but less ideal) | Consider SSR for initial data |
| S5 | **Info** | `dangerouslySetInnerHTML` used for JSON-LD | `src/app/mod/[slug]/page.tsx:106`, etc. | Low risk — only `JSON.stringify()` of computed objects | No action needed (safe pattern) |
| S6 | **Info** | Raw SQL in admin reports | `src/app/api/admin/reports/stats/route.ts:83` | Parameterized via template literals — safe | No action needed |
| S7 | **Info** | Sanitization implemented | `src/lib/sanitize.ts` — `sanitizeUrl()`, `sanitizeHTML()` | Good defense-in-depth | No action needed |
| S8 | **Info** | Rate limiting on creator actions | `rateLimitMiddleware` in creator API routes | Good — 10 edits/hour, 5 creates/hour | No action needed |
| S9 | **Info** | IDOR tests exist | `src/app/api/creator/requests/__tests__/actions.test.ts` | Good coverage of accept/boost/cancel IDOR | No action needed |

### Authorization Checks Summary

| Check | Present | Evidence |
|-------|---------|----------|
| Authentication (`requireCreatorStudio`) | ✓ All creator API routes | Every route calls `requireCreatorStudio(req)` |
| Role check (creator+) | ✓ All dashboard pages | Layout + page-level role checks |
| Ownership (`authorId` check) | ✓ All mod/comment/news routes | `mod.authorId !== user.id` → 403 |
| Rate limiting | ✓ Creator mutations | `rateLimitMiddleware` on create/edit |
| Input validation | ✓ All mutating routes | Zod schemas via `CreateModSchema` |
| Team ownership | **Missing** | No creator team API exists |
| Invitation authorization | **Missing** | No invitation system exists |

---

## 12. Test Coverage Gaps

### Test Files Found (88 total)

**Creator-specific tests:**
| Test File | Covers |
|-----------|--------|
| `creator-studio-access.test.ts` | Studio access control |
| `creator-mods-route.test.ts` | Mods CRUD route |
| `creator-comments-actions.test.ts` | Comment moderation |
| `creator-reports.test.ts` | Reports |
| `creator-likes.test.ts` | Likes |
| `creator-news.test.ts` | News authoring |
| `creator-waveb-guards.test.ts` | Wave B security guards |
| `creator-advanced-analytics.test.ts` | Analytics |
| `creator-comment-clicks.test.ts` | Comment click tracking |
| `creator-crop-upload.test.ts` | Crop upload |
| `creator-phase1-fix*.test.ts` | Phase 1 fixes (5 files) |
| `creator-phase4-*.test.ts` | Phase 4 features (6 files) |
| `creator-task7-cleanup.test.ts` | Cleanup |
| `creator-become-creator-cleanup.test.ts` | Apply flow cleanup |

**Request tests:**
| Test File | Covers |
|-----------|--------|
| `src/app/api/creator/requests/__tests__/actions.test.ts` | Accept/boost/cancel IDOR + spam guards |
| `src/app/api/creator/requests/__tests__/pagination.test.ts` | Request pagination |
| `src/app/api/creator/stats/__tests__/stats.test.ts` | Stats endpoint |

### Missing Test Coverage

| Feature | Status | Priority |
|---------|--------|----------|
| Team management (creator) | **No tests** (feature missing) | P0 |
| Invitation flow | **No tests** (feature missing) | P0 |
| Cloudinary avatar upload | `avatar-banner-cloudinary.test.ts` exists | — |
| Cloudinary cleanup | `cloudinary-cleanup.test.ts` exists | — |
| Mod form validation | No client-side form tests | P2 |
| Dashboard home rendering | No rendering tests | P2 |
| Auth ownership checks | Partial (request IDOR tests) | P1 |
| Settings page | No tests | P2 |
| Notification preferences | No tests for creator notification settings | P2 |

---

## 13. Database / Prisma Gaps

### Models Present vs Dashboard Exposure

| Model | In Schema | Exposed in Dashboard | Notes |
|-------|-----------|---------------------|-------|
| `User` | ✓ | ✓ (profile, settings) | — |
| `Mod` | ✓ | ✓ (full CRUD) | — |
| `ModFile` | ✓ | ✓ (via mod form) | — |
| `ModVersion` | ✓ | ✓ (versions page) | — |
| `ModTeamMember` | ✓ | ✓ (per-mod metadata in form) | Not team membership |
| `ModComment` | ✓ | ✓ (comments manager) | — |
| `ModRequest` | ✓ | ✓ (requests manager) | — |
| `Team` | ✓ | **Partial** — public read only | No creator CRUD |
| `TeamMembership` | ✓ | **Partial** — public read only | No creator management |
| `TeamFollow` | ✓ | ✓ (follow/unfollow) | — |
| `TeamContactLink` | ✓ | **Partial** — public read only | No creator management |
| `TeamCustomTab` | ✓ | **Partial** — public read only | No creator management |
| `CreatorRequest` | ✓ | ✓ (apply/status pages) | — |
| `News` | ✓ | ✓ (news authoring) | — |
| `Notification` | ✓ | ✓ (notification settings) | — |
| `NotificationPreference` | ✓ | ✓ (notification settings) | — |
| `AuditLog` | ✓ | **Admin only** | No creator-visible audit log |
| `Report` | ✓ | ✓ (reports page) | — |
| `WorkflowEntry` | ✓ | ✓ (workflow history) | — |

### Missing Models

| Model | Needed For |
|-------|------------|
| `TeamInvitation` | Invitation tokens, expiry, acceptance tracking |
| `TeamRole` (optional) | Structured team role definitions with granular permissions |
| `MediaAsset` (optional) | Track uploaded assets for media library |

---

## 14. Prioritized Action Plan

### P0 — Critical (Security / Core Flow Gaps)

| # | Item | Description | Est. Effort |
|---|------|-------------|-------------|
| 1 | **Creator team management page** | Create `/creator/team` page with team CRUD, member list, role management | Large (3-5 days) |
| 2 | **Creator team API routes** | Implement `/api/creator/teams/*` with ownership checks (team ownerId = creator) | Large (2-3 days) |
| 3 | **Team invitation system** | `TeamInvitation` model + invite/accept/reject API + UI | Large (3-5 days) |
| 4 | **Team member management UI** | Add/remove/change-role UI for team owners in dashboard | Medium (2 days) |

### P1 — High (Incomplete Features)

| # | Item | Description | Est. Effort |
|---|------|-------------|-------------|
| 5 | **Media library page** | Browse/delete uploaded assets (Cloudinary for avatars, FreeImage for mods) | Medium (2 days) |
| 6 | **Settings page edit capability** | Inline bio/social media editing in creator settings | Small (1 day) |
| 7 | **Team permissions in creator API** | Enforce `team-permissions.ts` in creator-facing routes | Small (1 day) |
| 8 | **Dashboard sidebar update** | Add team management link to creator sidebar | Small (0.5 day) |

### P2 — Medium (UX Gaps)

| # | Item | Description | Est. Effort |
|---|------|-------------|-------------|
| 9 | **Dashboard home error/loading/empty states** | Add loading skeleton, error UI, and empty state for new creators | Small (1 day) |
| 10 | **Mod form type safety** | Replace 30+ `any` casts in `mod-form.tsx` with proper types | Medium (1 day) |
| 11 | **Dashboard home status display** | Show all workflow statuses, not just PUBLISHED vs IN_PROGRESS | Small (0.5 day) |
| 12 | **Empty catch blocks** | Add error logging or user-facing error messages in `catch {}` blocks | Small (1 day) |

### P3 — Low (Polish)

| # | Item | Description | Est. Effort |
|---|------|-------------|-------------|
| 13 | **Environment variable validation** | Add runtime env validation (e.g., `@t3-oss/env-nextjs`) | Small (0.5 day) |
| 14 | **Creator-visible audit log** | Show mod change history to creators | Small (1 day) |
| 15 | **Settings page refactoring** | Break `settings.tsx` (76KB) into sections | Medium (1 day) |
| 16 | **Console.error cleanup** | Replace `console.error` with structured logger in API routes | Small (0.5 day) |

---

## 15. Open Product Questions

1. **Team ownership model:** Should a creator own exactly one team, or can they own multiple? The `Team.ownerId` field exists but has no uniqueness constraint.

2. **Invitation scope:** Should invitations be email-based (requires email service integration) or link-based (token in URL)? The project already has email via Emitlo.

3. **Team role granularity:** Should `TeamMembership.role` be extended beyond the current `leader | member | guest | tester` to include `translator`, `moderator`, `admin`? The `ModTeamMember.role` field is separate and per-mod.

4. **Moderator management:** Should creators be able to assign "moderator" roles within their team (content moderation), or should this remain an admin-only function?

5. **Media library scope:** Should the media library cover both Cloudinary (avatars) and FreeImage (mod images), or should it be scoped to one system?

6. **Quota enforcement:** `checkAvatarQuota()` exists but is noted as "not wired into routes yet" in the Cloudinary module. When should this be enforced?

7. **Team creation approval:** Should team creation require admin approval (like creator requests), or should any creator be able to create a team immediately?

8. **Notification preferences:** The creator notification settings UI exists but the `CreatorNotificationSettings` component is only 377 bytes — is this fully functional or a stub?

---

## Appendix A: Key File Paths

### Dashboard Core
- Layout: `src/app/creator/(studio)/layout.tsx`
- Home: `src/app/creator/(studio)/page.tsx`
- Sidebar: `src/components/creator-dashboard/app-sidebar.tsx`
- Studio shell: `src/components/creator-dashboard/studio-shell.tsx`

### Creator Components
- `src/components/creator/mods-list-client.tsx` — Mod list with search/filter/pagination
- `src/components/creator/mod-form.tsx` — Mod create/edit form (31KB)
- `src/components/creator/stats-client.tsx` — Statistics page
- `src/components/creator/requests-manager.tsx` — Translation requests
- `src/components/creator/comments-manager.tsx` — Comment moderation
- `src/components/creator/likes-client.tsx` — Likes received
- `src/components/creator/reports-client.tsx` — Reports
- `src/components/creator/news-client.tsx` — News authoring
- `src/components/creator/uppy-uploader.tsx` — File upload component

### Auth & Permissions
- `src/lib/auth.ts` — Authentication (576 lines)
- `src/lib/permissions.ts` — Permission definitions
- `src/lib/roles.ts` — Role hierarchy
- `src/lib/team-permissions.ts` — Team-level permissions
- `src/lib/team-members.ts` — Team member helpers

### Database
- `prisma/schema.prisma` — Schema (53 models)
- `src/lib/db.ts` — Prisma client
- `src/lib/cloudinary.ts` — Cloudinary integration (558 lines)

### Tests
- `src/__tests__/creator-*.test.ts` — 16 creator test files
- `src/app/api/creator/requests/__tests__/` — 2 request test files
- `src/app/api/creator/stats/__tests__/` — 1 stats test file
