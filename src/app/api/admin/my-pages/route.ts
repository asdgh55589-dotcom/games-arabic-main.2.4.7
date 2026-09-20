import { fail, internalError, ok } from '@/lib/api-response'
import { ADMIN_PAGES_FLAT } from '@/lib/admin-pages'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'

// GET /api/admin/my-pages — صفحاتي المسموحة لترشيح القائمة الجانبية.
// pages = null → النظام الافتراضي حسب الرتبة (اعرض كل ما تسمح به الرتبة).
// (الفحص الحقيقي في proxy عبر claim الكوكي — هذه للعرض فقط.)
export async function GET() {
  try {
    const session = await getSession()
    if (!session) return fail('UNAUTHORIZED', 'سجّل الدخول أولاً', 401)
    if (!['moderator', 'admin', 'manager', 'owner'].includes(session.role)) {
      return fail('FORBIDDEN', 'غير مصرح', 403)
    }
    const validKeys = new Set(ADMIN_PAGES_FLAT.map((d) => d.key))
    const rows = await db.staffPageAccess.findMany({
      where: { userId: session.id },
      select: { page: true },
    })
    const pages = rows.map((r) => r.page).filter((k) => validKeys.has(k))
    return ok({ pages: pages.length > 0 ? pages : null, role: session.role })
  } catch (err) {
    console.error('[admin my-pages GET] failed:', err)
    return internalError('فشل تحميل الصفحات المسموحة')
  }
}
