import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const logId = searchParams.get('id')
  const event = searchParams.get('event')

  if (!logId || !event) {
    return new NextResponse(null, { status: 400 })
  }

  try {
    const update: Record<string, Date> = {}
    if (event === 'open') update.openedAt = new Date()
    if (event === 'click') update.clickedAt = new Date()
    if (event === 'delivered') update.deliveredAt = new Date()

    if (Object.keys(update).length > 0) {
      await db.notificationLog.updateMany({
        where: { id: logId },
        data: update,
      })
    }
  } catch (error) {
    console.error('[track] Error:', error)
  }

  if (event === 'open') {
    const pixel = Buffer.from(
      'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
      'base64'
    )
    return new NextResponse(pixel, {
      headers: {
        'Content-Type': 'image/gif',
        'Cache-Control': 'no-store',
      },
    })
  }

  if (event === 'click') {
    const redirectTo = searchParams.get('url')
    if (redirectTo) {
      return NextResponse.redirect(redirectTo)
    }
  }

  return new NextResponse(null, { status: 200 })
}
