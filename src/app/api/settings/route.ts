import { ok } from '@/lib/api-response'
import { db } from '@/lib/db'

const DEFAULTS: Record<string, string> = {
  site_name: 'GAMES ARABIC',
  site_description: 'منصة تعريب وأرشفة الألعاب في العالم العربي',
  site_logo: '/logo.png',
  site_favicon: '/favicon.png',
  primary_color: '#eab308',
  dark_mode_default: 'true',
  meta_title: 'GAMES ARABIC — تعريب الألعاب',
  meta_description:
    'منصة تعريب وأرشفة الألعاب — حمّل التعريبات العربية لأحدث الألعاب على PC وPlayStation وNintendo Switch',
  og_image: '/hero-bg.jpg',
  robots_txt: 'User-agent: *\nAllow: /',
  site_url: 'https://games-arabic.vercel.app',
  og_locale: 'ar_SA',
  og_type: 'website',
  theme_color: '#eab308',
  google_analytics_id: '',
  google_search_console: '',
  twitter: '',
  discord: '',
  youtube: '',
  telegram: '',
}

export async function GET() {
  try {
    const rows = await db.siteSetting.findMany()
    const settings: Record<string, string> = { ...DEFAULTS }
    for (const row of rows) {
      settings[row.key] = row.value
    }
    return ok({ settings })
  } catch {
    return ok({ settings: DEFAULTS })
  }
}
