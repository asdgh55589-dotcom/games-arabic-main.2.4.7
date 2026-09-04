'use client'

import { Megaphone, Star, Zap } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'

interface NewsItem {
  id: string
  slug: string
  title: string
  summary: string
  linkUrl: string | null
  isSticky: boolean
  isAnimated: boolean
}

export function NewsTicker() {
  const [news, setNews] = useState<NewsItem[]>([])
  const [viewedIds, setViewedIds] = useState<Set<string>>(new Set())
  const itemRefs = useRef<Map<string, HTMLElement>>(new Map())

  useEffect(() => {
    fetch('/api/news?type=ticker&limit=10')
      .then((r) => r.json())
      .then((d) => {
        const list = d.data?.news ?? d.data ?? []
        if (Array.isArray(list)) {
          setNews(list)
        }
      })
      .catch(() => {})
  }, [])

  // IntersectionObserver for accurate view tracking (50% visible)
  useEffect(() => {
    if (news.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const newsId = entry.target.getAttribute('data-news-id')
            if (newsId && !viewedIds.has(newsId)) {
              setViewedIds((prev) => {
                if (prev.has(newsId)) return prev
                const next = new Set(prev)
                next.add(newsId)
                return next
              })
              fetch(`/api/news/${newsId}/view`, { method: 'POST' }).catch(() => {})
              observer.unobserve(entry.target)
            }
          }
        })
      },
      { threshold: 0.5 },
    )

    itemRefs.current.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [news, viewedIds])

  const trackClick = (id: string) => {
    fetch(`/api/news/${id}/click`, { method: 'POST' }).catch(() => {})
  }

  if (news.length === 0) return null

  const stickyItems = news.filter((n) => n.isSticky)
  const scrollItems = news.filter((n) => !n.isSticky)

  const setRef = (id: string) => (el: HTMLElement | null) => {
    if (el) itemRefs.current.set(id, el)
    else itemRefs.current.delete(id)
  }

  return (
    <div
      className="relative w-full border-y-[3px] border-border bg-card shadow-[0_3px_0_0_var(--border)] overflow-hidden"
      dir="rtl"
    >
      <div className="mx-auto flex max-w-[1600px] items-stretch">
        {/* شعار الأخبار — ثابت بزاوية حادة */}
        <div className="relative shrink-0 flex items-center gap-2 bg-primary px-4 py-2.5 lg:px-5 -mr-3">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-60"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
          </span>
          <Megaphone className="h-3.5 w-3.5 text-white hidden sm:block" />
          <span className="text-[11px] font-black uppercase tracking-[0.14em] text-white whitespace-nowrap">
            آخر الأخبار
          </span>
          <div className="absolute -left-[6px] top-1/2 -translate-y-1/2 w-0 h-0 border-y-[6px] border-y-transparent border-r-[6px] border-r-primary hidden sm:block" />
        </div>

        {/* العناصر الثابتة — مميزة */}
        {stickyItems.length > 0 && (
          <div className="hidden md:flex items-center gap-2 shrink-0 border-l-[3px] border-border bg-amber-500/10 px-3">
            {stickyItems.map((item) => (
              <Link
                key={item.id}
                ref={setRef(item.id) as any}
                data-news-id={item.id}
                href={item.linkUrl || '/'}
                target={item.linkUrl ? '_blank' : undefined}
                onClick={() => trackClick(item.id)}
                className="inline-flex items-center gap-1.5 border-2 border-amber-500/30 bg-amber-500/15 px-2.5 py-1 text-xs font-black text-amber-600 dark:text-amber-400 hover:bg-amber-500 hover:text-white hover:border-amber-600 transition-colors"
              >
                <Star className="h-3 w-3 fill-current shrink-0" />
                <span className="max-w-[180px] truncate">{item.title}</span>
              </Link>
            ))}
          </div>
        )}

        {/* الشريط المتحرك */}
        {scrollItems.length > 0 && (
          <div className="relative min-w-0 flex-1 overflow-hidden bg-card flex items-center group">
            <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-12 bg-gradient-to-l from-card via-card/80 to-transparent" />
            <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-12 bg-gradient-to-r from-card via-card/80 to-transparent" />

            <div
              className={`flex w-max items-center whitespace-nowrap gap-0 py-2.5 will-change-transform ${scrollItems.some((n) => n.isAnimated) ? 'animate-ticker group-hover:[animation-play-state:paused]' : 'justify-start'}`}
            >
              {[...scrollItems, ...scrollItems, ...scrollItems].map((item, i) => {
                // Only track view for original items (first set), duplicates are for animation
                const isOriginal = i < scrollItems.length
                return (
                  <Link
                    key={`${item.id}-${i}`}
                    ref={isOriginal ? (setRef(item.id) as any) : undefined}
                    data-news-id={isOriginal ? item.id : undefined}
                    href={item.linkUrl || '/'}
                    target={item.linkUrl ? '_blank' : undefined}
                    onClick={() => trackClick(item.id)}
                    className="inline-flex shrink-0 items-center gap-3 px-6 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors group/item"
                  >
                    <span className="h-1 w-1 shrink-0 rotate-45 bg-primary/60 group-hover/item:bg-primary transition-colors" />
                    <Zap className="h-3 w-3 text-primary/40 group-hover/item:text-primary transition-colors hidden lg:block" />
                    <span className="line-clamp-1 group-hover/item:text-primary transition-colors">
                      {item.title}
                    </span>
                  </Link>
                )
              })}
            </div>
          </div>
        )}

        {stickyItems.length > 0 && scrollItems.length === 0 && (
          <div className="flex md:hidden flex-1 items-center gap-2 overflow-x-auto no-scrollbar px-3 py-2">
            {stickyItems.map((item) => (
              <Link
                key={item.id}
                ref={setRef(item.id) as any}
                data-news-id={item.id}
                href={item.linkUrl || '/'}
                target={item.linkUrl ? '_blank' : undefined}
                onClick={() => trackClick(item.id)}
                className="shrink-0 inline-flex items-center gap-1 border-2 border-amber-500/30 bg-amber-500/15 px-2 py-1 text-xs font-bold text-amber-600"
              >
                <Star className="h-3 w-3 fill-current" />
                {item.title}
              </Link>
            ))}
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes ticker {
          0% { transform: translateX(0); }
          100% { transform: translateX(-33.333%); }
        }
        .animate-ticker {
          animation: ticker 45s linear infinite;
        }
        @media (max-width: 640px) {
          .animate-ticker { animation-duration: 30s; }
        }
      `}</style>
    </div>
  )
}
