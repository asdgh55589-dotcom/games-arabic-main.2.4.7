'use client'

import { ArrowRight, Star, TrendingUp, Trophy } from 'lucide-react'
import Link from 'next/link'
import { use, useEffect, useState } from 'react'
import { RatingDisplay } from '@/components/admin/mods/rating-display'
import { Badge } from '@/components/ui/badge'

interface TeamRewards {
  points: number
  level: number
  nameAr: string
  minPoints: number
  nextPoints: number
  progress: number
  transactions: {
    id: string
    points: number
    reason: string
    referenceType: string | null
    createdAt: string
  }[]
}

interface TeamAchievement {
  id: string
  achievement: {
    name: string
    nameAr: string
    description: string
    descriptionAr: string
    icon: string
    category: string
    points: number
  }
  earnedAt: string
}

export default function TeamRewardsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [rewards, setRewards] = useState<TeamRewards | null>(null)
  const [achievements, setAchievements] = useState<TeamAchievement[]>([])
  const [allAchievements, setAllAchievements] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [rewardsRes, achievementsRes] = await Promise.all([
          fetch(`/api/admin/teams/${id}/rewards`),
          fetch(`/api/admin/teams/${id}/achievements`),
        ])
        if (rewardsRes.ok) setRewards(await rewardsRes.json())
        if (achievementsRes.ok) {
          const data = await achievementsRes.json()
          setAchievements(data.earned || [])
          setAllAchievements(data.all || [])
        }
      } catch (error) {
        console.error('Failed to fetch team rewards:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [id])

  if (loading) return <div className="p-8 text-center text-muted-foreground">جاري التحميل...</div>

  const earnedIds = new Set(achievements.map((a) => a.achievement.name))

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin/teams" className="text-muted-foreground hover:text-foreground">
          <ArrowRight className="h-5 w-5" />
        </Link>
        <h1 className="text-2xl font-bold">مكافآت الفريق</h1>
      </div>

      {/* Level & Points */}
      {rewards && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-6 rounded-lg border bg-card">
            <div className="flex items-center gap-3 mb-3">
              <Trophy className="h-8 w-8 text-amber-400" />
              <div>
                <div className="text-3xl font-bold">{rewards.level}</div>
                <div className="text-sm text-muted-foreground">{rewards.nameAr}</div>
              </div>
            </div>
            <div className="w-full bg-muted rounded-full h-2">
              <div
                className="bg-primary h-2 rounded-full transition-all"
                style={{ width: `${rewards.progress}%` }}
              />
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {rewards.points} / {rewards.nextPoints} نقطة للمستوى التالي
            </div>
          </div>

          <div className="p-6 rounded-lg border bg-card text-center">
            <TrendingUp className="h-8 w-8 text-primary mx-auto mb-2" />
            <div className="text-3xl font-bold">{rewards.points.toLocaleString()}</div>
            <div className="text-sm text-muted-foreground">نقطة إجمالية</div>
          </div>

          <div className="p-6 rounded-lg border bg-card text-center">
            <Star className="h-8 w-8 text-amber-400 mx-auto mb-2" />
            <div className="text-3xl font-bold">{achievements.length}</div>
            <div className="text-sm text-muted-foreground">إنجاز مكتسب</div>
          </div>
        </div>
      )}

      {/* Achievements Grid */}
      <div>
        <h2 className="text-lg font-bold mb-4">الإنجازات</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {allAchievements.map((ach: any) => {
            const isEarned = earnedIds.has(ach.name)
            return (
              <div
                key={ach.id}
                className={`p-4 rounded-lg border text-center ${
                  isEarned ? 'bg-primary/5 border-primary/20' : 'bg-muted/30 opacity-50'
                }`}
              >
                <div className="text-2xl mb-2">{isEarned ? '🏆' : '🔒'}</div>
                <div className="font-medium text-sm">{ach.nameAr}</div>
                <div className="text-xs text-muted-foreground mt-1">{ach.descriptionAr}</div>
                <Badge variant="secondary" className="mt-2 text-xs">
                  +{ach.points} نقطة
                </Badge>
              </div>
            )
          })}
        </div>
      </div>

      {/* Points History */}
      {rewards && rewards.transactions.length > 0 && (
        <div>
          <h2 className="text-lg font-bold mb-4">سجل النقاط</h2>
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-right font-medium">التاريخ</th>
                  <th className="px-4 py-3 text-right font-medium">السبب</th>
                  <th className="px-4 py-3 text-right font-medium">النقاط</th>
                </tr>
              </thead>
              <tbody>
                {rewards.transactions.map((tx) => (
                  <tr key={tx.id} className="border-t">
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Date(tx.createdAt).toLocaleDateString('ar-SA')}
                    </td>
                    <td className="px-4 py-3">{tx.reason}</td>
                    <td className="px-4 py-3 font-bold">
                      <span className={tx.points > 0 ? 'text-green-600' : 'text-red-600'}>
                        {tx.points > 0 ? '+' : ''}
                        {tx.points}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
