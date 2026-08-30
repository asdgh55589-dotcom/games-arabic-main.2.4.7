'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useFetch } from '@/hooks/use-fetch'
import { useDocumentTitle } from '@/hooks/use-document-title'
import { ModCard, ModCardSkeleton } from '@/components/mod-card'
import { HeroSlider } from '@/components/hero-slider'
import { HomeSidebar } from '@/components/home-sidebar'
import { AdSection } from '@/components/ad-section'
import { SiteTeamCard } from '@/components/site-team-card'
import { CreatorLeaderboardCard } from '@/components/creator-leaderboard-card'
import { NewsTicker } from '@/components/news-ticker'
import { NewsFeatured } from '@/components/news-featured'
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

const FALLBACK_SECTIONS: SectionItem[] = [
  { id: '1', slug: 'pc', name: 'PC ARABIC', nameEn: 'PC Arabic', key: 'PC', icon: 'PcIcon', color: '#66c0f4', order: 1 },
  { id: '2', slug: 'xbox-360', name: 'XBOX 360 ARABIC', nameEn: 'Xbox 360 Arabic', key: 'X360', icon: 'Xbox360Icon', color: '#107C10', order: 2 },
  { id: '3', slug: 'ns', name: 'NS ARABIC', nameEn: 'NS Arabic', key: 'NS', icon: 'NintendoSwitchIcon', color: '#E60012', order: 3 },
  { id: '4', slug: 'ps4', name: 'PS4 ARABIC', nameEn: 'PS4 Arabic', key: 'PS4', icon: 'PlayStationIcon', color: '#0070D1', order: 4 },
  { id: '5', slug: 'ps3', name: 'PS3 ARABIC', nameEn: 'PS3 Arabic', key: 'PS3', icon: 'PlayStationIcon', color: '#06b6d4', order: 5 },
  { id: '6', slug: 'ps2', name: 'PS2 ARABIC', nameEn: 'PS2 Arabic', key: 'PS2', icon: 'PlayStationIcon', color: '#6366f1', order: 6 },
  { id: '7', slug: 'ps1', name: 'PS1 ARABIC', nameEn: 'PS1 Arabic', key: 'PS1', icon: 'PlayStationIcon', color: '#94a3b8', order: 7 },
  { id: '8', slug: 'ps5', name: 'PS5 ARABIC', nameEn: 'PS5 Arabic', key: 'PS5', icon: 'PlayStationIcon', color: '#0E6FFF', order: 8 },
  { id: '9', slug: 'android', name: 'ANDROID ARABIC', nameEn: 'Android Arabic', key: 'ANDROID', icon: 'Smartphone', color: '#3DDC84', order: 9 },
]

export function HomePage() {
  useDocumentTitle(null)
  const { data, loading } = useFetch<{ data: HomeData }>('/api/home')
  const [sections, setSections] = useState<SectionItem[]>(FALLBACK_SECTIONS)

  const homeData = data?.data

  const { data: teamsData, loading: teamsLoading } = useFetch<{ data: TeamSummary[] }>('/api/teams')

  useEffect(() => {
    fetch('/api/sections')
      .then((r) => r.json())
      .then((json) => {
        if (json?.data && Array.isArray(json.data) && json.data.length > 0) {
          setSections(json.data)
        }
      })
      .catch(() => {})
  }, [])

  return (
    <div dir="rtl">
      <h1 className="sr-only">Arabic Games — تعريبات الألعاب</h1>
      {/* ===== Hero Slider — شريط متحرك يعرض أحدث التعريبات ===== */}
      {loading ? (
        <div className="h-[clamp(360px,52vh,580px)] w-full animate-pulse bg-secondary" />
      ) : homeData?.latestMods && homeData.latestMods.length > 0 ? (
        <HeroSlider slides={homeData.latestMods} />
      ) : null}

      {/* ===== شريط الأخبار — تحت البنر مباشرة ===== */}
      <NewsTicker />

      {/* ===== الصف الرئيسي: المحتوى + الشريط الجانبي ===== */}
      <div className="mx-auto flex max-w-[1600px] gap-8 py-4 px-4 lg:px-6" dir="rtl">
        {/* ===== اليمين: الإعلانات فوق + الشريط الجانبي تحت ===== */}
        <div className="w-[340px] shrink-0 space-y-4 -mr-[140px]">
          <AdSection />
          <SiteTeamCard />
          <CreatorLeaderboardCard />
          {loading ? (
            <div className="space-y-4">
              <div className="h-64 animate-pulse rounded-lg bg-secondary" />
              <div className="h-64 animate-pulse rounded-lg bg-secondary" />
              <div className="h-64 animate-pulse rounded-lg bg-secondary" />
            </div>
          ) : (
            <HomeSidebar
              latest={homeData?.latestMods || []}
              trending={homeData?.trendingMods || []}
              topEndorsed={homeData?.topEndorsed || []}
            />
          )}
        </div>

        {/* ===== المحتوى الرئيسي — في المنتصف ===== */}
        <div className="min-w-0 flex-1 space-y-8 -ml-[140px]">

      {/* آخر الأخبار — قبل أقسام المنصات */}
      {!loading && <NewsFeatured />}

      {/* أقسام المنصات — ديناميكي من قاعدة البيانات */}
      {(() => {
        let firstSectionRendered = false
        return sections.map((section) => {
          const mods = homeData?.modsByPlatform?.[section.key] || []
          const isEmpty = mods.length === 0
          // تم تعطيل الإخفاء — إظهار كل الأقسام حتى الفارغة (PS5/ANDROID) مع رسالة "لا توجد تعريبات"
          // const allEmpty = !loading && sections.every((s) => (homeData?.modsByPlatform?.[s.key] || []).length === 0)
          // if (isEmpty && !loading && !allEmpty) return null
          const showDivider = firstSectionRendered
          firstSectionRendered = true
          const Icon = getSectionIcon(section.icon)
          return (
            <section key={section.id} className={showDivider ? "pt-4" : "pt-2"}>
              <div className="mb-3 flex items-center justify-between border-b-[3px] border-border pb-3">
                <div className="flex items-center gap-2">
                  <div className="section-glow relative w-1 self-stretch rounded-full" style={{ backgroundColor: section.color, '--glow-color': section.color } as React.CSSProperties} />
                  <Icon width={20} height={20} color={section.color} />
                  <h2 className="text-2xl font-black uppercase tracking-wider text-foreground">
                    {section.name}
                  </h2>
                </div>
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="shrink-0 border-[2px] border-border font-bold uppercase tracking-wider shadow-[2px_2px_0_0_var(--border)] hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[3px_3px_0_0_var(--border)] platform-hover-btn min-h-[44px]"
                  style={{ '--platform-color': section.color } as React.CSSProperties}
                >
                  <Link href={`/platform/${section.key}`}>
                    عرض الكل <ArrowLeft className="mr-1.5 h-4 w-4" />
                  </Link>
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-4 sm:gap-5 sm:grid-cols-3 lg:grid-cols-5">
                {loading
                  ? Array.from({ length: 10 }).map((_, i) => <ModCardSkeleton key={i} />)
                  : isEmpty
                    ? <div className="col-span-full py-8 text-center text-sm text-muted-foreground">لا توجد تعريبات في هذا القسم بعد</div>
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
          href="/series"
        />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {loading
            ? Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-28 animate-pulse bg-secondary border-[3px] border-border" />
              ))
            : homeData?.topSeries?.slice(0, 6).map((s) => (
                <Link
                  key={s.name}
                  href={`/series/${encodeURIComponent(s.name)}`}
                  className="group relative flex h-28 flex-col justify-end overflow-hidden border-[3px] border-border bg-card p-3 shadow-[4px_4px_0_0_var(--border)] transition-all duration-150 hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[5px_5px_0_0_var(--border)]"
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

        {/* فرق التعريب */}
      <section className="pt-4">
        <div className="mb-6 h-[3px] bg-border" />
        <SectionHeader
          title="فرق التعريب"
          subtitle="استكشف الفرق والأعمال التي قدّموها"
          href="/teams"
        />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {teamsLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-28 animate-pulse bg-secondary border-[3px] border-border" />
            ))
          ) : teamsData?.data?.length ? (
            teamsData.data.slice(0, 6).map((t) => (
              <Link
                key={t.id}
                href={`/teams/${t.slug}`}
                className="group relative flex h-28 flex-col justify-end overflow-hidden border-[3px] border-border bg-card p-3 shadow-[4px_4px_0_0_var(--border)] transition-all duration-150 hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[5px_5px_0_0_var(--border)]"
              >
                {t.bannerUrl || t.logoUrl ? (
                  <img
                    src={t.bannerUrl || t.logoUrl}
                    alt=""
                    loading="lazy"
                    className="absolute inset-0 h-full w-full object-cover opacity-55 transition-opacity group-hover:opacity-75"
                  />
                ) : null}
                <div className="absolute inset-0 bg-gradient-to-t from-card via-card/55 to-transparent" />
                <div className="relative">
                  <h3 className="line-clamp-1 text-sm font-black uppercase tracking-wider text-foreground group-hover:text-primary">
                    {t.name}
                  </h3>
                  <p className="mt-0.5 text-xs font-semibold text-muted-foreground">
                    {formatNumber(t.modCount)} تعريب
                  </p>
                </div>
              </Link>
            ))
          ) : (
            <div className="col-span-full py-8 text-center text-sm text-muted-foreground">لا توجد فرق تعريب بعد</div>
          )}
        </div>
      </section>
        </div>

      </div>
    </div>
  )
}

function SectionHeader({ title, subtitle, href }: { title: string; subtitle: string; href: string }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-4 border-b-[3px] border-border pb-3">
      <div>
        <h2 className="text-2xl font-black uppercase tracking-wider">{title}</h2>
        <p className="mt-1 text-sm font-semibold text-muted-foreground">{subtitle}</p>
      </div>
      <Button asChild variant="outline" size="sm" className="shrink-0 border-[2px] border-border font-bold uppercase tracking-wider shadow-[2px_2px_0_0_var(--border)] hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[3px_3px_0_0_var(--border)] min-h-[44px]">
        <Link href={href}>
          عرض الكل
          <ArrowLeft className="mr-1.5 h-4 w-4" />
        </Link>
      </Button>
    </div>
  )
}
