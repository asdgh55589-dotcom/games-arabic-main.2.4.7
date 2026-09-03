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
      // TODO Phase 2: إرسال عبر Resend — حالياً log فقط
      console.log('[BetterAuth] verification email for', user.email, 'url:', url);
      // يمكن ربطه بـ Resend لاحقاً:
      // const { sendEmail } = await import('@/lib/email');
      // await sendEmail({ to: user.email, subject: 'تأكيد بريدك', html: `...${url}...` });
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
