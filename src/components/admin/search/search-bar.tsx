'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'

interface SearchResult {
  id: string
  type: string
  title: string
  subtitle: string
  url: string
}

const TYPE_ICONS: Record<string, string> = {
  mod: '🎮',
  game: '🎯',
  team: '👥',
  user: '👤',
}

export function SearchBar() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  // Keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
      }
      if (e.key === 'Escape') {
        setShowDropdown(false)
        inputRef.current?.blur()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Search with debounce
  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([])
      setShowDropdown(false)
      return
    }

    const timer = setTimeout(async () => {
      setLoading(true)
      try {
        const response = await fetch(`/api/admin/search?q=${encodeURIComponent(query)}`)
        const data = await response.json()
        setResults(data.results?.slice(0, 10) || [])
        setShowDropdown(true)
      } catch (error) {
        console.error('Search failed:', error)
      } finally {
        setLoading(false)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [query])

  const handleSelect = (result: SearchResult) => {
    setShowDropdown(false)
    setQuery('')
    router.push(result.url)
  }

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setShowDropdown(true)}
          placeholder="بحث... ⌘K"
          className="pr-10 w-64"
          dir="rtl"
        />
        {query && (
          <button
            onClick={() => {
              setQuery('')
              setResults([])
              setShowDropdown(false)
            }}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {showDropdown && results.length > 0 && (
        <div className="absolute top-full mt-1 w-full bg-card border rounded-lg shadow-lg z-50 max-h-80 overflow-y-auto">
          {results.map((result) => (
            <button
              key={`${result.type}-${result.id}`}
              onClick={() => handleSelect(result)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted transition-colors text-right"
            >
              <span className="text-lg">{TYPE_ICONS[result.type]}</span>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate">{result.title}</div>
                <div className="text-xs text-muted-foreground truncate">{result.subtitle}</div>
              </div>
            </button>
          ))}
          <button
            onClick={() => router.push(`/admin/search?q=${encodeURIComponent(query)}`)}
            className="w-full px-4 py-3 text-center text-sm text-primary hover:bg-muted border-t"
          >
            عرض جميع النتائج
          </button>
        </div>
      )}
    </div>
  )
}
