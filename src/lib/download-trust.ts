// روابط التحميل الموثوقة — منطق مشترك (client + server safe, بدون أي import سيرفر).
// الروابط من هذه الخدمات تُفتح مباشرة بدون نافذة تحذير،
// أي رابط آخر يُعتبر رابط إعلانات ويعرض رسالة التنبيه.

export interface TrustedHostService {
  name: string
  domains: string[]
  /** لوجو الخدمة الرسمي (أيقونة موقعها) — يُملأ تلقائياً عند الحفظ لو فاضي */
  logoUrl?: string
}

export const DOWNLOAD_TRUST_SETTING_KEY = 'download.trustedHosts'
export const DOWNLOAD_WARNING_SETTING_KEY = 'download.warningMessage'

export const DEFAULT_TRUSTED_HOSTS: TrustedHostService[] = [
  { name: 'Google Drive', domains: ['drive.google.com', 'docs.google.com', 'google.com'] },
  { name: 'Dropbox', domains: ['dropbox.com', 'dropboxusercontent.com', 'db.tt'] },
  {
    name: 'Microsoft OneDrive',
    domains: ['onedrive.live.com', '1drv.ms', 'sharepoint.com', 'microsoft.com'],
  },
  { name: 'Apple iCloud', domains: ['icloud.com'] },
  { name: 'Box', domains: ['box.com', 'app.box.com'] },
  { name: 'Amazon Drive', domains: ['amazon.com', 'amzn.to'] },
  { name: 'pCloud', domains: ['pcloud.com', 'pcloud.link'] },
  { name: 'Mega', domains: ['mega.nz', 'mega.io'] },
  { name: 'Sync.com', domains: ['sync.com'] },
  { name: 'Icedrive', domains: ['icedrive.net'] },
  { name: 'Tresorit', domains: ['tresorit.com'] },
  { name: 'Internxt', domains: ['internxt.com'] },
  { name: 'Proton Drive', domains: ['proton.me', 'drive.proton.me'] },
  { name: 'SpiderOak', domains: ['spideroak.com'] },
  { name: 'Filen', domains: ['filen.io'] },
]

export const DEFAULT_WARNING_MESSAGE =
  'انتبه! أنت الآن موجّه إلى رابط إعلانات. تأكد من مطابقة حجم الملف بالحجم الذي ستقوم بتنزيله قبل تشغيله.'

export function extractHostname(url: string): string | null {
  try {
    const u = new URL(url.trim())
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
    return u.hostname.toLowerCase()
  } catch {
    return null
  }
}

/** هل الرابط من خدمة موثوقة؟ (مطابقة النطاق أو أي subdomain منه) */
export function isTrustedDownloadUrl(url: string, services: TrustedHostService[]): boolean {
  const host = extractHostname(url)
  if (!host) return false
  for (const service of services) {
    for (const raw of service.domains || []) {
      const domain = raw.trim().toLowerCase().replace(/^\*\./, '')
      if (!domain) continue
      if (host === domain || host.endsWith(`.${domain}`)) return true
    }
  }
  return false
}

/** لوجو الخدمة الرسمي — أيقونة موقعها نفسه (Favicon) بمقاس عالي. */
export function brandLogoUrl(domain: string, size = 128): string {
  const clean = domain.trim().toLowerCase().replace(/^\*\./, '')
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(clean)}&sz=${size}`
}

/** كل النطاقات مسطّحة (للعرض أو الفحص السريع) */
export function flattenTrustedDomains(services: TrustedHostService[]): string[] {
  const out: string[] = []
  for (const service of services) {
    for (const d of service.domains || []) {
      const clean = d.trim().toLowerCase()
      if (clean && !out.includes(clean)) out.push(clean)
    }
  }
  return out
}
