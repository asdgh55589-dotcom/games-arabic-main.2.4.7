import type { NextRequest } from 'next/server'
import { forbidden, internalError, ok, unauthorized, validationFail } from '@/lib/api-response'
import { AuthError, requireAdmin } from '@/lib/auth'
import { db } from '@/lib/db'
import {
  brandLogoUrl,
  DEFAULT_TRUSTED_HOSTS,
  DEFAULT_WARNING_MESSAGE,
  DOWNLOAD_TRUST_SETTING_KEY,
  DOWNLOAD_WARNING_SETTING_KEY,
  type TrustedHostService,
} from '@/lib/download-trust'
import { reportError } from '@/lib/error-reporting'

const HOSTNAME_RE = /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/

function sanitizeServices(input: unknown): TrustedHostService[] | null {
  if (!Array.isArray(input) || input.length > 100) return null
  const out: TrustedHostService[] = []
  for (const item of input) {
    if (typeof item !== 'object' || item === null) return null
    const name = typeof (item as any).name === 'string' ? (item as any).name.trim() : ''
    const rawDomains = (item as any).domains
    const domainsRaw: unknown[] = Array.isArray(rawDomains) ? rawDomains : String(rawDomains ?? '').split(',')
    const domains: string[] = []
    for (const d of domainsRaw) {
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
    if (!name || name.length > 80 || domains.length === 0 || domains.length > 20) return null
    // اللوجو: رابط صحيح يُقبل كما هو، وإلا يُعيَّن تلقائياً من أيقونة موقع الخدمة الرسمية.
    let logoUrl =
      typeof (item as any).logoUrl === 'string' ? (item as any).logoUrl.trim() : ''
    if (!/^https?:\/\/.{4,500}$/.test(logoUrl)) {
      logoUrl = brandLogoUrl(domains[0])
    }
    out.push({ name: name.slice(0, 80), domains, logoUrl: logoUrl.slice(0, 500) })
  }
  if (out.length === 0) return null
  return out
}

// GET /api/download-settings — عام: قائمة الخدمات الموثوقة + رسالة التحذير.
// تُستخدم في تبويبة التحميل ونماذج النشر (بدون مصادقة).
export async function GET() {
  try {
    const rows = await db.siteSetting.findMany({
      where: { key: { in: [DOWNLOAD_TRUST_SETTING_KEY, DOWNLOAD_WARNING_SETTING_KEY] } },
      select: { key: true, value: true },
    })
    const byKey = new Map(rows.map((r) => [r.key, r.value]))

    let services = DEFAULT_TRUSTED_HOSTS
    const rawServices = byKey.get(DOWNLOAD_TRUST_SETTING_KEY)
    if (rawServices) {
      try {
        const parsed = sanitizeServices(JSON.parse(rawServices))
        if (parsed) services = parsed
      } catch {
        // قيمة مخزنة تالفة — نستخدم الافتراضي
      }
    }

    const warningMessage = byKey.get(DOWNLOAD_WARNING_SETTING_KEY) || DEFAULT_WARNING_MESSAGE

    return ok({ services, warningMessage })
  } catch (error) {
    reportError(error, { route: 'GET /api/download-settings' })
    return internalError(error instanceof Error ? error.message : 'فشل تحميل إعدادات التحميل')
  }
}

// PUT /api/download-settings — حفظ القائمة والرسالة (إداريون فقط).
export async function PUT(req: NextRequest) {
  try {
    await requireAdmin()
    const body = await req.json().catch(() => null)

    const services = sanitizeServices(body?.services)
    if (!services) {
      return validationFail('قائمة الخدمات غير صالحة — كل خدمة تحتاج اسماً ونطاقاً واحداً على الأقل')
    }

    const warningMessage =
      typeof body?.warningMessage === 'string' ? body.warningMessage.trim() : ''
    if (warningMessage.length < 10 || warningMessage.length > 2000) {
      return validationFail('نص رسالة التحذير يجب أن يكون بين 10 و 2000 حرف')
    }

    await db.siteSetting.upsert({
      where: { key: DOWNLOAD_TRUST_SETTING_KEY },
      create: {
        key: DOWNLOAD_TRUST_SETTING_KEY,
        value: JSON.stringify(services),
        group: 'downloads',
      },
      update: { value: JSON.stringify(services) },
    })
    await db.siteSetting.upsert({
      where: { key: DOWNLOAD_WARNING_SETTING_KEY },
      create: {
        key: DOWNLOAD_WARNING_SETTING_KEY,
        value: warningMessage,
        group: 'downloads',
      },
      update: { value: warningMessage },
    })

    return ok({ services, warningMessage })
  } catch (error) {
    if (error instanceof AuthError) {
      return error.status === 401
        ? unauthorized('سجّل الدخول أولاً')
        : forbidden('غير مصرح — هذه الصفحة للإداريين فقط')
    }
    reportError(error, { route: 'PUT /api/download-settings' })
    return internalError(error instanceof Error ? error.message : 'فشل حفظ إعدادات التحميل')
  }
}
