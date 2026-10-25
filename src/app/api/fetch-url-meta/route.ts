import type { NextRequest } from 'next/server'
import { ok, validationFail } from '@/lib/api-response'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url')?.trim()
  if (!url) return validationFail('url مطلوب')
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return validationFail('رابط غير صالح')
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return validationFail('رابط غير صالح')
  }

  let title: string | null = null
  let siteName: string | null = null
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; GamesArabicBot/1.0)' },
      signal: AbortSignal.timeout(8000),
    })
    const html = await res.text()
    const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i)
    if (titleMatch) title = titleMatch[1].trim().slice(0, 500) || null
    const ogSite = html.match(/<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']*)["']/i)
    if (ogSite) siteName = ogSite[1].trim().slice(0, 200) || null
    if (!siteName) {
      const ogTitle = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']*)["']/i)
      if (ogTitle && !title) title = ogTitle[1].trim().slice(0, 500) || null
    }
    if (!siteName) siteName = parsed.hostname.replace(/^www\./, '')
  } catch {
    // best-effort: return what we have
  }

  return ok({ title, siteName, domain: parsed.hostname.replace(/^www\./, '') })
}
