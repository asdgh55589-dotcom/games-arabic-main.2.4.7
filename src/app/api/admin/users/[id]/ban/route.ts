import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin, invalidateUserSessions, getClientIp } from '@/lib/auth'
import { logUserAction } from '@/lib/audit'
import { notifyAdminAction } from '@/lib/notification-helpers'
import { setIpBanCache, deleteIpBanCache } from '@/lib/ip-ban-cache'

// POST /api/admin/users/[id]/ban — حظر مستخدم (مؤقت/دائم + خيار حظر IP)
//
// Body: {
//   type: 'temp' | 'perm',
//   days?: number,          // لـ temp
//   reason?: string,
//   banIp?: boolean,        // حظر عنوان IP أيضاً
// }
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const currentUser = await requireAdmin()
    const { id } = await params
    const body = await req.json()

    const target = await db.user.findUnique({
      where: { id },
      select: { id: true, role: true, username: true },
    })
    if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 })
    if (target.role === 'owner') return NextResponse.json({ error: 'لا يمكن حظر المالك' }, { status: 403 })
    if (id === currentUser.id) return NextResponse.json({ error: 'لا يمكنك حظر نفسك' }, { status: 403 })

    const type: 'temp' | 'perm' = body.type === 'temp' ? 'temp' : 'perm'
    let bannedUntil: Date | null = null
    let banStatus: string

    if (type === 'temp') {
      const days = Math.max(1, Number(body.days) || 7)
      bannedUntil = new Date(Date.now() + days * 24 * 60 * 60 * 1000)
      banStatus = 'banned_temp'
    } else {
      // دائم — نستخدم تاريخ بعيد جداً للأمان (للأكواد التي تفحص bannedUntil فقط)
      bannedUntil = new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000)
      banStatus = 'banned_perm'
    }

    const reason = body.reason?.trim() || null

    // تحديث حالة المستخدم
    await db.user.update({
      where: { id },
      data: {
        bannedUntil,
        banStatus,
        banReason: reason,
        bannedBy: currentUser.id,
        bannedAt: new Date(),
      },
    })

    // إبطال كل جلسات المستخدم فوراً (يمنعه من الدخول بكوكيز قديم)
    await invalidateUserSessions(id)

    // حظر IP اختياري
    let ipBanned = false
    let ipBanExpiresAt: Date | null = null
    if (body.banIp) {
      // نحاول نعرف IP المستخدم من آخر نشاط مسجّل (UserAction)
      const lastAction = await db.userAction.findFirst({
        where: { userId: id, ipAddress: { not: null } },
        orderBy: { createdAt: 'desc' },
        select: { ipAddress: true },
      })
      const ip = body.ipAddress || lastAction?.ipAddress || getClientIp(req)
      if (ip && ip !== 'unknown') {
        const ipExpires = type === 'temp' ? bannedUntil : null
        await db.ipBan.upsert({
          where: { ipAddress: ip },
          create: {
            ipAddress: ip,
            reason: reason || `حظر مرتبط بالمستخدم ${target.username}`,
            bannedBy: currentUser.id,
            bannedByUsername: currentUser.username,
            expiresAt: ipExpires,
          },
          update: {
            reason: reason || `حظر مرتبط بالمستخدم ${target.username}`,
            bannedBy: currentUser.id,
            bannedByUsername: currentUser.username,
            expiresAt: ipExpires,
          },
        })
        // تحديث الـ cache في Upstash للـ middleware
        await setIpBanCache(ip, { banned: true, expiresAt: ipExpires })
        ipBanned = true
        ipBanExpiresAt = ipExpires
      }
    }

    // تسجيل النشاط في AuditLog + UserAction
    await logUserAction({
      userId: id,
      actorId: currentUser.id,
      actorUsername: currentUser.username,
      action: 'ban',
      reason,
      expiresAt: bannedUntil,
      metadata: JSON.stringify({ type, days: type === 'temp' ? Number(body.days) || 7 : null, banIp: ipBanned }),
      request: req,
    })

    // إشعار المستخدم بالحظر
    await notifyAdminAction({
      userId: id,
      title: type === 'perm' ? 'تم حظر حسابك بشكل دائم' : 'تم حظر حسابك مؤقتاً',
      message: reason || '',
    })

    return NextResponse.json({
      success: true,
      bannedUntil,
      banStatus,
      banReason: reason,
      ipBanned,
      ipBanExpiresAt,
    })
  } catch (err) {
    console.error('[admin/users/[id]/ban] failed:', err)
    const status = (err as { status?: number })?.status || 500
    return NextResponse.json({ error: 'Failed' }, { status })
  }
}

// DELETE /api/admin/users/[id]/ban — إزالة حظر IP فقط (استخدام نادر)
// الحظر الكامل للمستخدم يُزال عبر /unban
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const currentUser = await requireAdmin()
    const { id } = await params
    const { searchParams } = new URL(req.url)
    const ip = searchParams.get('ip')

    if (!ip) {
      return NextResponse.json({ error: 'ip required' }, { status: 400 })
    }

    const target = await db.user.findUnique({ where: { id }, select: { id: true } })
    if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    await db.ipBan.delete({ where: { ipAddress: ip } })
    await deleteIpBanCache(ip)

    await logUserAction({
      userId: id,
      actorId: currentUser.id,
      actorUsername: currentUser.username,
      action: 'unban',
      reason: `إزالة حظر IP: ${ip}`,
      metadata: JSON.stringify({ clearedIp: ip }),
      request: req,
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[admin/users/[id]/ban DELETE] failed:', err)
    const status = (err as { status?: number })?.status || 500
    return NextResponse.json({ error: 'Failed' }, { status })
  }
}
