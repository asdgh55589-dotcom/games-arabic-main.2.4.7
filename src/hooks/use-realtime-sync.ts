'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { RealtimeEvent } from '@/lib/realtime/events'
import { parseEvent } from '@/lib/realtime/events'

export interface UseRealtimeSyncOptions {
  userId?: string | null
  enabled?: boolean
  url?: string
  onEvent?: (event: RealtimeEvent) => void
  // Optional React Query client (if available) to invalidate on events.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  queryClient?: any
}

export interface UseRealtimeSyncReturn {
  isConnected: boolean
  lastEvent: RealtimeEvent | null
  reconnect: () => void
}

export function useRealtimeSync(
  options: UseRealtimeSyncOptions = {},
): UseRealtimeSyncReturn {
  const { userId, enabled = true, url = '/api/realtime/stream', onEvent, queryClient } =
    options

  const [isConnected, setIsConnected] = useState(false)
  const [lastEvent, setLastEvent] = useState<RealtimeEvent | null>(null)
  const sourceRef = useRef<EventSource | null>(null)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const attemptRef = useRef(0)
  const stoppedRef = useRef(false)

  const invalidateQueries = useCallback(
    (event: RealtimeEvent) => {
      // React Query invalidation (best-effort, optional dependency).
      try {
        if (queryClient && typeof queryClient.invalidateQueries === 'function') {
          queryClient.invalidateQueries()
        }
      } catch {
        // ignore
      }
      // Dynamic import fallback (no-op if not installed).
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rq = (globalThis as any).__REACT_QUERY_CLIENT__
        if (rq && typeof rq.invalidateQueries === 'function') {
          rq.invalidateQueries()
        }
      } catch {
        // ignore
      }
      // Notify listeners via custom event for pages using useFetch.
      if (typeof window !== 'undefined') {
        try {
          window.dispatchEvent(new CustomEvent('realtime:event', { detail: event }))
        } catch {
          // ignore
        }
      }
      onEvent?.(event)
    },
    [queryClient, onEvent],
  )

  const connect = useCallback(() => {
    if (!enabled || !userId) return
    if (typeof EventSource === 'undefined') return
    if (sourceRef.current) return
    stoppedRef.current = false
    try {
      const source = new EventSource(url)
      sourceRef.current = source
      source.onopen = () => {
        setIsConnected(true)
        attemptRef.current = 0
      }
      source.onmessage = (ev: MessageEvent) => {
        const parsed = parseEvent(typeof ev.data === 'string' ? ev.data : '')
        if (parsed) {
          setLastEvent(parsed)
          if (parsed.type !== 'heartbeat') invalidateQueries(parsed)
        }
      }
      // Named events (event: mod_status_changed etc.)
      const handleNamed = (ev: MessageEvent) => {
        const parsed = parseEvent(typeof ev.data === 'string' ? ev.data : '')
        const evt = parsed ?? ({ type: (ev as { type?: string }).type, data: safeJson(ev.data) } as RealtimeEvent)
        setLastEvent(evt)
        if (evt.type !== 'heartbeat') invalidateQueries(evt)
      }
      source.addEventListener('mod_status_changed', handleNamed as EventListener)
      source.addEventListener('notification_created', handleNamed as EventListener)
      source.addEventListener('report_created', handleNamed as EventListener)
      source.addEventListener('heartbeat', (ev: Event) => {
        const me = ev as MessageEvent
        const parsed = parseEvent(typeof me.data === 'string' ? me.data : '')
        if (parsed) setLastEvent(parsed)
        setIsConnected(true)
      })

      source.onerror = () => {
        setIsConnected(false)
        try {
          source.close()
        } catch {
          // ignore
        }
        sourceRef.current = null
        if (stoppedRef.current) return
        const delay = Math.min(30000, 1000 * 2 ** attemptRef.current)
        attemptRef.current += 1
        if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current)
        reconnectTimerRef.current = setTimeout(() => {
          reconnectTimerRef.current = null
          connect()
        }, delay)
      }
    } catch {
      setIsConnected(false)
    }
  }, [enabled, userId, url, invalidateQueries])

  const disconnect = useCallback(() => {
    stoppedRef.current = true
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current)
      reconnectTimerRef.current = null
    }
    if (sourceRef.current) {
      try {
        sourceRef.current.close()
      } catch {
        // ignore
      }
      sourceRef.current = null
    }
    setIsConnected(false)
  }, [])

  const reconnect = useCallback(() => {
    disconnect()
    stoppedRef.current = false
    attemptRef.current = 0
    // small delay to allow cleanup
    setTimeout(connect, 0)
  }, [disconnect, connect])

  useEffect(() => {
    if (enabled && userId) connect()
    return () => disconnect()
  }, [enabled, userId, connect, disconnect])

  return { isConnected, lastEvent, reconnect }
}

function safeJson(value: unknown): unknown {
  if (typeof value !== 'string') return value
  try {
    return JSON.parse(value)
  } catch {
    return value
  }
}