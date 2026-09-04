import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { hashPassword, createSupabaseAuthUser } from '@/lib/auth'
import { hashSecurityKey } from '@/lib/security-key'
import { rateLimit, rateLimitHeaders } from '@/lib/rate-limit'
import { logAction } from '@/lib/audit'
import { ok, internalError, rateLimited, conflict } from '@/lib/api-response'

// POST /api/admin/setup — إنشاء أول حساب owner
// محمي: لا يعمل لو يوجد owner بالفعل (flag في DB)
// ملاحظة: هذا الـ route للإعداد الأولي فقط — يستخدم كلمة مرور من env
export async function POST(req: NextRequest) {
  try {
    const rl = await rateLimit(req, { limit: 3, window: 300, keyPrefix: 'admin:setup' })
    if (!rl.success) {
      return rateLimited()
    }

    // فحص: هل تم الـ setup بالفعل؟
    const existingUser = await db.user.findFirst({ where: { role: 'owner' } })
    if (existingUser) {
      return conflict('Owner account already exists')
    }

    // تحقق من وجود OWNER_PASSWORD في env
    const username = process.env.OWNER_USERNAME
    const email = process.env.OWNER_EMAIL
    const password = process.env.OWNER_PASSWORD
    const securityKey = process.env.OWNER_SECURITY_KEY || '1234567890'

    if (!username || !email || !password) {
      return internalError(
        'يجب ضبط OWNER_USERNAME و OWNER_EMAIL و OWNER_PASSWORD في ملف .env قبل تشغيل الـ setup.',
      )
    }

    const passwordHash = await hashPassword(password)
    const securityHash = await hashSecurityKey(securityKey)

    // إنشاء المستخدم في Supabase Auth أولاً
    const supabaseId = await createSupabaseAuthUser(email, password, username)

    const owner = await db.user.create({
      data: {
        username,
        email,
        password: passwordHash,
        securityKey: securityHash,
        securityKeyExpiresAt: null,
        securityKeyChangedAt: new Date(),
        supabaseId: supabaseId || undefined,
        role: 'owner',
        bio: 'مالك و مؤسس منصة ألعاب بالعربي',
        joinedAt: new Date(),
      },
    })

    // تسجيل النشاط
    await logAction({
      userId: owner.id,
      username,
      action: 'login',
      entity: 'user',
      entityId: owner.id,
      details: JSON.stringify({ event: 'owner_setup' }),
      request: req,
    })

    // وضع flag أن الـ setup تم
    await db.siteSetting.upsert({
      where: { key: 'setup_completed' },
      create: { key: 'setup_completed', value: 'true', group: 'general' },
      update: { value: 'true' },
    })

    return ok({ message: 'Owner account created successfully', setup: true })
  } catch (err) {
    console.error('[setup] failed:', err)
    return internalError('Setup failed')
  }
}
