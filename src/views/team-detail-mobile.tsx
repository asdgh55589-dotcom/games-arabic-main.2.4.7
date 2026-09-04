'use client'

import { BadgeCheck, Download, Eye, Gamepad2, Layers, Link2, Users } from 'lucide-react'
import Link from 'next/link'
import { ModCard } from '@/components/mod-card'
import { formatNumber } from '@/lib/format'
import { ROLE_LABELS, type TabKey, TEAM_TABS } from '@/lib/team-constants'
import {
  getMemberAvatar,
  getMemberBio,
  getMemberDisplayName,
  getMemberProfileUrl,
  isLinkedMember,
} from '@/lib/team-members'
import type { TeamDetail } from '@/lib/types'

// ---------------------------------------------------------------------------
// Props — same data as team-detail.tsx, reuse via props (no new API calls)
// ---------------------------------------------------------------------------

export interface TeamDetailMobileProps {
  team: TeamDetail | null | undefined
  loading: boolean
  activeTab: TabKey
  setActiveTab: (k: TabKey) => void
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TeamDetailMobile({
  team,
  loading,
  activeTab,
  setActiveTab,
}: TeamDetailMobileProps) {
  if (loading) {
    return (
      <div className="lg:hidden overflow-x-hidden" dir="rtl">
        <div className="h-[140px] w-full animate-pulse bg-muted" />
        <div className="flex justify-center">
          <div className="h-20 w-20 -mt-10 animate-pulse rounded-lg border-4 border-background bg-muted" />
        </div>
        <div className="mt-4 flex flex-col items-center gap-2 px-3 sm:px-4">
          <div className="h-6 w-40 animate-pulse rounded bg-muted" />
          <div className="h-4 w-64 animate-pulse rounded bg-muted" />
        </div>
        <div className="mt-4 grid grid-cols-3 gap-1 sm:gap-2 px-3 sm:px-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-lg border bg-muted" />
          ))}
        </div>
      </div>
    )
  }

  if (!team) {
    return (
      <div
        className="lg:hidden grid place-items-center overflow-x-hidden px-3 sm:px-4 py-20 text-center"
        dir="rtl"
      >
        <Users className="mb-3 h-12 w-12 text-muted-foreground/50" aria-hidden />
        <h3 className="break-words text-lg font-semibold">الفريق غير موجود</h3>
        <Link
          href="/teams"
          className="mt-4 inline-flex min-h-[44px] touch-manipulation items-center text-sm text-primary hover:underline"
        >
          العودة لفرق التعريب
        </Link>
      </div>
    )
  }

  const hiddenKeys = (team.hiddenTabs || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

  const visibleTabs = TEAM_TABS.filter((t) => !hiddenKeys.includes(t.key))
  const visibleCustomTabs = (team.customTabs || []).filter((t) => t.visible)

  return (
    <div className="lg:hidden overflow-x-hidden" dir="rtl">
      {/* 1. Banner/logo + team name + tagline stacked centered — banner h-[140px], logo centered, px-3 sm:px-4 */}
      <div className="relative h-[140px] w-full overflow-hidden bg-muted sm:h-48">
        {team.bannerUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={team.bannerUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-slate-800 via-slate-900 to-slate-800" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none" />
      </div>

      {/* Logo centered, overlapping banner */}
      <div className="flex justify-center">
        <div className="relative -mt-10 z-10 flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border-4 border-background bg-card shadow-xl">
          {team.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={team.logoUrl} alt={team.name} className="h-full w-full object-cover" />
          ) : (
            <Users className="h-8 w-8 text-muted-foreground/40" aria-hidden />
          )}
        </div>
      </div>

      {/* Name centered */}
      <div className="mt-3 flex flex-col items-center gap-1.5 px-3 sm:px-4 text-center">
        <div className="flex flex-wrap items-center justify-center gap-1.5">
          <h1 className="break-words text-xl font-bold leading-tight tracking-tight">
            {team.name}
          </h1>
          {team.isFeatured ? (
            <span
              className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-amber-500/30 bg-amber-500/15 text-amber-500"
              title="مميز"
              aria-label="مميز"
            >
              <Eye className="h-3 w-3" aria-hidden />
            </span>
          ) : null}
          {team.isOfficial ? (
            <span
              className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-primary/30 bg-primary/15 text-primary"
              title="رسمي"
              aria-label="رسمي"
            >
              <Layers className="h-3 w-3" aria-hidden />
            </span>
          ) : null}
        </div>
        {team.description ? (
          <p className="w-full max-w-full break-words text-center text-sm leading-relaxed text-muted-foreground">
            {team.description}
          </p>
        ) : null}
      </div>

      {/* 2. Stats row: grid grid-cols-3 gap-1 sm:gap-2 (أعضاء/تعريبات/تحميلات) — compact cells with border */}
      <div className="mt-4 grid grid-cols-3 gap-1 sm:gap-2 px-3 sm:px-4">
        <StatCellMobile label="أعضاء" value={team.stats.memberCount} icon={Users} />
        <StatCellMobile label="تعريبات" value={team.stats.modCount} icon={Gamepad2} />
        <StatCellMobile label="تحميلات" value={team.stats.totalDownloads} icon={Download} />
      </div>

      {/* 3. Tabs (تعريبات/أعضاء): overflow-x-auto whitespace-nowrap border-b, using TEAM_TABS */}
      <div className="mt-4 overflow-x-auto whitespace-nowrap border-b border-border scrollbar-thin">
        <div className="flex gap-0 px-2" role="tablist" aria-label="تبويبات الفريق">
          {visibleTabs.map((t) => {
            const Icon = t.icon
            const isActive = activeTab === t.key
            return (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveTab(t.key)}
                className={`inline-flex min-h-[44px] touch-manipulation shrink-0 items-center gap-1.5 border-b-2 px-3 sm:px-4 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden />
                <span className="break-words">{t.label}</span>
              </button>
            )
          })}
          {visibleCustomTabs.map((ct, i) => {
            const key = `custom-${i}` as TabKey
            const isActive = activeTab === key
            return (
              <button
                key={`custom-${i}`}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveTab(key)}
                className={`inline-flex min-h-[44px] touch-manipulation shrink-0 items-center gap-1.5 border-b-2 px-3 sm:px-4 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                <Layers className="h-4 w-4 shrink-0" aria-hidden />
                <span className="break-words">{ct.title}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Tab content */}
      <div className="px-3 py-4">
        {activeTab === 'mods' && <ModsTabMobile team={team} />}
        {activeTab === 'members' && <MembersTabMobile team={team} />}
        {activeTab === 'overview' && <OverviewTabMobile team={team} />}
        {activeTab === 'stats' && <StatsTabMobile team={team} />}
        {visibleCustomTabs.map((ct, i) => {
          const key = `custom-${i}` as TabKey
          if (activeTab !== key) return null
          return (
            <div
              key={`custom-content-${i}`}
              className="prose prose-invert max-w-none break-words text-sm leading-relaxed text-muted-foreground"
            >
              <p className="whitespace-pre-wrap break-words">{ct.content}</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
//  Stats compact cell
// ---------------------------------------------------------------------------

function StatCellMobile({
  label,
  value,
  icon: Icon,
}: {
  label: string
  value: number
  icon: typeof Users
}) {
  return (
    <div className="flex min-w-0 flex-col items-center justify-center gap-1 rounded-lg border bg-card px-2 py-3 text-center">
      <span className="inline-flex items-center gap-1 text-muted-foreground">
        <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <span className="break-words text-[11px] font-medium leading-none">{label}</span>
      </span>
      <span className="break-words text-sm font-bold leading-none tabular-nums">
        {formatNumber(value)}
      </span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// mods tab → grid-cols-2 compact ModCard
// ---------------------------------------------------------------------------

function ModsTabMobile({ team }: { team: TeamDetail }) {
  if (team.mods.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed bg-card px-3 sm:px-4 py-12 text-center">
        <Gamepad2 className="h-10 w-10 text-muted-foreground/40" aria-hidden />
        <p className="break-words text-sm font-medium text-muted-foreground">
          لا توجد تعريبات مسجلة في الفريق حالياً
        </p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
      {team.mods.map((m) => (
        <ModCard key={m.id} mod={m as never} variant="compact" />
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// members tab → stacked rows [avatar 40px + name + role badge] with border, gap-3
// ---------------------------------------------------------------------------

function MembersTabMobile({ team }: { team: TeamDetail }) {
  if (team.memberships.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed bg-card px-3 sm:px-4 py-12 text-center">
        <Users className="h-10 w-10 text-muted-foreground/40" aria-hidden />
        <p className="break-words text-sm font-medium text-muted-foreground">
          لا يوجد أعضاء مسجلين في الفريق حالياً
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {team.memberships.map((m) => {
        const role = ROLE_LABELS[m.role] || {
          label: m.role,
          icon: Users,
          color: 'text-muted-foreground',
        }
        const RoleIcon = role.icon
        const displayName = getMemberDisplayName(m as never)
        const avatar = getMemberAvatar(m as never)
        const profileUrl = getMemberProfileUrl(m as never)
        const bio = getMemberBio(m as never)
        const isLinked = isLinkedMember(m as never)

        return (
          <div
            key={m.id}
            className="flex min-h-[56px] items-center gap-3 rounded-lg border bg-card p-3 transition-colors hover:border-border/80"
          >
            {/* avatar 40px */}
            {avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatar}
                alt=""
                className="h-10 w-10 shrink-0 rounded-full object-cover ring-1 ring-border"
                loading="lazy"
              />
            ) : (
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-bold text-muted-foreground">
                {displayName.charAt(0).toUpperCase()}
              </div>
            )}

            <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5">
              <div className="flex min-w-0 items-center gap-1.5">
                {profileUrl ? (
                  <Link
                    href={profileUrl}
                    className="min-h-[44px] touch-manipulation inline-flex items-center truncate break-words text-sm font-semibold hover:text-primary hover:underline"
                  >
                    {displayName}
                  </Link>
                ) : (
                  <span className="truncate break-words text-sm font-semibold">{displayName}</span>
                )}
                {profileUrl ? (
                  <Link
                    href={profileUrl}
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary min-h-[32px] min-w-[32px]"
                    title="عرض الحساب"
                    aria-label="عرض الحساب"
                  >
                    <Link2 className="h-3.5 w-3.5" aria-hidden />
                  </Link>
                ) : null}
                {isLinked ? (
                  <span title="حساب موثق" aria-label="حساب موثق">
                    <BadgeCheck className="h-4 w-4 shrink-0 text-green-500" aria-hidden />
                  </span>
                ) : null}
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <span
                  className={`inline-flex items-center gap-1 break-words text-xs ${role.color}`}
                >
                  <RoleIcon className="h-3 w-3 shrink-0" aria-hidden />
                  {role.label}
                </span>
              </div>

              {bio ? (
                <p className="line-clamp-1 break-words text-xs leading-relaxed text-muted-foreground">
                  {bio}
                </p>
              ) : null}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// overview fallback for mobile (description centered already above, but keep tab)
// ---------------------------------------------------------------------------

function OverviewTabMobile({ team }: { team: TeamDetail }) {
  if (!team.description) {
    return (
      <div className="rounded-lg border bg-card p-4 text-center">
        <p className="break-words text-sm text-muted-foreground">لا يوجد وصف للفريق.</p>
      </div>
    )
  }
  return (
    <div className="space-y-3">
      <div className="rounded-lg border bg-card p-4">
        <h2 className="mb-2 flex items-center gap-2 break-words text-sm font-bold">
          <Layers className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          عن الفريق
        </h2>
        <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-muted-foreground">
          {team.description}
        </p>
      </div>
      {team.contactLinks.length > 0 ? (
        <div className="rounded-lg border bg-card p-4">
          <h2 className="mb-2 break-words text-sm font-bold">روابط التواصل</h2>
          <div className="flex flex-wrap gap-2">
            {team.contactLinks.map((link, i) => (
              <a
                key={i}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-[44px] touch-manipulation items-center gap-1.5 rounded-full border bg-muted px-3 py-1 text-xs font-medium break-words hover:bg-muted/80"
              >
                {link.label}
              </a>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}

function StatsTabMobile({ team }: { team: TeamDetail }) {
  return (
    <div className="space-y-2 rounded-lg border bg-card p-4">
      <h3 className="break-words text-sm font-bold">إحصائيات الفريق</h3>
      <div className="grid grid-cols-2 gap-1.5 sm:gap-2 text-xs">
        <div className="flex justify-between gap-2 border-b py-2">
          <span className="break-words text-muted-foreground">التعريبات</span>
          <span className="break-words font-bold tabular-nums">
            {formatNumber(team.stats.modCount)}
          </span>
        </div>
        <div className="flex justify-between gap-2 border-b py-2">
          <span className="break-words text-muted-foreground">الأعضاء</span>
          <span className="break-words font-bold tabular-nums">
            {formatNumber(team.stats.memberCount)}
          </span>
        </div>
        <div className="flex justify-between gap-2 border-b py-2">
          <span className="break-words text-muted-foreground">التحميلات</span>
          <span className="break-words font-bold tabular-nums">
            {formatNumber(team.stats.totalDownloads)}
          </span>
        </div>
        <div className="flex justify-between gap-2 border-b py-2">
          <span className="break-words text-muted-foreground">الإعجابات</span>
          <span className="break-words font-bold tabular-nums">
            {formatNumber(team.stats.totalEndorsements)}
          </span>
        </div>
        <div className="flex justify-between gap-2 border-b py-2">
          <span className="break-words text-muted-foreground">المشاهدات</span>
          <span className="break-words font-bold tabular-nums">
            {formatNumber(team.stats.totalViews)}
          </span>
        </div>
        <div className="flex justify-between gap-2 border-b py-2">
          <span className="break-words text-muted-foreground">المتابعون</span>
          <span className="break-words font-bold tabular-nums">
            {formatNumber(team.stats.followersCount)}
          </span>
        </div>
      </div>
    </div>
  )
}
