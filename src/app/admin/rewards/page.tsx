'use client'

import { useState, useEffect } from 'react'
import { Trophy, Medal, Award, Star, TrendingUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useDocumentTitle } from '@/hooks/use-document-title'

interface LeaderboardEntry {
  rank: number
  team: { id: string; name: string; slug: string; logoUrl: string } | null
  points: number
  level: number
  achievementsCount: number
}

const LEVEL_INFO: Record<number, { nameAr: string; color: string }> = {
  1: { nameAr: 'مبتدئ', color: 'bg-gray-100 text-gray-800' },
  2: { nameAr: 'مترجم', color: 'bg-blue-100 text-blue-800' },
  3: { nameAr: 'محترف', color: 'bg-green-100 text-green-800' },
  4: { nameAr: 'خبير', color: 'bg-purple-100 text-purple-800' },
  5: { nameAr: 'مشرف', color: 'bg-amber-100 text-amber-800' },
  6: { nameAr: 'أسطورة', color: 'bg-red-100 text-red-800' },
}

const RANK_ICONS: Record<number, React.ReactNode> = {
  1: <Trophy className="h-6 w-6 text-amber-400" />,
  2: <Medal className="h-6 w-6 text-gray-400" />,
  3: <Award className="h-6 w-6 text-orange-400" />,
}

export default function RewardsPage() {
  useDocumentTitle('لوحة المكافآت')
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [timeRange, setTimeRange] = useState('all_time')

  const fetchLeaderboard = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/admin/leaderboard?range=${timeRange}`)
      const data = await response.json()
      setLeaderboard(data.leaderboard || [])
    } catch (error) {
      console.error('Failed to fetch leaderboard:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchLeaderboard() }, [timeRange])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">لوحة المكافآت</h1>
        <div className="flex gap-2">
          {[
            { key: 'all_time', label: 'كل الوقت' },
            { key: 'monthly', label: 'شهري' },
            { key: 'weekly', label: 'أسبوعي' },
          ].map(({ key, label }) => (
            <Button
              key={key}
              variant={timeRange === key ? 'default' : 'outline'}
              size="sm" className="min-h-[44px]"
              onClick={() => setTimeRange(key)}
            >
              {label}
            </Button>
          ))}
        </div>
      </div>

      {/* Top 3 */}
      {!loading && leaderboard.length >= 3 && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          {leaderboard.slice(0, 3).map((entry, idx) => (
            <div
              key={entry.team?.id}
              className={`p-4 rounded-lg border text-center ${
                idx === 0
                  ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800'
                  : idx === 1
                  ? 'bg-gray-50 dark:bg-gray-900/20 border-gray-200 dark:border-gray-800'
                  : 'bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-800'
              }`}
            >
              <div className="flex justify-center mb-2">
                {RANK_ICONS[entry.rank]}
              </div>
              <div className="font-medium">{entry.team?.name}</div>
              <div className="text-2xl font-bold mt-1">{entry.points.toLocaleString()}</div>
              <div className="text-sm text-muted-foreground">نقطة</div>
              <Badge className={`mt-2 ${LEVEL_INFO[entry.level]?.color}`}>
                {LEVEL_INFO[entry.level]?.nameAr}
              </Badge>
            </div>
          ))}
        </div>
      )}

      {/* Full Leaderboard */}
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-4 py-3 text-right font-medium">المركز</th>
              <th className="px-4 py-3 text-right font-medium">الفريق</th>
              <th className="px-4 py-3 text-right font-medium">المستوى</th>
              <th className="px-4 py-3 text-right font-medium">النقاط</th>
              <th className="px-4 py-3 text-right font-medium">الإنجازات</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                  جاري التحميل...
                </td>
              </tr>
            ) : leaderboard.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                  لا توجد بيانات
                </td>
              </tr>
            ) : (
              leaderboard.map((entry) => (
                <tr key={entry.team?.id} className="border-t hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-lg">
                        {entry.rank <= 3 ? RANK_ICONS[entry.rank] : `#${entry.rank}`}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-medium">{entry.team?.name}</td>
                  <td className="px-4 py-3">
                    <Badge className={LEVEL_INFO[entry.level]?.color}>
                      {LEVEL_INFO[entry.level]?.nameAr}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 font-bold">{entry.points.toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <Star className="h-4 w-4 text-amber-400" />
                      {entry.achievementsCount}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
