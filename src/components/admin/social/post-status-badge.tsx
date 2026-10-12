'use client'

import type { PostTone } from '@/app/admin/social/telegram/posts/post-logic'
import { statusLabel, statusTone } from '@/app/admin/social/telegram/posts/post-logic'
import { Badge } from '@/components/ui/badge'

export interface PostStatusBadgeProps {
  /** قد يكون غائباً/فارغاً/قيمة مجهولة — الشارة لا تطبع `undefined` أبداً (درس P4). */
  status?: string | null
  className?: string
}

/** شارة حالة المنشور — التسمية والنبرة تأتيان من `post-logic` (مصدر واحد + fallback آمن). */
export function PostStatusBadge({ status, className }: PostStatusBadgeProps) {
  const tone: PostTone = statusTone(status)
  return (
    <Badge variant={tone} className={className}>
      {statusLabel(status)}
    </Badge>
  )
}

export default PostStatusBadge
