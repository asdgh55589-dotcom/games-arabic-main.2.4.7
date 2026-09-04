/**
 * Shared constants used across multiple views and components.
 *
 * Centralizing these here prevents drift between the navbar, footer, home page,
 * games list, and platform pages — all of which need to enumerate the same
 * set of platforms.
 */

/** All supported platforms, in the order they should appear in navigation. */
export const PLATFORMS = [
  { key: 'PC', label: 'PC ARABIC', arabicLabel: 'ألعاب الكمبيوتر' },
  { key: 'X360', label: 'XBOX 360 ARABIC', arabicLabel: 'ألعاب اكس بوكس 360' },
  { key: 'NS', label: 'NS ARABIC', arabicLabel: 'ألعاب نينتندو سويتش' },
  { key: 'PS5', label: 'PS5 ARABIC', arabicLabel: 'ألعاب البلايستيشن 5' },
  { key: 'PS4', label: 'PS4 ARABIC', arabicLabel: 'ألعاب البلايستيشن 4' },
  { key: 'PS3', label: 'PS3 ARABIC', arabicLabel: 'ألعاب البلايستيشن 3' },
  { key: 'PS2', label: 'PS2 ARABIC', arabicLabel: 'ألعاب البلايستيشن 2' },
  { key: 'PS1', label: 'PS1 ARABIC', arabicLabel: 'ألعاب البلايستيشن 1' },
  { key: 'ANDROID', label: 'ANDROID ARABIC', arabicLabel: 'ألعاب الأندرويد' },
] as const

/** Platform keys only — useful for `includes` checks on filter values. */
export const PLATFORM_KEYS = PLATFORMS.map((p) => p.key) as readonly string[]

/** Arabic display label for each platform key. */
export const PLATFORM_ARABIC: Record<string, string> = Object.fromEntries(
  PLATFORMS.map((p) => [p.key, p.arabicLabel]),
)

/** English display label for each platform key. */
export const PLATFORM_LABEL: Record<string, string> = Object.fromEntries(
  PLATFORMS.map((p) => [p.key, p.label]),
)

/**
 * Map of English game names → Arabic transliterations.
 *
 * Used to localize game names on cards and detail pages without requiring a
 * full localization layer. Add new entries here when seeding new games.
 */
export const GAME_ARABIC_NAMES: Record<string, string> = {
  'Skyrim Special Edition': 'سكايرم النسخة الخاصة',
  'Cyberpunk 2077': 'سايبربانك 2077',
  'The Witcher 3: Wild Hunt': 'ويتشر 3: الصيد البري',
  "Baldur's Gate 3": 'بوابة بالدور 3',
  'Elden Ring': 'إلدن رينغ',
  Minecraft: 'ماينكرافت',
  'God of War': 'إله الحرب',
  'Horizon Zero Dawn': 'هورايزن زيرو داون',
  "Marvel's Spider-Man": 'الرجل العنكبوت',
  Bloodborne: 'بلودبورن',
  'The Last of Us': 'ذا لاست أوف أس',
  'Red Dead Redemption': 'ريد ديد ريديمبشن',
  'God of War III': 'إله الحرب 3',
  'Shadow of the Colossus': 'ظل العملاق',
  'God of War II': 'إله الحرب 2',
  'Final Fantasy X': 'فاينل فانتسي 10',
  'Final Fantasy VII': 'فاينل فانتسي 7',
  'Metal Gear Solid': 'ميتال جير سوليد',
  'Castlevania: Symphony of the Night': 'كاسلفانيا: سيمفونية الليل',
}

/** Translate an English game name to Arabic, falling back to the original. */
export function translateGameName(name: string): string {
  return GAME_ARABIC_NAMES[name] || name
}

/** Translation-type filter options used on platform/game/series pages. */
export const TRANSLATION_FILTERS = ['الكل', 'official', 'unofficial'] as const

export const TRANSLATION_LABELS: Record<string, string> = {
  الكل: 'الكل',
  official: 'التعريبات الرسمية',
  unofficial: 'التعريبات غير الرسمية',
}

// ===== URLs المسموح بها للتحميل الخارجي =====
export const ALLOWED_DOWNLOAD_HOSTS = [
  'drive.google.com',
  'mega.nz',
  'mega.io',
  'mediafire.com',
  'www.mediafire.com',
  'anonfiles.com',
  'gofile.io',
  'archive.org',
]

export function isAllowedDownloadUrl(url: string): boolean {
  try {
    const hostname = new URL(url).hostname
    return ALLOWED_DOWNLOAD_HOSTS.some((h) => hostname === h || hostname.endsWith('.' + h))
  } catch {
    return false
  }
}

/** صور الألعاب المستخدمة في صفحات تسجيل الدخول والتسجيل كخلفية — تم تنظيفها وإضافة fallback */
export const GAME_IMAGES = [
  'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=400&h=400&fit=crop', // Gaming setup - verified working
  'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=400&h=400&fit=crop', // Gaming - verified working
  'https://images.unsplash.com/photo-1552820728-8b83bb6b773f?w=400&h=400&fit=crop', // Code - verified working
  'https://images.unsplash.com/photo-1493711662062-fa541adb3fc8?w=400&h=400&fit=crop', // Gaming - verified working
  'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=400&h=400&fit=crop', // Gaming setup
  'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=400&h=400&fit=crop', // Gaming
  'https://images.unsplash.com/photo-1551103782-8ab07afd45c1?w=400&h=400&fit=crop', // Gaming
  'https://images.unsplash.com/photo-1593305841991-05c297ba4575?w=400&h=400&fit=crop', // Gaming
]

/** صورة افتراضية عند فشل تحميل الصورة */
export const FALLBACK_GAME_IMAGE = '/default-game.jpg'

/** معالج fallback للصور — يستخدم في onError */
export function handleImageError(e: { currentTarget: HTMLImageElement }) {
  const target = e.currentTarget as HTMLImageElement
  if (!target.src.includes('default-game.jpg')) {
    target.src = FALLBACK_GAME_IMAGE
  }
}
