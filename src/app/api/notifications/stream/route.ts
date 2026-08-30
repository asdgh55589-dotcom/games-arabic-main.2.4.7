import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'

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
                })}\n\n`
              )
            )
            lastCheck = Date.now()
          }

          const now = Date.now()
          if (now - lastCheck > 30000) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'heartbeat' })}\n\n`))
            lastCheck = now
          }
        } catch (error) {
          console.error('[SSE] Error:', error)
        }
      }, 3000)

      req.signal.addEventListener('abort', () => {
        clearInterval(interval)
        try {
          controller.close()
        } catch {}
      })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
