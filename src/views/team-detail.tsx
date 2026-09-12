'use client'

import {
  ArrowRight,
  BadgeCheck,
  Calendar,
  Download,
  ExternalLink,
  Eye,
  Gamepad2,
  Globe,
  Heart,
  Layers,
  Link2,
  MessageCircle,
  Share2,
  Shield,
  Star,
  User,
  UserCheck,
  UserPlus,
  Users,
} from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { MarkdownRenderer } from '@/components/markdown-renderer'
import { ModCard } from '@/components/mod-card'
import { useAuth } from '@/contexts/auth-context'
import { useTeamDetail } from '@/hooks/use-team-detail'
import { useToast } from '@/hooks/use-toast'
import { formatNumber } from '@/lib/format'
import {
  CONTACT_COLORS,
  CONTACT_ICONS,
  ROLE_LABELS,
  type TabKey,
  TEAM_TABS,
} from '@/lib/team-constants'
import {
  getMemberAvatar,
  getMemberBio,
  getMemberDisplayName,
  getMemberProfileUrl,
  isLinkedMember,
} from '@/lib/team-members'
import type { TeamDetail } from '@/lib/types'
import { TeamDetailMobile } from './team-detail-mobile'

export function TeamDetailPage() {
  const { team, loading, activeTab, setActiveTab } = useTeamDetail()
  const { toast } = useToast()

  const { user: currentUser } = useAuth()

  const [isFollowing, setIsFollowing] = useState(false)
  const [followLoading, setFollowLoading] = useState(false)
  const [followersCount, setFollowersCount] = useState(0)

  useEffect(() => {
    setFollowersCount(team?.stats.followersCount ?? 0)
    if (!team) return
    fetch(`/api/teams/${encodeURIComponent(team.slug)}/follow`)
      .then((r) => r.json())
      .then((d) => {
        const payload = d.data
        setIsFollowing(Boolean(payload.isFollowing))
        if (typeof payload.followersCount === 'number') setFollowersCount(payload.followersCount)
      })
      .catch((error) => {
        console.error('[team-detail] failed to fetch follow status:', error)
      })
  }, [team])

  const isOwner = Boolean(currentUser && team && team.ownerId === currentUser.id)

  const handleFollowToggle = async () => {
    if (!currentUser) {
      toast({
        title: 'سجّل الدخول',
        description: 'يجب تسجيل الدخول لمتابعة الفرق',
        variant: 'destructive',
      })
      return
    }
    if (!team || followLoading) return
    setFollowLoading(true)
    try {
      const method = isFollowing ? 'DELETE' : 'POST'
      const res = await fetch(`/api/teams/${encodeURIComponent(team.slug)}/follow`, { method })
      if (res.ok) {
        const data = await res.json()
        const payload = data.data
        setIsFollowing(payload.isFollowing)
        setFollowersCount(payload.followersCount)
        toast({
          title: payload.isFollowing ? 'تمت المتابعة' : 'تم إلغاء المتابعة',
          description: team.name,
        })
      } else {
        const data = await res.json().catch(() => null)
        if (data?.error?.code === 'VALIDATION_ERROR') {
          toast({ title: 'لا يمكن متابعة فريقك الخاص' })
        } else if (res.status === 401) {
          toast({
            title: 'سجّل الدخول',
            description: 'يجب تسجيل الدخول لمتابعة الفرق',
            variant: 'destructive',
          })
        }
      }
    } catch (error) {
      console.error('[team-detail] follow toggle failed:', error)
    }
    setFollowLoading(false)
  }

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      toast({ title: 'تم نسخ الرابط', description: 'شارك رابط الفريق مع أصدقائك' })
    } catch {
      toast({ title: 'تعذّر النسخ', variant: 'destructive' })
    }
  }

  return (
    <>
      <div className="hidden lg:block">
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
              <Link href="/teams" className="mt-4 text-sm text-primary hover:underline">
                العودة لفرق التعريب
              </Link>
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
                    <Link href="/teams" className="hover:text-white transition-colors">
                      فرق التعريب
                    </Link>
                    <ArrowRight className="h-4 w-4 rotate-180" />
                    <span className="text-white font-medium">{team.name}</span>
                  </div>
                </div>
              </div>

              {/* اللوجو + معلومات الفريق */}
              <div className="mx-auto max-w-[1400px] px-4 lg:px-6" dir="rtl">
                <div className="relative -mt-40 sm:-mt-44 lg:-mt-48">
                  <div className="flex flex-col sm:flex-row items-end gap-6">
                    {team.logoUrl && (
                      <div className="relative shrink-0">
                        <div className="h-56 w-44 sm:h-72 sm:w-52 lg:h-80 lg:w-60 overflow-hidden border-[3px] border-slate-700 bg-card shadow-2xl">
                          <img
                            src={team.logoUrl}
                            alt={team.name}
                            className="h-full w-full object-cover"
                          />
                        </div>
                      </div>
                    )}
                    <div className="flex-1 pb-2 min-w-0 min-h-[120px] sm:min-h-[160px] lg:min-h-[200px] flex flex-col justify-end">
                      <div className="flex items-center gap-3 flex-wrap">
                        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-foreground">
                          {team.name}
                        </h1>
                        {team.isFeatured && (
                          <span
                            className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-amber-500/30 bg-amber-500/15 text-amber-500"
                            title="مميز"
                          >
                            <Star className="h-3 w-3 fill-amber-500" />
                          </span>
                        )}
                        {team.isOfficial && (
                          <span
                            className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-primary/30 bg-primary/15 text-primary"
                            title="رسمي"
                          >
                            <Shield className="h-3 w-3" />
                          </span>
                        )}
                      </div>

                      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          {team.contactLinks.map((link, i) => (
                            <a
                              key={i}
                              href={link.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex h-9 w-9 items-center justify-center rounded-full shadow-md ring-1 ring-white/10 transition-all hover:scale-110 hover:shadow-lg hover:ring-white/25"
                              style={{ backgroundColor: CONTACT_COLORS[link.type] || '#4b5563' }}
                              title={link.label}
                            >
                              <span className="text-white">
                                {CONTACT_ICONS[link.type] || <Globe className="h-4 w-4" />}
                              </span>
                            </a>
                          ))}
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={handleShare}
                            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-slate-700 bg-slate-800/60 px-3.5 text-xs font-medium text-slate-300 transition-colors hover:border-slate-500 hover:text-white"
                          >
                            <Share2 className="h-3.5 w-3.5" /> مشاركة
                          </button>
                          {!isOwner && (
                            <button
                              onClick={handleFollowToggle}
                              disabled={followLoading}
                              className={`inline-flex h-9 items-center gap-1.5 rounded-md border px-3.5 text-xs font-medium transition-colors disabled:opacity-50 ${
                                isFollowing
                                  ? 'border-primary/40 bg-primary/10 text-primary hover:bg-primary/20'
                                  : 'border-slate-700 bg-primary text-white hover:bg-primary/90'
                              }`}
                            >
                              {isFollowing ? (
                                <UserCheck className="h-3.5 w-3.5" />
                              ) : (
                                <UserPlus className="h-3.5 w-3.5" />
                              )}
                              {isFollowing ? 'متابَع' : 'متابعة'}
                              {followersCount > 0 && (
                                <span className="text-slate-400">
                                  ({formatNumber(followersCount)})
                                </span>
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* شريط الإحصائيات */}
                <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-7">
                  <StatCell icon={Layers} label="إجمالي التعريبات" value={team.stats.modCount} />
                  <StatCell icon={Users} label="أعضاء الفريق" value={team.stats.memberCount} />
                  <StatCell
                    icon={UserPlus}
                    label="عدد المتابعين"
                    value={team.stats.followersCount}
                  />
                  <StatCell
                    icon={Download}
                    label="إجمالي التحميلات"
                    value={team.stats.totalDownloads}
                  />
                  <StatCell
                    icon={Heart}
                    label="إجمالي الإعجابات"
                    value={team.stats.totalEndorsements}
                  />
                  <StatCell icon={Eye} label="إجمالي المشاهدات" value={team.stats.totalViews} />
                  <StatCell icon={Eye} label="مشاهدات الملف" value={team.stats.profileViews ?? 0} />
                  <StatCell
                    icon={Calendar}
                    label="تاريخ الإنشاء"
                    value={new Date(team.createdAt).toLocaleDateString('ar-EG', {
                      year: 'numeric',
                      month: 'short',
                    })}
                    isText
                  />
                </div>

                {/* التبويبات */}
                <div className="mt-8 border-b border-slate-700">
                  <div className="flex gap-0">
                    {TEAM_TABS.filter((t) => {
                      const hidden = (team.hiddenTabs || '')
                        .split(',')
                        .map((s) => s.trim())
                        .filter(Boolean)
                      return !hidden.includes(t.key)
                    }).map((t) => (
                      <TabButton
                        key={t.key}
                        active={activeTab === t.key}
                        onClick={() => setActiveTab(t.key)}
                        icon={t.icon}
                        label={t.label}
                      />
                    ))}
                    {(team.customTabs || [])
                      .filter((t) => t.visible)
                      .map((ct, i) => (
                        <TabButton
                          key={`custom-${i}`}
                          active={activeTab === `custom-${i}`}
                          onClick={() => setActiveTab(`custom-${i}` as TabKey)}
                          icon={Layers}
                          label={ct.title}
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
                  {(team.customTabs || [])
                    .filter((t) => t.visible)
                    .map((ct, i) => {
                      if (activeTab === `custom-${i}`) {
                        return (
                          <div
                            key={`custom-content-${i}`}
                            className="prose prose-invert max-w-none space-y-4 text-sm leading-relaxed text-slate-300"
                          >
                            <MarkdownRenderer content={ct.content} />
                          </div>
                        )
                      }
                      return null
                    })}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
      <TeamDetailMobile
        team={team}
        loading={loading}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />
    </>
  )
}

/* خلية إحصائية */
function StatCell({
  icon: Icon,
  label,
  value,
  isText,
}: {
  icon: typeof Download
  label: string
  value: number | string
  isText?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-md border border-slate-700/80 bg-slate-800/60 px-8 py-1.5 transition-colors hover:border-slate-500">
      <span className="flex items-center gap-2 text-[10px] font-medium text-slate-400">
        <Icon className="h-3.5 w-3.5 shrink-0 text-slate-500" />
        <span className="flex flex-col leading-tight">
          {label.split(' ').map((word, i) => (
            <span key={i}>{word}</span>
          ))}
        </span>
      </span>
      <span className="text-sm font-bold tabular-nums text-slate-100">
        {isText ? (
          <span className="text-xs font-medium">{value}</span>
        ) : (
          formatNumber(value as number)
        )}
      </span>
    </div>
  )
}

/* زر تبويب */
function TabButton({
  active,
  onClick,
  icon: Icon,
  label,
}: {
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
                <span
                  className="flex h-5 w-5 items-center justify-center rounded-full text-white"
                  style={{ backgroundColor: CONTACT_COLORS[link.type] || '#4b5563' }}
                >
                  {CONTACT_ICONS[link.type] || <Globe className="h-3 w-3" />}
                </span>
                {link.label}
              </a>
            ))}
          </div>
        </section>
      )}
      {team.websiteUrl && (
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
            const role = ROLE_LABELS[m.role] || {
              label: m.role,
              icon: User,
              color: 'text-slate-400',
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
                className="flex items-center gap-3 rounded-md border border-slate-700/50 bg-slate-800/30 p-3 transition-colors hover:border-slate-600"
              >
                {avatar ? (
                  <img
                    src={avatar}
                    alt=""
                    className="h-10 w-10 rounded-full object-cover ring-1 ring-slate-700"
                  />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-700 text-sm font-bold text-slate-300">
                    {displayName.charAt(0)}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    {profileUrl ? (
                      <Link
                        href={profileUrl}
                        className="truncate text-sm font-semibold text-slate-200 hover:text-primary hover:underline"
                      >
                        {displayName}
                      </Link>
                    ) : (
                      <div className="truncate text-sm font-semibold text-slate-200">
                        {displayName}
                      </div>
                    )}
                    {profileUrl ? (
                      <Link
                        href={profileUrl}
                        className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-700/60 text-slate-400 transition-colors hover:bg-primary/20 hover:text-primary"
                        title="عرض الحساب"
                      >
                        <Link2 className="h-3 w-3" />
                      </Link>
                    ) : null}
                    {isLinked && (
                      <span title="حساب موثق">
                        <BadgeCheck className="h-4 w-4 text-green-500" />
                      </span>
                    )}
                  </div>
                  <div className={`flex items-center gap-1 text-xs ${role.color}`}>
                    <RoleIcon className="h-3 w-3" />
                    {role.label}
                  </div>
                  {bio && <div className="mt-0.5 truncate text-xs text-slate-500">{bio}</div>}
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
  return (
    <div className="space-y-6">
      {team.memberships.length > 0 ? (
        <div>
          <h3 className="mb-2 text-sm font-bold text-slate-300">قائمة الأعضاء والمساهمات</h3>
          <div className="overflow-hidden rounded-md border border-slate-700">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700 bg-slate-800/50">
                  <th className="px-4 py-2.5 text-right text-xs font-bold text-slate-400">#</th>
                  <th className="px-4 py-2.5 text-right text-xs font-bold text-slate-400">العضو</th>
                  <th className="px-4 py-2.5 text-right text-xs font-bold text-slate-400">
                    الرتبة
                  </th>
                  <th className="px-4 py-2.5 text-right text-xs font-bold text-slate-400">
                    النبذة التعريفية
                  </th>
                  <th className="px-4 py-2.5 text-center text-xs font-bold text-slate-400">
                    تاريخ الانضمام
                  </th>
                </tr>
              </thead>
              <tbody>
                {team.memberships.map((m, i) => {
                  const role = ROLE_LABELS[m.role] || {
                    label: m.role,
                    icon: User,
                    color: 'text-slate-400',
                  }
                  const RoleIcon = role.icon
                  const displayName = getMemberDisplayName(m as never)
                  const avatar = getMemberAvatar(m as never)
                  const profileUrl = getMemberProfileUrl(m as never)
                  const isLinked = isLinkedMember(m as never)
                  return (
                    <tr
                      key={m.id}
                      className="border-b border-slate-700/50 transition-colors hover:bg-slate-800/30"
                    >
                      <td className="px-4 py-2.5 text-slate-500 font-mono text-xs">{i + 1}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2.5">
                          {avatar ? (
                            <img
                              src={avatar}
                              alt=""
                              className="h-7 w-7 rounded-full object-cover ring-1 ring-slate-700"
                            />
                          ) : (
                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-700 text-xs font-bold text-slate-300">
                              {displayName.charAt(0)}
                            </div>
                          )}
                          {profileUrl ? (
                            <Link
                              href={profileUrl}
                              className="font-medium text-slate-200 hover:text-primary hover:underline"
                            >
                              {displayName}
                            </Link>
                          ) : (
                            <span className="font-medium text-slate-200">{displayName}</span>
                          )}
                          {isLinked && (
                            <span title="حساب موثق">
                              <BadgeCheck className="h-4 w-4 text-green-500" />
                            </span>
                          )}
                          {m.username && (
                            <Link
                              href={`/profile/${encodeURIComponent(m.username)}`}
                              className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-700/60 text-slate-400 transition-colors hover:bg-primary/20 hover:text-primary"
                              title="عرض الحساب"
                            >
                              <Link2 className="h-3 w-3" />
                            </Link>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`inline-flex items-center gap-1 text-xs ${role.color}`}>
                          <RoleIcon className="h-3 w-3" />
                          {role.label}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-slate-400 max-w-[200px] truncate">
                        {m.bio || '—'}
                      </td>
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
          <div className="overflow-hidden rounded-md border border-slate-700">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700 bg-slate-800/50">
                  <th className="px-4 py-2.5 text-right text-xs font-bold text-slate-400">#</th>
                  <th className="px-4 py-2.5 text-right text-xs font-bold text-slate-400">
                    التعريب
                  </th>
                  <th className="px-4 py-2.5 text-right text-xs font-bold text-slate-400">
                    اللعبة
                  </th>
                  <th className="px-4 py-2.5 text-center text-xs font-bold text-slate-400">
                    المنصة
                  </th>
                  <th className="px-4 py-2.5 text-center text-xs font-bold text-slate-400">
                    التحميلات
                  </th>
                  <th className="px-4 py-2.5 text-center text-xs font-bold text-slate-400">
                    الإعجابات
                  </th>
                  <th className="px-4 py-2.5 text-center text-xs font-bold text-slate-400">
                    المشاهدات
                  </th>
                </tr>
              </thead>
              <tbody>
                {team.mods.map((m, i) => (
                  <tr
                    key={m.id}
                    className="border-b border-slate-700/50 transition-colors hover:bg-slate-800/30"
                  >
                    <td className="px-4 py-2.5 text-slate-500 font-mono text-xs">{i + 1}</td>
                    <td className="px-4 py-2.5">
                      <Link
                        href={`/mod/${m.slug}`}
                        className="font-medium text-slate-200 hover:text-primary transition-colors"
                      >
                        {m.name}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-slate-400">{m.game?.name || '—'}</td>
                    <td className="px-4 py-2.5 text-center text-xs text-slate-400">
                      {m.game?.platform || '—'}
                    </td>
                    <td className="px-4 py-2.5 text-center font-mono text-xs tabular-nums text-slate-300">
                      {formatNumber(m.downloads)}
                    </td>
                    <td className="px-4 py-2.5 text-center font-mono text-xs tabular-nums text-slate-300">
                      {formatNumber(m.endorsements)}
                    </td>
                    <td className="px-4 py-2.5 text-center font-mono text-xs tabular-nums text-slate-300">
                      {formatNumber(m.views)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-slate-600 bg-slate-800/50 font-bold">
                  <td className="px-4 py-2.5" colSpan={4}>
                    <span className="text-xs text-slate-300">الإجمالي</span>
                  </td>
                  <td className="px-4 py-2.5 text-center font-mono text-xs tabular-nums text-slate-100">
                    {formatNumber(team.stats.totalDownloads)}
                  </td>
                  <td className="px-4 py-2.5 text-center font-mono text-xs tabular-nums text-slate-100">
                    {formatNumber(team.stats.totalEndorsements)}
                  </td>
                  <td className="px-4 py-2.5 text-center font-mono text-xs tabular-nums text-slate-100">
                    {formatNumber(team.stats.totalViews)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
