'use client'

import type { RefObject } from 'react'
import { CommentToolbar } from '@/components/comments/comment-toolbar'
import { Button } from '@/components/ui/button'

interface CommentEditBoxProps {
  editText: string
  setEditText: (s: string) => void
  editRef: RefObject<HTMLTextAreaElement | null>
  saving: boolean
  onSave: () => void
  onCancel: () => void
}

/** صندوق تعديل التعليق */
export function CommentEditBox({
  editText,
  setEditText,
  editRef,
  saving,
  onSave,
  onCancel,
}: CommentEditBoxProps) {
  return (
    <div className="mb-2 overflow-hidden rounded-md border border-border bg-background">
      <CommentToolbar textareaRef={editRef} setValue={setEditText} />
      <textarea
        ref={editRef}
        value={editText}
        onChange={(e) => setEditText(e.target.value)}
        onKeyDown={(e) => {
          if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') onSave()
          if (e.key === 'Escape') onCancel()
        }}
        aria-label="تعديل التعليق"
        className="w-full resize-none border-0 bg-transparent p-2.5 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-primary"
        rows={3}
      />
      <div className="flex gap-2 border-t border-border/40 bg-muted/20 p-2">
        <Button
          size="sm"
          className="min-h-[44px] touch-manipulation"
          onClick={onSave}
          disabled={saving || !editText.trim()}
        >
          {saving ? 'جاري الحفظ...' : 'حفظ'}
        </Button>
        <Button
          size="sm"
          className="min-h-[44px] touch-manipulation"
          variant="outline"
          onClick={onCancel}
        >
          إلغاء
        </Button>
      </div>
    </div>
  )
}
