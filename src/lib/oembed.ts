/**
 * oEmbed fallback for video metadata (P2 YouTube, P3 Vimeo).
 * Used when yt-dlp fails (YouTube) or directly (Vimeo) — returns basic
 * fields only (title, author, thumbnail, +duration for Vimeo).
 * No stats, no publish date.
 */

export type VideoProvider = 'youtube' | 'vimeo'

export interface OEmbedData {
  title: string
  author_name: string
  thumbnail_url: string
  html?: string
  /** seconds (Vimeo only) */
  duration?: number
  provider: VideoProvider
}

/** Extract a Vimeo numeric id from common URL shapes. Null when no match. */
export function extractVimeoId(url: string): string | null {
  const patterns = [
    /player\.vimeo\.com\/video\/(\d+)/,
    /vimeo\.com\/channels\/[^/]+\/(\d+)/,
    /vimeo\.com\/groups\/[^/]+\/videos\/(\d+)/,
    /vimeo\.com\/(\d+)/,
  ]
  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match) return match[1]
  }
  return null
}

/**
 * Client-safe pre-check (no node imports): true for supported
 * YouTube + Vimeo URL shapes. The server does precise extraction.
 */
const YT_PART =
  '(?:youtube\\.com\\/watch\\?v=|youtu\\.be\\/|youtube\\.com\\/embed\\/|youtube\\.com\\/shorts\\/|music\\.youtube\\.com\\/watch\\?v=|youtube-nocookie\\.com\\/embed\\/|youtube\\.com\\/live\\/|youtube\\.com\\/v\\/)([\\w-]{11})'
const VIMEO_PART =
  '(?:player\\.vimeo\\.com\\/video\\/|vimeo\\.com\\/channels\\/[^/]+\\/|vimeo\\.com\\/groups\\/[^/]+\\/videos\\/|vimeo\\.com\\/)(\\d+)'

export function isSupportedVideoUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false
  return new RegExp(`${YT_PART}|${VIMEO_PART}`).test(url)
}

export function isVimeoUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false
  return new RegExp(VIMEO_PART).test(url)
}

/**
 * Detect provider + canonical id. YouTube matching delegates to the
 * caller's YouTube extractor to avoid duplicating its pattern list.
 */
export function detectVideoProvider(
  url: string,
  extractYouTubeId: (url: string) => string | null,
): { provider: VideoProvider; id: string } | null {
  const yt = extractYouTubeId(url)
  if (yt) return { provider: 'youtube', id: yt }
  const vimeo = extractVimeoId(url)
  if (vimeo) return { provider: 'vimeo', id: vimeo }
  return null
}

/**
 * Fetch YouTube oEmbed for a (preferably normalized watch) URL.
 * Returns null on any failure (non-200, bad JSON, timeout, missing title).
 */
export async function fetchOEmbedData(
  videoUrl: string,
  timeoutMs = 10_000,
  fetchFn: typeof fetch = fetch,
): Promise<OEmbedData | null> {
  try {
    const endpoint = `https://www.youtube.com/oembed?url=${encodeURIComponent(videoUrl)}&format=json`
    const res = await fetchFn(endpoint, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(timeoutMs),
    })
    if (!res.ok) return null
    const data = (await res.json()) as Partial<OEmbedData>
    if (!data || typeof data.title !== 'string' || !data.title) return null
    return {
      title: data.title,
      author_name: typeof data.author_name === 'string' ? data.author_name : '',
      thumbnail_url: typeof data.thumbnail_url === 'string' ? data.thumbnail_url : '',
      ...(typeof data.html === 'string' ? { html: data.html } : {}),
      provider: 'youtube',
    }
  } catch {
    return null
  }
}

/**
 * Fetch Vimeo oEmbed. Vimeo also reports duration (seconds).
 * Returns null on any failure.
 */
export async function fetchVimeoOEmbedData(
  videoUrl: string,
  timeoutMs = 10_000,
  fetchFn: typeof fetch = fetch,
): Promise<OEmbedData | null> {
  try {
    const endpoint = `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(videoUrl)}`
    const res = await fetchFn(endpoint, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(timeoutMs),
    })
    if (!res.ok) return null
    const data = (await res.json()) as Partial<OEmbedData> & { duration?: unknown }
    if (!data || typeof data.title !== 'string' || !data.title) return null
    return {
      title: data.title,
      author_name: typeof data.author_name === 'string' ? data.author_name : '',
      thumbnail_url: typeof data.thumbnail_url === 'string' ? data.thumbnail_url : '',
      ...(typeof data.html === 'string' ? { html: data.html } : {}),
      ...(typeof data.duration === 'number' && data.duration > 0 ? { duration: data.duration } : {}),
      provider: 'vimeo',
    }
  } catch {
    return null
  }
}
