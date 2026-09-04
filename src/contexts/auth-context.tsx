'use client'

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
  type ReactNode,
} from 'react'
import { usePathname } from 'next/navigation'
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

  const fetchUser = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await fetch('/api/auth/me', {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' },
      })
      const json = await res.json()
      setUser(json?.data?.user || null)
    } catch (err) {
      console.error('[auth] failed to fetch user:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  const refresh = useCallback(async () => {
    await fetchUser()
  }, [fetchUser])

  const logout = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/logout', { method: 'POST' })
      if (!res.ok) {
        throw new Error('Logout failed')
      }
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

  // Re-fetch auth state on route change (catches OAuth redirects, admin login redirects, etc.)
  useEffect(() => {
    if (hasInitialized.current && prevPathname.current !== pathname) {
      prevPathname.current = pathname
      fetchUser()
    }
    if (!hasInitialized.current) {
      hasInitialized.current = true
      prevPathname.current = pathname
    }
  }, [pathname, fetchUser])

  // Listen for visibility changes — re-fetch when tab becomes visible (catches OAuth popup flow)
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        fetchUser()
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
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
