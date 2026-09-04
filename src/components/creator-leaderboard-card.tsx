'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Trophy, Medal } from 'lucide-react'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { TierBadge } from '@/components/tier-badge'

interface LeaderEntry {
  user: { id: string; username: string; avatarUrl: string | null; role: string; tier: number }
  publishedCount: number
  totalDownloads: number
}

export function CreatorLeaderboardCard() {
  const [entries, setEntries] = useState<LeaderEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/leaderboard/creators', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        const list = json?.data || json || []
        if (Array.isArray(list) && list.length > 0) {
          setEntries(
            list
              .slice(0, 5)
              .map(
                (item: {
                  user: LeaderEntry['user']
                  publishedCount: number
                  totalDownloads: number
                }) => ({
                  user: item.user,
                  publishedCount: item.publishedCount,
                  totalDownloads: item.totalDownloads,
                }),
              ),
          )
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
      <div className="border-b-[3px] border-border bg-yellow-500/10 px-4 py-3">
        <h3 className="flex items-center gap-2 text-sm font-black uppercase tracking-wider text-foreground">
          <Trophy className="h-4 w-4 text-yellow-500" />
          الصدارة
          <span className="text-[10px] font-bold text-muted-foreground">— المُعَرِّبون فقط</span>
        </h3>
        <p className="mt-1 text-[11px] font-semibold text-muted-foreground">
          أفضل المُعَرِّبين حسب المستوى والإنجاز
        </p>
      </div>
      <div className="divide-y divide-border/50">
        {loading ? (
          <>
            <div className="h-14 animate-pulse bg-muted/30" />
            <div className="h-14 animate-pulse bg-muted/30" />
            <div className="h-14 animate-pulse bg-muted/30" />
          </>
        ) : entries.length === 0 ? (
          <div className="py-8 text-center">
            <Trophy className="mx-auto h-8 w-8 text-muted-foreground/30" />
            <p className="mt-2 text-xs font-semibold text-muted-foreground">لا يوجد مُعَرِّبون بعد</p>
            <Link
              href="/become-creator"
              className="mt-2 inline-block text-xs text-primary hover:underline"
            >
              كن أول مُعَرِّب
            </Link>
          </div>
        ) : (
          entries.map((entry, idx) => (
            <Link
              key={entry.user.id}
              href={`/profile/${encodeURIComponent(entry.user.username)}`}
              className="flex items-center gap-3 px-3 py-3 hover:bg-accent/50 transition-colors"
            >
              <span className="w-6 text-center">
                {idx === 0 ? (
                  <Trophy className="h-4 w-4 text-yellow-500 mx-auto" />
                ) : idx === 1 ? (
                  <Medal className="h-4 w-4 text-gray-400 mx-auto" />
                ) : idx === 2 ? (
                  <Medal className="h-4 w-4 text-amber-600 mx-auto" />
                ) : (
                  <span className="text-xs font-bold text-muted-foreground">{idx + 1}</span>
                )}
              </span>
              <Avatar className="h-8 w-8">
                <AvatarImage src={entry.user.avatarUrl || undefined} />
                <AvatarFallback>{entry.user.username[0]?.toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="truncate text-sm font-bold">{entry.user.username}</div>
                <div className="flex items-center gap-1 mt-0.5">
                  <TierBadge role={entry.user.role} tier={entry.user.tier} size="sm" />
                </div>
              </div>
              <div className="text-xs text-muted-foreground">{entry.publishedCount} تعريب</div>
            </Link>
          ))
        )}
      </div>
      <div className="border-t-[3px] border-border p-2 text-center">
        <Link
          href="/leaderboard/creators"
          className="text-xs font-bold text-primary hover:underline"
        >
          عرض كل المتصدرين →
        </Link>
      </div>
    </div>
  )
}
