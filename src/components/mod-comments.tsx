'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  ThumbsUp,
  Reply,
  Flag,
  Edit2,
  MoreVertical,
  Send,
  MessageSquare,
  Pin,
  Heart,
  Loader2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { formatNumber, timeAgo } from '@/lib/format'
import { useToast } from '@/hooks/use-toast'
import type { ModCommentType } from '@/lib/types'

interface ModCommentsProps {
  modSlug: string
  modOwnerName?: string
}

type SortMode = 'newest' | 'popular' | 'oldest'

interface CurrentUser {
  id: string
  username: string
  email: string
  role: string
  avatarUrl?: string | null
}

const PAGE_SIZE = 20
const MAX_DEPTH = 7

export function ModComments({ modSlug, modOwnerName }: ModCommentsProps) {
  const { toast } = useToast()
  const [comments, setComments] = useState<ModCommentType[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [sortMode, setSortMode] = useState<SortMode>('newest')
  const [page, setPage] = useState(1)
  const [newComment, setNewComment] = useState('')
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set())
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [replyText, setReplyText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)
  const [authLoading, setAuthLoading] = useState(true)

  // التحقق من تسجيل الدخول
  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((data) => setCurrentUser(data?.user || null))
      .catch(() => setCurrentUser(null))
      .finally(() => setAuthLoading(false))
  }, [])

  const fetchComments = useCallback(async () => {
    try {
      const res = await fetch(`/api/mods/${modSlug}/comments?sort=${sortMode}`)
      if (!res.ok) return
      const data = await res.json()
      setComments(data.comments || [])
      setTotalCount(data.total || 0)
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [modSlug, sortMode])

  useEffect(() => {
    setLoading(true)
    setPage(1)
    fetchComments()
  }, [fetchComments])

  const totalPages = Math.ceil(totalCount / PAGE_SIZE)
  const paginatedComments = comments.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const toggleLike = (id: string) => {
    setLikedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
    fetch(`/api/comments/${id}/like`, { method: 'POST' }).catch(() => {})
  }

  const onSubmitComment = async () => {
    if (!newComment.trim() || submitting) return
    if (!currentUser) {
      toast({ title: 'سجّل الدخول', description: 'يجب تسجيل الدخول للتعليق', variant: 'destructive' })
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch(`/api/mods/${modSlug}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: newComment.trim() }),
      })
      if (!res.ok) {
        const data = await res.json()
        if (data.code === 'AUTH_REQUIRED') {
          toast({ title: 'سجّل الدخول', description: 'يجب تسجيل الدخول للتعليق', variant: 'destructive' })
          return
        }
        throw new Error(data?.error || 'فشل النشر')
      }
      setNewComment('')
      toast({ title: 'تم نشر التعليق', description: 'تعليقك تم نشره بنجاح' })
      await fetchComments()
    } catch (err) {
      toast({
        title: 'خطأ',
        description: err instanceof Error ? err.message : 'فشل النشر',
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  const onSubmitReply = async (parentId: string) => {
    if (!replyText.trim() || submitting) return
    if (!currentUser) {
      toast({ title: 'سجّل الدخول', description: 'يجب تسجيل الدخول للرد', variant: 'destructive' })
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch(`/api/mods/${modSlug}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: replyText.trim(), parentId }),
      })
      if (!res.ok) {
        const data = await res.json()
        if (data.code === 'AUTH_REQUIRED') {
          toast({ title: 'سجّل الدخول', description: 'يجب تسجيل الدخول للرد', variant: 'destructive' })
          return
        }
        throw new Error(data?.error || 'فشل النشر')
      }
      setReplyText('')
      setReplyingTo(null)
      toast({ title: 'تم نشر الرد', description: 'ردك تم نشره بنجاح' })
      await fetchComments()
    } catch (err) {
      toast({
        title: 'خطأ',
        description: err instanceof Error ? err.message : 'فشل النشر',
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  const onReport = (name: string) => {
    toast({
      title: 'تم إرسال البلاغ',
      description: `سيتم مراجعة بلاغك على تعليق ${name}.`,
    })
  }

  const SORT_OPTIONS: { value: SortMode; label: string }[] = [
    { value: 'newest', label: 'الأحدث' },
    { value: 'popular', label: 'الأكثر إعجاباً' },
    { value: 'oldest', label: 'الأقدم' },
  ]

  return (
    <div>
      {/* رأس القسم */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
        <h2 className="flex items-center gap-2 text-xl font-bold">
          <MessageSquare className="h-5 w-5 text-primary" />
          التعليقات
          <Badge variant="secondary" className="mr-1">{formatNumber(totalCount)}</Badge>
        </h2>

        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">ترتيب:</span>
          <div className="flex gap-1 rounded-md border border-border p-0.5">
            {SORT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setSortMode(opt.value)}
                className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                  sortMode === opt.value
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* صندوق كتابة تعليق جديد */}
      <div className="mb-6 flex gap-3">
        <Avatar className="h-10 w-10 shrink-0">
          <AvatarFallback>{currentUser ? currentUser.username[0] : 'ز'}</AvatarFallback>
        </Avatar>
        <div className="flex-1">
          {authLoading ? (
            <div className="flex items-center justify-center rounded-lg border border-border bg-card p-6">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : currentUser ? (
            <>
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="اكتب تعليقك هنا..."
                rows={3}
                className="w-full resize-none rounded-lg border border-border bg-card p-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <div className="mt-2 flex justify-end">
                <Button
                  onClick={onSubmitComment}
                  disabled={!newComment.trim() || submitting}
                  size="sm"
                >
                  {submitting ? <Loader2 className="ml-1.5 h-3.5 w-3.5 animate-spin" /> : <Send className="ml-1.5 h-3.5 w-3.5" />}
                  نشر التعليق
                </Button>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center rounded-lg border border-border bg-card p-6 text-center">
              <p className="text-sm text-muted-foreground">
                <Link href="/?view=login" className="font-bold text-primary hover:text-primary/80">سجّل الدخول</Link>
                {' '}للتعليق على هذا التعريب
              </p>
            </div>
          )}
        </div>
      </div>

      {/* قائمة التعليقات */}
      {loading ? (
        <div className="grid place-items-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : comments.length === 0 ? (
        <div className="grid place-items-center py-12 text-center">
          <MessageSquare className="mb-3 h-12 w-12 text-muted-foreground/50" />
          <h3 className="text-lg font-semibold">لا توجد تعليقات</h3>
          <p className="mt-1 text-sm text-muted-foreground">كن أول من يعلّق على هذا التعريب!</p>
        </div>
      ) : (
        <>
          <div className="space-y-6">
            {paginatedComments.map((comment) => (
              <CommentItem
                key={comment.id}
                comment={comment}
                depth={0}
                modOwnerName={modOwnerName}
                likedIds={likedIds}
                replyingTo={replyingTo}
                replyText={replyText}
                setReplyText={setReplyText}
                currentUser={currentUser}
                onLike={toggleLike}
                onReply={(id) => setReplyingTo(replyingTo === id ? null : id)}
                onSubmitReply={onSubmitReply}
                onCancelReply={() => { setReplyingTo(null); setReplyText('') }}
                onReport={onReport}
              />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-6 flex items-center justify-center gap-3">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronRight className="h-4 w-4" />
                السابق
              </Button>
              <span className="text-sm text-muted-foreground">
                {page} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                التالي
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

/** عنصر تعليق واحد — مع ردود متداخلة (עד 7 مستويات) */
function CommentItem({
  comment,
  depth,
  modOwnerName,
  likedIds,
  replyingTo,
  replyText,
  setReplyText,
  currentUser,
  onLike,
  onReply,
  onSubmitReply,
  onCancelReply,
  onReport,
}: {
  comment: ModCommentType
  depth: number
  modOwnerName?: string
  likedIds: Set<string>
  replyingTo: string | null
  replyText: string
  setReplyText: (s: string) => void
  currentUser: CurrentUser | null
  onLike: (id: string) => void
  onReply: (id: string) => void
  onSubmitReply: (parentId: string) => void
  onCancelReply: () => void
  onReport: (name: string) => void
}) {
  const liked = likedIds.has(comment.id)
  const isNested = depth > 0
  const avatarSize = isNested ? 'h-8 w-8' : 'h-10 w-10'
  const canReply = depth < MAX_DEPTH
  const nestMargin = Math.min(depth * 16, 96)
  const displayName = comment.user?.username || comment.guestName || 'مستخدم'
  const displayAvatar = comment.user?.avatarUrl || comment.guestAvatar

  return (
    <div style={isNested ? { marginRight: nestMargin, borderRight: '2px solid', paddingRight: 16, borderColor: 'hsl(var(--border) / 0.5)' } : undefined}>
      <div className={`flex gap-3 ${comment.isPinned ? 'rounded-lg border border-primary/30 bg-primary/5 p-3' : ''}`}>
        <Avatar className={`${avatarSize} shrink-0`}>
          <AvatarImage src={displayAvatar || undefined} alt={displayName} />
          <AvatarFallback>{displayName[0]}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          {/* رأس التعليق */}
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <span className={`font-semibold text-foreground ${isNested ? 'text-sm' : ''}`}>
              {displayName}
            </span>
            {comment.isPinned && (
              <Badge variant="secondary" className="gap-1 bg-primary/15 text-primary">
                <Pin className="h-3 w-3" />
                مثبّت
              </Badge>
            )}
            {modOwnerName && displayName === modOwnerName && (
              <Badge variant="secondary" className="gap-1 bg-amber-500/15 text-amber-500">
                <Heart className="h-3 w-3" />
                المؤلف
              </Badge>
            )}
            <span className="text-xs text-muted-foreground">{timeAgo(comment.createdAt)}</span>
            {comment.isEdited && (
              <span className="text-[11px] text-muted-foreground/70">(تم التعديل)</span>
            )}
            <div className="mr-auto">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    aria-label="خيارات"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-40">
                  {canReply && (
                    <DropdownMenuItem onClick={() => onReply(comment.id)}>
                      <Reply className="ml-2 h-4 w-4" />
                      رد
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem>
                    <Edit2 className="ml-2 h-4 w-4" />
                    تعديل
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => onReport(displayName)}
                    className="text-red-500 focus:text-red-500"
                  >
                    <Flag className="ml-2 h-4 w-4" />
                    إبلاغ
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* نص التعليق */}
          <p className={`whitespace-pre-wrap leading-relaxed text-foreground/90 ${isNested ? 'text-xs' : 'mb-2 text-sm'}`}>
            {comment.text}
          </p>

          {/* أزرار التفاعل */}
          <div className="mt-1 flex items-center gap-1">
            <button
              onClick={() => onLike(comment.id)}
              className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                liked ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              }`}
              aria-pressed={liked}
            >
              <ThumbsUp className={`h-3.5 w-3.5 ${liked ? 'fill-current' : ''}`} />
              {formatNumber(comment.likes + (liked ? 1 : 0))}
            </button>
            <span className="mx-1 h-4 w-px bg-border" />
            {canReply && (
              <button
                onClick={() => onReply(comment.id)}
                className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <Reply className="h-3.5 w-3.5" />
                رد
              </button>
            )}
          </div>

          {/* صندوق الرد */}
          {replyingTo === comment.id && (
            <div className="mt-3 flex gap-2">
              <Avatar className="h-8 w-8 shrink-0">
                <AvatarFallback>{currentUser?.username?.[0] || 'ز'}</AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <textarea
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder={`الرد على ${displayName}...`}
                  rows={2}
                  autoFocus
                  className="w-full resize-none rounded-lg border border-border bg-card p-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <div className="mt-1.5 flex justify-end gap-2">
                  <Button variant="ghost" size="sm" onClick={onCancelReply}>
                    إلغاء
                  </Button>
                  <Button size="sm" onClick={() => onSubmitReply(comment.id)} disabled={!replyText.trim()}>
                    <Send className="ml-1.5 h-3.5 w-3.5" />
                    نشر الرد
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* الردود المتداخلة — recursive */}
      {comment.replies && comment.replies.length > 0 && depth < MAX_DEPTH && (
        <div className="mt-4 space-y-4">
          {comment.replies.map((reply) => (
            <CommentItem
              key={reply.id}
              comment={reply}
              depth={depth + 1}
              modOwnerName={modOwnerName}
              likedIds={likedIds}
              replyingTo={replyingTo}
              replyText={replyText}
              setReplyText={setReplyText}
              currentUser={currentUser}
              onLike={onLike}
              onReply={onReply}
              onSubmitReply={onSubmitReply}
              onCancelReply={onCancelReply}
              onReport={onReport}
            />
          ))}
        </div>
      )}
    </div>
  )
}
