'use client'

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'

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
      const data = await res.json()
      if (data.bookmarkedIds) {
        setBookmarkedIds(prev => {
          const next = new Set(prev)
          for (const id of data.bookmarkedIds) next.add(id)
          return next
        })
      }
    } catch {}
  }, [])

  // تسجيل modIds جديدة وجلبها
  const registerModIds = useCallback((modIds: string[]) => {
    setPendingIds(prev => {
      const next = new Set(prev)
      const newIds = modIds.filter(id => !bookmarkedIds.has(id) && !prev.has(id))
      for (const id of newIds) next.add(id)
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
