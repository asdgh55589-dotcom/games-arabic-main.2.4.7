'use client'

import { Send } from 'lucide-react'
import type { RefObject } from 'react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'

interface ReplyBoxProps {
  displayName: string
  replyText: string
  setReplyText: (s: string) => void
  replyRef: RefObject<HTMLTextAreaElement | null>
  currentUsername?: string | null
  onSubmit: () => void
  onCancel: () => void
}

/** صندوق الرد على تعليق (مستخرج من CommentItem) */
export function ReplyBox({
  displayName,
  replyText,
  setReplyText,
  replyRef,
  currentUsername,
  onSubmit,
  onCancel,
}: ReplyBoxProps) {
  return (
    <div className="flex gap-2 p-2">
      <Avatar className="h-8 w-8 min-h-[44px] min-w-[44px] shrink-0">
        <AvatarFallback>{currentUsername?.[0] || 'ز'}</AvatarFallback>
      </Avatar>
      <div className="flex-1">
        <textarea
          ref={replyRef as React.RefObject<HTMLTextAreaElement>}
          value={replyText}
          onChange={(e) => setReplyText(e.target.value)}
          onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && replyText.trim()) onSubmit()
            if (e.key === 'Escape') onCancel()
          }}
          placeholder={`الرد على ${displayName}...`}
          aria-label={`الرد على ${displayName}`}
          rows={2}
          autoFocus
          className="w-full resize-none rounded-md border border-border bg-background p-2.5 text-sm text-foreground placeholder:text-muted-foreground focus-visible:border-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
        />
        <div className="mt-1.5 flex justify-end gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="min-h-[44px] touch-manipulation"
            onClick={onCancel}
          >
            إلغاء
          </Button>
          <Button
            size="sm"
            className="min-h-[44px] touch-manipulation"
            onClick={onSubmit}
            disabled={!replyText.trim()}
          >
            <Send className="ml-1.5 h-3.5 w-3.5" />
            نشر الرد
          </Button>
        </div>
      </div>
    </div>
  )
}
