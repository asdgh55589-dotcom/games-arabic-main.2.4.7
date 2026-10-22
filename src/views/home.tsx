'use client'

import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { useEffect, useRef, useState } from 'react'
import { CreatorLeaderboardCard } from '@/components/creator-leaderboard-card'
import { ErrorBoundary } from '@/components/error-boundary'
import { HeroSlider } from '@/components/hero-slider'
import { HomeSidebar } from '@/components/home-sidebar'
import { ModCard, ModCardSkeleton } from '@/components/mod-card'
import { NewsFeatured } from '@/components/news-featured'
import { NewsTicker } from '@/components/news-ticker'
import { SiteTeamCard } from '@/components/site-team-card'
import { Button } from '@/components/ui/button'
import { useDocumentTitle } from '@/hooks/use-document-title'
import { useFetch } from '@/hooks/use-fetch'
import { formatNumber } from '@/lib/format'
import { reportError } from '@/lib/error-reporting'
import { HOME_TEAMS_STALE_MS, normalizeHomeData } from '@/lib/home-data'
import { getSectionIcon } from '@/lib/section-icons'
import type { HomeData, ModSummary } from '@/lib/types'
import { HomeMobile } from './home-mobile'

// Section 4 item 24: ads pull sanitize-html (~150KB) and are below-fold +
// client-fetched — keep them out of the first-paint bundle.
const AdSection = dynamic(() => import('@/components/ad-section').then((m) => m.AdSection), {
  ssr: false,
})

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
  {
    id: '1',
    slug: 'pc',
    name: 'PC ARABIC',
    nameEn: 'PC Arabic',
    key: 'PC',
    icon: 'PcIcon',
    color: '#66c0f4',
    order: 1,
  },
  {
    id: '2',
    slug: 'xbox-360',
    name: 'XBOX 360 ARABIC',
    nameEn: 'Xbox 360 Arabic',
    key: 'X360',
    icon: 'Xbox360Icon',
    color: '#107C10',
    order: 2,
  },
  {
    id: '3',
    slug: 'ns',
    name: 'NS ARABIC',
    nameEn: 'NS Arabic',
    key: 'NS',
    icon: 'NintendoSwitchIcon',
    color: '#E60012',
    order: 3,
  },
  {
    id: '4',
    slug: 'ps4',
    name: 'PS4 ARABIC',
    nameEn: 'PS4 Arabic',
    key: 'PS4',
    icon: 'PlayStationIcon',
    color: '#0070D1',
    order: 4,
  },
  {
    id: '5',
    slug: 'ps3',
    name: 'PS3 ARABIC',
    nameEn: 'PS3 Arabic',
    key: 'PS3',
    icon: 'PlayStationIcon',
    color: '#06b6d4',
    order: 5,
  },
  {
    id: '6',
    slug: 'ps2',
    name: 'PS2 ARABIC',
    nameEn: 'PS2 Arabic',
    key: 'PS2',
    icon: 'PlayStationIcon',
    color: '#6366f1',
    order: 6,
  },
  {
    id: '7',
    slug: 'ps1',
    name: 'PS1 ARABIC',
    nameEn: 'PS1 Arabic',
    key: 'PS1',
    icon: 'PlayStationIcon',
    color: '#94a3b8',
    order: 7,
  },
  {
    id: '8',
    slug: 'ps5',
    name: 'PS5 ARABIC',
    nameEn: 'PS5 Arabic',
    key: 'PS5',
    icon: 'PlayStationIcon',
    color: '#0E6FFF',
    order: 8,
  },
  {
    id: '9',
    slug: 'android',
    name: 'ANDROID ARABIC',
    nameEn: 'Android Arabic',
    key: 'ANDROID',
    icon: 'Smartphone',
    color: '#3DDC84',
    order: 9,
  },
]

export function HomePage() {
  useDocumentTitle(null)
  const {
    data,
    loading,
    error: homeError,
    showSkeleton,
    refetch: refetchHome,
  } = useFetch<{ data: HomeData }>('/api/home')
  const [sections, setSections] = useState<SectionItem[]>(FALLBACK_SECTIONS)
  const [sectionsLoading, setSectionsLoading] = useState(true)

  // Fix 1 (LEDA-14): coerce nullable/malformed payloads to safe defaults —
  // downstream `.length` / `.slice` / `.map` calls can never crash.
  const homeData = normalizeHomeData(data?.data)
  const sidebarRef = useRef<HTMLDivElement>(null)

  // R11 — نفس الأرقام كانت تُعرض مرتين: مرة داخل بطاقات أقسام المنصات
  // ومرة داخل الشريط الجانبي (latest / trending / topEndorsed). نحسب هنا
  // مجموعة المودات التي تُعرض فعلاً في الشبكات — بنفس منطق العرض
  // (`modsByPlatform[section.key].slice(0, 10)`) — ونستبعدها من الشريط.
  const gridModIds = (() => {
    const ids = new Set<string>()
    for (const section of sections) {
      const mods = homeData?.modsByPlatform?.[section.key] || []
      for (const m of mods.slice(0, 10)) ids.add(m.id)
    }
    return ids
  })()

  // عمود فارغ أسوأ من تكرار — فلو استبعدنا كل عناصر عمود نرجّع القائمة كاملة.
  const withoutGridDuplicates = (list: ModSummary[]) => {
    if (list.length === 0 || gridModIds.size === 0) return list
    const filtered = list.filter((m) => !gridModIds.has(m.id))
    return filtered.length > 0 ? filtered : list
  }

  // Fix 2 (LEDA-14): surface fetch failures instead of failing silently.
  useEffect(() => {
    if (homeError) {
      reportError(new Error(homeError), { route: 'home', action: 'load-home' })
    }
  }, [homeError])

  // Fix 4 (LEDA-14): the critical /api/home request goes first; teams and
  // sections wait until it settles so one slow query cannot starve the rest.
  const homeSettled = !loading

  // Sticky متأخر: يقيس طول الشريط الفعلي ويظبط نقطة الوقفة تلقائياً —
  // لو الشريط أطول من الشاشة يقف عند آخر قسم، ولو أقصر يقف تحت النافبار.
  useEffect(() => {
    const el = sidebarRef.current
    if (!el) return
    const update = () => {
      const top = Math.min(60, window.innerHeight - el.offsetHeight - 16)
      el.style.top = `${top}px`
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    window.addEventListener('resize', update)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', update)
    }
  }, [])

  // Fix 5 (LEDA-14): teams are semi-static — serve a 5-min SWR cache entry
  // instantly and revalidate in the background (see use-fetch staleMs).
  const {
    data: teamsData,
    loading: teamsLoading,
    error: teamsError,
    refetch: refetchTeams,
  } = useFetch<{ data: TeamSummary[] }>(homeSettled ? '/api/teams' : null, [], {
    staleMs: HOME_TEAMS_STALE_MS,
  })
  const teams = Array.isArray(teamsData?.data) ? teamsData.data : undefined

  useEffect(() => {
    // Fix 3 (LEDA-14): sections fetch now tracks loading state with
    // cancellation, and waits for the critical home payload first (Fix 4).
    // FALLBACK_SECTIONS keep rendering meanwhile, so this only drives
    // aria-busy + the mobile loading state — never a layout flash.
    if (!homeSettled) return
    let cancelled = false
    setSectionsLoading(true)
    fetch('/api/sections')
      .then((r) => r.json())
      .then((json) => {
        if (cancelled) return
        if (json?.data && Array.isArray(json.data) && json.data.length > 0) {
          setSections(json.data)
        }
      })
      .catch((err: unknown) => {
        // fallback sections stay visible — log the failure
        reportError(err, { route: 'home', action: 'load-sections' })
      })
      .finally(() => {
        if (!cancelled) setSectionsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [homeSettled])

  return (
    <>
      <div className="hidden lg:block">
        <div dir="rtl" className="overflow-x-clip">
          <h1 className="sr-only">Arabic Games — تعريبات الألعاب</h1>
          {/* Fix 2 (LEDA-14): failures are announced with a retry action
              instead of rendering an endless/empty page silently. */}
          {homeError && !loading ? (
            <div
              role="alert"
              className="mx-auto flex max-w-[1840px] flex-wrap items-center justify-center gap-3 px-4 pt-4 text-center"
            >
              <p className="text-sm font-bold text-destructive">
                {homeData
                  ? 'تعذر تحديث المحتوى — قد تكون البيانات المعروضة قديمة'
                  : 'تعذر تحميل محتوى الصفحة — تحقق من الاتصال وحاول مجدداً'}
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetchHome()}
                className="min-h-[44px] font-bold"
              >
                إعادة المحاولة
              </Button>
            </div>
          ) : null}
          {/* ===== Hero Slider — شريط متحرك يعرض أحدث التعريبات ===== */}
          {showSkeleton ? (
            <div className="h-[clamp(360px,52vh,580px)] w-full animate-pulse bg-secondary" />
          ) : homeData?.latestMods && homeData.latestMods.length > 0 ? (
            <ErrorBoundary label="hero slider" fallback={null}>
              <HeroSlider slides={homeData.latestMods} />
            </ErrorBoundary>
          ) : null}

          {/* ===== شريط الأخبار — تحت البنر مباشرة ===== */}
          <ErrorBoundary label="news ticker" fallback={null}>
            <NewsTicker />
          </ErrorBoundary>

          {/* ===== الصف الرئيسي: المحتوى + الشريط الجانبي ===== */}
          <div
            className="mx-auto flex max-w-[1840px] flex-col gap-6 py-4 px-4 lg:flex-row lg:gap-6 lg:px-4"
            dir="rtl"
          >
            {/* ===== اليمين: الشريط الجانبي (sticky متأخر — نقطة الوقفة تُحسب تلقائياً) ===== */}
            <div
              ref={sidebarRef}
              className="order-2 w-full space-y-4 lg:order-1 lg:w-[340px] lg:shrink-0 lg:sticky lg:top-[60px] lg:self-start"
            >
              <ErrorBoundary label="ad section" fallback={null}>
                <AdSection />
              </ErrorBoundary>
              <ErrorBoundary label="site team card" fallback={null}>
                <SiteTeamCard />
              </ErrorBoundary>
              <ErrorBoundary label="creator leaderboard" fallback={null}>
                <CreatorLeaderboardCard />
              </ErrorBoundary>
              {showSkeleton ? (
                <div className="space-y-4">
                  <div className="h-64 animate-pulse rounded-lg bg-secondary" />
                  <div className="h-64 animate-pulse rounded-lg bg-secondary" />
                  <div className="h-64 animate-pulse rounded-lg bg-secondary" />
                </div>
              ) : (
                <ErrorBoundary label="home sidebar" fallback={null}>
                  <HomeSidebar
                    latest={withoutGridDuplicates(homeData?.latestMods || [])}
                    trending={withoutGridDuplicates(homeData?.trendingMods || [])}
                    topEndorsed={withoutGridDuplicates(homeData?.topEndorsed || [])}
                  />
                </ErrorBoundary>
              )}
            </div>

            {/* ===== المحتوى الرئيسي — في المنتصف ===== */}
            <div
              className="order-1 min-w-0 flex-1 space-y-8 lg:order-2"
              aria-busy={sectionsLoading}
            >
              {/* آخر الأخبار — قبل أقسام المنصات */}
              {!loading && (
                <ErrorBoundary label="featured news" fallback={null}>
                  <NewsFeatured />
                </ErrorBoundary>
              )}

              {/* أقسام المنصات — ديناميكي من قاعدة البيانات */}
              {(() => {
                let firstSectionRendered = false
                return sections.map((section) => {
                  const mods = homeData?.modsByPlatform?.[section.key] || []
                  const isEmpty = mods.length === 0
                  // إخفاء القسم الفارغ — لو ما فيش حاجة منشورة في القسم ما يظهرش
                  if (isEmpty && !loading) return null
                  const showDivider = firstSectionRendered
                  firstSectionRendered = true
                  const Icon = getSectionIcon(section.icon)
                  return (
                    <section key={section.id} className={showDivider ? 'pt-4' : 'pt-2'}>
                      <div className="mb-3 flex items-center justify-between border-b-[3px] border-border pb-3">
                        <div className="flex items-center gap-2">
                          <div
                            className="section-glow relative w-1 self-stretch rounded-full"
                            style={
                              {
                                backgroundColor: section.color,
                                '--glow-color': section.color,
                              } as React.CSSProperties
                            }
                          />
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
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-4 lg:grid-cols-5 lg:gap-5">
                        {showSkeleton ? (
                          Array.from({ length: 10 }).map((_, i) => <ModCardSkeleton key={i} />)
                        ) : isEmpty ? (
                          <div className="col-span-full py-8 text-center text-sm text-muted-foreground">
                            لا توجد تعريبات في هذا القسم بعد
                          </div>
                        ) : (
                          mods.slice(0, 10).map((m) => <ModCard key={m.id} mod={m} />)
                        )}
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
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4">
                  {loading
                    ? Array.from({ length: 6 }).map((_, i) => (
                        <div
                          key={i}
                          className="h-24 animate-pulse bg-secondary border-[3px] border-border sm:h-28"
                        />
                      ))
                    : homeData?.topSeries?.slice(0, 6).map((s) => (
                        <ErrorBoundary key={s.name} label="series card" fallback={null}>
                          <Link
                            href={`/series/${encodeURIComponent(s.name)}`}
                          className="group relative flex h-24 flex-col justify-end overflow-hidden border-[3px] border-border bg-card p-3 shadow-[4px_4px_0_0_var(--border)] transition-all duration-150 hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[5px_5px_0_0_var(--border)] sm:h-28"
                        >
                          {s.thumbnailUrl ? (
                            <img
                              src={s.thumbnailUrl}
                              alt=""
                              loading="lazy"
                              className="absolute inset-0 h-full w-full object-cover opacity-55 transition-opacity group-hover:opacity-75"
                            />
                          ) : null}
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
                        </ErrorBoundary>
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
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4">
                  {teamsLoading && !teams?.length ? (
                    Array.from({ length: 4 }).map((_, i) => (
                      <div
                        key={i}
                        className="h-24 animate-pulse bg-secondary border-[3px] border-border sm:h-28"
                      />
                    ))
                  ) : teams?.length ? (
                    teams.slice(0, 6).map((t) => (
                      <ErrorBoundary key={t.id} label="team card" fallback={null}>
                        <Link
                          href={`/teams/${t.slug}`}
                        className="group relative flex h-24 flex-col justify-end overflow-hidden border-[3px] border-border bg-card p-3 shadow-[4px_4px_0_0_var(--border)] transition-all duration-150 hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[5px_5px_0_0_var(--border)] sm:h-28"
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
                      </ErrorBoundary>
                    ))
                  ) : teamsError ? (
                    <div role="alert" className="col-span-full space-y-2 py-8 text-center text-sm">
                      <p className="text-muted-foreground">تعذر تحميل فرق التعريب</p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => refetchTeams()}
                        className="min-h-[44px] font-bold"
                      >
                        إعادة المحاولة
                      </Button>
                    </div>
                  ) : (
                    <div className="col-span-full py-8 text-center text-sm text-muted-foreground">
                      لا توجد فرق تعريب بعد
                    </div>
                  )}
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>
      <HomeMobile
        homeData={homeData ?? undefined}
        teams={teams}
        sections={sections}
        loading={loading}
        teamsLoading={teamsLoading}
        teamsError={teamsError}
        sectionsLoading={sectionsLoading}
      />
    </>
  )
}

function SectionHeader({
  title,
  subtitle,
  href,
}: {
  title: string
  subtitle: string
  href: string
}) {
  return (
    <div className="mb-3 flex items-end justify-between gap-4 border-b-[3px] border-border pb-3">
      <div>
        <h2 className="text-2xl font-black uppercase tracking-wider">{title}</h2>
        <p className="mt-1 text-sm font-semibold text-muted-foreground">{subtitle}</p>
      </div>
      <Button
        asChild
        variant="outline"
        size="sm"
        className="shrink-0 border-[2px] border-border font-bold uppercase tracking-wider shadow-[2px_2px_0_0_var(--border)] hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[3px_3px_0_0_var(--border)] min-h-[44px]"
      >
        <Link href={href}>
          عرض الكل
          <ArrowLeft className="mr-1.5 h-4 w-4" />
        </Link>
      </Button>
    </div>
  )
}
