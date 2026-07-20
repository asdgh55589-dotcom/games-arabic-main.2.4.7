import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, rateLimitHeaders } from '@/lib/rate-limit'

function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=)([\w-]{11})/,
    /(?:youtu\.be\/)([\w-]{11})/,
    /(?:youtube\.com\/embed\/)([\w-]{11})/,
    /(?:youtube\.com\/shorts\/)([\w-]{11})/,
  ]
  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match) return match[1]
  }
  return null
}

export async function POST(req: NextRequest) {
  try {
    const rl = await rateLimit(req, { limit: 5, window: 60, keyPrefix: 'youtube:metadata' })
    if (!rl.success) {
      return NextResponse.json(
        { error: 'تم تجاوز الحد المسموح. حاول مرة أخرى بعد دقيقة.' },
        { status: 429, headers: rateLimitHeaders(rl) }
      )
    }

    const { url } = await req.json()

    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'URL مطلوب' }, { status: 400 })
    }

    const videoId = extractYouTubeId(url)
    if (!videoId) {
      return NextResponse.json({ error: 'رابط يوتيوب غير صالح' }, { status: 400 })
    }

    const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`

    // 1. oEmbed — title + channel + thumbnail
    let title = ''
    let channel = ''
    let thumbnail = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`

    try {
      const oembedRes = await fetch(
        `https://www.youtube.com/oembed?url=${encodeURIComponent(youtubeUrl)}&format=json`,
        { next: { revalidate: 3600 } }
      )
      if (oembedRes.ok) {
        const oembed = await oembedRes.json()
        title = oembed.title || ''
        channel = oembed.author_name || ''
      }
    } catch {
      // oEmbed failed — continue with defaults
    }

    // 2. Scrape YouTube page for stats (views, likes, duration, description)
    let views = 0
    let likes = 0
    let duration = ''
    let commentsCount = 0
    let description = ''

    try {
      const pageRes = await fetch(youtubeUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        next: { revalidate: 300 },
      })

      if (pageRes.ok) {
        const html = await pageRes.text()

        // Title fallback from page
        if (!title) {
          const titleMatch = html.match(/<title>(.+?)<\/title>/)
          if (titleMatch) {
            title = titleMatch[1].replace(' - YouTube', '').trim()
          }
        }

        // Channel fallback from page
        if (!channel) {
          const channelMatch = html.match(/"ownerChannelName":"([^"]+)"/)
          if (channelMatch) channel = channelMatch[1]
        }

        // Views from page
        const viewsMatch = html.match(/"viewCount":"(\d+)"/)
        if (viewsMatch) views = parseInt(viewsMatch[1]) || 0

        // Likes from page
        const likesMatch = html.match(/"defaultText":\{"accessibility":\{"accessibilityData":\{"label":"([^"]*?)"\}\},"simpleText":"(\d[\d,.]*)"\}/)
        if (likesMatch) {
          likes = parseInt(likesMatch[2].replace(/[,.]/g, '')) || 0
        } else {
          // Alternative like count pattern
          const altLikesMatch = html.match(/"likeCount":\s*"?(\d+)"?/)
          if (altLikesMatch) likes = parseInt(altLikesMatch[1]) || 0
        }

        // Duration from page (ISO 8601 format like PT5M30S)
        const durationMatch = html.match(/"lengthSeconds":"(\d+)"/)
        if (durationMatch) {
          const totalSec = parseInt(durationMatch[1]) || 0
          const mins = Math.floor(totalSec / 60)
          const secs = totalSec % 60
          duration = `${mins}:${secs.toString().padStart(2, '0')}`
        }

        // Comments count
        const commentsMatch = html.match(/"commentCount":\s*"?(\d+)"?/)
        if (commentsMatch) commentsCount = parseInt(commentsMatch[1]) || 0

        // Description from shortDescription
        const descMatch = html.match(/"shortDescription":"((?:[^"\\]|\\.)*)"/)
        if (descMatch) {
          description = descMatch[1]
            .replace(/\\n/g, '\n')
            .replace(/\\"/g, '"')
            .replace(/\\u0026/g, '&')
            .trim()
          // Truncate to 500 chars for display
          if (description.length > 500) {
            description = description.slice(0, 500) + '...'
          }
        }
      }
    } catch {
      // Page scrape failed — use oEmbed data only
    }

    // 3. Verify thumbnail exists, fallback to standard resolutions
    let thumbOk = false
    try {
      const thumbRes = await fetch(thumbnail, { method: 'HEAD' })
      thumbOk = thumbRes.ok
    } catch {
      // ignore
    }
    if (!thumbOk) {
      thumbnail = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
    }

    return NextResponse.json({
      title,
      channel,
      thumbnail,
      duration,
      views,
      likes,
      commentsCount,
      description,
      videoId,
      url: youtubeUrl,
    })
  } catch (err) {
    console.error('[youtube/metadata] failed:', err)
    return NextResponse.json({ error: 'فشل جلب البيانات' }, { status: 500 })
  }
}
