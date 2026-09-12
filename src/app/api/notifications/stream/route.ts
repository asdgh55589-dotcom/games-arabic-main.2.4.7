import type { NextRequest } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { reportError } from '@/lib/error-reporting'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) {
    return new Response('Unauthorized', { status: 401 })
  }

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'connected' })}\n\n`))

      let lastCheck = Date.now()

      const interval = setInterval(async () => {
        try {
          const newNotifications = await db.notification.findMany({
            where: {
              userId: session.id,
              createdAt: { gt: new Date(lastCheck) },
            },
            orderBy: { createdAt: 'desc' },
            take: 10,
          })

          if (newNotifications.length > 0) {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: 'new_notifications',
                  notifications: newNotifications,
                })}\n\n`,
              ),
            )
            lastCheck = Date.now()
          }

          const now = Date.now()
          if (now - lastCheck > 30000) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'heartbeat' })}\n\n`))
            lastCheck = now
          }
        } catch (error) {
          // UNEXPECTED: notification poll query failed — stream stays alive for retry on next tick.
          // Control flow unchanged (no rethrow, interval continues) — report only. No userId logged.
          logger.error(
            { event: 'notifications_stream_poll_failed', route: 'notifications/stream', error },
            'SSE poll failed',
          )
          reportError(error, { route: 'api/notifications/stream', action: 'sse_poll' })
        }
      }, 3000)

      req.signal.addEventListener('abort', () => {
        clearInterval(interval)
        try {
          controller.close()
        } catch (err) {
          // biome-ignore lint/suspicious/noEmptyBlockStatements: close-after-abort routinely throws (already closed) — teardown is complete either way
          // intentional: expected+handled (interval already cleared; nothing left to clean up)
          logger.warn({ event: 'sse_controller_close', err }, 'SSE controller close failed')
        }
      })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
