'use client'

import * as React from 'react'
import { ar } from './ar'
import { en } from './en'
import type { StudioDict, StudioDir, StudioLocale } from './types'

const STORAGE_KEY = 'studio-locale'

interface StudioLanguageValue {
  locale: StudioLocale
  dir: StudioDir
  dict: StudioDict
  setLocale: (locale: StudioLocale) => void
  /** Locale-aware number grouping (ar-EG Eastern-Arabic digits / en-US). */
  formatNumber: (n: number) => string
  /** Locale-aware short month/day (charts, cards). */
  formatShortDate: (value: string | Date) => string
}

const StudioLanguageContext =
  React.createContext<StudioLanguageValue | null>(null)

function readStoredLocale(): StudioLocale {
  try {
    const v = window.localStorage.getItem(STORAGE_KEY)
    return v === 'en' ? 'en' : 'ar'
  } catch {
    return 'ar'
  }
}

export function StudioLanguageProvider({
  children,
}: {
  children: React.ReactNode
}) {
  // 'ar' on first render (matches SSR) — stored value applied in effect
  // to avoid hydration mismatch for opt-in EN users.
  const [locale, setLocaleState] = React.useState<StudioLocale>('ar')

  React.useEffect(() => {
    setLocaleState(readStoredLocale())
  }, [])

  const setLocale = React.useCallback((next: StudioLocale) => {
    setLocaleState(next)
    try {
      window.localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // private mode — locale simply won't persist
    }
    // Mirror to a cookie so server components (stats/settings pages,
    // generateMetadata) can render the same locale. No sensitive data.
    try {
      document.cookie = `${STORAGE_KEY}=${next}; path=/; max-age=31536000; SameSite=Lax`
    } catch {
      // ignore
    }
  }, [])

  const value = React.useMemo<StudioLanguageValue>(() => {
    const tag = locale === 'ar' ? 'ar-EG' : 'en-US'
    return {
      locale,
      dir: locale === 'ar' ? 'rtl' : 'ltr',
      dict: locale === 'ar' ? ar : en,
      setLocale,
      formatNumber: (n: number) => n.toLocaleString(tag),
      formatShortDate: (value: string | Date) =>
        new Date(value).toLocaleDateString(tag, {
          month: 'short',
          day: 'numeric',
        }),
    }
  }, [locale, setLocale])

  return (
    <StudioLanguageContext.Provider value={value}>
      {children}
    </StudioLanguageContext.Provider>
  )
}

export function useStudioLanguage(): StudioLanguageValue {
  const ctx = React.useContext(StudioLanguageContext)
  if (!ctx) {
    throw new Error('useStudioLanguage must be used within StudioLanguageProvider')
  }
  return ctx
}
