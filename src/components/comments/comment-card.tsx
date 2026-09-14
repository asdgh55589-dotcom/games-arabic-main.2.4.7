'use client'

import { ChevronLeft, ChevronRight, Edit2, Flag, MoreVertical, Reply, ThumbsUp } from 'lucide-react'
import { useRef, useState } from 'react'
import { CommentEditBox } from '@/components/comments/comment-edit-box'
import { CommentHeader } from '@/components/comments/comment-header'
import { CommentToolbar } from '@/components/comments/comment-toolbar'
import { ReplyBox } from '@/components/comments/reply-box'
import { useCommentActions } from '@/components/comments/use-comment-actions'
import { MarkdownRenderer } from '@/components/markdown-renderer'
import { ReportButton } from '@/components/report-button'
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { SessionUser } from '@/lib/auth'
import { COMMENTS_CONFIG } from '@/lib/comments-config'
import { formatNumber } from '@/lib/format'
import type { ModCommentType } from '@/lib/types'

/** بطاقة تعليق واحد — مع ردود متداخلة (حتى 5 مستويات) */
export function CommentCard({
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
  onRefresh,
  replyRef,
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
  onRefresh: () => void
  replyRef: React.RefObject<HTMLTextAreaElement | null>
}) {
  const liked = likedIds.has(comment.id)
  const isNested = depth > 0
  const avatarSize = isNested ? 'h-8 w-8 min-h-[44px] min-w-[44px]' : 'h-10 w-10'
  const canReply = depth < COMMENTS_CONFIG.maxDepth
  const displayName = comment.user?.username || comment.guestName || 'مستخدم'
  const displayAvatar = comment.user?.avatarUrl || comment.guestAvatar
  const isOwner = currentUser?.id === comment.user?.id
  const isAdmin = currentUser && ['owner', 'admin', 'moderator'].includes(currentUser.role)
  const [showAllReplies, setShowAllReplies] = useState(false)
  const editRef = useRef<HTMLTextAreaElement>(null)
  const {
    isEditing,
    editText,
    setEditText,
    saving,
    handleEdit,
    deleteOpen,
    setDeleteOpen,
    requestDelete,
    confirmDelete,
    startEditing,
    cancelEditing,
  } = useCommentActions(comment.id, comment.text, onRefresh)

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
      <div
        className={`rounded-none border-[1.5px] shadow-[1.5px_1.5px_0_0_var(--border)] transition-all ${depthStyle.bg} ${depthStyle.border} ${isNested ? 'p-2' : 'p-2.5'}`}
      >
        <div
          className={`flex gap-2 ${comment.isPinned ? 'rounded-none border border-primary/30 bg-primary/5 p-2 -m-1' : ''}`}
        >
          <Avatar className={`${avatarSize} shrink-0 ring-2 ring-background`}>
            <AvatarImage src={displayAvatar || undefined} alt={displayName} />
            <AvatarFallback>{displayName[0]}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <CommentHeader
              comment={comment}
              displayName={displayName}
              isNested={isNested}
              modOwnerName={modOwnerName}
              replyToName={replyToName}
            />
            {/* نص التعليق */}
            {isEditing ? (
              <CommentEditBox
                editText={editText}
                setEditText={setEditText}
                editRef={editRef}
                saving={saving}
                onSave={handleEdit}
                onCancel={cancelEditing}
              />
            ) : (
              <div
                dir="auto"
                className={`${isNested ? 'text-sm' : 'mb-2 text-sm'} leading-relaxed font-medium text-foreground`}
              >
                <MarkdownRenderer content={comment.text} />
              </div>
            )}

            {/* أزرار التفاعل */}
            <div className="mt-2 flex items-center gap-1 border-t border-border/70 pt-2">
              <button
                type="button"
                onClick={() => onLike(comment.id)}
                className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-bold transition-colors border shadow-sm cursor-pointer ${
                  liked
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'border-transparent text-muted-foreground hover:bg-accent hover:text-foreground'
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
                    type="button"
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
                      type="button"
                      className="grid h-7 w-7 min-h-[44px] min-w-[44px] place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                      aria-label="خيارات"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-40">
                    <DropdownMenuItem onClick={() => startEditing(comment.text)}>
                      <Edit2 className="ml-2 h-4 w-4" />
                      تعديل
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={requestDelete}
                      className="text-red-500 focus:text-red-500"
                    >
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
                <CommentToolbar textareaRef={replyRef} setValue={setReplyText} />
                <ReplyBox
                  displayName={displayName}
                  replyText={replyText}
                  setReplyText={setReplyText}
                  replyRef={replyRef}
                  currentUsername={currentUser?.username}
                  onSubmit={() => onSubmitReply(comment.id)}
                  onCancel={onCancelReply}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* الردود المتداخلة — مسطحة (لا صناديق داخل بعضها) + تتعامل مع 5 ردود */}
      {comment.replies &&
        comment.replies.length > 0 &&
        depth < COMMENTS_CONFIG.maxDepth &&
        (() => {
          const visibleCount = COMMENTS_CONFIG.visibleReplies
          const hasMultiple = comment.replies.length > visibleCount
          const visibleReplies =
            showAllReplies || !hasMultiple
              ? comment.replies
              : comment.replies.slice(0, visibleCount)
          const hiddenCount = comment.replies.length - visibleReplies.length
          return (
            <div className="mt-3 space-y-2">
              {visibleReplies.map((reply) => (
                <CommentCard
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
                  onRefresh={onRefresh}
                  replyRef={replyRef}
                />
              ))}
              {hasMultiple && !showAllReplies && (
                <button
                  type="button"
                  onClick={() => setShowAllReplies(true)}
                  className="mt-1 inline-flex items-center gap-1 rounded-md border border-blue-500/20 bg-blue-500/10 px-2.5 py-1 text-[11px] font-bold text-blue-500 hover:bg-blue-500/15 transition-colors"
                >
                  <ChevronLeft className="h-3 w-3 rotate-90" />
                  عرض {hiddenCount} ردود إضافية
                </button>
              )}
              {hasMultiple && showAllReplies && (
                <button
                  type="button"
                  onClick={() => setShowAllReplies(false)}
                  className="mt-1 inline-flex items-center gap-1 rounded-md border border-border/40 bg-card/60 px-2.5 py-1 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ChevronRight className="h-3 w-3 rotate-90" />
                  إخفاء الردود
                </button>
              )}
            </div>
          )
        })()}

      {/* تأكيد الحذف — حوار RTL بدل confirm() الأصلي */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف التعليق؟</AlertDialogTitle>
            <AlertDialogDescription>
              سيتم حذف هذا التعليق وجميع الردود عليه نهائياً. لا يمكن التراجع عن هذا الإجراء.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
