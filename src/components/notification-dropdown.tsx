'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import {
  Bell,
  BellOff,
  MessageCircle,
  Heart,
  Star,
  Shield,
  CheckCheck,
  Users,
  FileText,
  AlertTriangle,
  Award,
  Package,
  Send,
  Clock,
  AlertCircle,
  ChevronLeft,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { formatArabicDate } from '@/lib/format'
import { NotificationType } from '@/lib/notifications/types'
import type { Notification } from '@/lib/types'

const TYPE_ICONS: Record<NotificationType, React.ReactNode> = {
  [NotificationType.CommentReply]: <MessageCircle className="h-4 w-4 text-blue-400" />,
  [NotificationType.Like]: <Heart className="h-4 w-4 text-red-400" />,
  [NotificationType.ModEndorse]: <Heart className="h-4 w-4 text-red-400" />,
  [NotificationType.ModEndorseMilestone]: <Star className="h-4 w-4 text-amber-400" />,
  [NotificationType.ModFeatured]: <Star className="h-4 w-4 text-amber-400" />,
  [NotificationType.TierUpgrade]: <Award className="h-4 w-4 text-orange-400" />,
  [NotificationType.SpecialRoleAssigned]: <Shield className="h-4 w-4 text-purple-400" />,
  [NotificationType.SpecialRoleRemoved]: <Shield className="h-4 w-4 text-gray-400" />,
  [NotificationType.AdminAction]: <Shield className="h-4 w-4 text-purple-400" />,
  [NotificationType.AdminUserRegister]: <Users className="h-4 w-4 text-green-400" />,
  [NotificationType.AdminRequest]: <FileText className="h-4 w-4 text-cyan-400" />,
  [NotificationType.AdminReport]: <AlertTriangle className="h-4 w-4 text-yellow-400" />,
  [NotificationType.AdminMilestone]: <Star className="h-4 w-4 text-amber-400" />,
  [NotificationType.ModSubmitted]: <Send className="h-4 w-4 text-blue-400" />,
  [NotificationType.ModApproved]: <CheckCheck className="h-4 w-4 text-green-400" />,
  [NotificationType.ModRejected]: <AlertCircle className="h-4 w-4 text-red-400" />,
  [NotificationType.ModPublished]: <Package className="h-4 w-4 text-green-400" />,
  [NotificationType.ModScheduled]: <Clock className="h-4 w-4 text-blue-400" />,
  [NotificationType.NewComment]: <MessageCircle className="h-4 w-4 text-blue-400" />,
  [NotificationType.NewReport]: <AlertTriangle className="h-4 w-4 text-yellow-400" />,
  [NotificationType.NewVersion]: <Package className="h-4 w-4 text-cyan-400" />,
  [NotificationType.BackupCompleted]: <CheckCheck className="h-4 w-4 text-green-400" />,
  [NotificationType.SystemAlert]: <AlertTriangle className="h-4 w-4 text-red-400" />,
}

interface NotificationDropdownProps {
  notifications: Notification[]
  loading: boolean
  onMarkAsRead: (id: string) => void
  onMarkAllAsRead: () => void
  onClose: () => void
}

export function NotificationDropdown({
  notifications,
  loading,
  onMarkAsRead,
  onMarkAllAsRead,
  onClose,
}: NotificationDropdownProps) {
  const router = useRouter()

  const unreadNotifications = notifications.filter((n) => !n.readAt)

  const handleClick = async (notification: Notification) => {
    if (!notification.readAt) {
      await onMarkAsRead(notification.id)
    }
    const url = (notification as any).targetUrl || notification.link
    if (url) {
      router.push(url)
    }
    onClose()
  }

  const handleActorClick = async (e: React.MouseEvent, notification: Notification) => {
    e.stopPropagation()
    if (!notification.readAt) {
      await onMarkAsRead(notification.id)
    }
  }

  return (
    <div
      className="absolute right-0 top-full z-50 mt-2 w-[320px] rounded-none border-2 border-border bg-card shadow-2xl"
      dir="rtl"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b-2 border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-gold" />
          <span className="text-sm font-bold text-foreground">الإشعارات</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className={`h-7 gap-1 text-xs text-muted-foreground hover:text-gold ${unreadNotifications.length === 0 ? 'hidden' : ''}`}
          onClick={onMarkAllAsRead}
        >
          <CheckCheck className="h-3.5 w-3.5" />
          تعيين الكل كمقروء
        </Button>
      </div>

      {/* List */}
      <div className="max-h-[400px] overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-gold border-t-transparent" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Bell className="mb-3 h-10 w-10 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">لا توجد إشعارات</p>
          </div>
        ) : unreadNotifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <BellOff className="mb-3 h-10 w-10 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">لا توجد إشعارات جديدة</p>
            <p className="mt-1 text-xs text-muted-foreground/60">جميع الإشعارات مقروءة</p>
          </div>
        ) : (
          unreadNotifications.map((notification) => {
            const targetUrl = (notification as any).targetUrl || notification.link
            const targetTitle = (notification as any).targetTitle
            const targetType = (notification as any).targetType
            const actorUsername =
              (notification as any).actorUsername || notification.actor?.username
            const actorAvatarUrl =
              (notification as any).actorAvatarUrl || notification.actor?.avatarUrl
            return (
              <div
                key={notification.id}
                onClick={() => handleClick(notification)}
                className="flex cursor-pointer gap-3 border-b border-border bg-gold/5 px-4 py-3 transition-colors hover:bg-accent"
              >
                {/* Icon or Avatar — clickable to profile */}
                <div className="shrink-0 pt-0.5">
                  {actorUsername ? (
                    <Link
                      href={`/profile/${actorUsername}`}
                      onClick={(e) => handleActorClick(e, notification)}
                      className="block"
                    >
                      <Avatar className="h-9 w-9">
                        <AvatarImage src={actorAvatarUrl || undefined} />
                        <AvatarFallback className="bg-secondary text-xs font-bold text-gold">
                          {actorUsername[0]?.toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    </Link>
                  ) : notification.actor ? (
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={notification.actor.avatarUrl || undefined} />
                      <AvatarFallback className="bg-secondary text-xs font-bold text-gold">
                        {notification.actor.username[0]?.toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  ) : targetType === 'team' ? (
                    <Link
                      href={targetUrl || '#'}
                      onClick={(e) => e.stopPropagation()}
                      className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100"
                    >
                      <Users className="h-5 w-5 text-blue-600" />
                    </Link>
                  ) : (
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary">
                      {TYPE_ICONS[notification.type as NotificationType] || (
                        <Bell className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold leading-snug text-foreground">
                    {notification.title}
                  </p>
                  {notification.message && (
                    <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">
                      {actorUsername && (
                        <Link
                          href={`/profile/${actorUsername}`}
                          onClick={(e) => handleActorClick(e, notification)}
                          className="font-bold hover:underline hover:text-gold"
                        >
                          {actorUsername}
                        </Link>
                      )}{' '}
                      {notification.message}
                    </p>
                  )}
                  {/* Target title as link */}
                  {targetUrl && targetTitle && (
                    <Link
                      href={targetUrl}
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1 mt-1 text-sm text-blue-600 hover:underline"
                    >
                      <span>
                        {targetType === 'team' ? '👥' : targetType === 'profile' ? '👤' : '📄'}
                      </span>
                      <span className={targetType === 'team' ? 'font-bold text-blue-600' : ''}>
                        {targetTitle}
                      </span>
                    </Link>
                  )}
                  <p className="mt-1 text-[11px] text-muted-foreground/60">
                    {formatArabicDate(notification.createdAt)}
                  </p>
                </div>

                {/* Arrow indicator if clickable + unread dot */}
                <div className="shrink-0 flex flex-col items-center gap-2 pt-1">
                  {targetUrl && <ChevronLeft className="w-4 h-4 text-gray-400" />}
                  <div className="h-2 w-2 rounded-full bg-gold" />
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Footer — always show "View All" */}
      <div className="border-t-2 border-border px-4 py-2.5 text-center">
        <button
          onClick={() => {
            router.push('/notifications')
            onClose()
          }}
          className="text-xs font-medium text-gold hover:underline"
        >
          عرض كل الإشعارات
        </button>
      </div>
    </div>
  )
}
