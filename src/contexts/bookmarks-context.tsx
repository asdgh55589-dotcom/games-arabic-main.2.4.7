'use client'

import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react'

interface BookmarksContextValue {
  bookmarkedIds: Set<string>
  isBookmarked: (modId: string) => boolean
  toggleBookmark: (modId: string) => void
  registerModIds: (modIds: string[]) => void
}

const BookmarksContext = createContext<BookmarksContextValue>({
  bookmarkedIds: new Set(),
  isBookmarked: () => false,
  toggleBookmark: () => {},
  registerModIds: () => {},
})

export function useBookmarks() {
  return useContext(BookmarksContext)
}

export function BookmarksProvider({ children }: { children: ReactNode }) {
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set())
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set())
  const registeredIdsRef = useRef<Set<string>>(new Set())

  // جلب الـ bookmarks للـ modIds المسجلة
  const fetchBookmarks = useCallback(async (modIds: string[]) => {
    if (modIds.length === 0) return
    try {
      const res = await fetch('/api/bookmarks/check-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modIds }),
      })
      if (!res.ok) return
      const { data } = await res.json()
      if (data?.bookmarkedIds) {
        setBookmarkedIds(prev => {
          const next = new Set(prev)
          for (const id of data.bookmarkedIds) next.add(id)
          return next
        })
      }
    } catch (error) {
      console.error('[bookmarks] failed to fetch:', error)
    }
  }, [])

  // تسجيل modIds جديدة وجلبها
  const registerModIds = useCallback((modIds: string[]) => {
    // Filter out already registered IDs using ref
    const newIds = modIds.filter(id => !registeredIdsRef.current.has(id))
    if (newIds.length === 0) return

    // Mark as registered immediately
    for (const id of newIds) {
      registeredIdsRef.current.add(id)
    }

    setPendingIds(prev => {
      const next = new Set(prev)
      const idsToAdd = newIds.filter(id => !bookmarkedIds.has(id) && !prev.has(id))
      for (const id of idsToAdd) next.add(id)
      return next
    })
  }, [bookmarkedIds])

  // جلب الـ pending IDs عند تغيرها
  useEffect(() => {
    if (pendingIds.size === 0) return
    const ids = Array.from(pendingIds)
    setPendingIds(new Set())
    fetchBookmarks(ids)
  }, [pendingIds, fetchBookmarks])

  // toggle bookmark محلياً
  const toggleBookmark = useCallback((modId: string) => {
    setBookmarkedIds(prev => {
      const next = new Set(prev)
      if (next.has(modId)) {
        next.delete(modId)
      } else {
        next.add(modId)
      }
      return next
    })
  }, [])

  const isBookmarked = useCallback((modId: string) => bookmarkedIds.has(modId), [bookmarkedIds])

  return (
    <BookmarksContext.Provider value={{ bookmarkedIds, isBookmarked, toggleBookmark, registerModIds }}>
      {children}
    </BookmarksContext.Provider>
  )
}
