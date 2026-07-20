'use client'

import { useState, useEffect } from 'react'
import { Play, X, ExternalLink, Image as ImageIcon, Youtube } from 'lucide-react'
import { cached } from '@/lib/cache'
import { sanitizeHTML } from '@/lib/sanitize'

interface HomepageAd {
  id: string
  type: string // youtube | image | html
  url: string
  title: string
  description: string
  link: string | null
  size: string // small | medium | large | full
  order: number
  visible: boolean
}

interface VideoInfo {
  title: string
  channel: string
  thumbnail: string
  duration: string
}

/** استخراج YouTube video ID من الرابط */
function extractYouTubeId(url: string): string {
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
  return ''
}

/** حجم الإعلان حسب الـ size */
function getAdSize(size: string): { width: string; height: string; className: string } {
  switch (size) {
    case 'small':
      return { width: '100%', height: '120px', className: 'aspect-[5/3]' }
    case 'large':
      return { width: '100%', height: '200px', className: 'aspect-video' }
    case 'full':
      return { width: '100%', height: '250px', className: 'aspect-[16/9]' }
    case 'medium':
    default:
      return { width: '100%', height: '160px', className: 'aspect-[5/3]' }
  }
}

/** عنصر إعلان واحد */
function AdItem({ ad }: { ad: HomepageAd }) {
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null)
  const [playing, setPlaying] = useState(false)
  const [loading, setLoading] = useState(false)

  // لو الإعلان فيديو يوتيوب، اقرأ بياناته تلقائياً
  useEffect(() => {
    if (ad.type !== 'youtube') return
    const videoId = extractYouTubeId(ad.url)
    if (!videoId) return

    setLoading(true)
    // استخدم thumbnail مباشرة من YouTube
    setVideoInfo({
      title: ad.title || 'فيديو',
      channel: ad.description || '',
      thumbnail: `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`,
      duration: '',
    })
    setLoading(false)
  }, [ad.type, ad.url, ad.title, ad.description])

  const sizeInfo = getAdSize(ad.size)

  // ===== YouTube Video Ad =====
  if (ad.type === 'youtube') {
    const videoId = extractYouTubeId(ad.url)

    if (playing && videoId) {
      return (
        <div className={`relative w-full overflow-hidden rounded-xl border border-border bg-black ${sizeInfo.className}`}>
          <iframe
            src={`https://www.youtube.com/embed/${videoId}?autoplay=1`}
            title={ad.title || 'إعلان'}
            className="absolute inset-0 h-full w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      )
    }

    return (
      <div
        className={`group relative w-full cursor-pointer overflow-hidden rounded-xl border border-border bg-card ${sizeInfo.className}`}
        onClick={() => setPlaying(true)}
      >
        {/* Thumbnail */}
        {videoInfo?.thumbnail && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={videoInfo.thumbnail}
            alt={ad.title || ''}
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        )}

        {/* Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

        {/* Play button */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="grid h-16 w-16 place-items-center rounded-full bg-red-600/90 shadow-2xl backdrop-blur transition-transform group-hover:scale-110">
            <Play className="h-7 w-7 fill-white text-white" />
          </div>
        </div>

        {/* Title + channel */}
        {(ad.title || ad.description) && (
          <div className="absolute bottom-0 left-0 right-0 p-4">
            {ad.title && (
              <h3 className="line-clamp-1 text-base font-bold text-white">{ad.title}</h3>
            )}
            {ad.description && (
              <p className="mt-0.5 line-clamp-1 text-xs text-white/70">{ad.description}</p>
            )}
          </div>
        )}

        {/* YouTube badge */}
        <div className="absolute right-2 top-2 flex items-center gap-1 rounded bg-red-600 px-2 py-1 text-[10px] font-bold text-white">
          <Youtube className="h-3 w-3" />
          AD
        </div>
      </div>
    )
  }

  // ===== Image Ad =====
  if (ad.type === 'image') {
    const content = (
      <div className={`relative w-full overflow-hidden rounded-xl border border-border bg-card ${sizeInfo.className}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={ad.url}
          alt={ad.title || ''}
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 hover:scale-105"
        />
        {(ad.title || ad.description) && (
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
            {ad.title && <h3 className="text-base font-bold text-white">{ad.title}</h3>}
            {ad.description && <p className="mt-0.5 text-xs text-white/70">{ad.description}</p>}
          </div>
        )}
        <div className="absolute right-2 top-2 rounded bg-primary px-2 py-1 text-[10px] font-bold text-primary-foreground">
          AD
        </div>
      </div>
    )

    if (ad.link) {
      return (
        <a href={ad.link} target="_blank" rel="noopener noreferrer">
          {content}
        </a>
      )
    }
    return content
  }

  // ===== HTML Ad =====
  if (ad.type === 'html') {
    return (
      <div
        className={`w-full overflow-hidden rounded-xl border border-border bg-card p-4 ${sizeInfo.className}`}
        dangerouslySetInnerHTML={{ __html: sanitizeHTML(ad.url) }}
      />
    )
  }

  return null
}

/**
 * AdSection — قسم الإعلانات في الصفحة الرئيسية.
 *
 * بيقرأ الإعلانات من /api/ads وبيعرضها فوق الشريط الجانبي.
 * بيدعم: فيديوهات يوتيوب، صور إعلانية، HTML مخصص.
 * بيدعم مقاسات مختلفة: small | medium | large | full.
 *
 * لما تتضاف إعلانات، الشريط الجانبي بينزل لتحت تلقائياً.
 */
export function AdSection() {
  const [ads, setAds] = useState<HomepageAd[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/ads')
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.ads) setAds(data.ads)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading || ads.length === 0) return null

  return (
    <aside className="space-y-4" dir="rtl">
      <div className="mb-2">
        <h2 className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
          <ImageIcon className="h-3.5 w-3.5" />
          إعلانات
        </h2>
      </div>
      <div className="space-y-3">
        {ads.map((ad) => (
          <AdItem key={ad.id} ad={ad} />
        ))}
      </div>
    </aside>
  )
}
