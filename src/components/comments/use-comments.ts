'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { useToast } from '@/hooks/use-toast'
import { COMMENTS_CONFIG } from '@/lib/comments-config'
import type { ModCommentType } from '@/lib/types'

export type SortMode = 'newest' | 'popular' | 'oldest'

export const SORT_OPTIONS: { value: SortMode; label: string }[] = [
  { value: 'newest', label: 'الأحدث' },
  { value: 'popular', label: 'الأكثر إعجاباً' },
  { value: 'oldest', label: 'الأقدم' },
]

/** حالة ومنطق التعليقات (مستخرج من ModComments): جلب، ترقيم، إعجاب، نشر */
export function useComments(modSlug: string) {
  const { toast } = useToast()
  const { user: currentUser, loading: authLoading } = useAuth()
  const [comments, setComments] = useState<ModCommentType[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [sortMode, setSortMode] = useState<SortMode>('newest')
  const [page, setPage] = useState(1)
  // مكدس cursor للتنقل: cursors[i] هو cursor صفحة i+1 (null للأولى)
  const [cursors, setCursors] = useState<(string | null)[]>([null])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [totalRoots, setTotalRoots] = useState(0)
  const [newComment, setNewComment] = useState('')
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set())
  const [loadError, setLoadError] = useState<string | null>(null)
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [replyText, setReplyText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const newCommentRef = useRef<HTMLTextAreaElement>(null)
  const replyRef = useRef<HTMLTextAreaElement>(null)

  // ترقيم خادمي: كل صفحة = limit جذور + ردودها (لا مزيد من slice محلياً)
  const fetchPage = useCallback(
    async (cursor: string | null) => {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), COMMENTS_CONFIG.fetchTimeoutMs)
      setLoadError(null)
      try {
        const params = new URLSearchParams({
          sort: sortMode,
          limit: String(COMMENTS_CONFIG.pageSize),
        })
        if (cursor) params.set('cursor', cursor)
        const res = await fetch(`/api/mods/${modSlug}/comments?${params.toString()}`, {
          signal: controller.signal,
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const responseData = await res.json()
        setComments(responseData.data?.comments || [])
        setTotalCount(responseData.data?.total || 0)
        setTotalRoots(responseData.data?.totalRoots || 0)
        setNextCursor(responseData.data?.nextCursor ?? null)
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          setLoadError('انتهت مهلة التحميل — تحقق من اتصالك')
          toast({
            title: 'انتهت مهلة التحميل',
            description: 'تحقق من اتصالك وحاول مجدداً',
            variant: 'destructive',
          })
        } else {
          setLoadError('تعذّر تحميل التعليقات')
          toast({
            title: 'تعذّر تحميل التعليقات',
            description: 'حاول مجدداً',
            variant: 'destructive',
          })
        }
      } finally {
        clearTimeout(timeout)
        setLoading(false)
      }
    },
    [modSlug, sortMode, toast],
  )

  const fetchComments = useCallback(() => {
    return fetchPage(cursors[cursors.length - 1] ?? null)
  }, [fetchPage, cursors])

  useEffect(() => {
    setLoading(true)
    setPage(1)
    setCursors([null])
    fetchPage(null)
  }, [modSlug, sortMode, fetchPage])

  const totalPages = Math.max(1, Math.ceil(totalRoots / COMMENTS_CONFIG.pageSize))

  const goNext = () => {
    if (!nextCursor) return
    setCursors((c) => [...c, nextCursor])
    setPage((p) => p + 1)
    setLoading(true)
    fetchPage(nextCursor)
  }

  const goPrev = () => {
    if (page <= 1) return
    const prev = cursors.length > 1 ? cursors.slice(0, -1) : [null]
    setCursors(prev)
    setPage((p) => p - 1)
    setLoading(true)
    fetchPage(prev[prev.length - 1] ?? null)
  }

  const updateLikesInTree = useCallback(
    (nodes: ModCommentType[], targetId: string, delta: number): ModCommentType[] => {
      return nodes.map((node) => {
        if (node.id === targetId) {
          return { ...node, likes: Math.max(0, (node.likes || 0) + delta) }
        }
        if (node.replies && node.replies.length > 0) {
          return { ...node, replies: updateLikesInTree(node.replies, targetId, delta) }
        }
        return node
      })
    },
    [],
  )

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
    fetch(`/api/comments/${id}/reaction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: 'like' }),
    }).catch((error) => {
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

  const handleRateLimited = useCallback(
    () =>
      toast({
        title: 'انتظر قليلاً',
        description: 'انتظر قليلاً قبل التعليق مرة أخرى',
        variant: 'destructive',
      }),
    [toast],
  )

  const onSubmitComment = async () => {
    if (!newComment.trim() || submitting) return
    if (!currentUser) {
      toast({
        title: 'سجّل الدخول',
        description: 'يجب تسجيل الدخول للتعليق',
        variant: 'destructive',
      })
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
        if (res.status === 429 || data.error?.code === 'RATE_LIMITED') {
          handleRateLimited()
          return
        }
        if (data.code === 'AUTH_REQUIRED') {
          toast({
            title: 'سجّل الدخول',
            description: 'يجب تسجيل الدخول للتعليق',
            variant: 'destructive',
          })
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
        if (res.status === 429 || data.error?.code === 'RATE_LIMITED') {
          handleRateLimited()
          return
        }
        if (data.code === 'AUTH_REQUIRED') {
          toast({
            title: 'سجّل الدخول',
            description: 'يجب تسجيل الدخول للرد',
            variant: 'destructive',
          })
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

  const onReply = (id: string) => setReplyingTo(replyingTo === id ? null : id)
  const onCancelReply = () => {
    setReplyingTo(null)
    setReplyText('')
  }

  const retry = () => {
    setLoading(true)
    fetchComments()
  }

  return {
    currentUser,
    authLoading,
    comments,
    totalCount,
    totalPages,
    page,
    sortMode,
    setSortMode,
    newComment,
    setNewComment,
    likedIds,
    replyingTo,
    replyText,
    setReplyText,
    submitting,
    loading,
    loadError,
    retry,
    newCommentRef,
    replyRef,
    fetchComments,
    goNext,
    goPrev,
    nextCursor,
    toggleLike,
    onSubmitComment,
    onSubmitReply,
    onReply,
    onCancelReply,
  }
}

export type UseComments = ReturnType<typeof useComments>
