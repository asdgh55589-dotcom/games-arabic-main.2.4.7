# إعادة بناء صفحة الملف الشخصي — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the user profile page with enhanced features: online status, followers/following, XP level system, mod filters, activity improvements, and settings.

**Architecture:** Client-side page using existing API routes. All data fetched via `/api/users/[username]/profile`, `/api/users/[username]/activity`, `/api/users/[username]/badges`. New tabs for XP and Settings.

**Tech Stack:** Next.js 16, React 19, Tailwind CSS, Lucide icons, existing UI components

## Global Constraints

- Arabic-first (RTL), all UI strings in Arabic
- Dark theme: `#121212` background, `#1a1a1a` cards
- Accent color from user profile (default: `#ff8c00`)
- Use existing UI components: `@/components/ui/button`, `@/components/ui/avatar`, `@/components/ui/badge`, `@/components/ui/tabs`
- Icons from `lucide-react` (no emojis)
- Prisma client imported as `db` from `@/lib/db`
- Auth helpers: `requireAuth()`, `requireAdmin()`

---

## File Structure

```
src/views/profile.tsx                 — MODIFY: Complete rebuild
src/app/api/users/[username]/profile/route.ts — MODIFY: Add followers/following counts
src/app/api/users/[username]/activity/route.ts — MODIFY: Add more activity types
src/components/profile/
  profile-stats.tsx                  — NEW: Stats cards component
  profile-xp-bar.tsx                 — NEW: XP progress bar component
  profile-badges-grid.tsx            — NEW: Badges grid component
  profile-mods-filter.tsx            — NEW: Mods with filter tabs
  profile-activity-feed.tsx          — NEW: Activity feed component
  profile-settings.tsx               — NEW: Settings tab component
  profile-social-links.tsx           — NEW: Social links component
```

---

### Task 1: Profile API Enhancement

**Files:**
- Modify: `src/app/api/users/[username]/profile/route.ts`

**What to add:**
- `followersCount` and `followingCount` to the profile response
- `onlineStatus` (computed from `lastLoginAt` — within 5 min = online)
- `xpLevel` and `xpProgress` (computed from stats)

**Commit:** `git commit -m "feat(profile): enhance profile API with followers, online status, and XP data"`

---

### Task 2: Activity API Enhancement

**Files:**
- Modify: `src/app/api/users/[username]/activity/route.ts`

**What to add:**
- `modEdits` — recent mod edits by this user
- `endorsements` — recent endorsements given/received
- `downloads` — recent download activity

**Commit:** `git commit -m "feat(profile): enhance activity API with mod edits, endorsements, downloads"`

---

### Task 3: Profile Stats Component

**Files:**
- Create: `src/components/profile/profile-stats.tsx`

**What to build:**
- 8 stat cards in 2 rows of 4
- Row 1: التعريبات, التحميلات, التأييدات, المشاهدات
- Row 2: المتابعين, المتابَعين, نسبة الإنجاز, المستوى
- Each card: icon + label + value
- XP progress bar in the last card

**Commit:** `git commit -m "feat(profile): add profile stats component with 8 cards"`

---

### Task 4: Profile Badges Grid Component

**Files:**
- Create: `src/components/profile/profile-badges-grid.tsx`

**What to build:**
- Grid of badge cards (4 columns on desktop, 2 on mobile)
- Each badge: icon + name + description + "مكتسبة" badge if earned
- Earned badges: colored with accent ring
- Unearned: grayscale + opacity

**Commit:** `git commit -m "feat(profile): add profile badges grid component"`

---

### Task 5: Profile XP Bar Component

**Files:**
- Create: `src/components/profile/profile-xp-bar.tsx`

**What to build:**
- Level display: "المستوى 5 — محترف ⭐"
- Progress bar: ████████░░ 750/1000 XP
- XP breakdown: "+10 XP من التحميلات | +5 XP من التعليقات"
- Level tiers: مبتدئ (0-100), متعلم (101-300), ماهر (301-600), محترف (601-1000), خبير (1001+)

**Commit:** `git commit -m "feat(profile): add XP level bar component with tier system"`

---

### Task 6: Profile Mods Filter Component

**Files:**
- Create: `src/components/profile/profile-mods-filter.tsx`

**What to build:**
- Filter tabs: [الكل] [الأحدث] [الأكثر تحميلاً] [قيد المراجعة] [مسودة]
- Mod grid (reuse existing `ModCard` component)
- Loading skeleton while fetching

**Commit:** `git commit -m "feat(profile): add mods filter component with 5 filter options"`

---

### Task 7: Profile Activity Feed Component

**Files:**
- Create: `src/components/profile/profile-activity-feed.tsx`

**What to build:**
- Activity items with icons:
  - تعديل تعريب → Edit icon
  - تعليق → MessageCircle icon
  - إعجاب → ThumbsUp icon
  - تحميل → Download icon
- Each item: icon + text + relative time
- Link to relevant mod

**Commit:** `git commit -m "feat(profile): add activity feed component with 4 activity types"`

---

### Task 8: Profile Settings Component

**Files:**
- Create: `src/components/profile/profile-settings.tsx`

**What to build:**
- Settings sections (accordion style):
  1. المعلومات الشخصية (bio, name)
  2. الروابط الاجتماعية (website, twitter, github, discord)
  3. إعدادات الإشعارات (email, comments, likes toggles)
  4. الخصوصية (profile visibility, hide join date)
  5. تخصيص المظهر (accent color picker)
  6. الحساب (linked accounts, disconnect button)
- Save button for each section

**Commit:** `git commit -m "feat(profile): add settings component with 6 setting sections"`

---

### Task 9: Profile Social Links Component

**Files:**
- Create: `src/components/profile/profile-social-links.tsx`

**What to build:**
- Row of social link icons (Globe, Twitter, Github, Discord)
- Each: icon + hover effect + external link
- Only show if URL exists

**Commit:** `git commit -m "feat(profile): add social links component"`

---

### Task 10: Rebuild Main Profile Page

**Files:**
- Modify: `src/views/profile.tsx`

**What to do:**
- Import all new components
- Rebuild the page layout:
  1. Banner section
  2. User info section (avatar, name, status, role badges)
  3. Social links
  4. Action buttons (edit/message/follow)
  5. Stats section (8 cards)
  6. Tabs (6 tabs: about, badges, xp, mods, activity, settings)
- Each tab renders the corresponding component
- Keep existing EditProfileModal for quick edits
- Add Settings tab for full settings

**Commit:** `git commit -m "feat(profile): rebuild profile page with all new components"`

---

### Task 11: Final Verification

**Files:** None (verification only)

- [ ] **Step 1: TypeScript check**
```bash
npx tsc --noEmit
```
Expected: No errors.

- [ ] **Step 2: Verify all new files exist**
```bash
ls -la src/components/profile/
```
Expected: 7 new component files.

- [ ] **Step 3: Final commit summary**
```bash
git log --oneline -12
```
Expected: 11 new commits for profile rebuild.
