import type { NextRequest } from 'next/server'
import { forbidden, internalError, ok, unauthorized, validationFail } from '@/lib/api-response'
import { getBanStatus, requireAuth, setRoleCookie, type SessionUser, type UserRole } from '@/lib/auth'
import { db } from '@/lib/db'
import { createClient } from '@/lib/supabase/server'

/**
 * حل الجلسة — requireAuth أولاً، وعند 401 (جلسة Supabase صالحة لكن
 * role cookie مفقود/قديم بعد دخول OAuth) نتحقق من Supabase مباشرة
 * ونعيد إصدار الكوكي من قيم DB الحالية بدل رفض الطلب.
 */
async function resolveUser(): Promise<SessionUser> {
  try {
    return await requireAuth()
  } catch (err) {
    if ((err as { status?: number })?.status !== 401) throw err
    let supabaseUser: { id: string; email?: string } | null = null
    try {
      const supabase = await createClient()
      const { data } = await supabase.auth.getUser()
      supabaseUser = data.user
    } catch {
      throw err
    }
    if (!supabaseUser) throw err
    const dbUser = await db.user.findFirst({
      where: {
        OR: [{ supabaseId: supabaseUser.id }, { email: supabaseUser.email || '' }],
      },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        avatarUrl: true,
        banStatus: true,
        bannedUntil: true,
        banReason: true,
        tokenVersion: true,
      },
    })
    if (!dbUser || getBanStatus(dbUser).banned) throw err
    try {
      await setRoleCookie(dbUser.id, dbUser.role as UserRole, dbUser.tokenVersion)
    } catch {}
    return {
      id: dbUser.id,
      username: dbUser.username,
      email: dbUser.email,
      role: dbUser.role as UserRole,
      avatarUrl: dbUser.avatarUrl,
    }
  }
}

// POST /api/creator-requests — تقديم طلب ترقية لمُعَرِّب
export async function POST(req: NextRequest) {
  try {
    const user = await resolveUser()

    // فقط الأعضاء العاديون يمكنهم التقديم
    if (user.role !== 'member') {
      return forbidden('أنت بالفعل معرّب أو لديك صلاحيات أعلى')
    }

    // منع الطلبات المكررة (قيد المراجعة)
    const existing = await db.creatorRequest.findFirst({
      where: { userId: user.id, status: 'pending' },
    })
    if (existing) {
      return validationFail('لديك طلب قيد المراجعة بالفعل')
    }

    const body = await req.json()
    const {
      experience,
      preferredGames,
      portfolioLinks,
      reason,
      twitterUrl,
      youtubeUrl,
      discordHandle,
      websiteUrl,
    } = body as {
      experience?: string
      preferredGames?: string
      portfolioLinks?: string
      reason?: string
      twitterUrl?: string
      youtubeUrl?: string
      discordHandle?: string
      websiteUrl?: string
    }

    if (!experience?.trim() || !reason?.trim()) {
      return validationFail('الخبرة وسبب الرغبة مطلوبان')
    }

    // تحقق اختياري لروابط التواصل
    const validateOptionalUrl = (val: string | undefined, fieldName: string) => {
      if (!val?.trim()) return null
      try {
        const u = new URL(val.trim())
        if (!['http:', 'https:'].includes(u.protocol)) throw new Error('invalid')
        return val.trim()
      } catch {
        throw new Error(`رابط ${fieldName} غير صحيح`)
      }
    }
    let cleanTwitter: string | null = null
    let cleanYoutube: string | null = null
    let cleanWebsite: string | null = null
    try {
      cleanTwitter = validateOptionalUrl(twitterUrl, 'تويتر')
      cleanYoutube = validateOptionalUrl(youtubeUrl, 'يوتيوب')
      cleanWebsite = validateOptionalUrl(websiteUrl, 'الموقع')
    } catch (e) {
      return validationFail((e as Error).message)
    }

    const created = await db.creatorRequest.create({
      data: {
        userId: user.id,
        experience: experience.trim(),
        preferredGames: preferredGames?.trim() || null,
        portfolioLinks: portfolioLinks?.trim() || null,
        reason: reason.trim(),
        twitterUrl: cleanTwitter,
        youtubeUrl: cleanYoutube,
        discordHandle: discordHandle?.trim() || null,
        websiteUrl: cleanWebsite,
      },
    })

    // إشعار المشرفين
    try {
      const admins = await db.user.findMany({
        where: { role: { in: ['admin', 'manager', 'owner'] } },
        select: { id: true },
      })
      for (const admin of admins) {
        await db.notification.create({
          data: {
            userId: admin.id,
            actorId: user.id,
            type: 'admin_request',
            title: '🎨 طلب ترقية جديد لمُعَرِّب',
            message: `${user.username} قدم طلباً للانضمام إلى برنامج منشئ المحتوى`,
            data: { requestId: created.id, username: user.username },
          },
        })
      }
    } catch (e) {
      console.error('[creator-requests POST] admin notify failed:', e)
    }

    return ok(created, { status: 201 })
  } catch (err) {
    const status = (err as { status?: number })?.status
    if (status === 401) return unauthorized('يجب تسجيل الدخول')
    if (status === 403) return forbidden((err as Error).message)
    console.error('[creator-requests POST] failed:', err)
    return internalError('فشل إرسال الطلب')
  }
}

// GET /api/creator-requests — حالة طلب المستخدم الحالي
export async function GET() {
  try {
    const user = await resolveUser()

    const latest = await db.creatorRequest.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    })

    if (!latest) return ok(null)
    return ok(latest)
  } catch (err) {
    const status = (err as { status?: number })?.status
    if (status === 401) return unauthorized('يجب تسجيل الدخول')
    console.error('[creator-requests GET] failed:', err)
    return internalError('فشل جلب حالة الطلب')
  }
}
