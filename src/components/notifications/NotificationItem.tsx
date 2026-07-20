// src/components/notifications/NotificationItem.tsx
import { formatDistanceToNow } from 'date-fns'
import { ar } from 'date-fns/locale'

interface NotificationItemProps {
  notification: any
  onMarkAsRead: (id: string) => void
  onDelete: (id: string) => void
}

export function NotificationItem({
  notification,
  onMarkAsRead,
  onDelete
}: NotificationItemProps) {
  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'like': return '❤️'
      case 'comment': return '💬'
      case 'admin': return '👑'
      case 'system': return '🔔'
      default: return '📢'
    }
  }

  return (
    <div
      className={`p-4 rounded-lg border ${
        !notification.isRead ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-200'
      }`}
    >
      <div className="flex items-start gap-3">
        <span className="text-2xl">
          {getNotificationIcon(notification.type)}
        </span>
        <div className="flex-1">
          <p className="font-medium">{notification.title}</p>
          <p className="text-gray-600 mt-1">{notification.message}</p>
          <p className="text-gray-400 text-sm mt-2">
            {formatDistanceToNow(new Date(notification.createdAt), {
              addSuffix: true,
              locale: ar
            })}
          </p>
        </div>
        <div className="flex gap-2">
          {!notification.isRead && (
            <button
              onClick={() => onMarkAsRead(notification.id)}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              تحديد كمقروء
            </button>
          )}
          <button
            onClick={() => onDelete(notification.id)}
            className="text-sm text-red-600 hover:text-red-800"
          >
            حذف
          </button>
        </div>
      </div>
    </div>
  )
}
