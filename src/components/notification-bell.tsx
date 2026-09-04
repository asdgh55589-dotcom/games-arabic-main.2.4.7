'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Bell } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { NotificationDropdown } from '@/components/notification-dropdown'
import { useNotificationPolling } from '@/hooks/use-notification-polling'

interface NotificationBellProps {
  currentUser: { id: string; username: string } | null
}

export function NotificationBell({ currentUser }: NotificationBellProps) {
  const [open, setOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const eventSourceRef = useRef<EventSource | null>(null)

  const {
    notifications: pollingNotifications,
    unreadCount: pollingUnread,
    isLoading,
    markAsRead,
    markAllAsRead,
  } = useNotificationPolling({ userId: currentUser?.id ?? null })

  const [sseNotifications, setSseNotifications] = useState<typeof pollingNotifications>([])
  const [sseUnread, setSseUnread] = useState(0)
  const [sseConnected, setSseConnected] = useState(false)

  // Merge polling + SSE
  const notifications = sseNotifications.length > 0 ? sseNotifications : pollingNotifications
  const unreadCount = sseUnread || pollingUnread

  const connectSSE = useCallback(() => {
    if (!currentUser?.id) return
    if (eventSourceRef.current) eventSourceRef.current.close()

    try {
      const es = new EventSource('/api/notifications/stream')
      eventSourceRef.current = es

      es.onopen = () => setSseConnected(true)

      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          if (data.type === 'connected') {
            setSseConnected(true)
          } else if (data.type === 'new_notifications' && Array.isArray(data.notifications)) {
            setSseNotifications((prev) => {
              const merged = [...data.notifications, ...prev]
              // dedup by id
              const seen = new Set<string>()
              return merged
                .filter((n: { id: string }) => {
                  if (seen.has(n.id)) return false
                  seen.add(n.id)
                  return true
                })
                .slice(0, 50)
            })
            setSseUnread((prev) => prev + data.notifications.length)
            // Browser notification if permitted
            if (
              typeof window !== 'undefined' &&
              'Notification' in window &&
              Notification.permission === 'granted'
            ) {
              data.notifications.forEach((n: { title: string; message: string }) => {
                try {
                  new Notification(n.title, { body: n.message })
                } catch {}
              })
            }
          } else if (data.type === 'heartbeat') {
            // keep alive
          }
        } catch {}
      }

      es.onerror = () => {
        es.close()
        setSseConnected(false)
        setTimeout(connectSSE, 5000)
      }
    } catch {
      setTimeout(connectSSE, 5000)
    }
  }, [currentUser?.id])

  useEffect(() => {
    if (!currentUser?.id) return
    // Request browser notification permission
    if (
      typeof window !== 'undefined' &&
      'Notification' in window &&
      Notification.permission === 'default'
    ) {
      Notification.requestPermission().catch(() => {})
    }
    connectSSE()
    return () => {
      eventSourceRef.current?.close()
      eventSourceRef.current = null
    }
  }, [currentUser?.id, connectSSE])

  // Sync polling notifications to SSE state initially
  useEffect(() => {
    if (pollingNotifications.length > 0 && sseNotifications.length === 0) {
      setSseNotifications(pollingNotifications)
    }
  }, [pollingNotifications, sseNotifications.length])

  const handleMarkAsRead = useCallback(
    async (id: string) => {
      await markAsRead(id)
      setSseNotifications((prev) =>
        prev.map((n) => (n.id === id ? ({ ...n, readAt: new Date().toISOString() } as never) : n)),
      )
      setSseUnread((prev) => Math.max(0, prev - 1))
    },
    [markAsRead],
  )

  const handleMarkAllAsRead = useCallback(async () => {
    await markAllAsRead()
    setSseNotifications((prev) =>
      prev.map((n) => ({ ...n, readAt: new Date().toISOString() }) as never),
    )
    setSseUnread(0)
  }, [markAllAsRead])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  if (!currentUser) return null

  return (
    <div className="relative" ref={dropdownRef}>
      <Button
        variant="ghost"
        size="sm"
        className="relative h-9 w-9 p-0 text-muted-foreground hover:text-foreground min-h-[44px]"
        onClick={() => setOpen(!open)}
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -left-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </Button>

      {open && (
        <NotificationDropdown
          notifications={notifications}
          loading={isLoading}
          onMarkAsRead={handleMarkAsRead}
          onMarkAllAsRead={handleMarkAllAsRead}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  )
}
