# Profile Stats Redesign + Translator Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign profile stats to horizontal compact cards and add translator mode with extra stats + upgrade flow.

**Architecture:** Modify `profile-stats.tsx` to render horizontal cards instead of grid squares. Add `isTranslator` prop to control showing translator-specific stats. Update profile API to return `firstModDate` and `rating`. Add upgrade button in settings.

**Tech Stack:** Next.js 16, React 19, Tailwind CSS, Prisma 6, PostgreSQL

## Global Constraints

- RTL layout (Arabic-first)
- Dark theme: `#121212` background, `#1a1a1a` cards, `#333` borders
- Accent color from user profile (default `#ff8c00`)
- Prisma client imported as `db` from `@/lib/db`
- `formatNumber()` from `@/lib/format`

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `src/components/profile/profile-stats.tsx` | Modify | Redesign to horizontal cards, add translator props |
| `src/app/api/users/[username]/profile/route.ts` | Modify | Add `isTranslator`, `firstModDate`, `rating` to response |
| `src/views/profile.tsx` | Modify | Pass translator data to ProfileStats |
| `src/components/profile/profile-settings.tsx` | Modify | Add "ترقية إلى معرب" button section |

---

### Task 1: Redesign profile-stats.tsx to Horizontal Compact Cards

**Files:**
- Modify: `src/components/profile/profile-stats.tsx` (full rewrite)

**Interfaces:**
- Consumes: `stats` (same shape), `xp` (same shape), `accent` (string)
- Produces: Same `<ProfileStats>` component with new props added

- [ ] **Step 1: Rewrite profile-stats.tsx**

```tsx
'use client'

import { Package, Download, ThumbsUp, Eye, Users, UserPlus, Star, Award, Calendar, BarChart3 } from 'lucide-react'
import { formatNumber, formatDate } from '@/lib/format'

interface ProfileStatsProps {
  stats: {
    mods: number
    totalDownloads: number
    totalEndorsements: number
    totalViews: number
    followersCount: number
    followingCount: number
  }
  xp?: {
    level: number
    name: string
    points: number
    progress: number
  }
  isTranslator?: boolean
  translatorStats?: {
    badgesCount: number
    firstModDate: string | null
    rating: number
  }
  accent: string
}

export function ProfileStats({ stats, xp, isTranslator, translatorStats, accent }: ProfileStatsProps) {
  return (
    <div className="rounded-lg bg-[#1a1a1a]">
      {/* Regular user stats */}
      <HorizontalStatCard icon={<Package className="h-4 w-4" />} label="التعريبات" value={formatNumber(stats.mods)} accent={accent} border />
      <HorizontalStatCard icon={<Download className="h-4 w-4" />} label="إجمالي التحميلات" value={formatNumber(stats.totalDownloads)} accent={accent} border />
      <HorizontalStatCard icon={<ThumbsUp className="h-4 w-4" />} label="التأييدات" value={formatNumber(stats.totalEndorsements)} accent={accent} border />
      <HorizontalStatCard icon={<Eye className="h-4 w-4" />} label="المشاهدات" value={formatNumber(stats.totalViews)} accent={accent} border />
      <HorizontalStatCard icon={<Users className="h-4 w-4" />} label="المتابعين" value={formatNumber(stats.followersCount)} accent={accent} border />
      <HorizontalStatCard icon={<UserPlus className="h-4 w-4" />} label="المتابَعين" value={formatNumber(stats.followingCount)} accent={accent} />

      {/* Translator-only stats */}
      {isTranslator && xp && (
        <>
          <div className="mx-4 border-t border-[#333]" />
          <div className="px-4 pt-3 pb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">إحصائيات المعرب</span>
          </div>
          <HorizontalStatCard
            icon={<Star className="h-4 w-4" />}
            label="نسبة الإنجاز"
            value={`${xp.progress}%`}
            accent={accent}
            border
            extra={
              <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-[#333]">
                <div className="h-full rounded-full" style={{ width: `${xp.progress}%`, backgroundColor: accent }} />
              </div>
            }
          />
          <HorizontalStatCard icon={<BarChart3 className="h-4 w-4" />} label="المستوى" value={`${xp.name} (${xp.level})`} accent={accent} border />
          <HorizontalStatCard icon={<Award className="h-4 w-4" />} label="الشارات المكتسبة" value={formatNumber(translatorStats?.badgesCount || 0)} accent={accent} border />
          <HorizontalStatCard icon={<Calendar className="h-4 w-4" />} label="تاريخ أول تعريب" value={translatorStats?.firstModDate ? formatDate(translatorStats.firstModDate) : '—'} accent={accent} border />
          <HorizontalStatCard icon={<ThumbsUp className="h-4 w-4" />} label="التقييم" value={`${translatorStats?.rating || 0}%`} accent={accent} />
        </>
      )}
    </div>
  )
}

function HorizontalStatCard({
  icon,
  label,
  value,
  accent,
  border,
  extra,
}: {
  icon: React.ReactNode
  label: string
  value: string
  accent: string
  border?: boolean
  extra?: React.ReactNode
}) {
  return (
    <div className={`px-4 py-3 ${border ? 'border-b border-[#333]' : ''}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span style={{ color: accent }}>{icon}</span>
          <span className="text-sm text-gray-300">{label}</span>
        </div>
        <span className="text-sm font-bold text-white">{value}</span>
      </div>
      {extra}
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/components/profile/profile-stats.tsx
git commit -m "feat(profile): redesign stats to horizontal compact cards with translator mode"
```

---

### Task 2: Update Profile API to Return Translator Data

**Files:**
- Modify: `src/app/api/users/[username]/profile/route.ts:94-108`

**Interfaces:**
- Consumes: existing user query, mods query
- Produces: `isTranslator`, `firstModDate`, `rating` in profile response

- [ ] **Step 1: Add translator fields to the profile API response**

In `src/app/api/users/[username]/profile/route.ts`, after the mods query (line 56), add:

```typescript
    // هل المستخدم معرب؟
    const isTranslator = ['owner', 'admin', 'moderator'].includes(user.role)

    // تاريخ أول تعريب
    let firstModDate: string | null = null
    if (isTranslator) {
      const firstMod = await db.mod.findFirst({
        where: { authorId: user.id },
        orderBy: { createdAt: 'asc' },
        select: { createdAt: true },
      })
      firstModDate = firstMod?.createdAt.toISOString() || null
    }
```

Then update the response (around line 94) to include these fields:

```typescript
    return NextResponse.json({
      profile: {
        ...user,
        stats: {
          mods: user._count.mods,
          totalDownloads,
          totalEndorsements,
          totalViews,
          followersCount,
          followingCount,
        },
        onlineStatus,
        xp: { ...xpLevel, progress: xpProgress },
        isTranslator,
        firstModDate,
        rating: user.qualityScore,
      },
    })
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/app/api/users/[username]/profile/route.ts
git commit -m "feat(profile-api): add isTranslator, firstModDate, rating to response"
```

---

### Task 3: Update Profile Page to Pass Translator Data to Stats

**Files:**
- Modify: `src/views/profile.tsx:27-56` (ProfileData interface)
- Modify: `src/views/profile.tsx:271-274` (ProfileStats usage)

**Interfaces:**
- Consumes: API response with `isTranslator`, `firstModDate`, `rating`
- Produces: passes new props to `<ProfileStats>`

- [ ] **Step 1: Add translator fields to ProfileData interface**

In `src/views/profile.tsx`, update the `ProfileData` interface to add:

```typescript
interface ProfileData {
  // ... existing fields ...
  isTranslator?: boolean
  firstModDate?: string | null
  rating?: number
}
```

- [ ] **Step 2: Update ProfileStats usage**

In `src/views/profile.tsx`, find the `<ProfileStats>` usage and update it:

```tsx
<ProfileStats
  stats={profile.stats}
  xp={profile.xp}
  isTranslator={profile.isTranslator}
  translatorStats={{
    badgesCount: badges.filter(b => b.earned).length,
    firstModDate: profile.firstModDate || null,
    rating: profile.rating || 0,
  }}
  accent={accent}
/>
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/views/profile.tsx
git commit -m "feat(profile): pass translator data to ProfileStats component"
```

---

### Task 4: Add Upgrade to Translator Button in Settings

**Files:**
- Modify: `src/components/profile/profile-settings.tsx`

**Interfaces:**
- Consumes: `profile.role` (to check if already translator)
- Produces: "ترقية إلى معرب" button + requirements modal

- [ ] **Step 1: Add upgrade section to ProfileSettings**

At the end of the `ProfileSettings` component, before the save button div, add a new section:

```tsx
      {/* Upgrade to Translator */}
      {!['owner', 'admin', 'moderator'].includes(profile.role) && (
        <SettingsSection title="ترقية إلى معرب" accent={accent}>
          <div className="space-y-3">
            <p className="text-sm text-gray-400">
              قم بالترقية إلى معرب للحصول على ميزات إضافية مثل نسبة الإنجاز والشارات والتقييم.
            </p>
            <Button
              variant="outline"
              className="w-full border-[#333] text-gray-300 hover:bg-[#222]"
              onClick={() => {
                toast({ title: 'قريباً', description: 'سيتم تفعيل هذه الميزة قريباً' })
              }}
            >
              ترقية إلى معرب
            </Button>
          </div>
        </SettingsSection>
      )}
```

- [ ] **Step 2: Add `role` to ProfileSettingsProps interface**

Update the props interface:

```typescript
interface ProfileSettingsProps {
  profile: {
    username: string
    role: string
    bio: string | null
    websiteUrl: string | null
    twitterUrl: string | null
    githubUrl: string | null
    discordUrl: string | null
    accentColor: string | null
  }
  accent: string
  onSave: (data: Partial<any>) => void
}
```

- [ ] **Step 3: Update ProfileSettings usage in profile.tsx**

In `src/views/profile.tsx`, find the `<ProfileSettings>` usage and ensure `role` is passed:

```tsx
<ProfileSettings
  profile={profile}
  accent={accent}
  onSave={(updated) => setProfile(prev => prev ? { ...prev, ...updated } : prev)}
/>
```

The `profile` object already contains `role`, so this should work without changes.

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src/components/profile/profile-settings.tsx
git commit -m "feat(profile-settings): add upgrade to translator button"
```

---

### Task 5: Final Verification

- [ ] **Step 1: Run full TypeScript check**

Run: `npx tsc --noEmit --pretty 2>&1`
Expected: No errors

- [ ] **Step 2: Test API response**

Run: `curl -s "http://localhost:3000/api/users/GADMIx/profile" | python3 -m json.tool | head -30`
Expected: Response includes `isTranslator`, `firstModDate`, `rating`

- [ ] **Step 3: Verify all commits**

Run: `git log --oneline -6`
Expected: 5 new commits (Tasks 1-4 + this verification)

---

## Summary

| Task | Commit | Description |
|------|--------|-------------|
| 1 | feat(profile): redesign stats to horizontal compact cards | Rewrite profile-stats.tsx |
| 2 | feat(profile-api): add translator fields | Update API response |
| 3 | feat(profile): pass translator data | Update profile.tsx |
| 4 | feat(profile-settings): add upgrade button | Update settings component |
| 5 | — | Final verification |
