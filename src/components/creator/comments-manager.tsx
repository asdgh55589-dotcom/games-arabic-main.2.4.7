'use client'

import { Eye, EyeOff, Loader2, Pencil, Pin, PinOff, Reply, Send, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { CommentSkeleton } from '@/components/comments/comment-skeleton'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { EmptyState } from '@/components/ui/empty-state'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/contexts/auth-context'
import { timeAgo } from '@/lib/format'
import { useStudioLanguage } from '@/lib/studio-i18n/context'

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
  const { dict, locale } = useStudioLanguage()
  const { user: me } = useAuth()
  const t = dict.commentsMgr
  const [filter, setFilter] = useState<'all' | 'visible' | 'hidden'>('all')
  const [comments, setComments] = useState<CommentItem[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [replyTo, setReplyTo] = useState<string | null>(null)
  const [replyText, setReplyText] = useState('')
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<string | null>(null)
  const [selected, setSelected] = useState<string[]>([])
  const [bulkLoading, setBulkLoading] = useState(false)
  const [pendingBulkDelete, setPendingBulkDelete] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')

  const toggleSelect = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))

  const fetchComments = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
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
      } else {
        throw new Error(json.error?.message || t.loadFailed)
      }
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : t.loadError)
    }
    setLoading(false)
  }, [filter, page])

  useEffect(() => {
    fetchComments()
  }, [fetchComments])

  const handleAction = async (id: string, action: 'hide' | 'unhide' | 'delete' | 'pin' | 'unpin') => {
    setActionLoading(id)
    try {
      const res = await fetch(`/api/creator/comments/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const json = await res.json()
      if (res.ok) {
        toast({ title: json.data?.message || t.actionDone })
        fetchComments()
      } else {
        toast({ title: json.error?.message || t.actionFailed, variant: 'destructive' })
      }
    } catch {
      toast({ title: t.connectionError, variant: 'destructive' })
    }
    setActionLoading(null)
  }

  const handleEditSave = async (comment: CommentItem) => {
    if (!editText.trim()) {
      toast({ title: t.writeReplyFirst, variant: 'destructive' })
      return
    }
    setActionLoading(comment.id)
    try {
      const res = await fetch(`/api/creator/comments/${comment.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'edit', text: editText.trim() }),
      })
      const json = await res.json()
      if (res.ok) {
        toast({ title: json.data?.message || t.actionDone })
        setEditingId(null)
        setEditText('')
        fetchComments()
      } else {
        toast({ title: json.error?.message || t.actionFailed, variant: 'destructive' })
      }
    } catch {
      toast({ title: t.connectionError, variant: 'destructive' })
    }
    setActionLoading(null)
  }

  const handleBulk = async (action: 'hide' | 'unhide' | 'delete') => {
    if (selected.length === 0) return
    setBulkLoading(true)
    try {
      const res = await fetch('/api/creator/comments/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selected, action }),
      })
      const json = await res.json()
      if (res.ok) {
        toast({ title: json.data?.message || t.actionDone })
        setSelected([])
        setPendingBulkDelete(false)
        fetchComments()
      } else {
        toast({ title: json.error?.message || t.actionFailed, variant: 'destructive' })
      }
    } catch {
      toast({ title: t.connectionError, variant: 'destructive' })
    }
    setBulkLoading(false)
  }

  const handleReply = async (comment: CommentItem) => {
    if (!replyText.trim()) {
      toast({ title: t.writeReplyFirst, variant: 'destructive' })
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
        toast({ title: t.replySent })
        setReplyTo(null)
        setReplyText('')
      } else {
        toast({ title: json.error?.message || t.sendFailed, variant: 'destructive' })
      }
    } catch {
      toast({ title: t.sendConnectionError, variant: 'destructive' })
    }
    setActionLoading(null)
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        {[
          { value: 'all', label: t.all },
          { value: 'visible', label: t.visible },
          { value: 'hidden', label: t.hidden },
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

      {selected.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap rounded-lg border border-border bg-muted/50 px-3 py-2">
          <span className="text-sm font-medium">
            {selected.length} {t.selectedCount}
          </span>
          <Button size="sm" variant="outline" disabled={bulkLoading} onClick={() => handleBulk('hide')}>
            {t.hideSelected}
          </Button>
          <Button size="sm" variant="outline" disabled={bulkLoading} onClick={() => handleBulk('unhide')}>
            {t.showSelected}
          </Button>
          <Button
            size="sm"
            variant="destructive"
            disabled={bulkLoading}
            onClick={() => setPendingBulkDelete(true)}
          >
            {bulkLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : t.deleteSelected}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected([])}>
            {t.clearSelection}
          </Button>
        </div>
      )}

      {loading ? (
        <CommentSkeleton rows={4} />
      ) : loadError ? (
        <div className="flex flex-col items-center gap-3 py-12 text-center" role="status">
          <p className="text-sm text-muted-foreground">{loadError}</p>
          <Button variant="outline" size="sm" className="min-h-[44px]" onClick={fetchComments}>
            {t.retry}
          </Button>
        </div>
      ) : comments.length === 0 ? (
        <EmptyState
          icon="file"
          title={t.emptyTitle}
          description={t.emptyDesc}
        />
      ) : (
        <div className="space-y-3">
          {comments.map((c) => (
            <Card key={c.id} className={c.isHidden ? 'opacity-60 border-dashed' : ''}>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <Checkbox
                    checked={selected.includes(c.id)}
                    onCheckedChange={() => toggleSelect(c.id)}
                    aria-label={`${t.selectRow} ${c.user?.username || ''}`}
                    className="mt-1 shrink-0"
                  />
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarImage src={c.user?.avatarUrl || undefined} />
                    <AvatarFallback>{c.user?.username?.[0]?.toUpperCase() || '?'}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{c.user?.username || t.unknownUser}</span>
                      <Badge variant="outline" className="text-xs">
                        {c.mod.name}
                      </Badge>
                      {c.isHidden && (
                        <Badge variant="destructive" className="text-xs">
                          {t.hiddenBadge}
                        </Badge>
                      )}
                      {c.isPinned && (
                        <Badge variant="secondary" className="text-xs">
                          {t.pinnedBadge}
                        </Badge>
                      )}
                      <span className="text-xs text-muted-foreground">{timeAgo(c.createdAt, locale)}</span>
                    </div>
                    {editingId === c.id ? (
                      <div className="mt-2 flex gap-2">
                        <Textarea
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          rows={2}
                          className="flex-1"
                          aria-label={t.editReply}
                        />
                        <div className="flex flex-col gap-1 shrink-0">
                          <Button
                            size="sm"
                            onClick={() => handleEditSave(c)}
                            disabled={actionLoading === c.id || !editText.trim()}
                          >
                            {t.saveEdit}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setEditingId(null)
                              setEditText('')
                            }}
                          >
                            {t.cancelEdit}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm mt-2 whitespace-pre-wrap">{c.text}</p>
                    )}
                    <div className="flex items-center gap-2 mt-3">
                      <Link
                        href={`/mod/${c.mod.slug}`}
                        target="_blank"
                        className="text-xs text-primary hover:underline"
                      >
                        {t.viewMod}
                      </Link>
                      <span className="text-muted-foreground">•</span>
                      <button
                        type="button"
                        onClick={() => setReplyTo(replyTo === c.id ? null : c.id)}
                        className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                      >
                        <Reply className="h-3 w-3" /> {t.reply}
                      </button>
                      {me && c.user?.id === me.id && (
                        <>
                          <span className="text-muted-foreground">•</span>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingId(c.id)
                              setEditText(c.text)
                            }}
                            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                          >
                            <Pencil className="h-3 w-3" /> {t.editReply}
                          </button>
                        </>
                      )}
                    </div>
                    {replyTo === c.id && (
                      <div className="mt-3 flex gap-2">
                        <Textarea
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          onKeyDown={(e) => {
                            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && replyText.trim())
                              handleReply(c)
                            if (e.key === 'Escape') setReplyTo(null)
                          }}
                          placeholder={t.replyPlaceholder}
                          aria-label={`${t.replyAria} ${c.mod.name}`}
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
                    {c.isPinned ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleAction(c.id, 'unpin')}
                        disabled={actionLoading === c.id}
                        aria-label={t.unpin}
                      >
                        <PinOff className="h-4 w-4" />
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleAction(c.id, 'pin')}
                        disabled={actionLoading === c.id}
                        aria-label={t.pin}
                      >
                        <Pin className="h-4 w-4" />
                      </Button>
                    )}
                    {c.isHidden ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleAction(c.id, 'unhide')}
                        disabled={actionLoading === c.id}
                        aria-label={t.show}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleAction(c.id, 'hide')}
                        disabled={actionLoading === c.id}
                        aria-label={t.hide}
                      >
                        <EyeOff className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setPendingDelete(c.id)}
                        disabled={actionLoading === c.id}
                        aria-label={t.remove}
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
            {t.prev}
          </Button>
          <span className="flex items-center px-3 text-sm text-muted-foreground">
            {t.page} {page} {t.pageOf} {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            {t.next}
          </Button>
        </div>
      )}

      {/* تأكيد الحذف — حوار RTL بدل confirm() الأصلي */}
      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.deleteTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {t.deleteDesc}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.cancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => pendingDelete && handleAction(pendingDelete, 'delete')}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t.confirmDelete}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={pendingBulkDelete}
        onOpenChange={(open) => !open && setPendingBulkDelete(false)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.bulkDeleteTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {t.bulkDeleteDesc} ({selected.length})
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.cancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => handleBulk('delete')}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t.confirmDelete}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
