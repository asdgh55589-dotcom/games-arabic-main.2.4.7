// Updated for new API response format
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { DataTableSkeleton } from '@/components/ui/data-skeleton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { Plus, Search, Gamepad2, Edit2, Trash2, ExternalLink } from 'lucide-react'

interface GameItem {
  id: string
  slug: string
  name: string
  platform: string
  category: string
  releaseYear: number
  featured: boolean
  _count: { mods: number }
}

export default function AdminGamesPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [games, setGames] = useState<GameItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetch('/api/admin/games')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => (data?.data ? setGames(data.data) : null))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const filtered = games.filter(
    (g) =>
      !search ||
      g.name.toLowerCase().includes(search.toLowerCase()) ||
      g.platform.toLowerCase().includes(search.toLowerCase()),
  )

  const onDelete = async (game: GameItem) => {
    if (!confirm(`هل أنت متأكد من حذف اللعبة "${game.name}"؟ سيتم حذف كل التعريبات المرتبطة بها.`))
      return
    try {
      const res = await fetch(`/api/admin/games/${game.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(
          data?.error?.message ||
            (typeof data?.error === 'string' ? data.error : null) ||
            'فشل الحذف',
        )
      }
      toast({ title: 'تم الحذف', description: `تم حذف "${game.name}"` })
      setGames((p) => p.filter((g) => g.id !== game.id))
    } catch (err) {
      toast({
        title: 'خطأ',
        description: err instanceof Error ? err.message : 'فشل الحذف',
        variant: 'destructive',
      })
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">الألعاب</h1>
          <p className="mt-1 text-sm text-muted-foreground">{games.length} لعبة</p>
        </div>
        <Button onClick={() => router.push('/admin/games/new')}>
          <Plus className="ml-2 h-4 w-4" /> إضافة لعبة
        </Button>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="ابحث عن لعبة..."
          className="h-10 pr-10"
        />
      </div>

      {loading ? (
        <DataTableSkeleton rows={5} cols={4} />
      ) : filtered.length === 0 ? (
        <div className="grid place-items-center py-20 text-center">
          <Gamepad2 className="mb-3 h-12 w-12 text-muted-foreground/50" />
          <h3 className="text-lg font-semibold">لا توجد ألعاب</h3>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border">
          <table className="w-full text-right">
            <thead className="border-b border-border bg-card/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-semibold">اللعبة</th>
                <th className="hidden px-4 py-3 font-semibold sm:table-cell">المنصة</th>
                <th className="hidden px-4 py-3 font-semibold md:table-cell">الفئة</th>
                <th className="hidden px-4 py-3 font-semibold lg:table-cell">السنة</th>
                <th className="px-4 py-3 font-semibold">التعريبات</th>
                <th className="px-4 py-3 font-semibold">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((g) => (
                <tr key={g.id} className="text-sm transition-colors hover:bg-accent/30">
                  <td className="px-4 py-3 font-medium">
                    {g.name}
                    {g.featured && <span className="mr-2 text-amber-500">★</span>}
                  </td>
                  <td className="hidden px-4 py-3 sm:table-cell">
                    <Badge variant="outline" className="text-[10px]">
                      {g.platform}
                    </Badge>
                  </td>
                  <td className="hidden px-4 py-3 text-xs md:table-cell">{g.category}</td>
                  <td className="hidden px-4 py-3 text-xs lg:table-cell">{g.releaseYear}</td>
                  <td className="px-4 py-3 text-xs">{g._count.mods}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <Button
                        asChild
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 min-h-[44px] min-w-[44px]"
                        aria-label="إجراء"
                      >
                        <Link href={`/admin/games/${g.id}/edit`} title="تعديل">
                          <Edit2 className="h-4 w-4" />
                        </Link>
                      </Button>
                      <Button
                        asChild
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 min-h-[44px] min-w-[44px]"
                        aria-label="إجراء"
                      >
                        <a
                          href={`/platform/${g.platform}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="عرض"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-red-400 hover:bg-red-500/10 hover:text-red-500 min-h-[44px] min-w-[44px]"
                        onClick={() => onDelete(g)}
                        title="حذف"
                        aria-label="حذف"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
