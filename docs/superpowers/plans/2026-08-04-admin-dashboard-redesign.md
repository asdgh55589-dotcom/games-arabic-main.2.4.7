# Admin Dashboard Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform `/admin` into a cinematic operations control center with clearer hierarchy, better responsiveness, reduced request overhead, and modern moderation workflows.

**Architecture:** Keep the current App Router structure but redesign the dashboard into modular sections with distinct hierarchy. Consolidate repeated admin fetches into aggregate APIs where possible and improve sidebar/navigation density without changing existing permissions or routes.

**Tech Stack:** Next.js 16, React 19, Tailwind CSS 4, Prisma 6, Supabase Auth, App Router

## Global Constraints

- Preserve existing admin routes and permissions.
- Maintain RTL layout.
- Do not introduce heavy animation libraries.
- Keep dark-mode-first visual language.
- Avoid raw hex duplication inside components.
- Preserve current API contracts unless explicitly replaced.

---

### Task 1: Redesign Admin Shell Layout

**Files:**
- Modify: `src/app/admin/layout.tsx`
- Modify: `src/app/globals.css`

**Interfaces:**
- Produces:
  - categorized admin sidebar
  - improved spacing system
  - cinematic admin shell

- [ ] Increase sidebar width and improve spacing rhythm.
- [ ] Add grouped navigation sections:
  - المحتوى
  - المجتمع
  - الإشراف
  - النظام
- [ ] Add active route glow/indicator.
- [ ] Add responsive collapse behavior for smaller screens.
- [ ] Replace flat background with layered dark surfaces.
- [ ] Verify no horizontal overflow at 320px width.

---

### Task 2: Rebuild Dashboard Hero Area

**Files:**
- Modify: `src/app/admin/page.tsx`

**Interfaces:**
- Produces:
  - cinematic dashboard hero
  - primary metrics row
  - quick operations zone

- [ ] Replace the current top section with a wide hero panel.
- [ ] Add primary operational metrics:
  - التعريبات
  - المستخدمون
  - التحميلات
  - البلاغات
- [ ] Add hierarchy between critical and secondary stats.
- [ ] Add system status chip:
  - DB
  - uploads
  - moderation queue
- [ ] Add larger quick-action controls.
- [ ] Reduce repeated visual card styling.

---

### Task 3: Improve Admin Activity Sections

**Files:**
- Modify: `src/app/admin/page.tsx`

**Interfaces:**
- Produces:
  - modern activity streams
  - moderation-first dashboard layout

- [ ] Convert "آخر النشاطات" into structured timeline cards.
- [ ] Improve comment readability.
- [ ] Add severity/status indicators.
- [ ] Improve visual density for moderators.
- [ ] Add hover states with cleaner contrast.
- [ ] Ensure cards scale correctly on tablet widths.

---

### Task 4: Add Dashboard Skeletons & Loading States

**Files:**
- Modify: `src/app/admin/page.tsx`
- Create: `src/components/admin/admin-dashboard-skeleton.tsx`

**Interfaces:**
- Produces:
  - dashboard loading skeleton

- [ ] Replace spinner-only loading state.
- [ ] Add skeleton cards for stats.
- [ ] Add skeleton activity rows.
- [ ] Preserve layout stability during loading.
- [ ] Verify CLS remains visually stable.

---

### Task 5: Optimize Admin Data Fetching

**Files:**
- Modify: `src/app/api/admin/dashboard/route.ts`
- Modify: `src/app/admin/page.tsx`

**Interfaces:**
- Produces:
  - reduced admin latency
  - consolidated dashboard queries

- [ ] Add query timing instrumentation.
- [ ] Parallelize independent Prisma queries.
- [ ] Reduce unused payload fields.
- [ ] Add lightweight cache headers where safe.
- [ ] Prevent duplicate dashboard fetches.

---

### Task 6: Improve Global Admin Visual Language

**Files:**
- Modify:
  - `src/app/admin/users/page.tsx`
  - `src/app/admin/mods/page.tsx`
  - `src/app/admin/comments/page.tsx`
  - `src/app/admin/reports/page.tsx`

**Interfaces:**
- Produces:
  - unified admin visual hierarchy

- [ ] Normalize table/card spacing.
- [ ] Improve typography hierarchy.
- [ ] Add consistent section headers.
- [ ] Reduce excessive saturated colors.
- [ ] Improve empty states.
- [ ] Improve destructive action styling.

---

### Task 7: Responsive Admin UX Pass

**Files:**
- Modify:
  - `src/app/admin/layout.tsx`
  - `src/app/admin/page.tsx`

**Interfaces:**
- Produces:
  - responsive admin experience

- [ ] Improve mobile admin navigation.
- [ ] Ensure cards stack correctly on tablets.
- [ ] Prevent table overflow.
- [ ] Add scroll containment where needed.
- [ ] Improve touch targets.

---

### Task 8: Verification Pass

**Files:**
- No new files

**Interfaces:**
- Produces:
  - verified stable admin redesign

- [ ] Verify all admin routes still work.
- [ ] Verify sidebar navigation.
- [ ] Verify dashboard metrics rendering.
- [ ] Verify loading states.
- [ ] Verify responsive layout.
- [ ] Verify no broken permissions.
- [ ] Verify no console errors.
