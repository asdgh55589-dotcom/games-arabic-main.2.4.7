import * as fs from 'node:fs'
import * as path from 'node:path'

import {
  REALTIME_EVENT_TYPES,
  createRealtimeEvent,
  parseEvent,
  serializeEvent,
} from '@/lib/realtime/events'
import { computeBackoff } from '@/lib/realtime/client'
import { channelName, createChannel } from '@/lib/realtime/channel'
import { realtimeEmitter } from '@/lib/realtime/server'

const root = process.cwd()

describe('realtime events', () => {
  it('defines all required event types', () => {
    for (const t of ['mod_status_changed', 'notification_created', 'report_created', 'heartbeat']) {
      expect(REALTIME_EVENT_TYPES).toContain(t)
    }
  })

  it('creates a typed event with timestamp', () => {
    const e = createRealtimeEvent('mod_status_changed', { modId: 'm1' }, 'u1')
    expect(e.type).toBe('mod_status_changed')
    expect(e.data).toMatchObject({ modId: 'm1' })
    expect(e.userId).toBe('u1')
    expect(typeof e.timestamp).toBe('number')
  })

  it('serializes and parses an event round-trip', () => {
    const e = createRealtimeEvent('notification_created', { id: 'n1' }, 'u2')
    const serialized = serializeEvent(e)
    expect(serialized).toContain('event: notification_created')
    const dataLine = serialized.split('\n').find((l) => l.startsWith('data: '))
    expect(dataLine).toBeTruthy()
    const parsed = parseEvent(dataLine!.slice('data: '.length))
    expect(parsed?.type).toBe('notification_created')
  })
})

describe('realtime client backoff', () => {
  it('computes exponential backoff capped at max', () => {
    expect(computeBackoff(0, 1000, 2, 30000)).toBe(1000)
    expect(computeBackoff(1, 1000, 2, 30000)).toBe(2000)
    expect(computeBackoff(2, 1000, 2, 30000)).toBe(4000)
    expect(computeBackoff(10, 1000, 2, 30000)).toBe(30000)
  })
})

describe('realtime server pub/sub', () => {
  beforeEach(() => {
    realtimeEmitter.clearAll()
  })

  it('delivers published events to subscribers', () => {
    const received: unknown[] = []
    const unsub = realtimeEmitter.subscribe('u1', (e) => received.push(e))
    realtimeEmitter.publish('u1', 'heartbeat', { ok: true })
    expect(received).toHaveLength(1)
    expect((received[0] as { type: string }).type).toBe('heartbeat')
    unsub()
  })

  it('does not deliver after unsubscribe', () => {
    const received: unknown[] = []
    const unsub = realtimeEmitter.subscribe('u2', (e) => received.push(e))
    unsub()
    realtimeEmitter.publish('u2', 'report_created', { id: 'r1' })
    expect(received).toHaveLength(0)
  })

  it('tracks subscriber counts per user', () => {
    const a = jest.fn()
    const b = jest.fn()
    const u1 = realtimeEmitter.subscribe('u3', a)
    realtimeEmitter.subscribe('u3', b)
    expect(realtimeEmitter.getSubscriberCount('u3')).toBe(2)
    u1()
    expect(realtimeEmitter.getSubscriberCount('u3')).toBe(1)
    realtimeEmitter.clearAll()
  })
})

describe('realtime channel', () => {
  it('builds a user-scoped channel name', () => {
    expect(channelName('abc')).toBe('user:abc')
    expect(channelName(null)).toBe('user:anonymous')
    const ch = createChannel({ userId: 'x' })
    expect(ch.name).toBe('user:x')
  })
})

describe('realtime integration (static)', () => {
  it('SSE route declares text/event-stream and heartbeat', () => {
    const src = fs.readFileSync(
      path.join(root, 'src/app/api/realtime/stream/route.ts'),
      'utf8',
    )
    expect(src).toContain("text/event-stream")
    expect(src).toContain('HEARTBEAT_MS')
    expect(src).toContain('getSession')
  })

  it('realtime indicator renders green/red dot and reconnect button', () => {
    const src = fs.readFileSync(
      path.join(root, 'src/components/creator/realtime-indicator.tsx'),
      'utf8',
    )
    expect(src).toContain('bg-green-500')
    expect(src).toContain('bg-red-500')
    expect(src).toContain('reconnect')
  })

  it('useRealtimeSync hook exists and invalidates queries', () => {
    const src = fs.readFileSync(
      path.join(root, 'src/hooks/use-realtime-sync.ts'),
      'utf8',
    )
    expect(src).toContain('EventSource')
    expect(src).toContain('invalidateQueries')
  })

  it('realtime infrastructure files exist', () => {
    const files = [
      'src/lib/realtime/events.ts',
      'src/lib/realtime/client.ts',
      'src/lib/realtime/channel.ts',
      'src/lib/realtime/server.ts',
    ]
    for (const f of files) {
      expect(fs.existsSync(path.join(root, f))).toBe(true)
    }
  })
})