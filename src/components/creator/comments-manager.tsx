'use client'

import { Eye, EyeOff, Loader2, Reply, Send, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { timeAgo } from '@/lib/format'

interface CommentItem {
  id: string
  text: string
  isHidden: boolean
  isPinned: boolean
  createdAt: string
  user: { id: string; username: string; avatarUrl: string | null; role: string } | null
  mod: { id: string; name: string; slug: string }
}

export function CommentsManager() {
  const { toast } = useToast()
  const [filter, setFilter] = useState<'all' | 'visible' | 'hidden'>('all')
  const [comments, setComments] = useState<CommentItem[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [replyTo, setReplyTo] = useState<string | null>(null)
  const [replyText, setReplyText] = useState('')
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const fetchComments = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('page', String(page))
      params.set('limit', '20')
      if (filter !== 'all') params.set('filter', filter)
      const res = await fetch(`/api/creator/comments?${params.toString()}`, { cache: 'no-store' })
      const json = await res.json()
      if (res.ok) {
        setComments(json.data?.comments || [])
        setTotalPages(json.data?.pagination?.totalPages || 1)
      }
    } catch {}
    setLoading(false)
  }, [filter, page])

  useEffect(() => {
    fetchComments()
  }, [fetchComments])

  const handleAction = async (id: string, action: 'hide' | 'unhide' | 'delete') => {
    if (action === 'delete' && !confirm('هل أنت متأكد من حذف هذا التعليق؟')) return
    setActionLoading(id)
    try {
      const res = await fetch(`/api/creator/comments/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const json = await res.json()
      if (res.ok) {
        toast({ title: json.data?.message || 'تم بنجاح' })
        fetchComments()
      } else {
        toast({ title: json.error?.message || 'فشل', variant: 'destructive' })
      }
    } catch {
      toast({ title: 'حدث خطأ', variant: 'destructive' })
    }
    setActionLoading(null)
  }

  const handleReply = async (comment: CommentItem) => {
    if (!replyText.trim()) {
      toast({ title: 'اكتب رداً أولاً', variant: 'destructive' })
      return
    }
    setActionLoading(comment.id)
    try {
      // Use existing mod comment reply API
      const modRes = await fetch(`/api/mods/${comment.mod.slug}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: replyText.trim(), parentId: comment.id }),
      })
      const json = await modRes.json()
      if (modRes.ok) {
        toast({ title: 'تم إرسال الرد' })
        setReplyTo(null)
        setReplyText('')
      } else {
        toast({ title: json.error?.message || 'فشل الإرسال', variant: 'destructive' })
      }
    } catch {
      toast({ title: 'حدث خطأ', variant: 'destructive' })
    }
    setActionLoading(null)
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        {[
          { value: 'all', label: 'الكل' },
          { value: 'visible', label: 'ظاهر' },
          { value: 'hidden', label: 'مخفي' },
        ].map((f) => (
          <Button
            key={f.value}
            variant={filter === f.value ? 'default' : 'outline'}
            size="sm"
            onClick={() => {
              setFilter(f.value as never)
              setPage(1)
            }}
          >
            {f.label}
          </Button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : comments.length === 0 ? (
        <EmptyState
          icon="file"
          title="لا توجد تعليقات"
          description="ستظهر تعليقات المستخدمين على تعريباتك هنا"
        />
      ) : (
        <div className="space-y-3">
          {comments.map((c) => (
            <Card key={c.id} className={c.isHidden ? 'opacity-60 border-dashed' : ''}>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarImage src={c.user?.avatarUrl || undefined} />
                    <AvatarFallback>{c.user?.username?.[0]?.toUpperCase() || '?'}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{c.user?.username || 'مجهول'}</span>
                      <Badge variant="outline" className="text-xs">
                        {c.mod.name}
                      </Badge>
                      {c.isHidden && (
                        <Badge variant="destructive" className="text-xs">
                          مخفي
                        </Badge>
                      )}
                      <span className="text-xs text-muted-foreground">{timeAgo(c.createdAt)}</span>
                    </div>
                    <p className="text-sm mt-2 whitespace-pre-wrap">{c.text}</p>
                    <div className="flex items-center gap-2 mt-3">
                      <Link
                        href={`/mod/${c.mod.slug}`}
                        target="_blank"
                        className="text-xs text-primary hover:underline"
                      >
                        عرض التعريب
                      </Link>
                      <span className="text-muted-foreground">•</span>
                      <button
                        onClick={() => setReplyTo(replyTo === c.id ? null : c.id)}
                        className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                      >
                        <Reply className="h-3 w-3" /> رد
                      </button>
                    </div>
                    {replyTo === c.id && (
                      <div className="mt-3 flex gap-2">
                        <Textarea
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          placeholder="اكتب ردك..."
                          rows={2}
                          className="flex-1"
                        />
                        <Button
                          size="sm"
                          onClick={() => handleReply(c)}
                          disabled={actionLoading === c.id || !replyText.trim()}
                          className="shrink-0"
                        >
                          {actionLoading === c.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Send className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {c.isHidden ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleAction(c.id, 'unhide')}
                        disabled={actionLoading === c.id}
                        aria-label="إظهار"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleAction(c.id, 'hide')}
                        disabled={actionLoading === c.id}
                        aria-label="إخفاء"
                      >
                        <EyeOff className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleAction(c.id, 'delete')}
                      disabled={actionLoading === c.id}
                      aria-label="حذف"
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            السابق
          </Button>
          <span className="flex items-center px-3 text-sm text-muted-foreground">
            صفحة {page} من {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
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
