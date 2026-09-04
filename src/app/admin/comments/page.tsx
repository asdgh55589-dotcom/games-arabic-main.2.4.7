// Updated for new API response format
'use client'

import { useEffect, useState, useCallback } from 'react'
import { Loader2, MessageSquare, Trash2, Pin, PinOff, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatNumber, timeAgo } from '@/lib/format'
import { useToast } from '@/hooks/use-toast'

interface Comment {
  id: string
  text: string
  guestName: string
  likes: number
  dislikes: number
  isPinned: boolean
  createdAt: string
  mod: { id: string; name: string; slug: string }
  user: { id: string; username: string; avatarUrl: string | null } | null
}

export default function AdminCommentsPage() {
  const { toast } = useToast()
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)

  const fetchComments = useCallback(() => {
    setLoading(true)
    setError(null)
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    params.set('page', String(page))
    params.set('limit', '50')
    fetch(`/api/admin/comments?${params}`)
      .then((r) => {
        if (!r.ok) throw new Error('Failed')
        return r.json()
      })
      .then((data) => {
        setComments(data.data)
        setTotalPages(data.pagination.totalPages)
        setTotal(data.pagination.total)
      })
      .catch(() => setError('فشل تحميل التعليقات'))
      .finally(() => setLoading(false))
  }, [search, page])

  useEffect(() => {
    fetchComments()
  }, [page, search])

  const onDelete = async (comment: Comment) => {
    if (!confirm('هل أنت متأكد من حذف هذا التعليق؟')) return
    try {
      const res = await fetch(`/api/admin/comments/${comment.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('فشل الحذف')
      toast({ title: 'تم الحذف' })
      setComments((p) => p.filter((c) => c.id !== comment.id))
      setTotal((t) => t - 1)
    } catch (err) {
      toast({
        title: 'خطأ',
        description: err instanceof Error ? err.message : 'فشل',
        variant: 'destructive',
      })
    }
  }

  const onTogglePin = async (comment: Comment) => {
    try {
      const res = await fetch(`/api/admin/comments/${comment.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPinned: !comment.isPinned }),
      })
      if (!res.ok) throw new Error('فشل التحديث')
      toast({ title: comment.isPinned ? 'تم إلغاء التثبيت' : 'تم التثبيت' })
      setComments((p) => p.map((c) => (c.id === comment.id ? { ...c, isPinned: !c.isPinned } : c)))
    } catch (err) {
      toast({
        title: 'خطأ',
        description: err instanceof Error ? err.message : 'فشل',
        variant: 'destructive',
      })
    }
  }

  if (loading && comments.length === 0) {
    return (
      <div className="grid place-items-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="grid place-items-center py-20 text-center">
        <p className="text-sm text-destructive">{error}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">التعليقات</h1>
        <p className="mt-1 text-sm text-muted-foreground">{total} تعليق إجمالي</p>
      </div>

      {/* البحث */}
      <div className="relative">
        <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setPage(1)
          }}
          placeholder="ابحث في التعليقات..."
          className="h-10 pr-10"
        />
      </div>

      {/* القائمة — responsive: table on desktop, cards on mobile */}
      {comments.length === 0 ? (
        <div className="grid place-items-center py-20 text-center">
          <MessageSquare className="mb-3 h-12 w-12 text-muted-foreground/50" />
          <h3 className="text-lg font-semibold">لا توجد تعليقات</h3>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block overflow-hidden rounded-xl border border-border bg-card">
            <table className="w-full text-right">
              <thead className="border-b border-border bg-card/50 text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-semibold">الكاتب</th>
                  <th className="px-4 py-3 font-semibold">التعليق</th>
                  <th className="px-4 py-3 font-semibold">التعريب</th>
                  <th className="px-4 py-3 font-semibold">الإعجابات</th>
                  <th className="px-4 py-3 font-semibold">الحالة</th>
                  <th className="px-4 py-3 font-semibold">التاريخ</th>
                  <th className="px-4 py-3 font-semibold">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {comments.map((c) => (
                  <tr
                    key={c.id}
                    className={`text-sm transition-colors hover:bg-accent/30 ${c.isPinned ? 'bg-primary/5' : ''}`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground">
                          {c.user?.username || c.guestName}
                        </span>
                        {c.isPinned && <Pin className="h-3 w-3 shrink-0 text-primary" />}
                      </div>
                    </td>
                    <td className="max-w-[320px] px-4 py-3">
                      <p className="line-clamp-2 text-sm leading-5 text-muted-foreground">
                        {c.text}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <span className="rounded-md bg-background-secondary px-2 py-1 font-medium">
                        {c.mod.name}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <div className="flex items-center gap-3">
                        <span>👍 {formatNumber(c.likes)}</span>
                        <span>👎 {formatNumber(c.dislikes)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {c.isPinned ? (
                        <Badge variant="default" className="gap-1 text-[10px]">
                          <Pin className="h-3 w-3" /> مثبت
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {timeAgo(c.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 min-h-[44px] min-w-[44px]"
                          onClick={() => onTogglePin(c)}
                          title={c.isPinned ? 'إلغاء التثبيت' : 'تثبيت'}
                          aria-label={c.isPinned ? 'إلغاء التثبيت' : 'تثبيت'}
                        >
                          {c.isPinned ? (
                            <PinOff className="h-4 w-4" />
                          ) : (
                            <Pin className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-red-400 hover:bg-red-500/10 min-h-[44px] min-w-[44px]"
                          onClick={() => onDelete(c)}
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

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {comments.map((c) => (
              <Card
                key={c.id}
                className={`overflow-hidden ${c.isPinned ? 'border-primary/40' : ''}`}
              >
                <CardContent className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-bold">{c.user?.username || c.guestName}</span>
                        {c.isPinned ? (
                          <Badge variant="default" className="gap-1 text-[10px]">
                            <Pin className="h-3 w-3" /> مثبت
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px]">
                            غير مثبت
                          </Badge>
                        )}
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                        <span>على {c.mod.name}</span>
                        <span>•</span>
                        <span>{timeAgo(c.createdAt)}</span>
                      </div>
                    </div>
                  </div>

                  <p className="text-sm leading-6 text-muted-foreground">{c.text}</p>

                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="rounded-full bg-background-secondary px-3 py-1.5 font-medium">
                      👍 {formatNumber(c.likes)}
                    </span>
                    <span className="rounded-full bg-background-secondary px-3 py-1.5 font-medium">
                      👎 {formatNumber(c.dislikes)}
                    </span>
                    <span className="rounded-full bg-background-secondary px-3 py-1.5 font-medium">
                      {c.mod.name}
                    </span>
                  </div>

                  <div className="flex gap-2 pt-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="min-h-[44px] flex-1 gap-2"
                      onClick={() => onTogglePin(c)}
                      aria-label={c.isPinned ? 'إلغاء التثبيت' : 'تثبيت'}
                    >
                      {c.isPinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                      {c.isPinned ? 'إلغاء التثبيت' : 'تثبيت'}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="min-h-[44px] flex-1 gap-2 text-red-400 hover:bg-red-500/10 hover:text-red-500"
                      onClick={() => onDelete(c)}
                      aria-label="حذف التعليق"
                    >
                      <Trash2 className="h-4 w-4" />
                      حذف
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="min-h-[44px]"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            السابق
          </Button>
          <span className="text-sm text-muted-foreground">
            صفحة {page} من {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            className="min-h-[44px]"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            التالي
          </Button>
        </div>
      )}
    </div>
  )
}
