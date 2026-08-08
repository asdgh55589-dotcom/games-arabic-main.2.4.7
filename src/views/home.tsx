'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useFetch } from '@/hooks/use-fetch'
import { useDocumentTitle } from '@/hooks/use-document-title'
import { ModCard, ModCardSkeleton } from '@/components/mod-card'
import { HeroSlider } from '@/components/hero-slider'
import { HomeSidebar } from '@/components/home-sidebar'
import { AdSection } from '@/components/ad-section'
import { NewsTicker } from '@/components/news-ticker'
import { NewsFeatured } from '@/components/news-featured'
import { formatNumber } from '@/lib/format'
import { PLATFORMS } from '@/lib/constants'
import type { HomeData } from '@/lib/types'

export function HomePage() {
  useDocumentTitle(null)
  const { data, loading } = useFetch<HomeData>('/api/home')

  return (
    <div dir="rtl">
      {/* ===== Hero Slider — شريط متحرك يعرض أحدث التعريبات ===== */}
      {loading ? (
        <div className="h-[clamp(360px,52vh,580px)] w-full animate-pulse bg-secondary" />
      ) : data?.latestMods && data.latestMods.length > 0 ? (
        <HeroSlider slides={data.latestMods} />
      ) : null}

      {/* ===== شريط الأخبار — تحت البنر مباشرة ===== */}
      <NewsTicker />

      {/* ===== الصف الرئيسي: المحتوى + الشريط الجانبي =====
          - الشريط الجانبي على اليمين (340px)
          - المحتوى الرئيسي في الباقي (flex-1) */}
      <div className="mx-auto flex max-w-[1600px] gap-4 py-4 px-4 lg:px-6" dir="rtl">
        {/* ===== اليمين: الإعلانات فوق + الشريط الجانبي تحت ===== */}
        <div className="w-[340px] shrink-0 space-y-4 -mr-[80px]">
          <AdSection />
          {loading ? (
            <div className="space-y-4">
              <div className="h-64 animate-pulse rounded-lg bg-secondary" />
              <div className="h-64 animate-pulse rounded-lg bg-secondary" />
              <div className="h-64 animate-pulse rounded-lg bg-secondary" />
            </div>
          ) : (
            <HomeSidebar
              latest={data?.latestMods || []}
              trending={data?.trendingMods || []}
              topEndorsed={data?.topEndorsed || []}
            />
          )}
        </div>

        {/* ===== المحتوى الرئيسي — في المنتصف ===== */}
        <div className="min-w-0 flex-1 space-y-8 -ml-[80px]">

      {/* آخر الأخبار — قبل أقسام المنصات */}
      {!loading && <NewsFeatured />}

      {/* أقسام المنصات — كل قسم يستخدم ModCard بنفس التصميم */}
      {(() => {
        let firstSectionRendered = false
        return PLATFORMS.map((platform) => {
          const mods = data?.modsByPlatform?.[platform.key] || []
          if (mods.length === 0 && !loading) return null
          const showDivider = firstSectionRendered
          firstSectionRendered = true
          return (
            <section key={platform.key} className={showDivider ? "pt-4" : "pt-2"}>
              <div className="mb-3 flex items-center justify-between border-b-[3px] border-border pb-3">
                <h2 className="text-xl font-black uppercase tracking-wider text-foreground">
                  {platform.label}
                </h2>
                <Button asChild variant="outline" size="sm" className="shrink-0 border-[2px] border-border font-bold uppercase tracking-wider shadow-[2px_2px_0_0_var(--border)] hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[3px_3px_0_0_var(--border)]">
                  <Link href={`/?view=platform&platform=${platform.key}`}>
                    عرض الكل <ArrowLeft className="mr-1.5 h-4 w-4" />
                  </Link>
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-4 sm:gap-5 sm:grid-cols-3 lg:grid-cols-5">
                {loading
                  ? Array.from({ length: 10 }).map((_, i) => <ModCardSkeleton key={i} />)
                  : mods.slice(0, 10).map((m) => <ModCard key={m.id} mod={m} />)}
              </div>
            </section>
          )
        })
      })()}

      {/* سلاسل التعريبات */}
      <section className="pt-4">
        <div className="mb-6 h-[3px] bg-border" />
        <SectionHeader
          title="سلاسل التعريبات"
          subtitle="استكشف التعريبات حسب السلسلة"
          href="/?view=series"
        />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {loading
            ? Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-28 animate-pulse bg-secondary border-[3px] border-border" />
              ))
            : data?.topSeries?.slice(0, 6).map((s) => (
                <Link
                  key={s.name}
                  href={`/?view=series-detail&series=${encodeURIComponent(s.name)}`}
                  className="group relative flex h-28 flex-col justify-end overflow-hidden border-[3px] border-border bg-card p-3 shadow-[3px_3px_0_0_var(--border)] transition-all duration-150 hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[4px_4px_0_0_var(--border)]"
                >
                  <img
                    src={s.thumbnailUrl}
                    alt=""
                    loading="lazy"
                    className="absolute inset-0 h-full w-full object-cover opacity-55 transition-opacity group-hover:opacity-75"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-card via-card/55 to-transparent" />
                  <div className="relative">
                    <h3 className="line-clamp-1 text-sm font-black uppercase tracking-wider text-foreground group-hover:text-primary">
                      {s.name}
                    </h3>
                    <p className="mt-0.5 text-xs font-semibold text-muted-foreground">
                      {formatNumber(s.count)} تعريب
                    </p>
                  </div>
                </Link>
              ))}
        </div>
      </section>

        </div>{/* نهاية المحتوى الرئيسي */}

      </div>
    </div>
  )
}

function SectionHeader({ title, subtitle, href }: { title: string; subtitle: string; href: string }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-4 border-b-[3px] border-border pb-3">
      <div>
        <h2 className="text-xl font-black uppercase tracking-wider">{title}</h2>
        <p className="mt-1 text-sm font-semibold text-muted-foreground">{subtitle}</p>
      </div>
      <Button asChild variant="outline" size="sm" className="shrink-0 border-[2px] border-border font-bold uppercase tracking-wider shadow-[2px_2px_0_0_var(--border)] hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[3px_3px_0_0_var(--border)]">
        <Link href={href}>
          عرض الكل
          <ArrowLeft className="mr-1.5 h-4 w-4" />
        </Link>
      </Button>
    </div>
  )
}
