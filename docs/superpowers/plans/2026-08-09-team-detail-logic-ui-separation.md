# فصل المنطق عن الواجهة — صفحة تفاصيل الفريق (Team Detail) — خطة التنفيذ

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** إعادة هيكلة `src/views/team-detail.tsx` لفصل كامل للمنطق (أنواع، ثوابت، جلب بيانات، حالة) عن الواجهة، دون أي تغيير بصري أو وظيفي.

**Architecture:** نقل الأنواع إلى `src/lib/types.ts`، ونقل الثوابت (`ROLE_LABELS`, `CONTACT_ICONS`, `CONTACT_COLORS`, `TabKey`, `TEAM_TABS`) إلى ملف `src/lib/team-constants.ts` الجديد، وتجميع كل منطق جلب البيانات وحالة التبويب وعنوان الصفحة في هوك `src/hooks/use-team-detail.ts` الجديد. يصبح ملف الواجهة عرضياً بحتاً ويستدعي الهوك.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript 5, lucide-react، الهوك الموجود `useFetch`.

## Global Constraints

- التغيير محصور في 4 ملفات فقط: `src/lib/types.ts`, `src/lib/team-constants.ts`, `src/hooks/use-team-detail.ts`, `src/views/team-detail.tsx`
- صفر تغيير بصري أو وظيفي — إعادة هيكلة فقط
- المكونات الواجهية الفرعية (`StatCell`, `TabButton`, `OverviewTab`, `MembersTab`, `ModsTab`, `StatsTab`) تبقى داخل `team-detail.tsx` (نمط المشروع)
- التحقق النهائي: `npx tsc --noEmit` بدون أخطاء في الملفات الأربعة
- لا توجد unit tests للـ views — دورة الاختبار هي `npx tsc --noEmit` بعد كل مهمة

---

### Task 1: إضافة أنواع الفريق إلى `src/lib/types.ts`

**Files:**
- Modify: `src/lib/types.ts` (إضافة في نهاية الملف)

**Interfaces:**
- Consumes: (لا شيء — إضافة مستقلة)
- Produces: `TeamMember`, `TeamMod`, `TeamContactLink`, `TeamStats`, `TeamDetail` — تُصدَّر من `@/lib/types`

- [ ] **Step 1: إضافة الأنواع**

أضف الكود التالي في نهاية `src/lib/types.ts`:

```ts
// ===== Team types =====

export interface TeamMember {
  id: string
  name: string
  avatarUrl: string | null
  role: string
  bio: string | null
  joinedAt?: string
}

export interface TeamMod {
  id: string
  name: string
  slug: string
  thumbnailUrl: string
  downloads: number
  endorsements: number
  views: number
  game: { platform: string; name: string } | null
}

export interface TeamContactLink {
  type: string
  label: string
  url: string
}

export interface TeamStats {
  modCount: number
  totalDownloads: number
  totalEndorsements: number
  totalViews: number
  memberCount: number
  platforms: Record<string, number>
  roleBreakdown: Record<string, number>
}

export interface TeamDetail {
  id: string
  slug: string
  name: string
  description: string
  logoUrl: string
  bannerUrl: string
  websiteUrl: string
  discordUrl: string
  isFeatured: boolean
  isOfficial: boolean
  createdAt: string
  memberships: TeamMember[]
  mods: TeamMod[]
  contactLinks: TeamContactLink[]
  stats: TeamStats
}
```

- [ ] **Step 2: التحقق من نوعية الملف**

Run: `npx tsc --noEmit`
Expected: لا أخطاء جديدة (الأنواع مضافة لكن لا أحد يستخدمها بعد)

- [ ] **Step 3: Commit**

```bash
git add src/lib/types.ts
git commit -m "refactor: add TeamDetail types to central types file"
```

---

### Task 2: إنشاء `src/lib/team-constants.ts` (الثوابت والتبويبات)

**Files:**
- Create: `src/lib/team-constants.ts`

**Interfaces:**
- Consumes: لا شيء
- Produces:
  - `type TabKey = 'overview' | 'members' | 'mods' | 'stats'`
  - `ROLE_LABELS: Record<string, { label: string; icon: typeof User; color: string }>`
  - `CONTACT_ICONS: Record<string, ReactNode>`
  - `CONTACT_COLORS: Record<string, string>`
  - `TEAM_TABS: Array<{ key: TabKey; label: string; icon: typeof Users }>`

- [ ] **Step 1: إنشاء الملف**

أنشئ `src/lib/team-constants.ts` بالمحتوى التالي (القيم منقولة حرفياً من `team-detail.tsx`):

```ts
import {
  Crown, Star, Globe, Eye, UserCheck, User, Shield, FlaskConical,
  Layers, Users, Gamepad2,
} from 'lucide-react'
import type { ReactNode } from 'react'

export type TabKey = 'overview' | 'members' | 'mods' | 'stats'

export const ROLE_LABELS: Record<string, { label: string; icon: typeof User; color: string }> = {
  leader: { label: 'قائد', icon: Crown, color: 'text-amber-500' },
  coleader: { label: 'نائب القائد', icon: Star, color: 'text-purple-400' },
  translator: { label: 'مترجم', icon: Globe, color: 'text-blue-400' },
  reviewer: { label: 'مراجع', icon: Eye, color: 'text-green-400' },
  editor: { label: 'محرر', icon: UserCheck, color: 'text-cyan-400' },
  member: { label: 'عضو', icon: User, color: 'text-slate-300' },
  admin: { label: 'مدير', icon: Shield, color: 'text-red-400' },
  guest: { label: 'ضيف', icon: User, color: 'text-gray-500' },
  tester: { label: 'مختبر', icon: FlaskConical, color: 'text-emerald-500' },
}

export const CONTACT_ICONS: Record<string, ReactNode> = {
  mail: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
      <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
    </svg>
  ),
  website: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
    </svg>
  ),
  telegram: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
      <path d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.5.71L12.6 16.3l-1.99 1.93c-.23.23-.42.42-.83.42z"/>
    </svg>
  ),
  twitter: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
    </svg>
  ),
  youtube: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
    </svg>
  ),
  discord: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
    </svg>
  ),
  facebook: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
    </svg>
  ),
  instagram: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
    </svg>
  ),
}

export const CONTACT_COLORS: Record<string, string> = {
  mail: '#6b7280',
  website: '#3b82f6',
  telegram: '#229ED9',
  twitter: '#000000',
  youtube: '#FF0000',
  discord: '#5865F2',
  facebook: '#1877F2',
  instagram: '#E4405F',
}

export const TEAM_TABS: Array<{ key: TabKey; label: string; icon: typeof Users }> = [
  { key: 'overview', label: 'نظرة عامة', icon: Layers },
  { key: 'members', label: 'أعضاء الفريق', icon: Users },
  { key: 'mods', label: 'تعريبات الفريق', icon: Gamepad2 },
  { key: 'stats', label: 'إحصائيات الفريق', icon: Eye },
]
```

- [ ] **Step 2: التحقق من نوعية الملف**

Run: `npx tsc --noEmit`
Expected: لا أخطاء (الملف يُصرَّح لكن لا أحد يستورده بعد)

- [ ] **Step 3: Commit**

```bash
git add src/lib/team-constants.ts
git commit -m "refactor: extract team constants to dedicated module"
```

---

### Task 3: إنشاء هوك `src/hooks/use-team-detail.ts`

**Files:**
- Create: `src/hooks/use-team-detail.ts`

**Interfaces:**
- Consumes: `useFetch` من `@/hooks/use-fetch`, `useDocumentTitle` من `@/hooks/use-document-title`, `TeamDetail` من `@/lib/types`, `TabKey` من `@/lib/team-constants`
- Produces: `useTeamDetail(): { team: TeamDetail | null; loading: boolean; activeTab: TabKey; setActiveTab: (t: TabKey) => void }`

- [ ] **Step 1: إنشاء الملف**

أنشئ `src/hooks/use-team-detail.ts`:

```ts
'use client'

import { useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useFetch } from '@/hooks/use-fetch'
import { useDocumentTitle } from '@/hooks/use-document-title'
import type { TeamDetail } from '@/lib/types'
import type { TabKey } from '@/lib/team-constants'

export function useTeamDetail() {
  const searchParams = useSearchParams()
  const teamSlug = searchParams.get('team') || ''
  const [activeTab, setActiveTab] = useState<TabKey>('overview')
  useDocumentTitle('فريق التعريب')

  const url = useMemo(() => {
    if (!teamSlug) return null
    return `/api/teams/${encodeURIComponent(teamSlug)}`
  }, [teamSlug])

  const { data, loading } = useFetch<{ team: TeamDetail }>(url, [url])
  const team = data?.team

  return { team, loading, activeTab, setActiveTab }
}
```

- [ ] **Step 2: التحقق من نوعية الملف**

Run: `npx tsc --noEmit`
Expected: لا أخطاء

- [ ] **Step 3: Commit**

```bash
git add src/hooks/use-team-detail.ts
git commit -m "refactor: add useTeamDetail hook to separate data logic"
```

---

### Task 4: إعادة كتابة `src/views/team-detail.tsx` كواجهة بحتة

**Files:**
- Modify: `src/views/team-detail.tsx` (إعادة كتابة كاملة)

**Interfaces:**
- Consumes: `useTeamDetail()` من `@/hooks/use-team-detail`, `TeamDetail` من `@/lib/types`, `ROLE_LABELS`/`CONTACT_ICONS`/`CONTACT_COLORS`/`TEAM_TABS` من `@/lib/team-constants`, `ModCard` من `@/components/mod-card`, `formatNumber` من `@/lib/format`
- Produces: `TeamDetailPage` — نفس التوقيع والسلوك كما قبل

- [ ] **Step 1: إعادة كتابة الملف بالكامل**

اكتب المحتوى التالي في `src/views/team-detail.tsx` (الواجهة نفسها حرفياً، والمنطق مستورد). الملف كاملاً:

```tsx
'use client'

import Link from 'next/link'
import {
  ArrowRight, Users, Star, Shield, Globe, ExternalLink,
  Download, Heart, Eye, Calendar, Gamepad2, User, MessageCircle,
  Layers,
} from 'lucide-react'
import { ModCard } from '@/components/mod-card'
import { useTeamDetail } from '@/hooks/use-team-detail'
import { formatNumber } from '@/lib/format'
import type { TeamDetail } from '@/lib/types'
import { ROLE_LABELS, CONTACT_ICONS, CONTACT_COLORS, TEAM_TABS } from '@/lib/team-constants'

export function TeamDetailPage() {
  const { team, loading, activeTab, setActiveTab } = useTeamDetail()

  return (
    <div className="min-h-screen" dir="rtl">
      {loading ? (
        <div className="space-y-0">
          <div className="h-72 animate-pulse bg-muted sm:h-80 lg:h-96" />
          <div className="mx-auto max-w-[1200px] px-4 py-8">
            <div className="h-8 w-48 animate-pulse rounded bg-muted" />
            <div className="mt-4 h-4 w-96 animate-pulse rounded bg-muted" />
          </div>
        </div>
      ) : !team ? (
        <div className="grid place-items-center py-20 text-center">
          <Users className="mb-3 h-12 w-12 text-muted-foreground/50" />
          <h3 className="text-lg font-semibold">الفريق غير موجود</h3>
          <Link href="/?view=teams" className="mt-4 text-sm text-primary hover:underline">العودة لفرق التعريب</Link>
        </div>
      ) : (
        <>
          {/* البانر */}
          <div className="relative h-64 w-full overflow-hidden sm:h-72 lg:h-80">
            {team.bannerUrl ? (
              <img src={team.bannerUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="h-full w-full bg-gradient-to-br from-slate-800 via-slate-900 to-slate-800" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
            <div className="absolute right-0 top-0 left-0 z-10 p-4">
              <div className="flex items-center gap-2 text-sm text-white/70">
                <Link href="/?view=teams" className="hover:text-white transition-colors">فرق التعريب</Link>
                <ArrowRight className="h-4 w-4 rotate-180" />
                <span className="text-white font-medium">{team.name}</span>
              </div>
            </div>
          </div>

          {/* اللوجو + معلومات الفريق */}
          <div className="mr-20 max-w-[1200px] px-4 lg:px-6" dir="rtl">
            <div className="relative -mt-40 sm:-mt-44 lg:-mt-48">
              <div className="flex flex-col sm:flex-row items-end gap-6">
                {team.logoUrl && (
                  <div className="relative shrink-0">
                    <div className="h-56 w-44 sm:h-72 sm:w-52 lg:h-80 lg:w-60 overflow-hidden border-[3px] border-slate-700 bg-card shadow-2xl">
                      <img src={team.logoUrl} alt={team.name} className="h-full w-full object-cover" />
                    </div>
                  </div>
                )}
                <div className="flex-1 pb-2 min-w-0 min-h-[120px] sm:min-h-[160px] lg:min-h-[200px] flex flex-col justify-end">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-foreground">
                      {team.name}
                    </h1>
                    {team.isFeatured && (
                      <span className="inline-flex items-center gap-1 bg-amber-500/10 px-2.5 py-1 text-xs font-bold text-amber-500 border border-amber-500/20">
                        <Star className="h-3 w-3 fill-amber-500" /> مميز
                      </span>
                    )}
                    {team.isOfficial && (
                      <span className="inline-flex items-center gap-1 bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary border border-primary/20">
                        <Shield className="h-3 w-3" /> رسمي
                      </span>
                    )}
                  </div>
                  {team.contactLinks.length > 0 && (
                    <div className="mt-3 flex items-center gap-2">
                      {team.contactLinks.map((link, i) => (
                        <a
                          key={i}
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex h-9 w-9 items-center justify-center rounded-full transition-transform hover:scale-110"
                          style={{ backgroundColor: CONTACT_COLORS[link.type] || '#4b5563' }}
                          title={link.label}
                        >
                          <span className="text-white">
                            {CONTACT_ICONS[link.type] || <Globe className="h-4 w-4" />}
                          </span>
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* شريط الإحصائيات */}
            <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
              <StatCell icon={Layers} label="إجمالي التعريبات" value={team.stats.modCount} />
              <StatCell icon={Users} label="أعضاء الفريق" value={team.stats.memberCount} />
              <StatCell icon={Download} label="إجمالي التحميلات" value={team.stats.totalDownloads} />
              <StatCell icon={Heart} label="إجمالي الإعجابات" value={team.stats.totalEndorsements} />
              <StatCell icon={Eye} label="إجمالي المشاهدات" value={team.stats.totalViews} />
              <StatCell
                icon={Calendar}
                label="تاريخ الإنشاء"
                value={new Date(team.createdAt).toLocaleDateString('ar-EG', { year: 'numeric', month: 'short' })}
                isText
              />
            </div>

            {/* التبويبات */}
            <div className="mt-8 border-b border-slate-700">
              <div className="flex gap-0">
                {TEAM_TABS.map((t) => (
                  <TabButton
                    key={t.key}
                    active={activeTab === t.key}
                    onClick={() => setActiveTab(t.key)}
                    icon={t.icon}
                    label={t.label}
                  />
                ))}
              </div>
            </div>

            {/* محتوى التبويبات */}
            <div className="py-6">
              {activeTab === 'overview' && <OverviewTab team={team} />}
              {activeTab === 'members' && <MembersTab team={team} />}
              {activeTab === 'mods' && <ModsTab team={team} />}
              {activeTab === 'stats' && <StatsTab team={team} />}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

/* خلية إحصائية */
function StatCell({ icon: Icon, label, value, isText }: {
  icon: typeof Download
  label: string
  value: number | string
  isText?: boolean
}) {
  return (
    <div className="flex items-center justify-between border border-slate-700 bg-slate-800 px-6 py-3 transition-colors hover:border-slate-600">
      <span className="flex items-center gap-1.5 text-[11px] font-medium text-slate-400">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </span>
      <span className="text-sm font-bold text-slate-100">
        {isText ? <span className="text-xs">{value}</span> : formatNumber(value as number)}
      </span>
    </div>
  )
}

/* زر تبويب */
function TabButton({ active, onClick, icon: Icon, label }: {
  active: boolean
  onClick: () => void
  icon: typeof Users
  label: string
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-medium transition-colors ${
        active
          ? 'border-primary text-primary'
          : 'border-transparent text-slate-400 hover:text-slate-200'
      }`}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  )
}

/* تبويب: نظرة عامة — وصف الفريق + روابط التواصل */
function OverviewTab({ team }: { team: TeamDetail }) {
  return (
    <div className="space-y-6">
      {team.description && (
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-foreground">
            <Layers className="h-5 w-5 text-slate-400" />
            عن الفريق
          </h2>
          <p className="text-sm leading-relaxed text-slate-300">{team.description}</p>
        </section>
      )}
      {team.contactLinks.length > 0 && (
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-foreground">
            <Globe className="h-5 w-5 text-slate-400" />
            روابط التواصل
          </h2>
          <div className="flex flex-wrap items-center gap-3">
            {team.contactLinks.map((link, i) => (
              <a
                key={i}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-full border border-slate-700 bg-slate-800/60 px-4 py-2 text-xs font-medium text-slate-300 transition-colors hover:border-slate-500 hover:text-white"
                title={link.label}
              >
                <span className="flex h-5 w-5 items-center justify-center rounded-full text-white" style={{ backgroundColor: CONTACT_COLORS[link.type] || '#4b5563' }}>
                  {CONTACT_ICONS[link.type] || <Globe className="h-3 w-3" />}
                </span>
                {link.label}
              </a>
            ))}
          </div>
        </section>
      )}
      {(team.websiteUrl || team.discordUrl) && (
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-foreground">
            <ExternalLink className="h-5 w-5 text-slate-400" />
            روابط إضافية
          </h2>
          <div className="flex flex-wrap items-center gap-3">
            {team.websiteUrl && (
              <a
                href={team.websiteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-full border border-slate-700 bg-slate-800/60 px-4 py-2 text-xs font-medium text-slate-300 transition-colors hover:border-slate-500 hover:text-white"
              >
                <Globe className="h-4 w-4 text-blue-400" />
                الموقع الرسمي
              </a>
            )}
            {team.discordUrl && (
              <a
                href={team.discordUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-full border border-slate-700 bg-slate-800/60 px-4 py-2 text-xs font-medium text-slate-300 transition-colors hover:border-slate-500 hover:text-white"
              >
                <MessageCircle className="h-4 w-4 text-indigo-400" />
                سيرفر ديسكورد
              </a>
            )}
          </div>
        </section>
      )}
    </div>
  )
}

/* تبويب: أعضاء الفريق */
function MembersTab({ team }: { team: TeamDetail }) {
  return (
    <div>
      {team.memberships.length > 0 ? (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {team.memberships.map((m) => {
            const role = ROLE_LABELS[m.role] || { label: m.role, icon: User, color: 'text-slate-400' }
            const RoleIcon = role.icon
            return (
              <div key={m.id} className="flex items-center gap-3 border border-slate-700/50 bg-slate-800/30 p-3 transition-colors hover:border-slate-600">
                {m.avatarUrl ? (
                  <img src={m.avatarUrl} alt="" className="h-10 w-10 rounded-full object-cover ring-1 ring-slate-700" />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center bg-slate-700 text-sm font-bold text-slate-300">
                    {m.name.charAt(0)}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-slate-200">{m.name}</div>
                  <div className={`flex items-center gap-1 text-xs ${role.color}`}>
                    <RoleIcon className="h-3 w-3" />
                    {role.label}
                  </div>
                  {m.bio && (
                    <div className="mt-0.5 text-xs text-slate-500 line-clamp-1">{m.bio}</div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="py-12 text-center text-slate-500">
          <Users className="mx-auto mb-3 h-10 w-10" />
          <p className="text-sm">لا يوجد أعضاء مسجلين في الفريق حالياً</p>
        </div>
      )}
    </div>
  )
}

/* تبويب: تعريبات الفريق */
function ModsTab({ team }: { team: TeamDetail }) {
  return (
    <div>
      {team.mods.length > 0 ? (
        <div className="grid grid-cols-2 gap-4 sm:gap-5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {team.mods.map((m) => (
            <ModCard key={m.id} mod={m as never} />
          ))}
        </div>
      ) : (
        <div className="py-12 text-center text-slate-500">
          <Gamepad2 className="mx-auto mb-3 h-10 w-10" />
          <p className="text-sm">لا توجد تعريبات مسجلة في الفريق حالياً</p>
        </div>
      )}
    </div>
  )
}

/* تبويب: إحصائيات الفريق — جدول Excel-style */
function StatsTab({ team }: { team: TeamDetail }) {
  const roleBreakdown = team.stats.roleBreakdown
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="border border-slate-700 bg-slate-900 px-3 py-3 text-center transition-colors hover:border-slate-600">
          <div className="text-sm font-bold text-slate-100 leading-tight">{team.stats.memberCount}</div>
          <div className="mt-1 text-[10px] font-medium text-slate-500 leading-tight">إجمالي الأعضاء</div>
        </div>
        <div className="border border-slate-700 bg-slate-900 px-3 py-3 text-center transition-colors hover:border-slate-600">
          <div className="text-sm font-bold text-slate-100 leading-tight">{team.stats.modCount}</div>
          <div className="mt-1 text-[10px] font-medium text-slate-500 leading-tight">إجمالي التعريبات</div>
        </div>
        <div className="border border-slate-700 bg-slate-900 px-3 py-3 text-center transition-colors hover:border-slate-600">
          <div className="text-sm font-bold text-slate-100 leading-tight">{formatNumber(team.stats.totalDownloads)}</div>
          <div className="mt-1 text-[10px] font-medium text-slate-500 leading-tight">إجمالي التحميلات</div>
        </div>
        <div className="border border-slate-700 bg-slate-900 px-3 py-3 text-center transition-colors hover:border-slate-600">
          <div className="text-sm font-bold text-slate-100 leading-tight">{formatNumber(team.stats.totalEndorsements)}</div>
          <div className="mt-1 text-[10px] font-medium text-slate-500 leading-tight">إجمالي الإعجابات</div>
        </div>
      </div>

      {Object.keys(roleBreakdown).length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-bold text-slate-300">توزيع الرتب</h3>
          <div className="flex flex-wrap gap-2">
            {Object.entries(roleBreakdown).map(([role, count]) => {
              const r = ROLE_LABELS[role] || { label: role, icon: User, color: 'text-slate-400' }
              const RoleIcon = r.icon
              return (
                <span key={role} className="inline-flex items-center gap-1.5 border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs transition-colors hover:border-slate-600">
                  <RoleIcon className={`h-3.5 w-3.5 ${r.color}`} />
                  <span className="text-slate-400">{r.label}</span>
                  <span className="font-bold text-slate-200">{count}</span>
                </span>
              )
            })}
          </div>
        </div>
      )}

      {team.memberships.length > 0 ? (
        <div>
          <h3 className="mb-2 text-sm font-bold text-slate-300">قائمة الأعضاء والمساهمات</h3>
          <div className="overflow-x-auto border border-slate-700">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700 bg-slate-800/50">
                  <th className="px-4 py-2.5 text-right text-xs font-bold text-slate-400">#</th>
                  <th className="px-4 py-2.5 text-right text-xs font-bold text-slate-400">العضو</th>
                  <th className="px-4 py-2.5 text-right text-xs font-bold text-slate-400">الرتبة</th>
                  <th className="px-4 py-2.5 text-right text-xs font-bold text-slate-400">النبذة التعريفية</th>
                  <th className="px-4 py-2.5 text-center text-xs font-bold text-slate-400">تاريخ الانضمام</th>
                </tr>
              </thead>
              <tbody>
                {team.memberships.map((m, i) => {
                  const role = ROLE_LABELS[m.role] || { label: m.role, icon: User, color: 'text-slate-400' }
                  const RoleIcon = role.icon
                  return (
                    <tr key={m.id} className="border-b border-slate-700/50 transition-colors hover:bg-slate-800/30">
                      <td className="px-4 py-2.5 text-slate-500 font-mono text-xs">{i + 1}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2.5">
                          {m.avatarUrl ? (
                            <img src={m.avatarUrl} alt="" className="h-7 w-7 rounded-full object-cover ring-1 ring-slate-700" />
                          ) : (
                            <div className="flex h-7 w-7 shrink-0 items-center justify-center bg-slate-700 text-xs font-bold text-slate-300">
                              {m.name.charAt(0)}
                            </div>
                          )}
                          <span className="font-medium text-slate-200">{m.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`inline-flex items-center gap-1 text-xs ${role.color}`}>
                          <RoleIcon className="h-3 w-3" />
                          {role.label}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-slate-400 max-w-[200px] truncate">{m.bio || '—'}</td>
                      <td className="px-4 py-2.5 text-center text-xs text-slate-500 font-mono">
                        {new Date(m.joinedAt || team.createdAt).toLocaleDateString('ar-EG')}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="py-12 text-center text-slate-500">
          <Users className="mx-auto mb-3 h-10 w-10" />
          <p className="text-sm">لا يوجد أعضاء مسجلين في الفريق حالياً</p>
        </div>
      )}

      {team.mods.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-bold text-slate-300">تعريبات الفريق</h3>
          <div className="overflow-x-auto border border-slate-700">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700 bg-slate-800/50">
                  <th className="px-4 py-2.5 text-right text-xs font-bold text-slate-400">#</th>
                  <th className="px-4 py-2.5 text-right text-xs font-bold text-slate-400">التعريب</th>
                  <th className="px-4 py-2.5 text-right text-xs font-bold text-slate-400">اللعبة</th>
                  <th className="px-4 py-2.5 text-center text-xs font-bold text-slate-400">المنصة</th>
                  <th className="px-4 py-2.5 text-center text-xs font-bold text-slate-400">التحميلات</th>
                  <th className="px-4 py-2.5 text-center text-xs font-bold text-slate-400">الإعجابات</th>
                  <th className="px-4 py-2.5 text-center text-xs font-bold text-slate-400">المشاهدات</th>
                </tr>
              </thead>
              <tbody>
                {team.mods.map((m, i) => (
                  <tr key={m.id} className="border-b border-slate-700/50 transition-colors hover:bg-slate-800/30">
                    <td className="px-4 py-2.5 text-slate-500 font-mono text-xs">{i + 1}</td>
                    <td className="px-4 py-2.5">
                      <Link href={`/?view=mod&slug=${m.slug}`} className="font-medium text-slate-200 hover:text-primary transition-colors">
                        {m.name}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-slate-400">{m.game?.name || '—'}</td>
                    <td className="px-4 py-2.5 text-center text-xs text-slate-400">{m.game?.platform || '—'}</td>
                    <td className="px-4 py-2.5 text-center font-mono text-xs text-slate-300">{formatNumber(m.downloads)}</td>
                    <td className="px-4 py-2.5 text-center font-mono text-xs text-slate-300">{formatNumber(m.endorsements)}</td>
                    <td className="px-4 py-2.5 text-center font-mono text-xs text-slate-300">{formatNumber(m.views)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-slate-600 bg-slate-800/50 font-bold">
                  <td className="px-4 py-2.5" colSpan={4}>
                    <span className="text-xs text-slate-300">الإجمالي</span>
                  </td>
                  <td className="px-4 py-2.5 text-center font-mono text-xs text-slate-100">{formatNumber(team.stats.totalDownloads)}</td>
                  <td className="px-4 py-2.5 text-center font-mono text-xs text-slate-100">{formatNumber(team.stats.totalEndorsements)}</td>
                  <td className="px-4 py-2.5 text-center font-mono text-xs text-slate-100">{formatNumber(team.stats.totalViews)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: التحقق من نوعية الملفات الأربعة**

Run: `npx tsc --noEmit`
Expected: لا أخطاء في `team-detail.tsx` ولا في الملفات الجديدة (`team-constants.ts`, `use-team-detail.ts`, `types.ts`)

- [ ] **Step 3: Commit**

```bash
git add src/views/team-detail.tsx
git commit -m "refactor: make team-detail view purely presentational"
```

---

## Self-Review

**1. Spec coverage:**
- الأنواع في `types.ts` ← Task 1 ✓
- الثوابت في `team-constants.ts` ✓ (Task 2)
- الهوك `useTeamDetail` يجمع URL + useFetch + activeTab + useDocumentTitle ✓ (Task 3)
- الواجهة عرضية بحتة، مكوناتها الفرعية باقية في نفس الملف ✓ (Task 4)
- حد 4 ملفات ✓
- صفر تغيير بصري — الواجهة في Task 4 مطابقة حرفياً للملف الأصلي ✓

**2. Placeholder scan:** لا يوجد "TBD"/"TODO" — كل الكود مكتوب كاملاً.

**3. Type consistency:**
- `TabKey` معرف في Task 2 ويُستهلك في Task 3 و Task 4 بنفس الاسم ✓
- `TeamDetail` معرف في Task 1 ويُستهلك في Task 3 و Task 4 ✓
- `TEAM_TABS` في Task 2 يستخدم `icon: typeof Users` و `TabButton` في Task 4 يقبل `icon: typeof Users` ✓
- `StatCell` يقبل `icon: typeof Download` — الأيقونات الممررة (Layers, Users, Download, Heart, Eye, Calendar) جميعها lucide components متوافقة ✓
