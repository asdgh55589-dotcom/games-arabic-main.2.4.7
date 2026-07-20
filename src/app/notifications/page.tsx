'use client'

import { useState, useEffect } from 'react'
import { NotificationItem } from '@/components/notifications/NotificationItem'
import { NotificationFilters } from '@/components/notifications/NotificationFilters'

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<any[]>([])
  const [filters, setFilters] = useState({ type: 'all', read: 'all' })
  const [loading, setLoading] = useState(true)

  const fetchNotifications = async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (filters.type !== 'all') params.append('type', filters.type)
    if (filters.read !== 'all') params.append('read', filters.read)

    const response = await fetch(`/api/notifications?${params}`)
    const data = await response.json()
    setNotifications(data.notifications)
    setLoading(false)
  }

  useEffect(() => {
    fetchNotifications()
  }, [filters])

  const markAsRead = async (id: string) => {
    await fetch(`/api/notifications/${id}/read`, { method: 'PATCH' })
    setNotifications(prev =>
      prev.map(n => n.id === id ? { ...n, isRead: true } : n)
    )
  }

  const deleteNotification = async (id: string) => {
    await fetch(`/api/notifications/${id}`, { method: 'DELETE' })
    setNotifications(prev => prev.filter(n => n.id !== id))
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">الإشعارات</h1>

      <NotificationFilters filters={filters} onFilterChange={setFilters} />

      {loading ? (
        <div className="text-center py-8">جاري التحميل...</div>
      ) : notifications.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          لا توجد إشعارات
        </div>
      ) : (
        <div className="space-y-4">
          {notifications.map(notification => (
            <NotificationItem
              key={notification.id}
              notification={notification}
              onMarkAsRead={markAsRead}
              onDelete={deleteNotification}
            />
          ))}
        </div>
      )}
    </div>
  )
}
