// DEPRECATED: consolidated into /admin/media
'use client'

import { PostEditor } from '@/components/admin/social/post-editor'

/** صفحة إنشاء منشور جديد (C3) — الحفظ يتم عبر `POST /api/admin/social/posts`. */
export default function NewTelegramPostPage() {
  return (
    <div dir="rtl" className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">منشور تليجرام جديد</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          اكتب المنشور، راجع المعاينة، ثم احفظه كمسودة أو جدوله أو انشره فوراً.
        </p>
      </div>
      <PostEditor />
    </div>
  )
}
