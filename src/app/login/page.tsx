import type { Metadata } from 'next'
import { OfficialLoginPage } from '@/components/official-login/login-page'

export const metadata: Metadata = {
  title: 'تسجيل الدخول — GAMES ARABIC',
  description: 'سجل دخولك للوصول إلى التعريبات والميزات الحصرية',
  robots: { index: false, follow: false },
}

export default async function LoginRoutePage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }>
}) {
  // Map server-driven ?error= codes (see /api/auth/callback) to specific
  // Arabic messages — previously rendered as a silent homepage.
  const sp = (await searchParams) ?? {}
  const initialError =
    sp.error === 'no_session'
      ? 'انتهت جلستك، سجّل دخولك من جديد'
      : sp.error === 'banned'
        ? 'حسابك محظور — تواصل مع الدعم'
        : sp.error === 'email_exists_link_accounts'
          ? 'هذا البريد مسجّل بطريقة أخرى — سجّل الدخول ثم اربط حسابك من الإعدادات'
          : sp.error === 'auth_failed'
            ? 'فشل تسجيل الدخول عبر Google — حاول مرة أخرى'
            : null
  return <OfficialLoginPage initialError={initialError} />
}
