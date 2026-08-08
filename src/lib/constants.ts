/**
 * Shared constants used across multiple views and components.
 *
 * Centralizing these here prevents drift between the navbar, footer, home page,
 * games list, and platform pages — all of which need to enumerate the same
 * set of platforms.
 */

/** All supported platforms, in the order they should appear in navigation. */
export const PLATFORMS = [
  { key: 'PC', label: 'ARABIC PC', arabicLabel: 'ألعاب الكمبيوتر' },
  { key: 'X360', label: 'ARABIC XBOX 360', arabicLabel: 'ألعاب اكس بوكس 360' },
  { key: 'NS', label: 'ARABIC NS', arabicLabel: 'ألعاب نينتندو سويتش' },
  { key: 'PS4', label: 'ARABIC PS4', arabicLabel: 'ألعاب البلايستيشن 4' },
  { key: 'PS3', label: 'ARABIC PS3', arabicLabel: 'ألعاب البلايستيشن 3' },
  { key: 'PS2', label: 'ARABIC PS2', arabicLabel: 'ألعاب البلايستيشن 2' },
  { key: 'PS1', label: 'ARABIC PS1', arabicLabel: 'ألعاب البلايستيشن 1' },
] as const

/** Platform keys only — useful for `includes` checks on filter values. */
export const PLATFORM_KEYS = PLATFORMS.map((p) => p.key) as readonly string[]

/** Arabic display label for each platform key. */
export const PLATFORM_ARABIC: Record<string, string> = Object.fromEntries(
  PLATFORMS.map((p) => [p.key, p.arabicLabel])
)

/** English display label for each platform key. */
export const PLATFORM_LABEL: Record<string, string> = Object.fromEntries(
  PLATFORMS.map((p) => [p.key, p.label])
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
  'Minecraft': 'ماينكرافت',
  'God of War': 'إله الحرب',
  'Horizon Zero Dawn': 'هورايزن زيرو داون',
  "Marvel's Spider-Man": 'الرجل العنكبوت',
  'Bloodborne': 'بلودبورن',
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
  'الكل': 'الكل',
  'official': 'التعريبات الرسمية',
  'unofficial': 'التعريبات غير الرسمية',
}

/** صور الألعاب المستخدمة في صفحات تسجيل الدخول والتسجيل كخلفية */
export const GAME_IMAGES = [
  'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=400&h=400&fit=crop',
  'https://images.unsplash.com/photo-1493238792000-8113da705763?w=400&h=400&fit=crop',
  'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=400&h=400&fit=crop',
  'https://images.unsplash.com/photo-1518709268805-4e9042af2176?w=400&h=400&fit=crop',
  'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=400&h=400&fit=crop',
  'https://images.unsplash.com/photo-1551103782-8ab07afd45c1?w=400&h=400&fit=crop',
  'https://images.unsplash.com/photo-1518709594023-6eab9bab7b23?w=400&h=400&fit=crop',
  'https://images.unsplash.com/photo-1509248961158-e54f6934749c?w=400&h=400&fit=crop',
  'https://images.unsplash.com/photo-1593305841991-05c297ba4575?w=400&h=400&fit=crop',
  'https://images.unsplash.com/photo-1531219432768-9f540ce0ec55?w=400&h=400&fit=crop',
  'https://images.unsplash.com/photo-1605379399642-870262d3d051?w=400&h=400&fit=crop',
  'https://images.unsplash.com/photo-1601784551446-20c9e07cdbdb?w=400&h=400&fit=crop',
  'https://images.unsplash.com/photo-1556438064-2d7646166914?w=400&h=400&fit=crop',
  'https://images.unsplash.com/photo-1574680096145-d05b474e2155?w=400&h=400&fit=crop',
  'https://images.unsplash.com/photo-1598899134739-24c46f58b8c0?w=400&h=400&fit=crop',
  'https://images.unsplash.com/photo-1620127252536-03bdfcf6d5b3?w=400&h=400&fit=crop',
  'https://images.unsplash.com/photo-1612287230202-1ff1d85d1bdf?w=400&h=400&fit=crop',
  'https://images.unsplash.com/photo-1557340988-1431e5d52e67?w=400&h=400&fit=crop',
  'https://images.unsplash.com/photo-1493711662062-fa541adb3fc8?w=400&h=400&fit=crop',
  'https://images.unsplash.com/photo-1486572788966-cfd3df1f5b42?w=400&h=400&fit=crop',
  'https://images.unsplash.com/photo-1534172553917-0ce2ef189c74?w=400&h=400&fit=crop',
  'https://images.unsplash.com/photo-1547036967-23d11aacaee0?w=400&h=400&fit=crop',
  'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=400&h=400&fit=crop',
  'https://images.unsplash.com/photo-1552820728-8b83bb6b773f?w=400&h=400&fit=crop',
  'https://images.unsplash.com/photo-1493711662062-fa541adb3fc8?w=400&h=400&fit=crop',
  'https://images.unsplash.com/photo-1551103782-8ab07afd45c1?w=400&h=400&fit=crop',
  'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=400&h=400&fit=crop',
  'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=400&h=400&fit=crop',
  'https://images.unsplash.com/photo-1518709268805-4e9042af2176?w=400&h=400&fit=crop',
  'https://images.unsplash.com/photo-1551103782-8ab07afd45c1?w=400&h=400&fit=crop',
]
