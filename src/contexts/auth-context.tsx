'use client'

import { usePathname } from 'next/navigation'
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useToast } from '@/hooks/use-toast'
import type { SessionUser } from '@/lib/auth'

interface AuthContextValue {
  user: SessionUser | null
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  error: null,
  refresh: async () => {},
  logout: async () => {},
})

/** SWR freshness window for /api/auth/me responses. */
const AUTH_SWR_TTL_MS = 30_000
/** Abort slow auth fetches instead of hanging the UI. */
const AUTH_FETCH_TIMEOUT_MS = 5_000
/** Ignore visibility flaps faster than this (quick tab switches). */
const VISIBILITY_DEBOUNCE_MS = 2_000

export function useAuth() {
  return useContext(AuthContext)
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()
  const pathname = usePathname()
  const prevPathname = useRef(pathname)
  const hasInitialized = useRef(false)
  // SWR-style client cache: fresh data (<30s) is reused, stale data is
  // revalidated in the background without flashing a loading state.
  const cacheRef = useRef<{ data: SessionUser | null; timestamp: number } | null>(null)
  const inFlightRef = useRef<Promise<void> | null>(null)

  const fetchUser = useCallback(async (opts?: { background?: boolean }) => {
    // Dedupe concurrent callers (pathname + visibility can fire together).
    if (inFlightRef.current) {
      await inFlightRef.current
      return
    }
    const cached = cacheRef.current
    if (cached && Date.now() - cached.timestamp < AUTH_SWR_TTL_MS) {
      setUser((prev) => {
        // Skip state churn when identity is unchanged.
        if (prev?.id === cached.data?.id) return prev
        return cached.data
      })
      setLoading(false)
      return
    }
    const run = (async () => {
      try {
        if (!opts?.background) setLoading(true)
        setError(null)
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), AUTH_FETCH_TIMEOUT_MS)
        try {
          const res = await fetch('/api/auth/me', {
            cache: 'no-store',
            headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' },
            signal: controller.signal,
          })
          const json = await res.json()
          const nextUser = (json?.data?.user || null) as SessionUser | null
          setUser((prev) => {
            if (prev?.id === nextUser?.id && prev?.role === nextUser?.role) return prev
            return nextUser
          })
          cacheRef.current = { data: nextUser, timestamp: Date.now() }
        } finally {
          clearTimeout(timeout)
        }
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          setError('timeout')
        } else {
          console.error('[auth] failed to fetch user:', err)
          setError(err instanceof Error ? err.message : 'Unknown error')
        }
        setUser(null)
      } finally {
        setLoading(false)
      }
    })()
    inFlightRef.current = run
    try {
      await run
    } finally {
      inFlightRef.current = null
    }
  }, [])

  const refresh = useCallback(async () => {
    // Explicit refresh (e.g. after login/logout) bypasses the SWR cache.
    cacheRef.current = null
    await fetchUser()
  }, [fetchUser])

  const logout = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/logout', { method: 'POST' })
      if (!res.ok) {
        throw new Error('Logout failed')
      }
      cacheRef.current = null
      setUser(null)
    } catch (err) {
      console.error('[auth] logout failed:', err)
      toast({
        title: 'خطأ',
        description: 'فشل تسجيل الخروج',
        variant: 'destructive',
      })
    }
  }, [toast])

  // Fetch on mount
  useEffect(() => {
    fetchUser()
  }, [fetchUser])

  // Re-validate auth state on route change in the background (catches OAuth
  // redirects, admin login redirects, etc.) — SWR cache absorbs the storm.
  useEffect(() => {
    if (hasInitialized.current && prevPathname.current !== pathname) {
      prevPathname.current = pathname
      fetchUser({ background: true })
    }
    if (!hasInitialized.current) {
      hasInitialized.current = true
      prevPathname.current = pathname
    }
  }, [pathname, fetchUser])

  // Re-validate when the tab becomes visible (catches OAuth popup flow),
  // debounced so quick tab switches don't each fire a request.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null
    let lastRefetch = 0
    const handleVisibility = () => {
      if (document.visibilityState !== 'visible') return
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        const now = Date.now()
        if (now - lastRefetch < VISIBILITY_DEBOUNCE_MS) return
        lastRefetch = now
        fetchUser({ background: true })
      }, VISIBILITY_DEBOUNCE_MS)
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
      if (timer) clearTimeout(timer)
    }
  }, [fetchUser])

  const value = useMemo(
    () => ({
      user,
      loading,
      error,
      refresh,
      logout,
    }),
    [user, loading, error, refresh, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
