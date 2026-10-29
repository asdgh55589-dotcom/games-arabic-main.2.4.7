import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { getSession } from '@/lib/auth'
import { subscribe } from '@/lib/realtime/server'
import { createRealtimeEvent, serializeEvent } from '@/lib/realtime/events'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const HEARTBEAT_MS = 30_000

// In-memory active connection counter per user (1 connection per user).
const activeConnections = new Map<string, number>()

export async function GET(req: NextRequest) {
  const user = await getSession()
  if (!user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = String(user.id)
  const current = activeConnections.get(userId) ?? 0
  if (current >= 1) {
    return NextResponse.json({ error: 'Too many connections' }, { status: 429 })
  }
  activeConnections.set(userId, current + 1)

  const encoder = new TextEncoder()
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null
  let unsubscribe: (() => void) | null = null

  const release = () => {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer)
      heartbeatTimer = null
    }
    if (unsubscribe) {
      try {
        unsubscribe()
      } catch {
        // ignore
      }
      unsubscribe = null
    }
    const n = activeConnections.get(userId) ?? 1
    if (n <= 1) activeConnections.delete(userId)
    else activeConnections.set(userId, n - 1)
  }

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      // initial heartbeat
      try {
        controller.enqueue(
          encoder.encode(serializeEvent(createRealtimeEvent('heartbeat', null, userId))),
        )
      } catch {
        // ignore
      }

      unsubscribe = subscribe(userId, (event) => {
        try {
          controller.enqueue(encoder.encode(serializeEvent(event)))
        } catch {
          // client gone
        }
      })

      heartbeatTimer = setInterval(() => {
        try {
          controller.enqueue(
            encoder.encode(serializeEvent(createRealtimeEvent('heartbeat', null, userId))),
          )
        } catch {
          // ignore
        }
      }, HEARTBEAT_MS)
    },
    cancel() {
      release()
    },
  })

  // Also release when the underlying request is aborted.
  req.signal.addEventListener('abort', release, { once: true })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}