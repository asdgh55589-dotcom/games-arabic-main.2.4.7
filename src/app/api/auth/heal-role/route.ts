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

// محارف التحكم (TAB/LF/CR …) يحذّفها مُحلّل URL حسب معيار WHATWG قبل التحليل —
// فـ "/<TAB>/evil.com" تنهار إلى "//evil.com" أي بروتوكول-نسبي ويخرج عن الموقع.
// لذلك نمنعها صريحاً إضافةً إلى فحص الأصل النهائي.
/** محارف تحكم (C0 + C1) — يحذّفها مُحلّل URL حسب معيار WHATWG قبل التحليل. */
function hasControlChars(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i)
    if (code <= 0x1f || (code >= 0x7f && code <= 0x9f)) return true
  }
  return false
}

/**
 * يقبل المسارات الداخلية النسبية فقط — يمنع إعادة التوجيه المفتوح.
 * مُصدَّر ليُختبر مباشرة — المنطق هنا أمني وحساس.
 */
export function safeNext(raw: string | null, origin: string): string {
  const fallback = FALLBACK_DESTINATION
  if (!raw) return fallback
  // مسار نسبي فقط
  if (!raw.startsWith('/')) return fallback
  // بروتوكول-نسبي (//host) و backslash (\ يعامله بعض العملاء كـ /)
  if (raw.startsWith('//') || raw.includes('\\')) return fallback
  // محارف التحكم: "/<TAB>/evil.com" تنهار إلى "//evil.com" خارج الموقع
  if (hasControlChars(raw)) return fallback
  // هروب المسار
  if (raw.includes('/../') || raw.endsWith('/..')) return fallback
  try {
    // حزام إضافي: تأكيد أن الوجهة النهائية على نفس الأصل
    const resolved = new URL(raw, origin)
    if (resolved.origin !== new URL(origin).origin) return fallback
    return `${resolved.pathname}${resolved.search}${resolved.hash}`
  } catch {
    return fallback
  }
}

/**
 * GET وليس POST عمداً: القفزة تعمل عبر إعادة توجيه 307 من المتصفح، والـ307
 * لا يمكن أن يصير POST — فلو كانت POST لتوقفت عند 307/303 وتحوّلت إلى GET.
 * الأثر أمنياً معدوم: العلاج يتطلب جلسة Supabase الخاصة بالزائر، وطلب GET
 * عبر المواقع (SameSite=lax) يجدّد كوكي الزائر من حقيقة DB فقط.
 */
export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin
  const destination = safeNext(req.nextUrl.searchParams.get('next'), origin)
  try {
    await resolveUserWithHeal()
  } catch {
    // فشل العلاج (جلسة Supabase غير صالحة أو الحساب محظور) → رجوع لصفحة
    // الدخول مع الاحتفاظ بالمسار المطلوب.
    const login = new URL('/login', origin)
    login.searchParams.set('next', destination)
    return NextResponse.redirect(login, 307)
  }

  return NextResponse.redirect(new URL(destination, origin), 307)
}
