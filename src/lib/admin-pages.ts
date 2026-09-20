// سجل صفحات لوحة الأدمن المركزي — المصدر الوحيد المعتمد.
// يُستخدم في: ترشيح القائمة الجانبية، محرر صلاحيات المسؤولين، فحص proxy.
// المفتاح (key) هو ما يُحفظ في StaffPageAccess وفي claim الـ JWT.
// client + Edge safe (بدون أي import سيرفر).

export type StaffMinRole = 'moderator' | 'admin' | 'owner'

export interface AdminPageDef {
  /** مفتاح ثابت يُحفظ في DB والكوكي (مثل mods) */
  key: string
  href: string
  label: string
  /** أدنى رتبة ترى الصفحة افتراضياً (بدون تخصيص) */
  minRole: StaffMinRole
}

export interface AdminPageGroup {
  label: string
  pages: AdminPageDef[]
}

const p = (href: string, label: string, minRole: StaffMinRole = 'moderator'): AdminPageDef => ({
  key: href === '/admin' ? 'home' : href.replace(/^\/admin\/?/, '').replaceAll('/', '-'),
  href,
  label,
  minRole,
})

export const ADMIN_PAGE_GROUPS: AdminPageGroup[] = [
  {
    label: 'عام',
    pages: [p('/admin', 'الرئيسية')],
  },
  {
    label: 'إدارة المحتوى',
    pages: [
      p('/admin/mods', 'التعريبات'),
      p('/admin/sections', 'أقسام المنصات'),
      p('/admin/series', 'السلاسل'),
      p('/admin/teams', 'فرق التعريب'),
      p('/admin/ads', 'الإعلانات'),
      p('/admin/news', 'الأخبار'),
      p('/admin/files', 'ملفات الرفع'),
      p('/admin/images/health', 'صحة الصور'),
      p('/admin/docs', 'الدليل'),
    ],
  },
  {
    label: 'إدارة المجتمع',
    pages: [
      p('/admin/comments', 'التعليقات'),
      p('/admin/endorsements', 'التأييدات', 'admin'),
      p('/admin/reports', 'البلاغات', 'admin'),
      p('/admin/tickets', 'تذاكر الدعم'),
      p('/admin/users', 'المستخدمون', 'admin'),
      p('/admin/admins', 'المسؤولون', 'admin'),
      p('/admin/creators', 'المُعَرِّبون والناشرون', 'admin'),
      p('/admin/creators/requests', 'طلبات الترقية', 'admin'),
      p('/admin/publication-requests', 'طلبات نشر التعريبات', 'admin'),
      p('/admin/mod-requests', 'طلبات التعريب', 'admin'),
      p('/admin/analytics', 'التحليلات', 'admin'),
    ],
  },
  {
    label: 'نظام المستويات',
    pages: [
      p('/admin/tiers', 'المستويات', 'admin'),
      p('/admin/special-roles', 'الأدوار الخاصة', 'admin'),
      p('/admin/tier-history', 'سجل الترقيات', 'admin'),
      p('/admin/rewards', 'لوحة المكافآت', 'admin'),
    ],
  },
  {
    label: 'النظام',
    pages: [
      p('/admin/search', 'بحث متقدم', 'admin'),
      p('/admin/api-keys', 'مفاتيح API', 'admin'),
      p('/admin/templates', 'قوالب الإشعارات', 'admin'),
      p('/admin/notifications/send', 'إرسال إشعار', 'admin'),
      p('/admin/notifications/analytics', 'تحليلات الإشعارات', 'admin'),
      p('/admin/notifications-health', 'صحة الإشعارات', 'admin'),
      p('/admin/notifications/history', 'سجل الإشعارات', 'admin'),
      p('/admin/sessions', 'الجلسات النشطة', 'admin'),
      p('/admin/scheduler', 'الجدولة', 'admin'),
      p('/admin/quotas', 'حصص الرفع', 'admin'),
      p('/admin/download-settings', 'روابط التحميل الموثوقة', 'admin'),
      p('/admin/backup', 'النسخ الاحتياطي', 'owner'),
      p('/admin/settings', 'الإعدادات', 'owner'),
      p('/admin/audit', 'سجل النشاطات', 'owner'),
    ],
  },
]

export const ADMIN_PAGES_FLAT: AdminPageDef[] = ADMIN_PAGE_GROUPS.flatMap((g) => g.pages)

const ROLE_LEVEL: Record<string, number> = { moderator: 0, admin: 1, manager: 2, owner: 3 }

/** هل الرتبة ترى الصفحة افتراضياً (بدون تخصيص)؟ */
export function roleSeesPageByDefault(role: string, page: AdminPageDef): boolean {
  const roleLevel = ROLE_LEVEL[role]
  const needLevel = ROLE_LEVEL[page.minRole]
  if (roleLevel === undefined || needLevel === undefined) return false
  // manager يُعامل معاملة admin في القائمة (adminOnly تشمل manager)
  return roleLevel >= needLevel
}

/** أقرب صفحة لمسار (أطول prefix على حدّ مقطع) — null لو خارج /admin.
 *  مسار غير معروف داخل /admin (مثل ‎/api/admin/dashboard) يُنسب للرئيسية home
 *  حتى لا تنكسر الصفحات التي تستدعي APIs مشتركة بلا صفحة مناظرة. */
export function findPageForPath(pathname: string): AdminPageDef | null {
  const home = ADMIN_PAGES_FLAT.find((d) => d.key === 'home') ?? null
  if (pathname === '/admin') return home
  const sorted = [...ADMIN_PAGES_FLAT].sort((a, b) => b.href.length - a.href.length)
  for (const def of sorted) {
    if (def.href === '/admin') continue
    if (pathname === def.href || pathname.startsWith(`${def.href}/`)) return def
  }
  if (pathname.startsWith('/admin/')) return home
  return null
}

/** مسار API إداري → مسار صفحة مناظر (‎/api/admin/mods/.. → ‎/admin/mods/..). */
export function apiPathToAdminPath(apiPath: string): string | null {
  if (!apiPath.startsWith('/api/admin')) return null
  const rest = apiPath.slice('/api'.length) // ‎/admin/..
  if (!rest.startsWith('/admin')) return null
  return rest
}

/** هل مسموح حسب claim الصفحات؟ (claim غائب/فارغ = النظام الافتراضي حسب الرتبة) */
export function isPathAllowedByPagesClaim(
  pathname: string,
  pagesClaim: string[] | undefined,
  role: string,
): boolean {
  if (role === 'owner') return true
  if (!Array.isArray(pagesClaim) || pagesClaim.length === 0) return true // لا تخصيص
  const def = findPageForPath(pathname)
  if (!def) return false
  return pagesClaim.includes(def.key)
}
