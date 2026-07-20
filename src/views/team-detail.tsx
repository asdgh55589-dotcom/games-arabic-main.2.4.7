'use client'

import { useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowRight, Users, Star, Shield, Globe, ExternalLink } from 'lucide-react'
import { ModCard, ModCardSkeleton } from '@/components/mod-card'
import { useFetch } from '@/hooks/use-fetch'
import { useDocumentTitle } from '@/hooks/use-document-title'
import { formatNumber } from '@/lib/format'

interface TeamMember {
  id: string
  name: string
  avatarUrl: string | null
  role: string
  bio: string | null
}

interface TeamDetail {
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
  modCount: number
  memberships: TeamMember[]
  mods: Array<{ id: string; name: string; slug: string; thumbnailUrl: string; downloads: number; endorsements: number }>
}

const ROLE_LABELS: Record<string, string> = {
  leader: 'قائد',
  member: 'عضو',
  guest: 'ضيف',
  tester: 'مختبر',
}

export function TeamDetailPage() {
  const searchParams = useSearchParams()
  const teamSlug = searchParams.get('team') || ''
  useDocumentTitle('فريق التعريب')

  const url = useMemo(() => {
    if (!teamSlug) return null
    return `/api/teams/${encodeURIComponent(teamSlug)}`
  }, [teamSlug])

  const { data, loading } = useFetch<{ team: TeamDetail }>(url, [url])
  const team = data?.team

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-8 lg:px-6" dir="rtl">
      {/* مسار التنقل */}
      <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/?view=teams" className="hover:text-foreground">فرق التعريب</Link>
        <ArrowRight className="h-4 w-4 rotate-180" />
        <span className="text-foreground">{team?.name || teamSlug}</span>
      </div>

      {loading ? (
        <div className="space-y-4">
          <div className="h-48 animate-pulse rounded-xl bg-muted" />
          <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        </div>
      ) : !team ? (
        <div className="grid place-items-center py-20 text-center">
          <Users className="mb-3 h-12 w-12 text-muted-foreground/50" />
          <h3 className="text-lg font-semibold">الفريق غير موجود</h3>
        </div>
      ) : (
        <>
          {/* Banner */}
          {team.bannerUrl && (
            <div className="relative mb-6 h-48 overflow-hidden rounded-xl">
              <img src={team.bannerUrl} alt="" className="h-full w-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-card via-card/50 to-transparent" />
            </div>
          )}

          {/* Header */}
          <div className="mb-8 flex items-start gap-4">
            {team.logoUrl && (
              <img src={team.logoUrl} alt="" className="h-20 w-20 rounded-xl object-cover" />
            )}
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h1 className="text-3xl font-bold tracking-tight">{team.name}</h1>
                {team.isFeatured && <Star className="h-5 w-5 fill-amber-400 text-amber-400" />}
                {team.isOfficial && <span className="rounded bg-primary/20 px-2 py-1 text-xs font-bold text-primary">رسمي</span>}
              </div>
              {team.description && (
                <p className="mt-2 text-muted-foreground">{team.description}</p>
              )}
              <p className="mt-1 text-sm text-muted-foreground">
                {formatNumber(team.modCount)} تعريب
              </p>
              {/* Links */}
              <div className="mt-3 flex gap-3">
                {team.websiteUrl && (
                  <a href={team.websiteUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-primary hover:underline">
                    <Globe className="h-3 w-3" /> الموقع
                  </a>
                )}
                {team.discordUrl && (
                  <a href={team.discordUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-primary hover:underline">
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* الأعضاء */}
          {team.memberships.length > 0 && (
            <section className="mb-8">
              <h2 className="mb-4 text-xl font-bold">الأعضاء ({team.memberships.length})</h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {team.memberships.map((m) => (
                  <div key={m.id} className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
                    {m.avatarUrl ? (
                      <img src={m.avatarUrl} alt="" className="h-10 w-10 rounded-full object-cover" />
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-sm font-bold">
                        {m.name.charAt(0)}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium">{m.name}</div>
                      <div className="text-xs text-muted-foreground">{ROLE_LABELS[m.role] || m.role}</div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* التعريبات */}
          {team.mods.length > 0 && (
            <section>
              <h2 className="mb-4 text-xl font-bold">التعريبات ({team.modCount})</h2>
              <div className="grid grid-cols-2 gap-4 sm:gap-5 sm:grid-cols-3 lg:grid-cols-4">
                {team.mods.map((m) => (
                  <ModCard key={m.id} mod={m as never} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}
