'use client'

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'

interface SettingsData {
  site_name?: string
  meta_title?: string
  meta_description?: string
  og_image?: string
  og_locale?: string
  og_type?: string
  site_url?: string
  theme_color?: string
  telegram?: string
  youtube?: string
  twitter?: string
  google_analytics_id?: string
  [key: string]: string | undefined
}

interface SettingsContextValue {
  settings: SettingsData
  loading: boolean
  error: string | null
}

const SettingsContext = createContext<SettingsContextValue>({
  settings: {},
  loading: true,
  error: null,
})

export function useSettings() {
  return useContext(SettingsContext)
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<SettingsData>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await fetch('/api/settings', {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' },
      })
      if (!res.ok) {
        throw new Error('Failed to fetch settings')
      }
      const data = await res.json()
      setSettings(data?.data?.settings || {})
    } catch (err) {
      console.error('[settings] failed to fetch:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSettings()
  }, [fetchSettings])

  const value = useMemo(
    () => ({
      settings,
      loading,
      error,
    }),
    [settings, loading, error],
  )

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
}
