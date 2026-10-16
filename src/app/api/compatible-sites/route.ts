import type { NextRequest } from 'next/server'
import { setCacheControl } from '@/lib/api-cache'
import { forbidden, internalError, ok, unauthorized, validationFail } from '@/lib/api-response'
import { AuthError, requireAdmin } from '@/lib/auth'
import { db } from '@/lib/db'
import { brandLogoUrl } from '@/lib/download-trust'
import { reportError } from '@/lib/error-reporting'
import { logger } from '@/lib/logger'

// تعبير تحقق من أسماء النطاقات — نفس نمط download-settings
export const HOSTNAME_RE = /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/

// تنظيف قائمة النطاقات — تقبل مصفوفة أو نصاً مفصولاً بفواصل
export function sanitizeDomains(input: unknown): string[] | null {
  const rawList: unknown[] = Array.isArray(input) ? input : String(input ?? '').split(',')
  const domains: string[] = []
  for (const d of rawList) {
    const clean = String(d ?? '')
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/\/.*$/, '')
      .replace(/^\*\./, '')
    if (!clean) continue
    if (!HOSTNAME_RE.test(clean) || domains.includes(clean)) continue
    domains.push(clean)
  }
  if (domains.length === 0 || domains.length > 20) return null
  return domains
}

// تطبيع صف الموقع للاستجابة العامة (id,name,domains,logoUrl,notes)
function toPublicSite(row: {
  id: string
  name: string
  domains: unknown
  logoUrl: string | null
  notes: string | null
}) {
  const domains = Array.isArray(row.domains) ? (row.domains as string[]) : []
  return { id: row.id, name: row.name, domains, logoUrl: row.logoUrl, notes: row.notes }
}

// GET /api/compatible-sites — عام: المواقع المفعّلة فقط مرتبة بـ order
// يُستخدم للتحقق عند "جلب الرابط" (بدون مصادقة، fail-open).
export async function GET() {
  try {
    const rows = await db.compatibleSite.findMany({
      where: { enabled: true },
      select: { id: true, name: true, domains: true, logoUrl: true, notes: true },
      orderBy: { order: 'asc' },
    })
    // Section 4 item 27: enabled-sites list is public and rarely changes.
    const res = ok(rows.map(toPublicSite))
    setCacheControl(res.headers, { type: 'public', maxAge: 300, swr: 600 })
    return res
  } catch (error) {
    // فشل DB لا يكسر الواجهة — نرجع قائمة فارغة
    reportError(error, { route: 'GET /api/compatible-sites' })
    logger.error({ err: error, route: 'GET /api/compatible-sites' }, 'Failed to load compatible sites')
    return ok([])
  }
}

// POST /api/compatible-sites — إنشاء موقع متوافق (إداريون فقط)
export async function POST(req: NextRequest) {
  try {
    await requireAdmin()
    const body = await req.json().catch(() => null)

    // اسم الموقع حتى 80 حرفاً
    const name = typeof body?.name === 'string' ? body.name.trim() : ''
    if (!name || name.length > 80) {
      return validationFail('اسم الموقع مطلوب (حتى 80 حرفاً)')
    }

    const domains = sanitizeDomains(body?.domains)
    if (!domains) {
      return validationFail('قائمة النطاقات غير صالحة — نطاق صحيح واحد على الأقل (حتى 20)')
    }

    // ملاحظات الموقع حتى 2000 حرف
    const rawNotes = body?.notes == null ? null : String(body.notes).trim()
    if (rawNotes != null && rawNotes.length > 2000) {
      return validationFail('الملاحظات يجب ألا تتجاوز 2000 حرف')
    }
    const notes = rawNotes && rawNotes.length > 0 ? rawNotes.slice(0, 2000) : null

    // اللوجو: رابط صحيح يُقبل كما هو، وإلا يُعيَّن تلقائياً من نطاق الموقع
    let logoUrl = typeof body?.logoUrl === 'string' ? body.logoUrl.trim() : ''
    if (!/^https?:\/\/.{4,500}$/.test(logoUrl)) {
      logoUrl = brandLogoUrl(domains[0])
    }
    logoUrl = logoUrl.slice(0, 500)

    const enabled = body?.enabled === undefined ? true : Boolean(body.enabled)
    const order = Number.isFinite(Number(body?.order)) ? Math.trunc(Number(body.order)) : 0

    const created = await db.compatibleSite.create({
      data: { name: name.slice(0, 80), domains, logoUrl, notes, enabled, order },
    })
    return ok(toPublicSite(created))
  } catch (error) {
    if (error instanceof AuthError) {
      return error.status === 401
        ? unauthorized('سجّل الدخول أولاً')
        : forbidden('غير مصرح — هذه الصفحة للإداريين فقط')
    }
    reportError(error, { route: 'POST /api/compatible-sites' })
    logger.error({ err: error, route: 'POST /api/compatible-sites' }, 'Failed to create compatible site')
    return internalError('فشل إنشاء الموقع المتوافق')
  }
}
