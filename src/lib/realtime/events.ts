// Real-time event definitions for the SSE-based sync layer.
// These are the canonical event types broadcast over /api/realtime/stream.

export type RealtimeEventType =
  | 'mod_status_changed'
  | 'notification_created'
  | 'report_created'
  | 'heartbeat'

export interface RealtimeEventPayload {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any
}

export interface RealtimeEvent {
  type: RealtimeEventType
  userId?: string | null
  data?: RealtimeEventPayload | null
  timestamp?: number
  id?: string
}

export const REALTIME_EVENTS = {
  MOD_STATUS_CHANGED: 'mod_status_changed' as const,
  NOTIFICATION_CREATED: 'notification_created' as const,
  REPORT_CREATED: 'report_created' as const,
  HEARTBEAT: 'heartbeat' as const,
} as const

export const REALTIME_EVENT_TYPES: RealtimeEventType[] = [
  'mod_status_changed',
  'notification_created',
  'report_created',
  'heartbeat',
]

export function isRealtimeEventType(value: unknown): value is RealtimeEventType {
  return typeof value === 'string' && (REALTIME_EVENT_TYPES as string[]).includes(value)
}

export function createRealtimeEvent(
  type: RealtimeEventType,
  data?: RealtimeEventPayload | null,
  userId?: string | null,
): RealtimeEvent {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    type,
    userId: userId ?? null,
    data: data ?? null,
    timestamp: Date.now(),
  }
}

export function serializeEvent(event: RealtimeEvent): string {
  const lines: string[] = []
  if (event.id) lines.push(`id: ${event.id}`)
  lines.push(`event: ${event.type}`)
  lines.push(`data: ${JSON.stringify(event)}`)
  lines.push('')
  return lines.join('\n') + '\n'
}

export function parseEvent(raw: string): RealtimeEvent | null {
  try {
    const parsed = JSON.parse(raw) as RealtimeEvent
    if (!parsed || !isRealtimeEventType(parsed.type)) return null
    return parsed
  } catch {
    return null
  }
}

export const HEARTBEAT_INTERVAL_MS = 30_000