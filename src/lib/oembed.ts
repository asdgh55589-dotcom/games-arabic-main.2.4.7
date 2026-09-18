/**
 * oEmbed fallback for video metadata (P2).
 * Used when yt-dlp fails — returns basic fields only
 * (title, author, thumbnail). No stats, duration, or publish date.
 */

export interface OEmbedData {
  title: string
  author_name: string
  thumbnail_url: string
  html?: string
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
    }
  } catch {
    return null
  }
}
