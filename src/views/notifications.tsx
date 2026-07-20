'use client'

import { useMemo, useState, useEffect, useCallback } from 'react'
import { Bell, MessageCircle, Heart, Star, Shield, Settings, CheckCheck, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { useDocumentTitle } from '@/hooks/use-document-title'
import { formatArabicDate } from '@/lib/format'
import type { Notification } from '@/lib/types'

const TYPE_ICONS: Record<string, React.ReactNode> = {
  comment_reply: <MessageCircle className="h-5 w-5 text-blue-400" />,
  mod_endorse: <Heart className="h-5 w-5 text-red-400" />,
  mod_featured: <Star className="h-5 w-5 text-amber-400" />,
  admin_action: <Shield className="h-5 w-5 text-purple-400" />,
  system: <Settings className="h-5 w-5 text-gray-400" />,
}

const TYPE_LABELS: Record<string, string> = {
  comment_reply: 'ردود التعليقات',
  mod_endorse: 'إعجابات التعريبات',
  mod_featured: 'تعريبات مميزة',
  admin_action: 'إجراءات إدارية',
  system: 'إشعارات النظام',
}

export function NotificationsPage() {
  useDocumentTitle('الإشعارات')

  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [unreadCount, setUnreadCount] = useState(0)
  const [filter, setFilter] = useState('all')

  const fetchNotifications = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' })
      if (filter !== 'all') params.set('unread', 'true')
      const res = await fetch(`/api/notifications?${params}`)
      if (res.ok) {
        const data = await res.json()
        setNotifications(data.notifications)
        setTotalPages(data.totalPages)
        setUnreadCount(data.unreadCount)
      }
    } catch {} finally {
      setLoading(false)
    }
  }, [page, filter])

  useEffect(() => { fetchNotifications() }, [fetchNotifications])

  const markAsRead = async (id: string) => {
    try {
      await fetch(`/api/notifications/${id}/read`, { method: 'PUT' })
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, readAt: new Date().toISOString() } : n))
      setUnreadCount(prev => Math.max(0, prev - 1))
    } catch {}
  }

  const markAllAsRead = async () => {
    try {
      await fetch('/api/notifications/read-all', { method: 'PUT' })
      setNotifications(prev => prev.map(n => ({ ...n, readAt: new Date().toISOString() })))
      setUnreadCount(0)
    } catch {}
  }

  const deleteNotification = async (id: string) => {
    try {
      await fetch(`/api/notifications/${id}`, { method: 'DELETE' })
      setNotifications(prev => prev.filter(n => n.id !== id))
    } catch {}
  }

  return (
    <div className="min-h-screen bg-[#121212] text-white" dir="rtl">
      <div className="mx-auto max-w-[800px] px-4 py-8">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Bell className="h-6 w-6 text-[#ff8c00]" />
            <h1 className="text-2xl font-bold">الإشعارات</h1>
            {unreadCount > 0 && (
              <span className="rounded-full bg-[#ff8c00] px-2.5 py-0.5 text-xs font-bold text-white">
                {unreadCount}
              </span>
            )}
          </div>
          {unreadCount > 0 && (
            <Button variant="outline" size="sm" className="gap-1.5 border-[#333] text-xs text-gray-300 hover:bg-[#222]" onClick={markAllAsRead}>
              <CheckCheck className="h-3.5 w-3.5" />
              تعيين الكل كمقروء
            </Button>
          )}
        </div>

        {/* Tabs */}
        <Tabs value={filter} onValueChange={(v) => { setFilter(v); setPage(1) }}>
          <TabsList className="mb-6 w-full flex-row justify-start border-b border-[#333] bg-transparent p-0">
            <TabsTrigger value="all" className="rounded-none border-b-2 border-transparent bg-transparent text-gray-500 data-[state=active]:border-[#ff8c00] data-[state=active]:text-white">
              الكل
            </TabsTrigger>
            <TabsTrigger value="unread" className="rounded-none border-b-2 border-transparent bg-transparent text-gray-500 data-[state=active]:border-[#ff8c00] data-[state=active]:text-white">
              غير مقروء ({unreadCount})
            </TabsTrigger>
          </TabsList>

          <TabsContent value={filter}>
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#ff8c00] border-t-transparent" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <Bell className="mb-4 h-16 w-16 text-gray-700" />
                <p className="text-lg font-medium text-gray-400">لا توجد إشعارات</p>
                <p className="mt-1 text-sm text-gray-600">ستظهر الإشعارات الجديدة هنا</p>
              </div>
            ) : (
              <div className="space-y-2">
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    onClick={() => !notification.readAt && markAsRead(notification.id)}
                    className={`group flex gap-4 rounded-xl border p-4 transition-all hover:bg-[#1a1a1a] ${
                      !notification.readAt
                        ? 'border-[#ff8c00]/20 bg-[#ff8c00]/5'
                        : 'border-[#222] bg-[#161616]'
                    }`}
                  >
                    {/* Avatar or Icon */}
                    <div className="shrink-0">
                      {notification.actor ? (
                        <Avatar className="h-11 w-11">
                          <AvatarImage src={notification.actor.avatarUrl || undefined} />
                          <AvatarFallback className="bg-[#333] text-sm font-bold text-[#ff8c00]">
                            {notification.actor.username[0]?.toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                      ) : (
                        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#333]">
                          {TYPE_ICONS[notification.type] || <Bell className="h-5 w-5 text-gray-400" />}
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className={`text-sm leading-snug ${!notification.readAt ? 'font-semibold text-white' : 'text-gray-300'}`}>
                          {notification.title}
                        </p>
                        <div className="flex shrink-0 items-center gap-1">
                          {!notification.readAt && <div className="h-2 w-2 rounded-full bg-[#ff8c00]" />}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400"
                            onClick={(e) => { e.stopPropagation(); deleteNotification(notification.id) }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                      {notification.message && (
                        <p className="mt-1 text-xs text-gray-500">{notification.message}</p>
                      )}
                      <div className="mt-2 flex items-center gap-2">
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#222] px-2 py-0.5 text-[10px] text-gray-400">
                          {TYPE_ICONS[notification.type]}
                          {TYPE_LABELS[notification.type] || notification.type}
                        </span>
                        <span className="text-[11px] text-gray-600">{formatArabicDate(notification.createdAt)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-6 flex items-center justify-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 border-[#333] text-xs text-gray-300"
                  disabled={page <= 1}
                  onClick={() => setPage(p => p - 1)}
                >
                  السابق
                </Button>
                <span className="text-xs text-gray-500">
                  {page} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 border-[#333] text-xs text-gray-300"
                  disabled={page >= totalPages}
                  onClick={() => setPage(p => p + 1)}
                >
                  التالي
                </Button>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
