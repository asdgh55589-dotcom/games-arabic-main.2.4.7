import { spawn } from 'node:child_process'
import type { NextRequest } from 'next/server'
import { internalError, ok, rateLimited, validationFail } from '@/lib/api-response'
import { rateLimit } from '@/lib/rate-limit'

export const runtime = 'nodejs'

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

interface VideoMetadata {
  title: string
  channel: string
  thumbnail: string
  duration: string
  views: number
  likes: number
  commentsCount: number
  description: string
  publishedAt: string | null
  videoId: string
  url: string
}

/** مسار تنفيذ yt-dlp (قابل للتخصيص عبر متغير البيئة YT_DLP_PATH). */
const YT_DLP_BIN = process.env.YT_DLP_PATH || 'yt-dlp'

/** تحويل عدد الثواني إلى صيغة قابلة للعرض (h:mm:ss أو m:ss). */
function formatDuration(totalSec: number): string {
  if (!totalSec || totalSec <= 0) return ''
  const hours = Math.floor(totalSec / 3600)
  const mins = Math.floor((totalSec % 3600) / 60)
  const secs = Math.floor(totalSec % 60)
  if (hours > 0) {
    return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

/**
 * تحويل تاريخ الرفع من yt-dlp إلى ISO.
 * yt-dlp يوفّر `timestamp` (Unix seconds) أو `upload_date` (YYYYMMDD).
 */
function resolvePublishedAt(timestamp: unknown, uploadDate: unknown): string | null {
  if (typeof timestamp === 'number' && timestamp > 0) {
    return new Date(timestamp * 1000).toISOString()
  }
  if (typeof uploadDate === 'string' && /^\d{8}$/.test(uploadDate)) {
    const y = uploadDate.slice(0, 4)
    const m = uploadDate.slice(4, 6)
    const d = uploadDate.slice(6, 8)
    const parsed = new Date(`${y}-${m}-${d}T00:00:00Z`)
    if (!isNaN(parsed.getTime())) return parsed.toISOString()
  }
  return null
}

/** اختيار أعلى دقة متاحة من الصور المصغّرة. */
function pickBestThumbnail(data: any, videoId: string): string {
  if (typeof data.thumbnail === 'string' && data.thumbnail) return data.thumbnail
  if (Array.isArray(data.thumbnails) && data.thumbnails.length > 0) {
    // yt-dlp يرتّبها تصاعدياً بالجودة عادةً — نختار الأخيرة ذات الرابط الصالح
    const withUrl = data.thumbnails.filter((t: any) => typeof t?.url === 'string')
    const best = withUrl
      .sort((a: any, b: any) => (a.preference ?? a.width ?? 0) - (b.preference ?? b.width ?? 0))
      .pop()
    if (best?.url) return best.url
  }
  return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
}

/**
 * تشغيل yt-dlp لجلب بيانات الفيديو كـ JSON دون تنزيل الفيديو نفسه.
 * timeout للحماية من التعليق.
 */
function runYtDlp(youtubeUrl: string, timeoutMs = 25_000): Promise<any> {
  return new Promise((resolve, reject) => {
    const args = [
      '--skip-download',
      '--no-warnings',
      '--no-playlist',
      // لا نحتاج صيغ الفيديو — تخطّي تنزيل وتحليل player JS يسرّع الجلب بشكل ملحوظ.
      '--ignore-no-formats-error',
      '--extractor-args',
      'youtube:player_skip=js,configs',
      '--dump-single-json',
      youtubeUrl,
    ]

    const child = spawn(YT_DLP_BIN, args, { windowsHide: true })

    let stdout = ''
    let stderr = ''
    let settled = false

    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      child.kill('SIGKILL')
      reject(new Error('yt-dlp timeout'))
    }, timeoutMs)

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString()
    })
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString()
    })

    child.on('error', (err) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      reject(err)
    })

    child.on('close', (code) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      if (code !== 0) {
        reject(new Error(stderr.trim() || `yt-dlp exited with code ${code}`))
        return
      }
      try {
        resolve(JSON.parse(stdout))
      } catch {
        reject(new Error('تعذّر تحليل مخرجات yt-dlp'))
      }
    })
  })
}

/** بناء البيانات النهائية من مخرجات yt-dlp. */
function buildMetadata(data: any, videoId: string, youtubeUrl: string): VideoMetadata {
  const description: string = typeof data.description === 'string' ? data.description : ''

  return {
    title: data.title || data.fulltitle || '',
    channel: data.channel || data.uploader || '',
    thumbnail: pickBestThumbnail(data, videoId),
    duration: data.duration_string || formatDuration(Number(data.duration) || 0),
    views: Number(data.view_count) || 0,
    likes: Number(data.like_count) || 0,
    commentsCount: Number(data.comment_count) || 0,
    description,
    publishedAt: resolvePublishedAt(data.timestamp, data.upload_date),
    videoId,
    url: youtubeUrl,
  }
}

export async function POST(req: NextRequest) {
  try {
    const rl = await rateLimit(req, { limit: 5, window: 60, keyPrefix: 'youtube:metadata' })
    if (!rl.success) {
      return rateLimited()
    }

    const { url } = await req.json()

    if (!url || typeof url !== 'string') {
      return validationFail({ url: 'URL مطلوب' })
    }

    const videoId = extractYouTubeId(url)
    if (!videoId) {
      return validationFail({ url: 'رابط يوتيوب غير صالح' })
    }

    const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`

    // الاعتماد الكامل على yt-dlp لجلب كل البيانات
    try {
      const data = await runYtDlp(youtubeUrl)
      return ok(buildMetadata(data, videoId, youtubeUrl))
    } catch (err) {
      console.error('[youtube/metadata] yt-dlp failed:', err)
      return internalError('تعذّر جلب بيانات الفيديو عبر yt-dlp. تأكد من تثبيت yt-dlp على الخادم.')
    }
  } catch (err) {
    console.error('[youtube/metadata] failed:', err)
    return internalError('فشل جلب البيانات')
  }
}
