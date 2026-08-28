# Implementation Plan — Teams Admin Dashboard

Spec: `docs/superpowers/specs/2026-08-09-teams-admin-dashboard-design.md`

## Task 1: API — teams list & detail (followers count)
- `src/app/api/admin/teams/route.ts` GET: add `follows: true` to `_count.select`.
- `src/app/api/admin/teams/[id]/route.ts` GET: add `follows: true` to `_count.select`.

## Task 2: API — contact links + owner in PUT team
- `src/app/api/admin/teams/[id]/route.ts` PUT: accept `contactLinks[]` and `ownerId`.
- Inside `db.$transaction`: `teamContactLink.deleteMany({teamId})` then create each link with non-empty url (`type`, `label`, `url`, `order ?? i`).
- Sync legacy `websiteUrl`/`discordUrl` from matching contact link when present.
- Pattern reference: `src/app/api/admin/mods/[id]/route.ts:160-175`.

## Task 3: API — members PUT + POST bio/userId
- `src/app/api/admin/teams/[id]/members/route.ts`:
  - POST: accept `bio`, `userId` (guard unique `[teamId, userId]` — skip link if duplicate).
  - New PUT: `{ memberId, name?, role?, avatarUrl?, bio?, userId? }` → `updateMany({id: memberId, teamId})` returning updated member.

## Task 4: API — mods link/unlink
- New `src/app/api/admin/teams/[id]/mods/route.ts` PUT: `{ linkModId? , unlinkModId? }` → `db.mod.update({teamId})`; recount `team.modCount`.

## Task 5: UI — teams list followers column
- `src/app/admin/teams/page.tsx`: add `_count.follows` to interface + column.

## Task 6: UI — edit page tabs shell + components
- `src/components/admin/teams/team-general-tab.tsx` — name, description, logo, banner, order, flags, owner select.
- `src/components/admin/teams/team-contact-tab.tsx` — dynamic rows (type select 8 types from `CONTACT_COLORS` keys, label, url, remove, add).
- `src/components/admin/teams/team-members-tab.tsx` — list with inline edit (name, role from `ROLE_LABELS`, avatarUrl, bio), add form with bio, delete.
- `src/components/admin/teams/team-mods-tab.tsx` — linked mods with unlink + select of unlinked mods to link.
- `src/app/admin/teams/[id]/edit/page.tsx` — tab shell, data fetching, save orchestration.

## Task 7: Verify
- `npx tsc --noEmit` (ignore pre-existing `route.ts:100` error)
- `bun run lint`

---

## Task 8: UI — Mods tab: category-first search flow
- **المشكلة الحالية:** قائمة التعريبات غير المرتبطة تظهر كـ select واحد بدون تصنيف.
- **المطلوب:**
  1. عند فتح نافذة ربط تعريب، تظهر أولاً **قائمة الأقسام** (categories/sections).
  2. بعد اختيار القسم، تظهر **نافذة بحث** للبحث عن التعريب المعين داخل القسم ده.
  3. بعد إيجاد التعريب المطلوب، يتم ربطه بالفريق.
- **الملفات:** `src/components/admin/teams/team-mods-tab.tsx`

## Task 9: UI — Description field: Markdown editor
- **المشكلة الحالية:** حقل الوصف (description) هو textarea عادي بدون تنسيق.
- **المطلوب:** إضافة محرر Markdown بسيط يدعم:
  - خط عريض (**bold**)
  - خط كبير (عناوين #, ##, ###)
  - مائل (*italic*)
  - قوائم (- item)
  - أي تنسيقات markdown أساسية أخرى
- **الملفات:** `src/components/admin/teams/team-general-tab.tsx`

## Task 10: إدارة تبويبات صفحة الفريق العامة (التي يراها الزائر)
- **النطاق مؤكّد:** تبويبات صفحة الفريق العامة — نظرة عامة / أعضاء الفريق / تعريبات الفريق / إحصائيات الفريق (`TEAM_TABS` في `src/lib/team-constants.tsx`، تُعرض في `src/views/team-detail.tsx`).
- **المطلوب (لكل فريق، يُدار من الأدمن):**
  1. **إظهار/إخفاء** أي تبويب من الأربعة الأساسيين لكل فريق (مثلاً فريق يخفي "إحصائيات الفريق").
  2. **إضافة تبويب مخصص جديد** للفريق: عنوان + محتوى.
- **تأثير على قاعدة البيانات:** يلزم إضافة تخزين للإعدادات لكل فريق، مثلاً:
  - `Team.hiddenTabs String @default("")` (قائمة مفصولة بفواصل) أو JSON
  - موديل جديد `TeamCustomTab { id, teamId, title, content, order }`
  - ثم `prisma db push` على Neon والمحلية.
- **API:** `GET /api/teams/[slug]` يرجع `hiddenTabs` + `customTabs`؛ `PUT /api/admin/teams/[id]` يقبل تحديثهم.
- **الواجهة الأمامية:** `team-detail.tsx` يفلتر `TEAM_TABS` حسب `hiddenTabs` ويضيف التبويبات المخصصة؛ الأدمن يحصل على قسم إدارة التبويبات في صفحة تعديل الفريق.
- **ملاحظة تنفيذ:** يجب مراجعة الـ spec قبل البدء (قاعدة AGENTS.md: اسأل لو غير متأكد).
