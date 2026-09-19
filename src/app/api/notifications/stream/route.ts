import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// GET /api/notifications/stream — DISABLED (501).
//
// The per-tab SSE stream (3s DB poll per open tab) is retired in favor of the
// single polling channel: useNotificationPolling (30s unread-count poll,
// visibility-aware, server-cached). Keeping the route returns an explicit
// signal instead of a hanging connection.
export async function GET() {
  return NextResponse.json(
    { error: 'SSE disabled — use polling', code: 'SSE_DISABLED' },
    { status: 501 },
  )
}
