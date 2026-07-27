'use client'

import { useRouter } from 'next/navigation'
import { Bell, MessageCircle, Heart, Star, Shield, CheckCheck, Users, FileText, AlertTriangle, Award } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { formatArabicDate } from '@/lib/format'
import { NotificationType, NOTIFICATION_TYPE_LABELS } from '@/lib/notifications/types'
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
}

interface NotificationDropdownProps {
  notifications: Notification[]
  loading: boolean
  onMarkAsRead: (id: string) => void
  onMarkAllAsRead: () => void
  onClose: () => void
}

export function NotificationDropdown({ notifications, loading, onMarkAsRead, onMarkAllAsRead, onClose }: NotificationDropdownProps) {
  const router = useRouter()

  const handleClick = (notification: Notification) => {
    if (!notification.readAt) onMarkAsRead(notification.id)
    if (notification.link) {
      router.push(notification.link)
      onClose()
    }
  }

  return (
    <div className="absolute right-0 top-full z-50 mt-2 w-[320px] rounded-xl border border-[#333] bg-[#1a1a1a] shadow-2xl" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#333] px-4 py-3">
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-[#ff8c00]" />
          <span className="text-sm font-bold text-white">الإشعارات</span>
        </div>
        <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs text-gray-400 hover:text-[#ff8c00]" onClick={onMarkAllAsRead}>
          <CheckCheck className="h-3.5 w-3.5" />
          تعيين الكل كمقروء
        </Button>
      </div>

      {/* List */}
      <div className="max-h-[400px] overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#ff8c00] border-t-transparent" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Bell className="mb-3 h-10 w-10 text-gray-600" />
            <p className="text-sm text-gray-500">لا توجد إشعارات</p>
          </div>
        ) : (
          notifications.map((notification) => (
            <div
              key={notification.id}
              onClick={() => handleClick(notification)}
              className={`flex cursor-pointer gap-3 border-b border-[#222] px-4 py-3 transition-colors hover:bg-[#222] ${
                !notification.readAt ? 'bg-[#ff8c00]/5' : ''
              }`}
            >
              {/* Icon or Avatar */}
              <div className="shrink-0 pt-0.5">
                {notification.actor ? (
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={notification.actor.avatarUrl || undefined} />
                    <AvatarFallback className="bg-[#333] text-xs font-bold text-[#ff8c00]">
                      {notification.actor.username[0]?.toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                ) : (
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#333]">
                    {TYPE_ICONS[notification.type] || <Bell className="h-4 w-4 text-gray-400" />}
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="min-w-0 flex-1">
                <p className={`text-sm leading-snug ${!notification.readAt ? 'font-semibold text-white' : 'text-gray-300'}`}>
                  {notification.title}
                </p>
                {notification.message && (
                  <p className="mt-0.5 text-xs text-gray-500 line-clamp-1">{notification.message}</p>
                )}
                <p className="mt-1 text-[11px] text-gray-600">{formatArabicDate(notification.createdAt)}</p>
              </div>

              {/* Unread dot */}
              {!notification.readAt && (
                <div className="shrink-0 pt-2">
                  <div className="h-2 w-2 rounded-full bg-[#ff8c00]" />
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      {notifications.length > 0 && (
        <div className="border-t border-[#333] px-4 py-2.5 text-center">
          <button
            onClick={() => { router.push('/?view=notifications'); onClose() }}
            className="text-xs font-medium text-[#ff8c00] hover:underline"
          >
            عرض الكل
          </button>
        </div>
      )}
    </div>
  )
}
