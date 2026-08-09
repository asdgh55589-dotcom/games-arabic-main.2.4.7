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
