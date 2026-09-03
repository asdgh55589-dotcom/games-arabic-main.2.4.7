import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { db } from '@/lib/db';

// Better Auth — PUBLIC users only (Staff 4-credential auth remains frozen via Supabase + JWT)
// Telegram is PRIMARY ( bridged in Phase 2 ), Google via Better Auth, Email+Password with verification
export const auth = betterAuth({
  database: prismaAdapter(db, { provider: 'postgresql' }),
  baseURL: process.env.BETTER_AUTH_URL || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
  secret: process.env.BETTER_AUTH_SECRET || process.env.JWT_SECRET,
  trustedOrigins: [
    process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
    'http://localhost:3000',
  ].filter(Boolean) as string[],
  // Core name field -> existing displayName column (username already exists)
  user: {
    fields: {
      name: 'displayName',
      image: 'avatarUrl',
    },
    additionalFields: {
      username: {
        type: 'string',
        required: true,
        unique: true,
        input: true,
      },
    },
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    autoSignIn: false, // يمنع الجلسة إلا بعد تأكيد الإيميل
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    expiresIn: 60 * 60 * 24, // 24 ساعة
    sendVerificationEmail: async ({ user, url }) => {
      try {
        const { getVerifyEmailHtml, getVerifyEmailText } = await import('@/lib/emails/verify-email')
        const html = getVerifyEmailHtml({ displayName: (user as any).displayName || (user as any).name || user.email, url, siteName: 'Games Arabic' })
        const text = getVerifyEmailText({ displayName: (user as any).displayName || (user as any).name || user.email, url, siteName: 'Games Arabic' })
        // Resend إذا متوفر، وإلا log
        if (process.env.RESEND_API_KEY) {
          const { Resend } = await import('resend')
          const resend = new Resend(process.env.RESEND_API_KEY)
          const from = process.env.EMAIL_FROM || 'Games Arabic <noreply@games-arabic.com>'
          await resend.emails.send({
            from,
            to: user.email,
            subject: 'فعّل حسابك في Games Arabic',
            html,
            text,
          })
          console.log('[BetterAuth] verification email sent via Resend to', user.email)
        } else {
          console.log('[BetterAuth] RESEND_API_KEY missing — verification email for', user.email, 'url:', url)
        }
      } catch (e) {
        console.error('[BetterAuth] sendVerificationEmail failed', e)
        // لا نرمي خطأ يمنع التسجيل — نكتفي بالـ log
      }
    },
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
      // Google موثّق تلقائياً — لا حاجة لتحقق إضافي
      // scope: ['email', 'profile'],
    },
  },
  session: {
    cookieCache: { enabled: true },
    expiresIn: 60 * 60 * 24 * 7, // 7 أيام
    updateAge: 60 * 60 * 24, // يوم
  },
  advanced: {
    database: {
      // نترك توليد الـ IDs افتراضي (cuid/string) متوافق مع User.id الحالي cuid()
    },
  },
  // Telegram سيُربط عبر endpoint مخصص في Phase 2 يثق بالـ payload الموقّع من Telegram
  // لا نضيفه كـ socialProvider هنا — نحتفظ بالـ Widget الحالي
});

export type Auth = typeof auth;
