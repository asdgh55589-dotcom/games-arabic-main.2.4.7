'use client'

import { ChevronLeft, ChevronRight, Loader2, MessageSquare, Send } from 'lucide-react'
import Link from 'next/link'
import { CommentCard } from '@/components/comments/comment-card'
import { CommentSkeleton } from '@/components/comments/comment-skeleton'
import { CommentToolbar } from '@/components/comments/comment-toolbar'
import { SORT_OPTIONS, useComments } from '@/components/comments/use-comments'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { formatNumber } from '@/lib/format'

interface ModCommentsProps {
  modSlug: string
  modOwnerName?: string
}

export function ModComments({ modSlug, modOwnerName }: ModCommentsProps) {
  const {
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
  } = useComments(modSlug)

  return (
    <div>
      {/* رأس القسم — حد سميك وأبيض أكثر */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b-[4px] border-border pb-4">
        <h2 className="flex items-center gap-2 text-xl font-bold">
          <MessageSquare className="h-5 w-5 text-primary" />
          التعليقات
          <Badge variant="secondary" className="mr-1">
            {formatNumber(totalCount)}
          </Badge>
        </h2>

        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">ترتيب:</span>
          <div className="flex gap-1 rounded-md border border-border/60 bg-card/40 p-0.5">
            {SORT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setSortMode(opt.value)}
                aria-pressed={sortMode === opt.value}
                className={`rounded px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer ${
                  sortMode === opt.value
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent/60'
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
              <CommentToolbar textareaRef={newCommentRef} setValue={setNewComment} />
              <textarea
                ref={newCommentRef}
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') onSubmitComment()
                }}
                placeholder="اكتب تعليقك هنا... حدد جملة ثم استخدم الأزرار للتكبير أو التلوين أو الشطب"
                aria-label="اكتب تعليقك"
                rows={3}
                className="w-full resize-none border-0 bg-transparent p-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-primary"
              />
              <div className="flex justify-end border-t border-border/40 bg-muted/20 p-2">
                <Button
                  onClick={onSubmitComment}
                  disabled={!newComment.trim() || submitting}
                  size="sm"
                  className="min-h-[44px] touch-manipulation"
                >
                  {submitting ? (
                    <Loader2 className="ml-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Send className="ml-1.5 h-3.5 w-3.5" />
                  )}
                  نشر التعليق
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center rounded-lg border border-border bg-card p-6 text-center">
              <p className="text-sm text-muted-foreground">
                <Link href="/login" className="font-bold text-primary hover:text-primary/80">
                  سجّل الدخول
                </Link>{' '}
                للتعليق على هذا التعريب
              </p>
            </div>
          )}
        </div>
      </div>

      {/* قائمة التعليقات */}
      {loading ? (
        <CommentSkeleton rows={3} />
      ) : loadError ? (
        <div className="flex flex-col items-center gap-3 py-12 text-center" role="status">
          <p className="text-sm text-muted-foreground">{loadError}</p>
          <Button variant="outline" size="sm" className="min-h-[44px]" onClick={retry}>
            إعادة المحاولة
          </Button>
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
            {comments.map((comment) => (
              <CommentCard
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
                onReply={onReply}
                onSubmitReply={onSubmitReply}
                onCancelReply={onCancelReply}
                onRefresh={fetchComments}
                replyRef={replyRef}
              />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-6 flex items-center justify-center gap-3">
              <Button
                variant="outline"
                size="sm"
                className="min-h-[44px] touch-manipulation"
                disabled={page <= 1}
                onClick={goPrev}
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
                className="min-h-[44px] touch-manipulation"
                disabled={!nextCursor}
                onClick={goNext}
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
