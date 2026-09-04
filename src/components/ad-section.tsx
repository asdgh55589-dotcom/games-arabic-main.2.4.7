// Updated for new API response format
'use client'

import Image from 'next/image'

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

/** استخراج YouTube video ID من الرابط — يدعم كل الصيغ */
function extractYouTubeId(url: string): string {
  if (!url) return ''
  try {
    const u = new URL(url.trim())
    const host = u.hostname.replace(/^www\./, '').replace(/^m\./, '')
    // youtu.be/ID
    if (host === 'youtu.be') {
      const id = u.pathname.split('/')[1]?.slice(0, 11)
      if (id && /^[\w-]{11}$/.test(id)) return id
    }
    // youtube.com / youtube-nocookie.com / music.youtube.com
    if (host.includes('youtube') || host.includes('youtube-nocookie')) {
      // ?v=ID — قد يكون ليس أول param
      const v = u.searchParams.get('v')
      if (v && /^[\w-]{11}$/.test(v)) return v
      // /embed/ID  /shorts/ID  /v/ID
      const parts = u.pathname.split('/').filter(Boolean)
      const idx = parts.findIndex((p) => ['embed', 'shorts', 'v', 'watch'].includes(p))
      if (idx !== -1 && parts[idx + 1] && /^[\w-]{11}$/.test(parts[idx + 1])) {
        return parts[idx + 1]
      }
      // fallback: آخر جزء 11 حرف
      for (const part of parts) {
        if (/^[\w-]{11}$/.test(part)) return part
      }
    }
  } catch {}
  // fallback regex للروابط بدون scheme أو بصيغ غريبة
  const patterns = [
    /(?:youtube\.com\/watch\?.*v=)([\w-]{11})/,
    /(?:youtube\.com\/.*[?&]v=)([\w-]{11})/,
    /(?:youtu\.be\/)([\w-]{11})/,
    /(?:youtube\.com\/embed\/)([\w-]{11})/,
    /(?:youtube\.com\/shorts\/)([\w-]{11})/,
    /(?:youtube-nocookie\.com\/embed\/)([\w-]{11})/,
    /(?:youtube\.com\/v\/)([\w-]{11})/,
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

  const trackClick = () => {
    fetch(`/api/ads/${ad.id}/click`, { method: 'POST' }).catch(() => {})
  }

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

    // رابط غير صالح — اعرض تنبيه بدل شاشة سوداء
    if (!videoId) {
      return (
        <div
          className={`relative flex w-full flex-col items-center justify-center gap-2 overflow-hidden rounded-none border-2 border-destructive/50 bg-destructive/10 p-4 text-center ${sizeInfo.className}`}
        >
          <Youtube className="h-8 w-8 text-destructive/60" />
          <p className="text-xs font-bold text-destructive">رابط يوتيوب غير صالح</p>
          <p className="max-w-[90%] truncate text-[11px] text-muted-foreground" dir="ltr">
            {ad.url}
          </p>
          {ad.title && <p className="text-xs font-medium text-foreground">{ad.title}</p>}
        </div>
      )
    }

    if (playing && videoId) {
      const origin = typeof window !== 'undefined' ? window.location.origin : ''
      return (
        <div
          className={`relative w-full overflow-hidden rounded-none border-2 border-border bg-black ${sizeInfo.className}`}
        >
          <iframe
            src={`https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&controls=1&rel=0&modestbranding=1&playsinline=1&enablejsapi=1${origin ? `&origin=${encodeURIComponent(origin)}` : ''}`}
            title={ad.title || 'إعلان'}
            className="absolute inset-0 h-full w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
          <button
            onClick={(e) => {
              e.stopPropagation()
              setPlaying(false)
            }}
            className="absolute right-2 top-2 z-10 grid h-8 w-8 place-items-center rounded-full bg-black/70 text-white backdrop-blur hover:bg-black/90"
            aria-label="إغلاق الفيديو"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )
    }

    return (
      <div
        className={`group relative w-full cursor-pointer overflow-hidden rounded-none border-2 border-border bg-card ${sizeInfo.className}`}
        onClick={() => {
          trackClick()
          setPlaying(true)
        }}
      >
        {/* Thumbnail — مع fallback متدرج maxres → hq → mq → sd */}
        {videoInfo?.thumbnail && (
          // eslint-disable-next-line @next/next/no-img-element
          <Image
            unoptimized
            sizes="(max-width: 768px) 100vw, 50vw"
            fill
            src={videoInfo.thumbnail}
            alt={ad.title || ''}
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105 bg-black"
            onError={(e) => {
              const img = e.currentTarget as HTMLImageElement & {
                dataset: { fallbackStep?: string }
              }
              const step = img.dataset.fallbackStep || '0'
              const videoId = extractYouTubeId(ad.url)
              if (step === '0' && videoId) {
                img.dataset.fallbackStep = '1'
                img.src = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
              } else if (step === '1' && videoId) {
                img.dataset.fallbackStep = '2'
                img.src = `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`
              } else if (step === '2' && videoId) {
                img.dataset.fallbackStep = '3'
                img.src = `https://i.ytimg.com/vi/${videoId}/sddefault.jpg`
              } else {
                img.style.display = 'none'
              }
            }}
          />
        )}
        {/* خلفية سوداء احتياطية لو الثامبنيل فشل */}
        {!videoInfo?.thumbnail && (
          <div className="absolute inset-0 bg-gradient-to-br from-zinc-900 to-black" />
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
      <div
        className={`relative w-full overflow-hidden rounded-none border-2 border-border bg-card ${sizeInfo.className}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <Image
          unoptimized
          sizes="(max-width: 768px) 100vw, 50vw"
          fill
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
        <a
          href={ad.link}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => {
            // Track before navigation; don't prevent default
            trackClick()
          }}
        >
          {content}
        </a>
      )
    }
    return (
      <div onClick={trackClick} className="cursor-pointer">
        {content}
      </div>
    )
  }

  // ===== HTML Ad =====
  if (ad.type === 'html') {
    return (
      <div onClick={trackClick} className="cursor-pointer">
        <div
          className={`w-full overflow-hidden rounded-none border-2 border-border bg-card p-4 ${sizeInfo.className}`}
          dangerouslySetInnerHTML={{ __html: sanitizeHTML(ad.url) }}
        />
      </div>
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
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.data?.ads) setAds(data.data.ads)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading || ads.length === 0) return null

  return (
    <aside className="space-y-4" dir="rtl">
      <div className="mb-2">
        <h2 className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
          <Youtube className="h-3.5 w-3.5 text-red-500" />
          YouTube
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
