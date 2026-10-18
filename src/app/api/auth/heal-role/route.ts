import { type NextRequest, NextResponse } from 'next/server'
import { resolveUserWithHeal } from '@/lib/resolve-with-heal'

/**
 * قفزة العلاج — GET /api/auth/heal-role?next=/creator
 *
 * لماذا: كوكي `ga_admin_role` ثابت 7 أيام ولا يُجدَّد، بينما جلسة Supabase
 * تُجدَّد تلقائياً. عند انتهاء الكوكي يبقى المستخدم "مسجّلاً" لكن بوابة الـEdge
 * في proxy.ts ترميه إلى /login. هذه القفزة تُعيد إصدار الكوكي من DB ثم ترجّعه
 * لنفس الصفحة — بدل إجباره على تسجيل دخول يدوي.
 *
 * الأمان: تتطلب جلسة Supabase صالحة، تقرأ الدور من DB (لا من الكوكي)،
 * ترفض المحظورين، والوجهة `next` تُحصر بمسار داخلي نسبي فقط.
 */
const FALLBACK_DESTINATION = '/creator'

/** يقبل المسارات الداخلية النسبية فقط — يمنع إعادة التوجيه المفتوح. */
function safeNext(raw: string | null): string {
  if (!raw) return FALLBACK_DESTINATION
  if (!raw.startsWith('/')) return FALLBACK_DESTINATION
  if (raw.startsWith('//')) return FALLBACK_DESTINATION
  if (raw.includes('/../') || raw.includes('\\')) return FALLBACK_DESTINATION
  return raw
}

export async function GET(req: NextRequest) {
  const destination = safeNext(req.nextUrl.searchParams.get('next'))
  try {
    await resolveUserWithHeal()
  } catch {
    // فشل العلاج (جلسة Supabase غير صالحة أو الحساب محظور) → رجوع لصفحة
    // الدخول مع الاحتفاظ بالمسار المطلوب.
    const login = new URL('/login', req.url)
    login.searchParams.set('next', destination)
    return NextResponse.redirect(login, 307)
  }

  return NextResponse.redirect(new URL(destination, req.url), 307)
}