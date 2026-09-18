import { spawn } from 'node:child_process'
import type { NextRequest } from 'next/server'
import { fail, internalError, ok, rateLimited, validationFail } from '@/lib/api-response'
import { fetchOEmbedData } from '@/lib/oembed'
import { rateLimit } from '@/lib/rate-limit'

export const runtime = 'nodejs'

// ===== P1: structured yt-dlp error classification (Arabic UX) =====

export const VIDEO_ERROR_CODES = [
  'VIDEO_PRIVATE',
  'VIDEO_UNAVAILABLE',
  'VIDEO_AGE_RESTRICTED',
  'VIDEO_NOT_FOUND',
  'VIDEO_RATE_LIMITED',
  'VIDEO_TIMEOUT',
  'BINARY_NOT_FOUND',
  'VIDEO_FETCH_FAILED',
] as const

export type VideoErrorCode = (typeof VIDEO_ERROR_CODES)[number]

export interface ClassifiedVideoError {
  code: VideoErrorCode
  message: string
  status: number
}

/**
 * Map raw yt-dlp stderr/exit text to a structured Arabic error.
 * Exported for unit tests. Never exposes raw stderr to clients
 * (may contain server paths) — stderr stays in server logs only.
 */
export function classifyYtDlpError(raw: unknown): ClassifiedVideoError {
  const text = raw instanceof Error ? `${raw.message}` : String(raw ?? '')
  const t = text.toLowerCase()

  if (t.includes('private video')) {
    return { code: 'VIDEO_PRIVATE', message: 'هذا الفيديو خاص ولا يمكن الوصول إليه', status: 422 }
  }
  if (t.includes('sign in to confirm your age') || /age[-_ ]?restricted/.test(t)) {
    return { code: 'VIDEO_AGE_RESTRICTED', message: 'هذا الفيديو مقيّد بالعمر ولا يمكن جلب بياناته', status: 422 }
  }
  if (t.includes('video unavailable') || t.includes('has been removed') || t.includes('has been deleted')) {
    return { code: 'VIDEO_UNAVAILABLE', message: 'الفيديو غير متاح أو تم حذفه', status: 422 }
  }
  if (t.includes('http error 404') || t.includes('not found')) {
    return { code: 'VIDEO_NOT_FOUND', message: 'الفيديو غير موجود', status: 404 }
  }
  if (t.includes('http error 429') || t.includes('too many requests') || t.includes('rate-limit')) {
    return { code: 'VIDEO_RATE_LIMITED', message: 'تم تجاوز حد الطلبات، حاول لاحقًا', status: 429 }
  }
  if (t.includes('yt-dlp timeout') || t.includes('timed out')) {
    return { code: 'VIDEO_TIMEOUT', message: 'انتهت مهلة الاتصال، حاول مرة أخرى', status: 504 }
  }
  if ((raw as NodeJS.ErrnoException)?.code === 'ENOENT' || t.includes('enoent')) {
    return { code: 'BINARY_NOT_FOUND', message: 'yt-dlp غير مثبّت على الخادم — تواصل مع الإدارة', status: 500 }
  }
  return { code: 'VIDEO_FETCH_FAILED', message: 'تعذّر جلب بيانات الفيديو — تحقق من الرابط وحاول مجددًا', status: 500 }
}

export function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=)([\w-]{11})/,
    /(?:youtu\.be\/)([\w-]{11})/,
    /(?:youtube\.com\/embed\/)([\w-]{11})/,
    /(?:youtube\.com\/shorts\/)([\w-]{11})/,
    /(?:music\.youtube\.com\/watch\?v=)([\w-]{11})/,
    /(?:youtube-nocookie\.com\/embed\/)([\w-]{11})/,
    /(?:youtube\.com\/live\/)([\w-]{11})/,
    /(?:youtube\.com\/v\/)([\w-]{11})/,
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
  source: 'yt-dlp' | 'oembed'
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

    const child = spawn(/*turbopackIgnore: true*/ YT_DLP_BIN, args, { windowsHide: true })

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
    source: 'yt-dlp',
  }
}

/** Partial metadata from oEmbed (no stats/duration/publish date). */
export function buildOEmbedMetadata(
  data: { title: string; author_name: string; thumbnail_url: string },
  videoId: string,
  youtubeUrl: string,
): VideoMetadata {
  return {
    title: data.title || '',
    channel: data.author_name || '',
    thumbnail: data.thumbnail_url || `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
    duration: '',
    views: 0,
    likes: 0,
    commentsCount: 0,
    description: '',
    publishedAt: null,
    videoId,
    url: youtubeUrl,
    source: 'oembed',
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

    // yt-dlp first (full metadata); oEmbed fallback (basic fields only).
    try {
      const data = await runYtDlp(youtubeUrl)
      return ok(buildMetadata(data, videoId, youtubeUrl))
    } catch (err) {
      console.error('[youtube/metadata] yt-dlp failed:', err)
      const oembed = await fetchOEmbedData(youtubeUrl)
      if (oembed) {
        console.info('[youtube/metadata] oEmbed fallback succeeded')
        return ok(buildOEmbedMetadata(oembed, videoId, youtubeUrl))
      }
      const classified = classifyYtDlpError(err)
      return fail(classified.code, classified.message, classified.status, { url: youtubeUrl })
    }
  } catch (err) {
    console.error('[youtube/metadata] failed:', err)
    return internalError('فشل جلب البيانات')
  }
}
