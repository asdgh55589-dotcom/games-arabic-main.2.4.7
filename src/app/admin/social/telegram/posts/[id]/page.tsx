// DEPRECATED: consolidated into /admin/media
'use client'

import { AlertCircle, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import {
  fetchRole,
  getPost,
  SocialApiError,
  type SocialPost,
} from '@/app/admin/social/telegram/posts/social-api'
import { PostEditor } from '@/components/admin/social/post-editor'
import { PostStatusBadge } from '@/components/admin/social/post-status-badge'
import { Button } from '@/components/ui/button'

/** صفحة تعديل منشور قائم (C3) — قراءة `GET` ثم الطفرات عبر المحرّر. */
export default function EditTelegramPostPage() {
  const params = useParams<{ id: string }>()
  const id = Array.isArray(params?.id) ? params.id[0] : (params?.id ?? '')

  const [post, setPost] = useState<SocialPost | null>(null)
  const [role, setRole] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!id) {
      setError('معرّف المنشور غير صالح')
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const data = await getPost(id)
      setPost(data)
    } catch (err) {
      if (err instanceof SocialApiError && err.status === 404) {
        setError('المنشور غير موجود — ربما حُذف.')
      } else {
        setError(err instanceof Error ? err.message : 'تعذّر تحميل المنشور')
      }
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchRole()
      .then(setRole)
      .catch(() => setRole(null))
    load()
  }, [load])

  if (loading) {
    return (
      <div dir="rtl" className="grid place-items-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="mt-3 text-sm text-muted-foreground">جارٍ تحميل المنشور…</p>
      </div>
    )
  }

  if (error || !post) {
    return (
      <div dir="rtl" className="grid place-items-center py-20 text-center">
        <AlertCircle className="mb-3 h-12 w-12 text-destructive/70" />
        <h1 className="text-xl font-bold">تعذّر فتح المنشور</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error ?? 'المنشور غير موجود'}</p>
        <Button asChild variant="outline" className="mt-4">
          <Link href="/admin/social/telegram/posts">العودة إلى قائمة المنشورات</Link>
        </Button>
      </div>
    )
  }

  return (
    <div dir="rtl" className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">
              {post.title || 'منشور بدون عنوان'}
            </h1>
            <PostStatusBadge status={post.status} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            آخر تحديث: {new Date(post.updatedAt).toLocaleString('ar-SA')}
            {post.externalId ? ` — معرّف الرسالة: ${post.externalId}` : ''}
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/admin/social/telegram/posts">قائمة المنشورات</Link>
        </Button>
      </div>

      {post.status === 'published' ? (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-600 dark:text-amber-400">
          هذا المنشور منشور بالفعل — لا يمكن تعديله أو حذفه. يمكنك نسخ محتواه في منشور جديد.
        </p>
      ) : null}

      <PostEditor post={post} role={role} onChanged={(next) => setPost(next)} />
    </div>
  )
}
