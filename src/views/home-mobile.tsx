'use client'

import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { HeroSlider } from '@/components/hero-slider'
import { ModCard, ModCardSkeleton } from '@/components/mod-card'
import { NewsFeatured } from '@/components/news-featured'
// Sidebar blocks removed for phone — kept in desktop home.tsx
import { NewsTicker } from '@/components/news-ticker'
import { Button } from '@/components/ui/button'
import { formatNumber } from '@/lib/format'
import { getSectionIcon } from '@/lib/section-icons'
import type { HomeData } from '@/lib/types'

interface SectionItem {
  id: string
  slug: string
  name: string
  nameEn: string
  key: string
  icon: string
  color: string
  order: number
}

interface TeamSummary {
  id: string
  slug: string
  name: string
  logoUrl: string
  bannerUrl: string
  modCount: number
}

interface HomeMobileProps {
  homeData?: HomeData
  teams?: TeamSummary[]
  sections: SectionItem[]
  loading: boolean
  teamsLoading?: boolean
}

export function HomeMobile({ homeData, teams, sections, loading, teamsLoading }: HomeMobileProps) {
  return (
    <div className="lg:hidden" dir="rtl">
      <h1 className="sr-only">Arabic Games — تعريبات الألعاب</h1>

      {/* 1. HeroSlider (compact) */}
      {loading ? (
        <div className="h-[300px] w-full animate-pulse bg-secondary" />
      ) : homeData?.latestMods && homeData.latestMods.length > 0 ? (
        <div className="[&_.h-\[clamp\(360px\,52vh\,580px\)\]]:h-[300px] [&_.h-\[clamp\(360px\,52vh\,580px\)\]]:min-h-[300px]">
          <HeroSlider slides={homeData.latestMods} />
        </div>
      ) : null}

      {/* 2. NewsTicker */}
      <NewsTicker />

      {/* 3. NewsFeatured */}
      {!loading && (
        <div className="px-3 py-4">
          <NewsFeatured />
        </div>
      )}

      {/* 4. Platform sections — الشكل العادي: 3 بطاقات، بطاقة واحدة في الصف */}
      <div className="space-y-6 px-3 py-2">
        {sections.map((section) => {
          const mods = homeData?.modsByPlatform?.[section.key] || []
          const isEmpty = mods.length === 0
          const Icon = getSectionIcon(section.icon)
          return (
            <section key={section.id} className="pt-2">
              <div className="mb-3 flex items-center justify-between border-b-[2px] border-border pb-2">
                <div className="flex items-center gap-1.5">
                  <div
                    className="section-glow relative w-1 self-stretch rounded-full"
                    style={
                      {
                        backgroundColor: section.color,
                        '--glow-color': section.color,
                      } as React.CSSProperties
                    }
                  />
                  <Icon width={16} height={16} color={section.color} />
                  <h2 className="text-base font-black uppercase tracking-wider text-foreground">
                    {section.name}
                  </h2>
                </div>
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="h-7 shrink-0 border-[2px] border-border px-2 text-xs font-bold uppercase tracking-wider shadow-[2px_2px_0_0_var(--border)] hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[3px_3px_0_0_var(--border)] platform-hover-btn touch-manipulation"
                  style={{ '--platform-color': section.color } as React.CSSProperties}
                >
                  <Link href={`/platform/${section.key}`}>
                    عرض الكل <ArrowLeft className="mr-1 h-3 w-3" />
                  </Link>
                </Button>
              </div>
              <div className="grid grid-cols-1 gap-2">
                {loading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <ModCardSkeleton key={i} variant="compact" />
                  ))
                ) : isEmpty ? (
                  <div className="col-span-full py-6 text-center text-xs text-muted-foreground">
                    لا توجد تعريبات في هذا القسم بعد
                  </div>
                ) : (
                  mods.slice(0, 3).map((m) => <ModCard key={m.id} mod={m} variant="compact" />)
                )}
              </div>
            </section>
          )
        })}
      </div>

      {/* 5. Series grid — الشكل العادي: 3 بطاقات، واحدة في الصف */}
      <section className="px-3 pt-4">
        <div className="mb-4 h-[2px] bg-border" />
        <div className="mb-3 flex items-end justify-between gap-3 border-b-[2px] border-border pb-2">
          <div>
            <h2 className="text-base font-black uppercase tracking-wider">سلاسل التعريبات</h2>
            <p className="mt-0.5 text-xs font-semibold text-muted-foreground">
              استكشف التعريبات حسب السلسلة
            </p>
          </div>
          <Button
            asChild
            variant="outline"
            size="sm"
            className="h-7 shrink-0 border-[2px] border-border px-2 text-xs font-bold uppercase tracking-wider shadow-[2px_2px_0_0_var(--border)] touch-manipulation"
          >
            <Link href="/series">
              عرض الكل <ArrowLeft className="mr-1 h-3 w-3" />
            </Link>
          </Button>
        </div>
        <div className="grid grid-cols-1 gap-2">
          {loading
            ? Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="h-24 animate-pulse bg-secondary border-[2px] border-border"
                />
              ))
            : homeData?.topSeries?.slice(0, 3).map((s) => (
                <Link
                  key={s.name}
                  href={`/series/${encodeURIComponent(s.name)}`}
                  className="group relative flex h-24 flex-col justify-end overflow-hidden border-[2px] border-border bg-card p-2.5 shadow-[2px_2px_0_0_var(--border)]"
                >
                  {s.thumbnailUrl ? (
                    <img
                      src={s.thumbnailUrl}
                      alt=""
                      loading="lazy"
                      className="absolute inset-0 h-full w-full object-cover opacity-55"
                    />
                  ) : null}
                  <div className="absolute inset-0 bg-gradient-to-t from-card via-card/55 to-transparent" />
                  <div className="relative">
                    <h3 className="line-clamp-1 text-xs font-black uppercase tracking-wider text-foreground">
                      {s.name}
                    </h3>
                    <p className="mt-0.5 text-[11px] font-semibold text-muted-foreground">
                      {formatNumber(s.count)} تعريب
                    </p>
                  </div>
                </Link>
              ))}
        </div>
      </section>

      {/* 6. Teams grid — الشكل العادي: 3 بطاقات، واحدة في الصف */}
      <section className="px-3 pt-4 pb-2">
        <div className="mb-4 h-[2px] bg-border" />
        <div className="mb-3 flex items-end justify-between gap-3 border-b-[2px] border-border pb-2">
          <div>
            <h2 className="text-base font-black uppercase tracking-wider">فرق التعريب</h2>
            <p className="mt-0.5 text-xs font-semibold text-muted-foreground">
              استكشف الفرق والأعمال التي قدّموها
            </p>
          </div>
          <Button
            asChild
            variant="outline"
            size="sm"
            className="h-7 shrink-0 border-[2px] border-border px-2 text-xs font-bold uppercase tracking-wider shadow-[2px_2px_0_0_var(--border)] touch-manipulation"
          >
            <Link href="/teams">
              عرض الكل <ArrowLeft className="mr-1 h-3 w-3" />
            </Link>
          </Button>
        </div>
        <div className="grid grid-cols-1 gap-2">
          {teamsLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-24 animate-pulse bg-secondary border-[2px] border-border" />
            ))
          ) : teams?.length ? (
            teams.slice(0, 3).map((t) => (
              <Link
                key={t.id}
                href={`/teams/${t.slug}`}
                className="group relative flex h-24 flex-col justify-end overflow-hidden border-[2px] border-border bg-card p-2.5 shadow-[2px_2px_0_0_var(--border)]"
              >
                {t.bannerUrl || t.logoUrl ? (
                  <img
                    src={t.bannerUrl || t.logoUrl}
                    alt=""
                    loading="lazy"
                    className="absolute inset-0 h-full w-full object-cover opacity-55"
                  />
                ) : null}
                <div className="absolute inset-0 bg-gradient-to-t from-card via-card/55 to-transparent" />
                <div className="relative">
                  <h3 className="line-clamp-1 text-xs font-black uppercase tracking-wider text-foreground">
                    {t.name}
                  </h3>
                  <p className="mt-0.5 text-[11px] font-semibold text-muted-foreground">
                    {formatNumber(t.modCount)} تعريب
                  </p>
                </div>
              </Link>
            ))
          ) : (
            <div className="col-span-full py-6 text-center text-xs text-muted-foreground">
              لا توجد فرق تعريب بعد
            </div>
          )}
        </div>
      </section>

      {/* 7. Sidebar blocks — محذوفة للتليفون بس (تبقى في الديسكتوب) */}
    </div>
  )
}
