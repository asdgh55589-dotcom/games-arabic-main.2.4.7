'use client'

import { Bell } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { NotificationDropdown } from '@/components/notification-dropdown'
import { Button } from '@/components/ui/button'
import { useNotificationPolling } from '@/hooks/use-notification-polling'

interface NotificationBellProps {
  currentUser: { id: string; username: string } | null
}

// Single notification channel: polling hook only (30s, visibility-aware,
// server-cached unread count). The SSE stream is retired (501).
export function NotificationBell({ currentUser }: NotificationBellProps) {
  const [open, setOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const { notifications, unreadCount, isLoading, markAsRead, markAllAsRead } =
    useNotificationPolling({ userId: currentUser?.id ?? null })

  const handleMarkAsRead = useCallback(
    async (id: string) => {
      await markAsRead(id)
    },
    [markAsRead],
  )

  const handleMarkAllAsRead = useCallback(async () => {
    await markAllAsRead()
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
