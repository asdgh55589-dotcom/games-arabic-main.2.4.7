'use client'

import { Heart, MessageSquareHeart, Star, TrendingUp } from 'lucide-react'
import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { timeAgo } from '@/lib/format'
import { useStudioLanguage } from '@/lib/studio-i18n/context'

interface PerMod {
  modId: string
  name: string
  slug: string
  endorsements: number
  commentLikes: number
  ratings: number
  avgRating: number | null
}

interface RecentItem {
  type: 'endorsement' | 'commentLike' | 'rating'
  username: string
  value: string | null
  modName: string
  modSlug: string
  createdAt: string
}

interface LikesData {
  range: number
  summary: {
    endorsements: number
    endorsementsDelta: number
    endorsementsTotal: number
    commentLikes: number
    commentLikesDelta: number
    commentLikesTotal: number
    ratings: number
    ratingsDelta: number
    ratingsTotal: number
    avgRating: number | null
    topMod: PerMod | null
  }
  mods: PerMod[]
  recent: RecentItem[]
}

type SortKey = 'total' | 'endorsements' | 'commentLikes' | 'ratings'

function Delta({ value }: { value: number }) {
  const up = value >= 0
  return (
    <span dir="ltr" className={up ? 'text-green-600' : 'text-red-500'}>
      {up ? '+' : ''}
      {value}%
    </span>
  )
}

export function LikesClient() {
  const { dict, locale, formatNumber } = useStudioLanguage()
  const t = dict.likes
  const [range, setRange] = useState(30)
  const [data, setData] = useState<LikesData | null>(null)
  const [loading, setLoading] = useState(true)
  const [sortKey, setSortKey] = useState<SortKey>('total')

  const fetchLikes = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/creator/likes?range=${range}`, { cache: 'no-store' })
      const json = await res.json()
      if (res.ok) setData(json.data)
    } catch {
      // empty state on failure
    }
    setLoading(false)
  }, [range])

  useEffect(() => {
    fetchLikes()
  }, [fetchLikes])

  const score = (m: PerMod) =>
    sortKey === 'endorsements'
      ? m.endorsements
      : sortKey === 'commentLikes'
        ? m.commentLikes
        : sortKey === 'ratings'
          ? m.ratings
          : m.endorsements + m.commentLikes + m.ratings
  const mods = [...(data?.mods ?? [])].sort((a, b) => score(b) - score(a))
  const s = data?.summary

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        {[7, 30, 90].map((r) => (
          <Button
            key={r}
            variant={range === r ? 'default' : 'outline'}
            size="sm"
            onClick={() => setRange(r)}
          >
            <span dir="ltr">{r}d</span>
          </Button>
        ))}
        <div className="flex gap-1 items-center ms-auto">
          <span className="text-xs text-muted-foreground">{t.sortBy}:</span>
          {(['total', 'endorsements', 'commentLikes', 'ratings'] as SortKey[]).map((k) => (
            <Button
              key={k}
              variant={sortKey === k ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setSortKey(k)}
            >
              {k === 'total' ? t.total : k === 'endorsements' ? t.endorsements : k === 'commentLikes' ? t.commentLikes : t.ratings}
            </Button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="py-8 text-center text-muted-foreground">…</CardContent>
            </Card>
          ))}
        </div>
      ) : !s || (s.endorsements === 0 && s.commentLikes === 0 && s.ratings === 0) ? (
        <EmptyState icon="heart" title={t.empty} description={t.subtitle} />
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                  <Heart className="h-4 w-4" /> {t.endorsements}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatNumber(s.endorsements)}</div>
                <div className="text-xs">
                  <Delta value={s.endorsementsDelta} />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                  <MessageSquareHeart className="h-4 w-4" /> {t.commentLikes}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatNumber(s.commentLikes)}</div>
                <div className="text-xs">
                  <Delta value={s.commentLikesDelta} />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                  <Star className="h-4 w-4" /> {t.ratings}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatNumber(s.ratings)}</div>
                <div className="text-xs">
                  <Delta value={s.ratingsDelta} /> • {t.avgRating}: {s.avgRating ?? '—'}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                  <TrendingUp className="h-4 w-4" /> {t.topMod}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-lg font-bold truncate">
                  {s.topMod ? s.topMod.name : t.noneYet}
                </div>
                <div className="text-xs text-muted-foreground">
                  {s.topMod
                    ? `${formatNumber(s.topMod.endorsements + s.topMod.commentLikes + s.topMod.ratings)}`
                    : '—'}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t.perMod}</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-start">{t.mod}</TableHead>
                    <TableHead>{t.endorsements}</TableHead>
                    <TableHead>{t.commentLikes}</TableHead>
                    <TableHead>{t.ratings}</TableHead>
                    <TableHead>{t.avgRating}</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mods.map((m) => (
                    <TableRow key={m.modId}>
                      <TableCell className="font-medium">{m.name}</TableCell>
                      <TableCell>{formatNumber(m.endorsements)}</TableCell>
                      <TableCell>{formatNumber(m.commentLikes)}</TableCell>
                      <TableCell>{formatNumber(m.ratings)}</TableCell>
                      <TableCell>{m.avgRating ?? '—'}</TableCell>
                      <TableCell>
                        <Link
                          href={`/mod/${m.slug}`}
                          target="_blank"
                          className="text-xs text-primary hover:underline"
                        >
                          {t.openMod}
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t.recent}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {(data?.recent ?? []).map((r, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm flex-wrap">
                    <Badge variant="outline" className="text-xs">
                      {r.type === 'endorsement' ? t.endorsements : r.type === 'commentLike' ? t.commentLikes : t.ratings}
                    </Badge>
                    <bdi className="font-medium">{r.username}</bdi>
                    {r.value && <span className="text-amber-500">{t.avgRating}: {r.value}</span>}
                    <span className="text-muted-foreground">{r.modName}</span>
                    <span className="text-xs text-muted-foreground ms-auto">
                      {timeAgo(r.createdAt, locale)}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
