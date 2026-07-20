import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createClient } from '@/lib/supabase/server'

async function requireUser() {
  const supabase = await createClient()
  const { data: { user: supabaseUser } } = await supabase.auth.getUser()
  if (!supabaseUser) return null
  const neonUser = await db.user.findFirst({
    where: { OR: [{ supabaseId: supabaseUser.id }, { email: supabaseUser.email || '' }] },
    select: { id: true },
  })
  return neonUser
}

// GET /api/notifications/preferences — جلب تفضيلات الإشعارات
export async function GET(_req: NextRequest) {
  try {
    const neonUser = await requireUser()
    if (!neonUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let preferences = await db.notificationPreference.findUnique({
      where: { userId: neonUser.id },
    })

    if (!preferences) {
      preferences = await db.notificationPreference.create({
        data: { userId: neonUser.id },
      })
    }

    return NextResponse.json(preferences)
  } catch (err) {
    console.error('[notifications preferences GET] failed:', err)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

// PUT /api/notifications/preferences — تحديث تفضيلات الإشعارات
export async function PUT(req: NextRequest) {
  try {
    const neonUser = await requireUser()
    if (!neonUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const {
      emailEnabled,
      pushEnabled,
      dailySummary,
      summaryIntervalDays,
      likeThreshold,
    } = body

    const preferences = await db.notificationPreference.upsert({
      where: { userId: neonUser.id },
      update: {
        emailEnabled,
        pushEnabled,
        dailySummary,
        summaryIntervalDays,
        likeThreshold,
      },
      create: {
        userId: neonUser.id,
        emailEnabled,
        pushEnabled,
        dailySummary,
        summaryIntervalDays,
        likeThreshold,
      },
    })

    return NextResponse.json(preferences)
  } catch (err) {
    console.error('[notifications preferences PUT] failed:', err)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
