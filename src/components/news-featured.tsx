'use client'

import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Newspaper } from 'lucide-react'
import { timeAgo } from '@/lib/format'

interface NewsItem {
  id: string
  slug: string
  title: string
  summary: string
  imageUrl: string
  linkUrl: string | null
  category: string
  publishAt: string
}

export function NewsFeatured() {
  const [news, setNews] = useState<NewsItem[]>([])
  const [viewedIds, setViewedIds] = useState<Set<string>>(new Set())
  const itemRefs = useRef<Map<string, HTMLElement>>(new Map())

  useEffect(() => {
    fetch('/api/news?type=featured&limit=6')
      .then((r) => r.json())
      .then((d) => {
        const list = d.data?.news ?? d.data ?? []
        if (Array.isArray(list)) {
          setNews(list)
        }
      })
      .catch(() => {})
  }, [])

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

  const setRef = (id: string) => (el: HTMLElement | null) => {
    if (el) itemRefs.current.set(id, el)
    else itemRefs.current.delete(id)
  }

  if (news.length === 0) return null

  return (
    <section>
      <div className="mb-5 flex items-center gap-2">
        <Newspaper className="h-5 w-5 text-primary" />
        <h2 className="text-2xl font-bold tracking-tight">آخر الأخبار</h2>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:gap-4 lg:grid-cols-3">
        {news.map((item) => {
          const href = item.linkUrl || '/'
          return (
            <Link
              key={item.id}
              ref={setRef(item.id) as any}
              data-news-id={item.id}
              href={href}
              target={item.linkUrl ? '_blank' : undefined}
              onClick={() => trackClick(item.id)}
              className="group overflow-hidden rounded-none border-2 border-border bg-card transition-all hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5"
            >
              {item.imageUrl && (
                <div className="relative h-28 sm:h-40 overflow-hidden">
                  <Image
                    src={item.imageUrl}
                    alt={item.title}
                    fill
                    sizes="(max-width: 768px) 50vw, 33vw"
                    quality={75}
                    className="object-cover transition-transform group-hover:scale-105"
                    onError={(e) => {
                      const img = e.currentTarget as HTMLImageElement & { dataset: DOMStringMap }
                      if (!img.dataset.fallback) {
                        img.dataset.fallback = '1'
                        img.src = '/hero-bg.jpg'
                      }
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-card to-transparent" />
                </div>
              )}
              <div className="p-2.5 sm:p-4">
                <div className="mb-1.5 flex items-center gap-1.5">
                  <span className="rounded bg-primary/20 px-1.5 py-0.5 text-[9px] sm:text-[10px] font-bold text-primary">
                    {item.category}
                  </span>
                  <span className="text-[10px] sm:text-[11px] text-muted-foreground">
                    {timeAgo(item.publishAt)}
                  </span>
                </div>
                <h3 className="line-clamp-2 text-xs sm:text-sm font-bold text-foreground group-hover:text-primary">
                  {item.title}
                </h3>
                {item.summary && (
                  <p className="mt-1 line-clamp-2 text-[11px] sm:text-xs text-muted-foreground">
                    {item.summary}
                  </p>
                )}
              </div>
            </Link>
          )
        })}
      </div>
    </section>
  )
}
