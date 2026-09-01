import Link from 'next/link'
import { AlertTriangle, Ban, CheckCircle, Eye, Key, Pencil, Trash2 } from 'lucide-react'

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
  onEdit?: () => void
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
  onEdit,
}: UserModerationActionsProps) {
  return (
    <div className="flex items-center gap-2">
      <Link
        href={`/admin/users/${userId}`}
        className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-background-secondary text-muted-foreground transition-all hover:border-primary/30 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        title="عرض التفاصيل"
      >
        <Eye className="h-4 w-4" />
      </Link>

      {onEdit && (
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8 rounded-md border border-border bg-background-secondary text-muted-foreground hover:text-primary min-h-[44px] min-w-[44px]"
          onClick={onEdit}
          title="تعديل البيانات" aria-label="تعديل البيانات"
        >
          <Pencil className="h-4 w-4" />
        </Button>
      )}

      <Button
        size="icon"
        variant="ghost"
        className="h-8 w-8 rounded-md border border-border bg-background-secondary text-muted-foreground hover:text-primary min-h-[44px] min-w-[44px]"
        onClick={onPassword}
        title="تغيير كلمة المرور" aria-label="تغيير كلمة المرور"
      >
        <Key className="h-4 w-4" />
      </Button>

      {!isOwner && (
        <>
          {isBanned ? (
            <Button
              size="icon"
              variant="ghost"
              className="h-9 w-9 rounded-xl border border-green-500/20 bg-green-500/10 text-green-400 min-h-[44px] min-w-[44px]"
              onClick={onUnban}
              title="إلغاء الحظر" aria-label="إلغاء الحظر"
            >
              <CheckCircle className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              size="icon"
              variant="ghost"
              className="h-9 w-9 rounded-xl border border-orange-500/20 bg-orange-500/10 text-orange-400 min-h-[44px] min-w-[44px]"
              onClick={onBan}
              title="حظر" aria-label="حظر"
            >
              <Ban className="h-4 w-4" />
            </Button>
          )}

          <Button
            size="icon"
            variant="ghost"
            className="h-9 w-9 rounded-xl border border-yellow-500/20 bg-yellow-500/10 text-yellow-400 min-h-[44px] min-w-[44px]"
            onClick={onWarn}
            title="تحذير" aria-label="تحذير"
          >
            <AlertTriangle className="h-4 w-4" />
          </Button>

          <Button
            size="icon"
            variant="ghost"
            className="h-9 w-9 rounded-xl border border-red-500/20 bg-red-500/10 text-red-400 min-h-[44px] min-w-[44px]"
            onClick={onDelete}
            title="حذف" aria-label="حذف"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </>
      )}
    </div>
  )
}
