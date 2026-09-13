'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Notification } from '@/lib/types'

interface UseNotificationPollingOptions {
  userId: string | null
  pollIntervalMs?: number
  maxNotifications?: number
  enabled?: boolean
}

interface UseNotificationPollingReturn {
  notifications: Notification[]
  unreadCount: number
  isLoading: boolean
  error: string | null
  refetch: () => Promise<void>
  markAsRead: (id: string) => Promise<void>
  markAllAsRead: () => Promise<void>
}

export function useNotificationPolling(
  options: UseNotificationPollingOptions,
): UseNotificationPollingReturn {
  const { userId, pollIntervalMs = 30_000, maxNotifications = 20, enabled = true } = options

  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const isVisibleRef = useRef(true)
  const prevCountRef = useRef(0)

  const fetchNotifications = useCallback(async () => {
    if (!userId) return
    try {
      const res = await fetch(`/api/notifications?limit=${maxNotifications}`)
      if (!res.ok) throw new Error('Failed to fetch notifications')
      const data = await res.json()
      setNotifications(data.data ?? [])
      if (typeof data.meta?.unreadCount === 'number') {
        setUnreadCount(data.meta.unreadCount)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch notifications')
    }
  }, [userId, maxNotifications])

  const fetchUnreadCount = useCallback(async () => {
    if (!userId) return
    try {
      const res = await fetch('/api/notifications/unread-count')
      if (!res.ok) throw new Error('Failed to fetch unread count')
      const data = await res.json()
      const count = data.data?.count ?? 0

      if (count > prevCountRef.current || prevCountRef.current === 0) {
        await fetchNotifications()
      }

      prevCountRef.current = count
      setUnreadCount(count)
    } catch {
      // biome-ignore lint/suspicious/noEmptyBlockStatements: best-effort notification polling
    }
  }, [userId, fetchNotifications])

  const startPolling = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    intervalRef.current = setInterval(() => {
      if (isVisibleRef.current) fetchUnreadCount()
    }, pollIntervalMs)
  }, [fetchUnreadCount, pollIntervalMs])

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  // Page Visibility API
  useEffect(() => {
    const handleVisibilityChange = () => {
      const isVisible = document.visibilityState === 'visible'
      isVisibleRef.current = isVisible

      if (isVisible) {
        fetchUnreadCount()
        startPolling()
      } else {
        stopPolling()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [fetchUnreadCount, startPolling, stopPolling])

  // Initial fetch + start polling
  useEffect(() => {
    if (!userId || !enabled) return

    setIsLoading(true)
    fetchNotifications()
      .then(() => fetchUnreadCount())
      .finally(() => setIsLoading(false))

    startPolling()
    return () => stopPolling()
  }, [userId, enabled]) // eslint-disable-line react-hooks/exhaustive-deps

  const markAsRead = useCallback(async (id: string) => {
    try {
      await fetch(`/api/notifications/${id}/read`, { method: 'POST' })
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n)),
      )
      setUnreadCount((prev) => Math.max(0, prev - 1))
    } catch {
      // biome-ignore lint/suspicious/noEmptyBlockStatements: best-effort notification polling
    }
  }, [])

  const markAllAsRead = useCallback(async () => {
    try {
      await fetch('/api/notifications/read-all', { method: 'POST' })
      setNotifications((prev) => prev.map((n) => ({ ...n, readAt: new Date().toISOString() })))
      setUnreadCount(0)
    } catch {
      // biome-ignore lint/suspicious/noEmptyBlockStatements: best-effort notification polling
    }
  }, [])

  return {
    notifications,
    unreadCount,
    isLoading,
    error,
    refetch: fetchNotifications,
    markAsRead,
    markAllAsRead,
  }
}
