/**
 * lib/password-setup.ts — P0: provision a password credential for OAuth-only users.
 *
 * Mirrors the three-path provisioning already proven in PATCH /api/auth/onboarding
 * (kept separate so the onboarding flow is untouched):
 *  a. live Supabase session  → updateUser({ password }) — the session is proof
 *  b. supabaseId, no session → admin updateUserById (after email-identity check)
 *  c. Telegram-only account  → admin createUser + link supabaseId
 *     (requires a real, non-synthetic email — checked here AND by the caller)
 *
 * NEVER logs or returns the plaintext password. Only throws ProvisionError
 * (coded) or returns the fields the caller must persist.
 */

import { isSyntheticTelegramEmail } from '@/lib/onboarding'
import { createAdminClient, createClient } from '@/lib/supabase/server'

export type ProvisionFailureCode =
  | 'HAS_PASSWORD'
  | 'NEED_EMAIL'
  | 'SERVICE_UNAVAILABLE'
  | 'PROVISION_FAILED'

export class ProvisionError extends Error {
  code: ProvisionFailureCode
  field: 'password' | 'email'
  constructor(code: ProvisionFailureCode, message: string, field: 'password' | 'email' = 'password') {
    super(message)
    this.name = 'ProvisionError'
    this.code = code
    this.field = field
  }
}

export interface ProvisionInput {
  username: string
  /** Final email the credential belongs to (already validated + deduped by caller). */
  email: string
  supabaseId: string | null
  /** Validated plaintext — never logged, never returned. */
  password: string
}

export interface ProvisionResult {
  /** Set only when a new Supabase identity was created (path c). */
  supabaseId?: string
}

interface SupabaseIdentity {
  provider?: string
}

function hasEmailIdentity(user: {
  identities?: SupabaseIdentity[] | null
  app_metadata?: { providers?: string[] } | null
} | null): boolean {
  if (!user) return false
  const identities = (user as { identities?: SupabaseIdentity[] }).identities
  const providers = (user as { app_metadata?: { providers?: string[] } }).app_metadata?.providers
  return identities?.some((i) => i?.provider === 'email') || providers?.includes('email') || false
}

export async function provisionSupabasePassword(input: ProvisionInput): Promise<ProvisionResult> {
  const { password } = input

  // Path (a): live session — the session itself proves account ownership.
  try {
    const supabase = await createClient()
    const {
      data: { user: liveUser },
    } = await supabase.auth.getUser()
    if (liveUser) {
      // If we can verify via admin that NO email credential exists yet, do so —
      // otherwise the live session alone authorizes the set (Supabase native model).
      if (input.supabaseId) {
        const admin = createAdminClient()
        if (admin) {
          const { data, error } = await admin.auth.admin.getUserById(input.supabaseId)
          if (!error && hasEmailIdentity(data?.user)) {
            throw new ProvisionError(
              'HAS_PASSWORD',
              'لديك كلمة مرور بالفعل — استخدم تغيير كلمة المرور',
            )
          }
        }
      }
      const { error } = await supabase.auth.updateUser({ password })
      if (error) {
        throw new ProvisionError('PROVISION_FAILED', 'تعذّر إنشاء كلمة المرور')
      }
      return {}
    }
  } catch (err) {
    if (err instanceof ProvisionError) throw err
    // No live session — fall through to admin paths (expected for role-cookie users).
  }

  const admin = createAdminClient()
  if (!admin) {
    throw new ProvisionError('SERVICE_UNAVAILABLE', 'خدمة الحسابات غير متاحة حالياً')
  }

  // Path (b): Supabase identity exists but no live session.
  if (input.supabaseId) {
    const { data, error } = await admin.auth.admin.getUserById(input.supabaseId)
    if (!error && hasEmailIdentity(data?.user)) {
      throw new ProvisionError(
        'HAS_PASSWORD',
        'لديك كلمة مرور بالفعل — استخدم تغيير كلمة المرور',
      )
    }
    const { error: updateError } = await admin.auth.admin.updateUserById(input.supabaseId, {
      password,
    })
    if (updateError) {
      throw new ProvisionError('PROVISION_FAILED', 'تعذّر إنشاء كلمة المرور')
    }
    return {}
  }

  // Path (c): Telegram-only account — provision the Supabase identity now.
  if (isSyntheticTelegramEmail(input.email)) {
    throw new ProvisionError('NEED_EMAIL', 'أضف بريداً إلكترونياً حقيقياً أولاً', 'email')
  }
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: input.email,
    password,
    email_confirm: true,
    user_metadata: { username: input.username },
  })
  if (createError || !created?.user) {
    throw new ProvisionError('PROVISION_FAILED', 'تعذّر إنشاء بيانات الدخول')
  }
  return { supabaseId: created.user.id }
}
