// Server-side in-memory pub/sub keyed by userId.
// Used by the SSE route handler to fan out events to connected clients.

import type { RealtimeEvent, RealtimeEventType } from './events'
import { createRealtimeEvent } from './events'

type Listener = (event: RealtimeEvent) => void

const channels = new Map<string, Set<Listener>>()

function channelKey(userId: string | null | undefined): string {
  return userId ? String(userId) : '__anonymous__'
}

export function subscribe(userId: string | null | undefined, listener: Listener): () => void {
  const key = channelKey(userId)
  if (!channels.has(key)) channels.set(key, new Set())
  channels.get(key)!.add(listener)
  return () => unsubscribe(key, listener)
}

export function unsubscribe(userIdOrKey: string | null | undefined, listener: Listener): void {
  const key = channelKey(userIdOrKey)
  const set = channels.get(key)
  if (!set) return
  set.delete(listener)
  if (set.size === 0) channels.delete(key)
}

export function publish(
  userId: string | null | undefined,
  event: RealtimeEvent | RealtimeEventType,
  data?: unknown,
): void {
  const key = channelKey(userId)
  const set = channels.get(key)
  if (!set || set.size === 0) return
  const payload =
    typeof event === 'string'
      ? createRealtimeEvent(event as RealtimeEventType, (data as never) ?? null, userId ?? null)
      : event
  // snapshot to avoid mutation during iteration
  for (const listener of Array.from(set)) {
    try {
      listener(payload)
    } catch {
      // best-effort delivery
    }
  }
}

export const broadcastToUser = publish

export function broadcastAll(event: RealtimeEvent | RealtimeEventType, data?: unknown): void {
  for (const key of Array.from(channels.keys())) {
    publish(key === '__anonymous__' ? null : key, event as never, data)
  }
}

export function getSubscriberCount(userId: string | null | undefined): number {
  return channels.get(channelKey(userId))?.size ?? 0
}

export function hasSubscribers(userId: string | null | undefined): boolean {
  return getSubscriberCount(userId) > 0
}

export function clearAll(): void {
  channels.clear()
}

export const realtimeEmitter = {
  subscribe,
  unsubscribe,
  publish,
  broadcastToUser,
  broadcastAll,
  getSubscriberCount,
  hasSubscribers,
  clearAll,
}

export default realtimeEmitter