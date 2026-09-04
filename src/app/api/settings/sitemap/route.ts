import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const urlSetting = await db.siteSetting.findUnique({ where: { key: 'site_url' } })
    const baseUrl = urlSetting?.value || 'https://games-arabic.vercel.app'

    const [games, mods] = await Promise.all([
      db.game.findMany({ select: { slug: true, updatedAt: true } }),
      db.mod.findMany({ select: { slug: true, updatedAt: true } }),
    ])

    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n'
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'

    xml += `  <url>\n    <loc>${baseUrl}</loc>\n    <changefreq>daily</changefreq>\n    <priority>1.0</priority>\n  </url>\n`

    for (const game of games) {
      xml += `  <url>\n    <loc>${baseUrl}/?view=game&slug=${game.slug}</loc>\n    <lastmod>${game.updatedAt.toISOString().split('T')[0]}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n  </url>\n`
    }

    for (const mod of mods) {
      xml += `  <url>\n    <loc>${baseUrl}/?view=mod&slug=${mod.slug}</loc>\n    <lastmod>${mod.updatedAt.toISOString().split('T')[0]}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.6</priority>\n  </url>\n`
    }

    xml += '</urlset>'

    return new NextResponse(xml, {
      headers: { 'Content-Type': 'application/xml; charset=utf-8' },
    })
  } catch {
    return new NextResponse(
      '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>',
      {
        headers: { 'Content-Type': 'application/xml; charset=utf-8' },
      },
    )
  }
}
