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
export function formatArabicDate(date: Date | string | null | undefined): string {
  if (!date) return '—'
  const d = typeof date === 'string' ? new Date(date) : date
  if (isNaN(d.getTime())) return '—'
  const months = [
    'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
    'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
  ]
  const day = d.getUTCDate()
  const month = months[d.getUTCMonth()]
  const year = d.getUTCFullYear()
  return `${day} ${month} ${year}`
}

export function timeAgo(date: Date | string | null | undefined): string {
  if (!date) return '—'
  const d = typeof date === 'string' ? new Date(date) : date
  if (isNaN(d.getTime())) return '—'
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000)
  if (seconds < 60) return 'الآن'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `منذ ${minutes} دقيقة`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `منذ ${hours} ساعة`
  const days = Math.floor(hours / 24)
  if (days < 30) return `منذ ${days} يوم`
  const months = Math.floor(days / 30)
  if (months < 12) return `منذ ${months} شهر`
  const years = Math.floor(days / 365)
  return `منذ ${years} سنة`
}

export function parseGalleryUrls(s: string | null | undefined): string[] {
  if (!s) return []
  return s.split(',').filter(Boolean)
}

export function parseTags(s: string | null | undefined): string[] {
  if (!s) return []
  return s.split(',').map((t) => t.trim()).filter(Boolean)
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
      const translatedValue = typeof value === 'string' ? (valueTranslations[value] || value) : String(value)
      return `${translatedKey}: ${translatedValue}`
    })
    .join(' • ')
}
