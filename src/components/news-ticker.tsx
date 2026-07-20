'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

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

  useEffect(() => {
    fetch('/api/news?type=ticker&limit=10')
      .then((r) => r.json())
      .then((d) => setNews(d.news || []))
      .catch(() => {})
  }, [])

  if (news.length === 0) return null

  const stickyItems = news.filter((n) => n.isSticky)
  const scrollItems = news.filter((n) => !n.isSticky)

  return (
    <div className="w-full border-b border-border bg-card/80 backdrop-blur" dir="rtl">
      <div className="mx-auto flex max-w-[1600px] items-center overflow-hidden px-4 py-2 lg:px-6">
        {/* شعار الأخبار */}
        <div className="shrink-0 border-l border-border pl-3 pr-4">
          <span className="text-xs font-bold text-primary">آخر الأخبار</span>
        </div>

        {/* العناصر الثابتة */}
        {stickyItems.map((item) => (
          <Link
            key={item.id}
            href={item.linkUrl || `/?view=news&slug=${item.slug}`}
            target={item.linkUrl ? '_blank' : undefined}
            className="shrink-0 border-l border-border px-3 text-xs font-medium text-foreground hover:text-primary"
          >
            ★ {item.title}
          </Link>
        ))}

        {/* الشريط المتحرك */}
        {scrollItems.length > 0 && (
          <div className="relative min-w-0 flex-1 overflow-hidden">
            <div className={`flex whitespace-nowrap gap-8 ${scrollItems.some((n) => n.isAnimated) ? 'animate-[scroll_30s_linear_infinite]' : ''}`}>
              {[...scrollItems, ...scrollItems].map((item, i) => (
                <Link
                  key={`${item.id}-${i}`}
                  href={item.linkUrl || `/?view=news&slug=${item.slug}`}
                  target={item.linkUrl ? '_blank' : undefined}
                  className="inline-block shrink-0 text-xs text-muted-foreground hover:text-foreground"
                >
                  {item.title}
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes scroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  )
}
