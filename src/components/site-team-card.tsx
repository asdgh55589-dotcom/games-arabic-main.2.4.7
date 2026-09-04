'use client'

import Image from 'next/image'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Users, Crown, Shield, UserCheck, User, Circle, Clock } from 'lucide-react'
import { timeAgo } from '@/lib/format'

interface SiteMember {
  id: string
  username: string
  avatarUrl: string | null
  role: string
  tier: number
  joinedAt: string
  lastLoginAt: string | null
  isOnline: boolean
}

const ROLE_CONFIG: Record<
  string,
  { label: string; icon: typeof Crown; bg: string; color: string }
> = {
  owner: { label: 'مالك الموقع', icon: Crown, bg: 'bg-amber-500', color: 'text-amber-500' },
  manager: { label: 'مدير عام', icon: Shield, bg: 'bg-orange-500', color: 'text-orange-500' },
  admin: { label: 'إداري', icon: Shield, bg: 'bg-red-500', color: 'text-red-500' },
  moderator: { label: 'مشرف', icon: UserCheck, bg: 'bg-purple-500', color: 'text-purple-500' },
}

function getRoleConfig(role: string) {
  return (
    ROLE_CONFIG[role] || { label: role, icon: User, bg: 'bg-slate-500', color: 'text-slate-400' }
  )
}

function MemberRow({ member }: { member: SiteMember }) {
  const config = getRoleConfig(member.role)
  const RoleIcon = config.icon
  const lastActive = member.lastLoginAt ? timeAgo(member.lastLoginAt) : 'غير معروف'

  return (
    <Link
      href={`/profile/${encodeURIComponent(member.username)}`}
      className="group flex items-center gap-3 px-3 py-3 transition-all duration-150 hover:bg-accent/50 border-r-[3px] border-transparent hover:border-primary"
    >
      {/* Avatar with online dot */}
      <div className="relative shrink-0">
        {member.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <Image
            unoptimized
            width={40}
            height={40}
            src={member.avatarUrl}
            alt={member.username}
            className="h-11 w-11 rounded-full object-cover border-2 border-border group-hover:border-primary/30 transition-colors"
            loading="lazy"
          />
        ) : (
          <div className="grid h-11 w-11 place-items-center rounded-full border-2 border-border bg-muted text-sm font-black text-muted-foreground group-hover:border-primary/30 transition-colors">
            {member.username.charAt(0).toUpperCase()}
          </div>
        )}
        {/* Online status dot */}
        <span
          className={`absolute -bottom-0.5 -right-0.5 grid h-3.5 w-3.5 place-items-center rounded-full border-2 border-card ${
            member.isOnline ? 'bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.6)]' : 'bg-gray-400'
          }`}
          title={member.isOnline ? 'متصل الآن' : `آخر ظهور ${lastActive}`}
        >
          {member.isOnline && <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />}
        </span>
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="truncate text-sm font-bold leading-none text-foreground group-hover:text-primary transition-colors">
            {member.username}
          </span>
          <span
            className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none text-white ${config.bg}`}
          >
            <RoleIcon className="h-3 w-3" />
            {config.label}
          </span>
        </div>
        <div className="mt-1 flex items-center gap-1.5 text-[11px]">
          <span
            className={`h-1.5 w-1.5 shrink-0 rounded-full ${member.isOnline ? 'bg-green-500' : 'bg-gray-400'}`}
          />
          {member.isOnline ? (
            <span className="font-bold text-green-500">متصل الآن</span>
          ) : (
            <span className="flex items-center gap-1 text-muted-foreground">
              <Clock className="h-3 w-3" />
              آخر ظهور {lastActive}
            </span>
          )}
        </div>
      </div>

      {/* Arrow indicator */}
      <Circle className="h-3 w-3 shrink-0 text-muted-foreground/30 group-hover:text-primary/60 transition-colors fill-current opacity-0 group-hover:opacity-100" />
    </Link>
  )
}

function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 px-3 py-3">
      <div className="h-11 w-11 rounded-full bg-muted animate-pulse" />
      <div className="flex-1 space-y-2">
        <div className="h-3 w-24 bg-muted rounded animate-pulse" />
        <div className="h-2.5 w-32 bg-muted rounded animate-pulse" />
      </div>
    </div>
  )
}

export function SiteTeamCard() {
  const [members, setMembers] = useState<SiteMember[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/site-team')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.data && Array.isArray(data.data)) {
          setMembers(data.data)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <div
      className="border-[3px] border-border bg-card shadow-[4px_4px_0_0_var(--border)]"
      dir="rtl"
    >
      {/* Header */}
      <div className="border-b-[3px] border-border bg-primary/10 px-4 py-3">
        <h3 className="flex items-center gap-2 text-sm font-black uppercase tracking-wider text-foreground">
          <Users className="h-4 w-4 text-primary" />
          فريق الموقع
        </h3>
        <p className="mt-1 text-[11px] font-semibold text-muted-foreground">
          طاقم الإدارة والمسؤولون عن الموقع
        </p>
      </div>

      {/* Body */}
      <div className="divide-y divide-border/50">
        {loading ? (
          <>
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </>
        ) : members.length === 0 ? (
          <div className="py-8 text-center">
            <Users className="mx-auto h-8 w-8 text-muted-foreground/30" />
            <p className="mt-2 text-xs font-semibold text-muted-foreground">
              لا يوجد مسؤولون حالياً
            </p>
          </div>
        ) : (
          members.map((m) => <MemberRow key={m.id} member={m} />)
        )}
      </div>

      {/* Footer — optional link */}
      {!loading && members.length > 0 && (
        <div className="border-t-2 border-border/60 bg-muted/20 px-3 py-2">
          <div className="flex items-center justify-between text-[11px]">
            <span className="font-semibold text-muted-foreground">
              {members.filter((m) => m.isOnline).length} متصل الآن • {members.length} إجمالي
            </span>
            <span className="flex items-center gap-1 font-bold text-primary">
              <Circle className="h-2 w-2 fill-green-500 text-green-500 animate-pulse" />
              مباشر
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

export function SiteTeamCardSkeleton() {
  return (
    <div className="border-[3px] border-border bg-card shadow-[4px_4px_0_0_var(--border)]">
      <div className="border-b-[3px] border-border bg-primary/10 px-4 py-3">
        <div className="h-4 w-24 bg-muted rounded animate-pulse" />
        <div className="mt-2 h-3 w-32 bg-muted rounded animate-pulse" />
      </div>
      <div className="divide-y divide-border/50">
        <SkeletonRow />
        <SkeletonRow />
      </div>
    </div>
  )
}
