'use client'

import NewTelegramPostPage from '@/app/admin/social/telegram/posts/new/page'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

export interface NewPostModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export default function NewPostModal({ open, onOpenChange }: NewPostModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl" dir="rtl">
        <DialogHeader>
          <DialogTitle>New Post</DialogTitle>
        </DialogHeader>
        <div className="max-h-[70vh] overflow-auto">
          <NewTelegramPostPage />
        </div>
      </DialogContent>
    </Dialog>
  )
}

export { NewPostModal }
