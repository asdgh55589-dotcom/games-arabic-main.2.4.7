'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Navbar } from '@/components/navbar'
import { Footer } from '@/components/footer'
import { ErrorBoundary } from '@/components/error-boundary'
import { HomePage } from '@/views/home'
import { ModDetailPage } from '@/views/mod-detail'
import { SearchPage } from '@/views/search'
import { UploadPage } from '@/views/upload'
import { ProfilePage } from '@/views/profile'
import { LoginPage } from '@/views/login'
import { RegisterPage } from '@/views/register'
import { SeriesPage } from '@/views/series'
import { SeriesDetailPage } from '@/views/series-detail'
import { TranslationTeamsPage } from '@/views/translation-teams'
import { TeamDetailPage } from '@/views/team-detail'
import { PlatformPage } from '@/views/platform'
import { SupportPage } from '@/views/support'
import { ExplorePage } from '@/views/explore'
import { CommunityPage } from '@/views/community'
import { AboutPage } from '@/views/about'
import { ProblemsPage } from '@/views/problems'
import { TermsPage } from '@/views/terms'
import { PrivacyPage } from '@/views/privacy'
import { ComingSoonPage } from '@/views/coming-soon'
import { NotificationsPage } from '@/views/notifications'
import type { GameSummary } from '@/lib/types'

type View =
  | 'home'
  | 'mod'
  | 'search'
  | 'upload'
  | 'profile'
  | 'login'
  | 'register'
  | 'series'
  | 'series-detail'
  | 'teams'
  | 'team-detail'
  | 'platform'
  | 'support'
  | 'explore'
  | 'community'
  | 'about'
  | 'problems'
  | 'terms'
  | 'privacy'
  | 'notifications'

const KNOWN_VIEWS: ReadonlySet<string> = new Set<string>([
  'home', 'mod', 'search', 'upload', 'profile', 'login', 'register',
  'series', 'series-detail', 'teams', 'team-detail', 'platform', 'support', 'explore', 'community',
  'about', 'problems', 'terms', 'privacy', 'notifications',
])

/** Games list shown in the navbar — only the fields the navbar needs. */
type NavGame = Pick<GameSummary, 'slug' | 'name' | 'thumbnailUrl' | 'modCount' | 'platform'>

function PageContent() {
  const searchParams = useSearchParams()
  const view = searchParams.get('view') || 'home'
  const isKnownView = KNOWN_VIEWS.has(view)

  const [navGames, setNavGames] = useState<NavGame[]>([])

  useEffect(() => {
    let cancelled = false
    fetch('/api/games?sort=mods&limit=20')
      .then((r) => r.json())
      .then((d: { games: GameSummary[] }) => {
        if (cancelled) return
        setNavGames(d.games || [])
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (window.location.hash) return
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
  }, [view, searchParams.toString()])

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar games={navGames} />
      <main className="flex-1">
        <ErrorBoundary label="this page">
          {view === 'home' && <HomePage />}
          {view === 'mod' && <ModDetailPage />}
          {view === 'search' && <SearchPage />}
          {view === 'upload' && <UploadPage />}
          {view === 'profile' && <ProfilePage />}
          {view === 'login' && <LoginPage />}
          {view === 'register' && <RegisterPage />}
          {view === 'series' && <SeriesPage />}
          {view === 'series-detail' && <SeriesDetailPage />}
          {view === 'teams' && <TranslationTeamsPage />}
          {view === 'team-detail' && <TeamDetailPage />}
          {view === 'platform' && <PlatformPage />}
          {view === 'support' && <SupportPage />}
          {view === 'explore' && <ExplorePage />}
          {view === 'community' && <CommunityPage />}
          {view === 'about' && <AboutPage />}
          {view === 'problems' && <ProblemsPage />}
          {view === 'terms' && <TermsPage />}
          {view === 'privacy' && <PrivacyPage />}
          {view === 'notifications' && <NotificationsPage />}
          {view && !isKnownView && <ComingSoonPage title={view} />}
        </ErrorBoundary>
      </main>
      <Footer />
    </div>
  )
}

export default function Home() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent" aria-label="Loading" />
        </div>
      }
    >
      <PageContent />
    </Suspense>
  )
}
