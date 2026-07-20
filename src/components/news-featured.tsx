'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
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

  useEffect(() => {
    fetch('/api/news?type=featured&limit=6')
      .then((r) => r.json())
      .then((d) => setNews(d.news || []))
      .catch(() => {})
  }, [])

  if (news.length === 0) return null

  return (
    <section>
      <div className="mb-5 flex items-center gap-2">
        <Newspaper className="h-5 w-5 text-primary" />
        <h2 className="text-2xl font-bold tracking-tight">آخر الأخبار</h2>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {news.map((item) => {
          const href = item.linkUrl || `/?view=news&slug=${item.slug}`
          return (
            <Link
              key={item.id}
              href={href}
              target={item.linkUrl ? '_blank' : undefined}
              className="group overflow-hidden rounded-xl border border-border bg-card transition-all hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5"
            >
              {item.imageUrl && (
                <div className="relative h-40 overflow-hidden">
                  <img src={item.imageUrl} alt="" className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                  <div className="absolute inset-0 bg-gradient-to-t from-card to-transparent" />
                </div>
              )}
              <div className="p-4">
                <div className="mb-2 flex items-center gap-2">
                  <span className="rounded bg-primary/20 px-2 py-0.5 text-[10px] font-bold text-primary">{item.category}</span>
                  <span className="text-[11px] text-muted-foreground">{timeAgo(item.publishAt)}</span>
                </div>
                <h3 className="line-clamp-2 text-sm font-bold text-foreground group-hover:text-primary">{item.title}</h3>
                {item.summary && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{item.summary}</p>}
              </div>
            </Link>
          )
        })}
      </div>
    </section>
  )
}
