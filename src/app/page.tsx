'use client'

import { useEffect, useState, Suspense, useRef } from 'react'
import dynamic from 'next/dynamic'
import { useSearchParams } from 'next/navigation'
import { Navbar } from '@/components/navbar'
import { Footer } from '@/components/footer'
import { ErrorBoundary } from '@/components/error-boundary'
import { ScrollToTop } from '@/components/scroll-to-top'
import { BookmarksProvider } from '@/contexts/bookmarks-context'
import type { GameSummary } from '@/lib/types'

// Lazy-loaded view components — code splitting
const HomePage = dynamic(() => import('@/views/home').then(m => ({ default: m.HomePage })), { loading: () => <ViewSkeleton /> })
const ModDetailPage = dynamic(() => import('@/views/mod-detail').then(m => ({ default: m.ModDetailPage })), { loading: () => <ViewSkeleton /> })
const SearchPage = dynamic(() => import('@/views/search').then(m => ({ default: m.SearchPage })), { loading: () => <ViewSkeleton /> })
const UploadPage = dynamic(() => import('@/views/upload').then(m => ({ default: m.UploadPage })), { loading: () => <ViewSkeleton /> })
const ProfilePage = dynamic(() => import('@/views/profile').then(m => ({ default: m.ProfilePage })), { loading: () => <ViewSkeleton /> })
const LoginPage = dynamic(() => import('@/views/login').then(m => ({ default: m.LoginPage })), { loading: () => <ViewSkeleton /> })
const SeriesPage = dynamic(() => import('@/views/series').then(m => ({ default: m.SeriesPage })), { loading: () => <ViewSkeleton /> })
const SeriesDetailPage = dynamic(() => import('@/views/series-detail').then(m => ({ default: m.SeriesDetailPage })), { loading: () => <ViewSkeleton /> })
const TranslationTeamsPage = dynamic(() => import('@/views/translation-teams').then(m => ({ default: m.TranslationTeamsPage })), { loading: () => <ViewSkeleton /> })
const TeamDetailPage = dynamic(() => import('@/views/team-detail').then(m => ({ default: m.TeamDetailPage })), { loading: () => <ViewSkeleton /> })
const PlatformPage = dynamic(() => import('@/views/platform').then(m => ({ default: m.PlatformPage })), { loading: () => <ViewSkeleton /> })
const SupportPage = dynamic(() => import('@/views/support').then(m => ({ default: m.SupportPage })), { loading: () => <ViewSkeleton /> })
const ExplorePage = dynamic(() => import('@/views/explore').then(m => ({ default: m.ExplorePage })), { loading: () => <ViewSkeleton /> })
const CommunityPage = dynamic(() => import('@/views/community').then(m => ({ default: m.CommunityPage })), { loading: () => <ViewSkeleton /> })
const AboutPage = dynamic(() => import('@/views/about').then(m => ({ default: m.AboutPage })), { loading: () => <ViewSkeleton /> })
const ProblemsPage = dynamic(() => import('@/views/problems').then(m => ({ default: m.ProblemsPage })), { loading: () => <ViewSkeleton /> })
const TermsPage = dynamic(() => import('@/views/terms').then(m => ({ default: m.TermsPage })), { loading: () => <ViewSkeleton /> })
const PrivacyPage = dynamic(() => import('@/views/privacy').then(m => ({ default: m.PrivacyPage })), { loading: () => <ViewSkeleton /> })
const NotificationsPage = dynamic(() => import('@/views/notifications').then(m => ({ default: m.NotificationsPage })), { loading: () => <ViewSkeleton /> })
const SettingsPage = dynamic(() => import('@/views/settings').then(m => ({ default: m.SettingsPage })), { loading: () => <ViewSkeleton /> })
const ComingSoonPage = dynamic(() => import('@/views/coming-soon').then(m => ({ default: m.ComingSoonPage })), { loading: () => <ViewSkeleton /> })

function ViewSkeleton() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  )
}

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
  | 'settings'

const KNOWN_VIEWS: ReadonlySet<string> = new Set<string>([
  'home', 'mod', 'search', 'upload', 'profile', 'login', 'register',
  'series', 'series-detail', 'teams', 'team-detail', 'platform', 'support', 'explore', 'community',
  'about', 'problems', 'terms', 'privacy', 'notifications', 'settings',
])

type NavGame = Pick<GameSummary, 'slug' | 'name' | 'thumbnailUrl' | 'modCount' | 'platform'>

function PageContent() {
  const searchParams = useSearchParams()
  const view = searchParams.get('view') || 'home'
  const isKnownView = KNOWN_VIEWS.has(view)

  const [navGames, setNavGames] = useState<NavGame[]>([])
  const [transitioning, setTransitioning] = useState(false)
  const prevViewRef = useRef(view)
  const mainRef = useRef<HTMLElement>(null)

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
    if (prevViewRef.current !== view) {
      setTransitioning(true)
      document.body.style.overflow = 'hidden'
      const timer = setTimeout(() => {
        setTransitioning(false)
        document.body.style.overflow = ''
      }, 150)
      prevViewRef.current = view
      return () => {
        clearTimeout(timer)
        document.body.style.overflow = ''
      }
    }
  }, [view])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (window.location.hash) return
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [view, searchParams.toString()])

  useEffect(() => {
    const handlePopState = () => {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  return (
    <BookmarksProvider>
    <div className="flex min-h-screen flex-col">
      <Navbar games={navGames} currentView={view} />
      <main ref={mainRef} className="flex-1">
        <ErrorBoundary label="this page">
          <div
            className="page-transition"
            style={{
              opacity: transitioning ? 0 : 1,
              transform: transitioning ? 'translateY(8px)' : 'translateY(0)',
              transition: 'opacity 0.15s ease-out, transform 0.15s ease-out',
            }}
          >
            {view === 'home' && <HomePage />}
            {view === 'mod' && <ModDetailPage />}
            {view === 'search' && <SearchPage />}
            {view === 'upload' && <UploadPage />}
            {view === 'profile' && <ProfilePage />}
            {view === 'login' && <LoginPage />}
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
            {view === 'settings' && <SettingsPage />}
            {view && !isKnownView && <ComingSoonPage title={view} />}
          </div>
        </ErrorBoundary>
      </main>
      <Footer />
      <ScrollToTop />
    </div>
    </BookmarksProvider>
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
