import { type NextRequest, NextResponse } from 'next/server'
import { internalError, ok, rateLimited, unauthorized, validationFail } from '@/lib/api-response'
import { logAction } from '@/lib/audit'
import { requireAuth } from '@/lib/auth'
import { db } from '@/lib/db'
import { isSyntheticTelegramEmail } from '@/lib/onboarding'
import { rateLimit } from '@/lib/rate-limit'
import { DisplayNameSchema, EmailSchema, PasswordSchema, UsernameSchema } from '@/lib/schemas'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { generateUniqueUsername } from '@/lib/username-generator'
import { z } from 'zod'

const OnboardingSaveSchema = z
  .object({
    displayName: DisplayNameSchema.optional(),
    username: UsernameSchema.optional(),
    email: EmailSchema.optional(),
    password: PasswordSchema.optional(),
  })
  .refine((d) => d.displayName !== undefined || d.username !== undefined || d.email !== undefined || d.password !== undefined, {
    message: 'لا يوجد ما يُحفظ',
  })

// PATCH /api/auth/onboarding — D.6-b2: save onboarding fields + first password.
export async function PATCH(req: NextRequest) {
  try {
    const rl = await rateLimit(req, { limit: 10, window: 60, keyPrefix: 'auth:onboarding' })
    if (!rl.success) {
      return rateLimited()
    }
  } catch {
    // biome-ignore lint/suspicious/noEmptyBlockStatements: rate limit fail-open
  }

  try {
    const session = await requireAuth().catch(() => null)
    if (!session) return unauthorized()

    const body = await req.json().catch(() => null)
    const parsed = OnboardingSaveSchema.safeParse({
      displayName: typeof body?.displayName === 'string' ? body.displayName.trim() : undefined,
      username: typeof body?.username === 'string' ? body.username.trim() : undefined,
      email: typeof body?.email === 'string' ? body.email.trim().toLowerCase() : undefined,
      password: typeof body?.password === 'string' ? body.password : undefined,
    })
    if (!parsed.success) {
      const issue = parsed.error.issues[0]
      return validationFail({ [String(issue?.path?.[0] || 'form')]: issue?.message || 'بيانات غير صالحة' })
    }
    const input = parsed.data

    const neonUser = await db.user.findUnique({
      where: { id: session.id },
      select: {
        id: true,
        username: true,
        displayName: true,
        email: true,
        supabaseId: true,
        role: true,
        onboardingCompleted: true,
      },
    })
    if (!neonUser) return unauthorized()

    const data: Record<string, unknown> = {}

    if (input.displayName !== undefined) {
      data.displayName = input.displayName
    }

    if (input.username !== undefined && input.username.toLowerCase() !== neonUser.username.toLowerCase()) {
      const taken = await db.user.findUnique({
        where: { username: input.username },
        select: { id: true },
      })
      if (taken && taken.id !== neonUser.id) {
        const suggestion = await generateUniqueUsername(input.username)
        return NextResponse.json(
          { error: 'اسم المستخدم مستخدم بالفعل', code: 'USERNAME_TAKEN', suggestion },
          { status: 409 },
        )
      }
      data.username = input.username
    }

    // Email may only change for synthetic Telegram identities (Google-verified
    // emails are the account identity and stay immutable here).
    let effectiveEmail = neonUser.email
    if (input.email !== undefined && input.email !== neonUser.email.toLowerCase()) {
      if (!isSyntheticTelegramEmail(neonUser.email)) {
        return validationFail({ email: 'لا يمكن تغيير البريد الموثّق من مزوّد الدخول' })
      }
      const emailTaken = await db.user.findUnique({
        where: { email: input.email },
        select: { id: true },
      })
      if (emailTaken && emailTaken.id !== neonUser.id) {
        return validationFail({ email: 'هذا البريد مستخدم بالفعل' })
      }
      data.email = input.email
      effectiveEmail = input.email
    }

    if (input.password !== undefined) {
      const supabase = await createClient()
      const {
        data: { user: supabaseUser },
      } = await supabase.auth.getUser()

      if (supabaseUser) {
        // Google/email path — live session, set directly.
        const { error } = await supabase.auth.updateUser({ password: input.password })
        if (error) {
          return validationFail({ password: error.message })
        }
      } else if (neonUser.supabaseId) {
        // Has a Supabase identity but no live session — update by id.
        const admin = createAdminClient()
        if (!admin) {
          return NextResponse.json(
            { error: 'خدمة الحسابات غير متاحة حالياً', code: 'SERVICE_UNAVAILABLE' },
            { status: 503 },
          )
        }
        const { error } = await admin.auth.admin.updateUserById(neonUser.supabaseId, {
          password: input.password,
        })
        if (error) {
          return validationFail({ password: error.message })
        }
      } else {
        // Telegram-only account — provision the Supabase identity now.
        if (isSyntheticTelegramEmail(effectiveEmail)) {
          return validationFail({ password: 'أضف بريداً إلكترونياً حقيقياً أولاً' })
        }
        const admin = createAdminClient()
        if (!admin) {
          return NextResponse.json(
            { error: 'خدمة الحسابات غير متاحة حالياً', code: 'SERVICE_UNAVAILABLE' },
            { status: 503 },
          )
        }
        const { data: created, error } = await admin.auth.admin.createUser({
          email: effectiveEmail,
          password: input.password,
          email_confirm: true,
          user_metadata: { username: (data.username as string) || neonUser.username },
        })
        if (error || !created?.user) {
          return validationFail({ password: error?.message || 'تعذّر إنشاء بيانات الدخول' })
        }
        data.supabaseId = created.user.id
      }
    }

    const updated =
      Object.keys(data).length > 0
        ? await db.user.update({
            where: { id: neonUser.id },
            data,
            select: {
              id: true,
              username: true,
              displayName: true,
              email: true,
              supabaseId: true,
              onboardingCompleted: true,
            },
          })
        : neonUser

    try {
      await logAction({
        userId: neonUser.id,
        username: updated.username,
        action: 'onboarding_updated',
        entity: 'user',
        entityId: neonUser.id,
      })
    } catch {
      // biome-ignore lint/suspicious/noEmptyBlockStatements: best-effort audit logging
    }

    return ok({
      user: {
        id: updated.id,
        username: updated.username,
        displayName: (updated as { displayName?: string | null }).displayName ?? null,
        email: updated.email,
        onboardingCompleted: (updated as { onboardingCompleted?: boolean }).onboardingCompleted ?? false,
      },
    })
  } catch (err) {
    console.error('[onboarding PATCH] failed:', err instanceof Error ? err.message : 'unknown')
    return internalError('حدث خطأ')
  }
}
