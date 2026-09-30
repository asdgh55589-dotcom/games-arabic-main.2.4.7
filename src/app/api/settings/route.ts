import { setCacheControl, withETag } from '@/lib/api-cache'
import type { NextRequest } from 'next/server'
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
  youtube: '',
  telegram: '',
}

export async function GET(req: NextRequest) {
  try {
    const rows = await db.siteSetting.findMany()
    const settings: Record<string, string> = { ...DEFAULTS }
    for (const row of rows) {
      settings[row.key] = row.value
    }
    // Phase 3: public site config (same for everyone) — short public cache + ETag.
    // (Deliberately NOT no-store: this is shared config, not user data.)
    const headers = new Headers()
    setCacheControl(headers, { type: 'public', maxAge: 30, swr: 60 })
    return withETag(req, { data: { settings } }, { headers })
  } catch {
    const headers = new Headers()
    setCacheControl(headers, { type: 'public', maxAge: 30, swr: 60 })
    return withETag(req, { data: { settings: DEFAULTS } }, { headers })
  }
}
