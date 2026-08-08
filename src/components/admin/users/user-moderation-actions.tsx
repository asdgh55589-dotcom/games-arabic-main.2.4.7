import Link from 'next/link'
import { AlertTriangle, Ban, CheckCircle, Eye, Key, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'

interface UserModerationActionsProps {
  userId: string
  isOwner: boolean
  isBanned: boolean
  onPassword: () => void
  onBan: () => void
  onUnban: () => void
  onWarn: () => void
  onDelete: () => void
}

export function UserModerationActions({
  userId,
  isOwner,
  isBanned,
  onPassword,
  onBan,
  onUnban,
  onWarn,
  onDelete,
}: UserModerationActionsProps) {
  return (
    <div className="flex items-center gap-2">
      <Link
        href={`/admin/users/${userId}`}
        className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-white/55 transition-all hover:border-primary/30 hover:text-primary"
        title="عرض التفاصيل"
      >
        <Eye className="h-4 w-4" />
      </Link>

      <Button
        size="icon"
        variant="ghost"
        className="h-9 w-9 rounded-xl border border-white/10 bg-white/[0.03] text-white/55 hover:text-primary"
        onClick={onPassword}
        title="تغيير كلمة المرور"
      >
        <Key className="h-4 w-4" />
      </Button>

      {!isOwner && (
        <>
          {isBanned ? (
            <Button
              size="icon"
              variant="ghost"
              className="h-9 w-9 rounded-xl border border-green-500/20 bg-green-500/10 text-green-400"
              onClick={onUnban}
              title="إلغاء الحظر"
            >
              <CheckCircle className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              size="icon"
              variant="ghost"
              className="h-9 w-9 rounded-xl border border-orange-500/20 bg-orange-500/10 text-orange-400"
              onClick={onBan}
              title="حظر"
            >
              <Ban className="h-4 w-4" />
            </Button>
          )}

          <Button
            size="icon"
            variant="ghost"
            className="h-9 w-9 rounded-xl border border-yellow-500/20 bg-yellow-500/10 text-yellow-400"
            onClick={onWarn}
            title="تحذير"
          >
            <AlertTriangle className="h-4 w-4" />
          </Button>

          <Button
            size="icon"
            variant="ghost"
            className="h-9 w-9 rounded-xl border border-red-500/20 bg-red-500/10 text-red-400"
            onClick={onDelete}
            title="حذف"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </>
      )}
    </div>
  )
}
