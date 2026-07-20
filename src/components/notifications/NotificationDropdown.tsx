import { formatDistanceToNow } from 'date-fns'
import { ar } from 'date-fns/locale'

interface NotificationDropdownProps {
  notifications: any[]
  onMarkAsRead: (id: string) => void
  onMarkAllAsRead: () => void
  onClose: () => void
}

export function NotificationDropdown({
  notifications,
  onMarkAsRead,
  onMarkAllAsRead,
  onClose
}: NotificationDropdownProps) {
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
      className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border z-50"
      data-testid="notification-dropdown"
    >
      <div className="p-3 border-b flex justify-between items-center">
        <h3 className="font-semibold">الإشعارات</h3>
        <button
          onClick={onMarkAllAsRead}
          className="text-sm text-blue-600 hover:text-blue-800"
          data-testid="mark-all-read"
        >
          تحديد الكل كمقروء
        </button>
      </div>

      <div className="max-h-96 overflow-y-auto">
        {notifications.length === 0 ? (
          <div className="p-4 text-center text-gray-500">
            لا توجد إشعارات
          </div>
        ) : (
          notifications.map(notification => (
            <div
              key={notification.id}
              onClick={() => onMarkAsRead(notification.id)}
              className={`p-3 border-b cursor-pointer hover:bg-gray-50 ${
                !notification.isRead ? 'bg-blue-50' : ''
              }`}
              data-testid="notification-item"
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl">
                  {getNotificationIcon(notification.type)}
                </span>
                <div className="flex-1">
                  <p className="font-medium text-sm">
                    {notification.title}
                  </p>
                  <p className="text-gray-600 text-sm mt-1">
                    {notification.message}
                  </p>
                  <p className="text-gray-400 text-xs mt-2">
                    {formatDistanceToNow(new Date(notification.createdAt), {
                      addSuffix: true,
                      locale: ar
                    })}
                  </p>
                </div>
                {!notification.isRead && (
                  <div className="w-2 h-2 bg-blue-500 rounded-full mt-2" />
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="p-3 border-t">
        <a
          href="/notifications"
          className="block text-center text-blue-600 hover:text-blue-800"
          onClick={onClose}
        >
          عرض جميع الإشعارات
        </a>
      </div>
    </div>
  )
}
