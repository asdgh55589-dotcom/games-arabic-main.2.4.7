'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
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
  Bold,
  Italic,
  Strikethrough,
  Heading2,
  Palette,
  Smile,
  Type,
} from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { EmptyState } from '@/components/ui/empty-state'
import { formatNumber, timeAgo } from '@/lib/format'
import { ReportButton } from '@/components/report-button'
import { useToast } from '@/hooks/use-toast'
import type { SessionUser } from '@/lib/auth'
import { useAuth } from '@/contexts/auth-context'
import type { ModCommentType } from '@/lib/types'
import { MarkdownRenderer } from '@/components/markdown-renderer'
import { CreatorBadge } from '@/components/creator-badge'
import { RoleBadge } from '@/components/role-badge'
import { TierBadge } from '@/components/tier-badge'

interface ModCommentsProps {
  modSlug: string
  modOwnerName?: string
}

type SortMode = 'newest' | 'popular' | 'oldest'

const PAGE_SIZE = 20
const MAX_DEPTH = 5

const EMOJIS = ['😀','😁','😂','🤣','😍','😘','🥰','😎','🤩','🥳','😢','😭','😡','🤔','👍','👏','❤️','🔥','🎉','✨','🙏','💯','😅','🤗','🫡','👌']

const COLORS = [
  { name: 'أحمر', value: '#ef4444' },
  { name: 'أزرق', value: '#3b82f6' },
  { name: 'أخضر', value: '#22c55e' },
  { name: 'برتقالي', value: '#f97316' },
  { name: 'بنفسجي', value: '#a855f7' },
  { name: 'وردي', value: '#ec4899' },
]

function wrapSelection(
  textarea: HTMLTextAreaElement | null,
  setValue: (v: string) => void,
  prefix: string,
  suffix: string,
  placeholder = 'نص'
) {
  if (!textarea) return
  const start = textarea.selectionStart
  const end = textarea.selectionEnd
  const value = textarea.value
  const selected = value.slice(start, end) || placeholder
  const newValue = value.slice(0, start) + prefix + selected + suffix + value.slice(end)
  setValue(newValue)
  // إعادة التركيز وتحديد النص الجديد
  requestAnimationFrame(() => {
    textarea.focus()
    textarea.setSelectionRange(start + prefix.length, start + prefix.length + selected.length)
  })
}

function insertAtCursor(
  textarea: HTMLTextAreaElement | null,
  setValue: (v: string) => void,
  text: string
) {
  if (!textarea) {
    setValue(text)
    return
  }
  const start = textarea.selectionStart
  const end = textarea.selectionEnd
  const value = textarea.value
  const newValue = value.slice(0, start) + text + value.slice(end)
  setValue(newValue)
  requestAnimationFrame(() => {
    textarea.focus()
    const pos = start + text.length
    textarea.setSelectionRange(pos, pos)
  })
}

export function ModComments({ modSlug, modOwnerName }: ModCommentsProps) {
  const { toast } = useToast()
  const { user: currentUser, loading: authLoading } = useAuth()
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
  const newCommentRef = useRef<HTMLTextAreaElement>(null)
  const replyRef = useRef<HTMLTextAreaElement>(null)
  const [showEmojiNew, setShowEmojiNew] = useState(false)
  const [showEmojiReply, setShowEmojiReply] = useState(false)
  const [showColorNew, setShowColorNew] = useState(false)
  const [showColorReply, setShowColorReply] = useState(false)

  const fetchComments = useCallback(async () => {
    try {
      const res = await fetch(`/api/mods/${modSlug}/comments?sort=${sortMode}`)
      if (!res.ok) return
      const responseData = await res.json()
      setComments(responseData.data?.comments || [])
      setTotalCount(responseData.data?.total || 0)
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

  // pagination على التعليقات الجذرية فقط — totalCount يشمل الردود لذلك لا نستخدمه هنا
  const totalPages = Math.ceil(comments.length / PAGE_SIZE)
  const paginatedComments = comments.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  // لو حذف تعليق وصارت الصفحة الحالية خارج النطاق، ارجع لآخر صفحة موجودة
  useEffect(() => {
    if (totalPages > 0 && page > totalPages) setPage(totalPages)
  }, [totalPages, page])

  const updateLikesInTree = useCallback((nodes: ModCommentType[], targetId: string, delta: number): ModCommentType[] => {
    return nodes.map((node) => {
      if (node.id === targetId) {
        return { ...node, likes: Math.max(0, (node.likes || 0) + delta) }
      }
      if (node.replies && node.replies.length > 0) {
        return { ...node, replies: updateLikesInTree(node.replies, targetId, delta) }
      }
      return node
    })
  }, [])

  const toggleLike = (id: string) => {
    const isLiked = likedIds.has(id)
    const delta = isLiked ? -1 : 1
    setLikedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
    // تحديث بصري فوري للعداد — مع إعادة ترتيب لو الفلترة "الأكثر إعجاباً"
    const sortPopular = (nodes: ModCommentType[]) =>
      [...nodes].sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1
        if (!a.isPinned && b.isPinned) return 1
        return (b.likes || 0) - (a.likes || 0)
      })
    setComments((prev) => {
      const updated = updateLikesInTree(prev, id, delta)
      return sortMode === 'popular' ? sortPopular(updated) : updated
    })
    fetch(`/api/comments/${id}/like`, { method: 'POST' }).catch((error) => {
      console.error('[mod-comments] like toggle failed:', error)
      // rollback بصري عند الفشل
      setLikedIds((prev) => {
        const next = new Set(prev)
        if (isLiked) next.add(id)
        else next.delete(id)
        return next
      })
      setComments((prev) => {
        const reverted = updateLikesInTree(prev, id, -delta)
        return sortMode === 'popular' ? sortPopular(reverted) : reverted
      })
    })
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
        throw new Error(data?.error?.message || 'فشل النشر')
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
        throw new Error(data?.error?.message || 'فشل النشر')
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
      {/* رأس القسم — حد سميك وأبيض أكثر */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b-[4px] border-white/30 pb-4">
        <h2 className="flex items-center gap-2 text-xl font-bold">
          <MessageSquare className="h-5 w-5 text-primary" />
          التعليقات
          <Badge variant="secondary" className="mr-1">{formatNumber(totalCount)}</Badge>
        </h2>

        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">ترتيب:</span>
          <div className="flex gap-1 rounded-md border border-white/15 bg-card/40 p-0.5">
            {SORT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setSortMode(opt.value)}
                className={`rounded px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer ${
                  sortMode === opt.value
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
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
            <div className="overflow-hidden rounded-lg border border-border bg-card focus-within:border-primary focus-within:ring-1 focus-within:ring-primary transition-colors">
              {/* شريط تنسيق — يظهر عند تحديد نص */}
              <div className="flex flex-wrap items-center gap-1 border-b border-white/10 bg-white/[0.02] p-1.5">
                <button
                  type="button"
                  onClick={() => wrapSelection(newCommentRef.current, setNewComment, '**', '**', 'نص عريض')}
                  className="grid h-7 w-7 place-items-center rounded hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors"
                  title="عريض **نص**"
                >
                  <Bold className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => wrapSelection(newCommentRef.current, setNewComment, '*', '*', 'نص مائل')}
                  className="grid h-7 w-7 place-items-center rounded hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors"
                  title="مائل *نص*"
                >
                  <Italic className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => wrapSelection(newCommentRef.current, setNewComment, '~~', '~~', 'نص مشطوب')}
                  className="grid h-7 w-7 place-items-center rounded hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors"
                  title="مشطوب ~~نص~~"
                >
                  <Strikethrough className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => wrapSelection(newCommentRef.current, setNewComment, '## ', '', 'عنوان كبير')}
                  className="grid h-7 w-7 place-items-center rounded hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors"
                  title="تكبير ## عنوان"
                >
                  <Heading2 className="h-3.5 w-3.5" />
                </button>
                <span className="mx-1 h-4 w-px bg-white/10" aria-hidden />
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowColorNew(!showColorNew)}
                    className={`grid h-7 w-7 place-items-center rounded hover:bg-white/10 transition-colors ${showColorNew ? 'bg-white/10 text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                    title="لون النص"
                  >
                    <Palette className="h-3.5 w-3.5" />
                  </button>
                  {showColorNew && (
                    <div className="absolute top-8 start-0 z-20 flex gap-1 rounded-lg border border-border bg-card p-2 shadow-xl">
                      {COLORS.map((c) => (
                        <button
                          key={c.value}
                          title={c.name}
                          onClick={() => {
                            wrapSelection(newCommentRef.current, setNewComment, `<span style="color:${c.value}">`, `</span>`, 'نص ملون')
                            setShowColorNew(false)
                          }}
                          className="h-6 w-6 rounded-full border-2 border-white/20 hover:scale-110 transition-transform"
                          style={{ backgroundColor: c.value }}
                        />
                      ))}
                      <button
                        onClick={() => setShowColorNew(false)}
                        className="ms-1 text-[10px] text-muted-foreground hover:text-foreground px-1"
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </div>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowEmojiNew(!showEmojiNew)}
                    className={`grid h-7 w-7 place-items-center rounded hover:bg-white/10 transition-colors ${showEmojiNew ? 'bg-white/10 text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                    title="إيموجي"
                  >
                    <Smile className="h-3.5 w-3.5" />
                  </button>
                  {showEmojiNew && (
                    <div className="absolute top-8 start-0 z-20 grid grid-cols-7 gap-1 rounded-lg border border-border bg-card p-2 shadow-xl w-56">
                      {EMOJIS.map((e) => (
                        <button
                          key={e}
                          onClick={() => {
                            insertAtCursor(newCommentRef.current, setNewComment, e)
                            setShowEmojiNew(false)
                          }}
                          className="grid h-7 w-7 place-items-center rounded hover:bg-white/10 text-base leading-none"
                        >
                          {e}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <span className="ms-auto hidden sm:inline text-[10px] text-muted-foreground/50">حدد نص ثم اختر تنسيق</span>
              </div>
              <textarea
                ref={newCommentRef}
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="اكتب تعليقك هنا... حدد جملة ثم استخدم الأزرار للتكبير أو التلوين أو الشطب"
                rows={3}
                className="w-full resize-none border-0 bg-transparent p-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
              />
              <div className="flex justify-end border-t border-white/5 bg-white/[0.01] p-2">
                <Button
                  onClick={onSubmitComment}
                  disabled={!newComment.trim() || submitting}
                  size="sm" className="min-h-[44px]"
                >
                  {submitting ? <Loader2 className="ml-1.5 h-3.5 w-3.5 animate-spin" /> : <Send className="ml-1.5 h-3.5 w-3.5" />}
                  نشر التعليق
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center rounded-lg border border-border bg-card p-6 text-center">
              <p className="text-sm text-muted-foreground">
                <Link href="/login" className="font-bold text-primary hover:text-primary/80">سجّل الدخول</Link>
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
        <EmptyState
          icon="file"
          title="لا توجد تعليقات"
          description="كن أول من يعلّق على هذا التعريب!"
        />
      ) : (
        <>
          <div className="space-y-4">
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
                onRefresh={fetchComments}
                replyRef={replyRef}
                showEmojiReply={showEmojiReply}
                setShowEmojiReply={setShowEmojiReply}
                showColorReply={showColorReply}
                setShowColorReply={setShowColorReply}
              />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-6 flex items-center justify-center gap-3">
              <Button
                variant="outline"
                size="sm" className="min-h-[44px]"
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
                size="sm" className="min-h-[44px]"
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

/** عنصر تعليق واحد — مع ردود متداخلة (עד 5 مستويات) */
function CommentItem({
  comment,
  depth,
  modOwnerName,
  replyToName,
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
  onRefresh,
  replyRef,
  showEmojiReply,
  setShowEmojiReply,
  showColorReply,
  setShowColorReply,
}: {
  comment: ModCommentType
  depth: number
  modOwnerName?: string
  replyToName?: string
  likedIds: Set<string>
  replyingTo: string | null
  replyText: string
  setReplyText: (s: string) => void
  currentUser: SessionUser | null
  onLike: (id: string) => void
  onReply: (id: string) => void
  onSubmitReply: (parentId: string) => void
  onCancelReply: () => void
  onReport: (name: string) => void
  onRefresh: () => void
  replyRef?: React.RefObject<HTMLTextAreaElement | null>
  showEmojiReply?: boolean
  setShowEmojiReply?: (v: boolean) => void
  showColorReply?: boolean
  setShowColorReply?: (v: boolean) => void
}) {
  const liked = likedIds.has(comment.id)
  const isNested = depth > 0
  const avatarSize = isNested ? 'h-8 w-8' : 'h-10 w-10'
  const canReply = depth < MAX_DEPTH
  const displayName = comment.user?.username || comment.guestName || 'مستخدم'
  const displayAvatar = comment.user?.avatarUrl || comment.guestAvatar
  const isOwner = currentUser?.id === comment.user?.id
  const isAdmin = currentUser && ['owner', 'admin', 'moderator'].includes(currentUser.role)
  const [isEditing, setIsEditing] = useState(false)
  const [editText, setEditText] = useState(comment.text)
  const [saving, setSaving] = useState(false)
  const [showAllReplies, setShowAllReplies] = useState(false)
  const editRef = useRef<HTMLTextAreaElement>(null)
  const [showEmojiEdit, setShowEmojiEdit] = useState(false)
  const [showColorEdit, setShowColorEdit] = useState(false)
  const { toast } = useToast()

  const handleEdit = async () => {
    if (!editText.trim() || editText === comment.text) {
      setIsEditing(false)
      return
    }
    setSaving(true)
    try {
      const res = await fetch(`/api/comments/${comment.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: editText.trim() }),
      })
      if (res.ok) {
        toast({ title: 'تم التعديل' })
        setIsEditing(false)
        onRefresh()
      } else {
        const data = await res.json()
        toast({ title: 'خطأ', description: data.error?.message || 'فشل التعديل', variant: 'destructive' })
      }
    } catch {
      toast({ title: 'خطأ', description: 'حدث خطأ', variant: 'destructive' })
    }
    setSaving(false)
  }

  const handleDelete = async () => {
    if (!confirm('هل أنت متأكد من حذف هذا التعليق؟')) return
    try {
      const res = await fetch(`/api/comments/${comment.id}`, { method: 'DELETE' })
      if (res.ok) {
        toast({ title: 'تم الحذف' })
        onRefresh()
      } else {
        const data = await res.json()
        toast({ title: 'خطأ', description: data.error?.message || 'فشل الحذف', variant: 'destructive' })
      }
    } catch {
      toast({ title: 'خطأ', description: 'حدث خطأ', variant: 'destructive' })
    }
  }

  // خلفيات متدرجة — متوافقة مع بطاقات الموقع الجديدة (border-border/40 + gradient خفيف)
  const depthColors = [
    { bg: 'bg-card', border: 'border-border/40' },
    { bg: 'bg-card/80', border: 'border-border/30' },
    { bg: 'bg-primary/[0.04]', border: 'border-primary/15' },
    { bg: 'bg-primary/[0.06]', border: 'border-primary/20' },
    { bg: 'bg-primary/[0.08]', border: 'border-primary/25' },
  ] as const
  const depthStyle = depthColors[Math.min(depth, depthColors.length - 1)]

  return (
    <>
      <div className={`rounded-lg border transition-all ${depthStyle.bg} ${depthStyle.border} ${isNested ? 'p-2.5' : 'p-2.5 sm:p-3'}`}>
        <div className={`flex gap-2.5 ${comment.isPinned ? 'rounded-lg border border-primary/30 bg-primary/5 p-2.5 -m-1' : ''}`}>
          <Avatar className={`${avatarSize} shrink-0 ring-2 ring-background`}>
            <AvatarImage src={displayAvatar || undefined} alt={displayName} />
            <AvatarFallback>{displayName[0]}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            {/* رأس التعليق — خط عريض وأبيض موحد مع باقي البطاقات */}
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <span className={`font-bold text-foreground flex flex-wrap items-center gap-1 ${isNested ? 'text-sm' : 'text-sm'}`}>
                {displayName}
                {(comment.user as unknown as { role?: string })?.role && (comment.user as unknown as { role: string }).role !== 'member' && (
                  <RoleBadge role={(comment.user as unknown as { role: string }).role} size="sm" />
                )}
                {(comment.user as unknown as { tier?: number; role?: string })?.tier !== undefined && (
                  <TierBadge tier={(comment.user as unknown as { tier: number }).tier} role={(comment.user as unknown as { role?: string })?.role} size="sm" />
                )}
                {(comment.user as unknown as { role?: string; specialRoles?: string })?.role && (
                  <CreatorBadge
                    role={(comment.user as unknown as { role: string }).role}
                    specialRoles={(comment.user as unknown as { specialRoles?: string }).specialRoles}
                    size={14}
                  />
                )}
              </span>
              {replyToName && (
                <span className="text-xs font-bold text-foreground">
                  رد على <span className="font-bold text-foreground">{replyToName}</span>
                </span>
              )}
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
            </div>

            {/* نص التعليق */}
            {isEditing ? (
              <div className="mb-2 overflow-hidden rounded-md border border-border bg-background">
                <div className="flex flex-wrap items-center gap-1 border-b border-white/10 bg-white/[0.02] p-1">
                  <button type="button" onClick={() => wrapSelection(editRef.current, setEditText, '**', '**', 'نص عريض')} className="grid h-6 w-6 place-items-center rounded hover:bg-white/10 text-muted-foreground hover:text-foreground"><Bold className="h-3 w-3" /></button>
                  <button type="button" onClick={() => wrapSelection(editRef.current, setEditText, '*', '*', 'مائل')} className="grid h-6 w-6 place-items-center rounded hover:bg-white/10 text-muted-foreground hover:text-foreground"><Italic className="h-3 w-3" /></button>
                  <button type="button" onClick={() => wrapSelection(editRef.current, setEditText, '~~', '~~', 'مشطوب')} className="grid h-6 w-6 place-items-center rounded hover:bg-white/10 text-muted-foreground hover:text-foreground"><Strikethrough className="h-3 w-3" /></button>
                  <button type="button" onClick={() => wrapSelection(editRef.current, setEditText, '## ', '', 'عنوان')} className="grid h-6 w-6 place-items-center rounded hover:bg-white/10 text-muted-foreground hover:text-foreground"><Heading2 className="h-3 w-3" /></button>
                  <span className="mx-1 h-3 w-px bg-white/10" />
                  <div className="relative">
                    <button type="button" onClick={() => setShowColorEdit(!showColorEdit)} className="grid h-6 w-6 place-items-center rounded hover:bg-white/10 text-muted-foreground hover:text-foreground"><Palette className="h-3 w-3" /></button>
                    {showColorEdit && (
                      <div className="absolute top-7 start-0 z-20 flex gap-1 rounded-lg border border-border bg-card p-1.5 shadow-xl">
                        {COLORS.map((c) => (
                          <button key={c.value} onClick={() => { wrapSelection(editRef.current, setEditText, `<span style="color:${c.value}">`, `</span>`, 'ملون'); setShowColorEdit(false)}} className="h-5 w-5 rounded-full border-2 border-white/20" style={{ backgroundColor: c.value }} />
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="relative">
                    <button type="button" onClick={() => setShowEmojiEdit(!showEmojiEdit)} className="grid h-6 w-6 place-items-center rounded hover:bg-white/10 text-muted-foreground hover:text-foreground"><Smile className="h-3 w-3" /></button>
                    {showEmojiEdit && (
                      <div className="absolute top-7 start-0 z-20 grid grid-cols-6 gap-1 rounded-lg border border-border bg-card p-2 shadow-xl w-48">
                        {EMOJIS.slice(0,18).map((e) => (
                          <button key={e} onClick={() => { insertAtCursor(editRef.current, setEditText, e); setShowEmojiEdit(false)}} className="h-6 w-6 grid place-items-center rounded hover:bg-white/10 text-sm">{e}</button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <textarea
                  ref={editRef}
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  className="w-full resize-none border-0 bg-transparent p-2.5 text-sm focus:outline-none"
                  rows={3}
                />
                <div className="flex gap-2 border-t border-white/5 bg-white/[0.01] p-2">
                  <Button size="sm" className="min-h-[44px]" onClick={handleEdit} disabled={saving || !editText.trim()}>
                    {saving ? 'جاري الحفظ...' : 'حفظ'}
                  </Button>
                  <Button size="sm" className="min-h-[44px]" variant="outline" onClick={() => { setIsEditing(false); setEditText(comment.text) }}>
                    إلغاء
                  </Button>
                </div>
              </div>
            ) : (
              <div className={`${isNested ? 'text-sm' : 'mb-2 text-sm'} leading-relaxed font-medium text-foreground`}>
                <MarkdownRenderer content={comment.text} />
              </div>
            )}

            {/* أزرار التفاعل */}
            <div className="mt-2 flex items-center gap-1 border-t border-white/20 pt-2">
              <button
                onClick={() => onLike(comment.id)}
                className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-bold transition-colors border shadow-sm cursor-pointer ${
                  liked ? 'bg-blue-600 text-white border-blue-600' : 'border-transparent text-muted-foreground hover:bg-accent hover:text-foreground'
                }`}
                aria-pressed={liked}
              >
                <ThumbsUp className={`h-3.5 w-3.5 ${liked ? 'fill-current' : ''}`} />
                {formatNumber(comment.likes)}
              </button>
              {canReply && (
                <>
                  <span className="mx-0.5 h-3 w-px bg-border/50" />
                  <button
                    onClick={() => onReply(comment.id)}
                    className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground cursor-pointer"
                  >
                    <Reply className="h-3.5 w-3.5" />
                    رد
                  </button>
                </>
              )}
              <div className="me-auto">
                <ReportButton targetType="comment" targetId={comment.id} />
              </div>
              {isOwner && (
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
                    <DropdownMenuItem onClick={() => { setIsEditing(true); setEditText(comment.text) }}>
                      <Edit2 className="ml-2 h-4 w-4" />
                      تعديل
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleDelete} className="text-red-500 focus:text-red-500">
                      <Flag className="ml-2 h-4 w-4" />
                      حذف
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>

            {/* صندوق الرد — مع شريط تنسيق وإيموجي */}
            {replyingTo === comment.id && (
              <div className="mt-3 overflow-hidden rounded-lg border border-primary/20 bg-card">
                <div className="flex flex-wrap items-center gap-1 border-b border-white/10 bg-white/[0.02] p-1">
                  <button type="button" onClick={() => replyRef?.current && wrapSelection(replyRef.current, setReplyText, '**', '**', 'عريض')} className="grid h-6 w-6 place-items-center rounded hover:bg-white/10 text-muted-foreground hover:text-foreground"><Bold className="h-3 w-3" /></button>
                  <button type="button" onClick={() => replyRef?.current && wrapSelection(replyRef.current, setReplyText, '*', '*', 'مائل')} className="grid h-6 w-6 place-items-center rounded hover:bg-white/10 text-muted-foreground hover:text-foreground"><Italic className="h-3 w-3" /></button>
                  <button type="button" onClick={() => replyRef?.current && wrapSelection(replyRef.current, setReplyText, '~~', '~~', 'مشطوب')} className="grid h-6 w-6 place-items-center rounded hover:bg-white/10 text-muted-foreground hover:text-foreground"><Strikethrough className="h-3 w-3" /></button>
                  <button type="button" onClick={() => replyRef?.current && wrapSelection(replyRef.current, setReplyText, '## ', '', 'عنوان')} className="grid h-6 w-6 place-items-center rounded hover:bg-white/10 text-muted-foreground hover:text-foreground"><Heading2 className="h-3 w-3" /></button>
                  <span className="mx-1 h-3 w-px bg-white/10" />
                  <div className="relative">
                    <button type="button" onClick={() => setShowColorReply?.(!showColorReply)} className="grid h-6 w-6 place-items-center rounded hover:bg-white/10 text-muted-foreground hover:text-foreground"><Palette className="h-3 w-3" /></button>
                    {showColorReply && (
                      <div className="absolute top-7 start-0 z-20 flex gap-1 rounded-lg border border-border bg-card p-1.5 shadow-xl">
                        {COLORS.map((c) => (
                          <button key={c.value} onClick={() => { replyRef?.current && wrapSelection(replyRef.current, setReplyText, `<span style="color:${c.value}">`, `</span>`, 'ملون'); setShowColorReply?.(false)}} className="h-5 w-5 rounded-full border-2 border-white/20" style={{ backgroundColor: c.value }} />
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="relative">
                    <button type="button" onClick={() => setShowEmojiReply?.(!showEmojiReply)} className="grid h-6 w-6 place-items-center rounded hover:bg-white/10 text-muted-foreground hover:text-foreground"><Smile className="h-3 w-3" /></button>
                    {showEmojiReply && (
                      <div className="absolute top-7 start-0 z-20 grid grid-cols-6 gap-1 rounded-lg border border-border bg-card p-2 shadow-xl w-48">
                        {EMOJIS.slice(0,18).map((e) => (
                          <button key={e} onClick={() => { replyRef?.current && insertAtCursor(replyRef.current, setReplyText, e); setShowEmojiReply?.(false)}} className="h-6 w-6 grid place-items-center rounded hover:bg-white/10 text-sm">{e}</button>
                        ))}
                      </div>
                    )}
                  </div>
                  <span className="ms-auto text-[10px] text-muted-foreground/40 hidden sm:inline">حدد نص للتنسيق</span>
                </div>
                <div className="flex gap-2 p-2">
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarFallback>{currentUser?.username?.[0] || 'ز'}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <textarea
                      ref={replyRef as any}
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder={`الرد على ${displayName}...`}
                      rows={2}
                      autoFocus
                      className="w-full resize-none rounded-md border border-border bg-background p-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    <div className="mt-1.5 flex justify-end gap-2">
                      <Button variant="ghost" size="sm" className="min-h-[44px]" onClick={onCancelReply}>
                        إلغاء
                      </Button>
                      <Button size="sm" className="min-h-[44px]" onClick={() => onSubmitReply(comment.id)} disabled={!replyText.trim()}>
                        <Send className="ml-1.5 h-3.5 w-3.5" />
                        نشر الرد
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* الردود المتداخلة — recursive — مطوية إذا أكثر من رد واحد */}
      {comment.replies && comment.replies.length > 0 && depth < MAX_DEPTH && (() => {
        const hasMultiple = comment.replies.length > 1
        const visibleReplies = showAllReplies || !hasMultiple ? comment.replies : comment.replies.slice(0, 1)
        const hiddenCount = comment.replies.length - visibleReplies.length
        return (
          <div className="relative mt-3 ms-4 sm:ms-6 border-s-2 border-primary/10 ps-3 sm:ps-4">
            {/* نقطة ارتباط بالأب */}
            <div className="absolute top-5 -start-1 h-2 w-2 rounded-full bg-primary/20 border-2 border-background" />
            <div className="space-y-2">
              {visibleReplies.map((reply) => (
                <CommentItem
                  key={reply.id}
                  comment={reply}
                  depth={depth + 1}
                  modOwnerName={modOwnerName}
                  replyToName={displayName}
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
                  onRefresh={onRefresh}
                  replyRef={replyRef}
                  showEmojiReply={showEmojiReply}
                  setShowEmojiReply={setShowEmojiReply}
                  showColorReply={showColorReply}
                  setShowColorReply={setShowColorReply}
                />
              ))}
            </div>
            {hasMultiple && !showAllReplies && (
              <button
                onClick={() => setShowAllReplies(true)}
                className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-xs font-bold text-blue-500 hover:bg-blue-500/15 transition-colors"
              >
                <ChevronLeft className="h-3.5 w-3.5 rotate-90" />
                عرض {hiddenCount} ردود إضافية
              </button>
            )}
            {hasMultiple && showAllReplies && (
              <button
                onClick={() => setShowAllReplies(false)}
                className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-border/40 bg-card/60 px-3 py-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                <ChevronRight className="h-3.5 w-3.5 rotate-90" />
                إخفاء الردود
              </button>
            )}
          </div>
        )
      })()}
    </>
  )
}
