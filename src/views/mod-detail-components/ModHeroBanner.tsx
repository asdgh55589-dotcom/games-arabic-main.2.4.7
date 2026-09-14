'use client'

import { ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FALLBACK_GAME_IMAGE } from '@/lib/constants'

interface ModHeroBannerProps {
  bannerImage: string
  modName: string
  platform: string
  platformColor?: string
}

export function ModHeroBanner({
  bannerImage,
  modName,
  platform,
  platformColor,
}: ModHeroBannerProps) {
  const router = useRouter()

  return (
    <div className="relative h-[280px] sm:h-[360px] md:h-[440px] overflow-hidden rounded-b-xl" dir="rtl">
      <div className="absolute inset-0">
        {bannerImage ? (
          <>
            <img
              src={bannerImage}
              alt=""
              className="h-full w-full object-cover"
              fetchPriority="high"
              onError={(e) => {
                e.currentTarget.src = FALLBACK_GAME_IMAGE
              }}
            />
            <div className="mod-detail-hero-overlay absolute inset-0" />
          </>
        ) : (
          <div
            className="h-full w-full"
            style={{
              background: platformColor
                ? `radial-gradient(circle at 30% 50%, ${platformColor}1a 0%, var(--background) 70%)`
                : 'var(--background)',
            }}
          />
        )}
      </div>

      <nav
        className="absolute top-3 sm:top-4 start-3 sm:start-6 z-10 flex flex-wrap items-center gap-2 text-xs text-muted-foreground/80"
        aria-label="مسار التنقل"
      >
        <button
          onClick={() => router.back()}
          className="inline-flex items-center justify-center h-8 w-8 rounded-lg bg-background/50 backdrop-blur-sm border border-white/10 transition-all hover:bg-background/70 hover:text-foreground cursor-pointer"
          aria-label="العودة للصفحة السابقة"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
        <Link
          href="/"
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-background/50 backdrop-blur-sm border border-white/10 transition-all hover:bg-background/70 hover:text-foreground"
        >
          <span className="text-[10px] opacity-60">«</span>
          الرئيسية
        </Link>
        <span className="text-primary/60 text-[10px]">‹</span>
        <Link
          href={`/platform/${platform}`}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-background/50 backdrop-blur-sm border border-white/10 transition-all hover:bg-background/70 whitespace-nowrap"
          style={{ color: platformColor }}
        >
          ARABIC {platform}
        </Link>
        <span className="text-primary/60 text-[10px]">‹</span>
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary/10 border border-primary/20 font-medium text-foreground">
          {modName}
        </span>
      </nav>
    </div>
  )
}
