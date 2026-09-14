export function formatNumber(n: number): string {
  // Guard against NaN / Infinity — return a placeholder rather than
  // producing strings like "NaNM" or "InfinityB".
  if (!Number.isFinite(n)) return '—'
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1).replace(/\.0$/, '') + 'B'
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'K'
  return n.toString()
}

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return '—'
  const d = typeof date === 'string' ? new Date(date) : date
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

// تنسيق التاريخ بالعربية كاملة (يوم شهر سنة) — باستخدام الأرقام العربية (1234567890)
// مش الأرقام الهندية (١٢٣٤٥٦٧٨٩٠) — نستخدم UTC لتجنب إزاحة يوم بسبب المنطقة الزمنية
export function formatArabicDate(date: Date | string | null | undefined, locale: 'ar' | 'en' = 'ar'): string {
  if (!date) return '—'
  const d = typeof date === 'string' ? new Date(date) : date
  if (isNaN(d.getTime())) return '—'
  if (locale === 'en') {
    return `${d.getUTCDate()} ${d.toLocaleString('en-US', { month: 'long', timeZone: 'UTC' })} ${d.getUTCFullYear()}`
  }
  const months = [
    'يناير',
    'فبراير',
    'مارس',
    'أبريل',
    'مايو',
    'يونيو',
    'يوليو',
    'أغسطس',
    'سبتمبر',
    'أكتوبر',
    'نوفمبر',
    'ديسمبر',
  ]
  const day = d.getUTCDate()
  const month = months[d.getUTCMonth()]
  const year = d.getUTCFullYear()
  return `${day} ${month} ${year}`
}

/** صياغة عربية سليمة: مفرد/مثنى/جمع (3-10)/مفرد منصوب (11+) */
function arabicUnit(n: number, one: string, two: string, few: string, many: string): string {
  if (n === 1) return one
  if (n === 2) return two
  if (n >= 3 && n <= 10) return `${n} ${few}`
  return `${n} ${many}`
}

export function timeAgo(date: Date | string | null | undefined, locale: 'ar' | 'en' = 'ar'): string {
  if (!date) return '—'
  const d = typeof date === 'string' ? new Date(date) : date
  if (isNaN(d.getTime())) return '—'
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000)
  if (locale === 'en') {
    if (seconds < 60) return 'just now'
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`
    const days = Math.floor(hours / 24)
    if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`
    const months = Math.floor(days / 30)
    if (months < 12) return `${months} month${months === 1 ? '' : 's'} ago`
    const years = Math.floor(days / 365)
    return `${years} year${years === 1 ? '' : 's'} ago`
  }
  if (seconds < 60) return 'الآن'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `منذ ${arabicUnit(minutes, 'دقيقة', 'دقيقتين', 'دقائق', 'دقيقة')}`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `منذ ${arabicUnit(hours, 'ساعة', 'ساعتين', 'ساعات', 'ساعة')}`
  const days = Math.floor(hours / 24)
  if (days < 30) return `منذ ${arabicUnit(days, 'يوم', 'يومين', 'أيام', 'يوماً')}`
  const months = Math.floor(days / 30)
  if (months < 12) return `منذ ${arabicUnit(months, 'شهر', 'شهرين', 'أشهر', 'شهراً')}`
  const years = Math.floor(days / 365)
  return `منذ ${arabicUnit(years, 'سنة', 'سنتين', 'سنوات', 'سنة')}`
}

export function parseGalleryUrls(s: string | null | undefined): string[] {
  if (!s) return []
  return s.split(',').filter(Boolean)
}

export function parseTags(s: string | null | undefined): string[] {
  if (!s) return []
  return s
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)
}

export function formatAuditDetails(action: string, details: any): string {
  if (!details) return '—'
  let obj: Record<string, any>
  try {
    obj = typeof details === 'string' ? JSON.parse(details) : details
  } catch {
    return String(details)
  }
  if (typeof obj !== 'object' || obj === null) return String(details)
  const keyTranslations: Record<string, string> = {
    oldRole: 'الدور السابق',
    newRole: 'الدور الجديد',
    username: 'اسم المستخدم',
    email: 'البريد الإلكتروني',
    reason: 'السبب',
    oldStatus: 'الحالة السابقة',
    newStatus: 'الحالة الجديدة',
    modName: 'اسم التعريب',
  }
  const valueTranslations: Record<string, string> = {
    member: 'عضو',
    creator: 'مُعَرِّب',
    publisher: 'ناشر',
    moderator: 'مشرف',
    admin: 'مسؤول',
    manager: 'مدير',
    owner: 'مالك الموقع',
    DRAFT: 'مسودة',
    IN_REVIEW: 'قيد المراجعة',
    APPROVED: 'مقبول',
    PUBLISHED: 'منشور',
    ARCHIVED: 'مؤرشف',
    REJECTED: 'مرفوض',
  }
  return Object.entries(obj)
    .map(([key, value]) => {
      const translatedKey = keyTranslations[key] || key
      const translatedValue =
        typeof value === 'string' ? valueTranslations[value] || value : String(value)
      return `${translatedKey}: ${translatedValue}`
    })
    .join(' • ')
}
