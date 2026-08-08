import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { hashPassword, createSupabaseAuthUser } from '@/lib/auth'
import { rateLimit, rateLimitHeaders } from '@/lib/rate-limit'
import { logAction } from '@/lib/audit'

// POST /api/admin/setup — إنشاء أول حساب owner
// محمي: لا يعمل لو يوجد owner بالفعل (flag في DB)
// ملاحظة: هذا الـ route للإعداد الأولي فقط — يستخدم كلمة مرور من env
export async function POST(req: NextRequest) {
  try {
    const rl = await rateLimit(req, { limit: 3, window: 300, keyPrefix: 'admin:setup' })
    if (!rl.success) {
      return NextResponse.json(
        { error: 'تم تجاوز الحد المسموح. حاول مرة أخرى بعد 5 دقائق.' },
        { status: 429, headers: rateLimitHeaders(rl) }
      )
    }

    // فحص: هل تم الـ setup بالفعل؟
    const existingUser = await db.user.findFirst({ where: { role: 'owner' } })
    if (existingUser) {
      return NextResponse.json({ message: 'Owner account already exists', setup: false })
    }

    // تحقق من وجود OWNER_PASSWORD في env
    const username = process.env.OWNER_USERNAME
    const email = process.env.OWNER_EMAIL
    const password = process.env.OWNER_PASSWORD

    if (!username || !email || !password) {
      return NextResponse.json(
        { error: 'يجب ضبط OWNER_USERNAME و OWNER_EMAIL و OWNER_PASSWORD في ملف .env قبل تشغيل الـ setup.' },
        { status: 500 }
      )
    }

    const passwordHash = await hashPassword(password)

    // إنشاء المستخدم في Supabase Auth أولاً
    const supabaseId = await createSupabaseAuthUser(email, password, username)

    const owner = await db.user.create({
      data: {
        username,
        email,
        password: passwordHash,
        supabaseId: supabaseId || undefined,
        role: 'owner',
        bio: 'مالك و مؤسس منصة ألعاب بالعربي',
        provider: 'admin',
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

    return NextResponse.json({ message: 'Owner account created successfully', setup: true })
  } catch (err) {
    console.error('[setup] failed:', err)
    return NextResponse.json({ error: 'Setup failed' }, { status: 500 })
  }
}
