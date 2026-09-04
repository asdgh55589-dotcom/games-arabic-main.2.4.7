'use client'

import { useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Search, Filter } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

const TYPE_LABELS: Record<string, string> = {
  mod: 'تعريب',
  game: 'لعبة',
  team: 'فريق',
  user: 'مستخدم',
}

const TYPE_COLORS: Record<string, string> = {
  mod: 'bg-blue-100 text-blue-800',
  game: 'bg-green-100 text-green-800',
  team: 'bg-purple-100 text-purple-800',
  user: 'bg-gray-100 text-gray-800',
}

interface SearchResult {
  id: string
  type: string
  title: string
  subtitle: string
  url: string
  highlight: string
  metadata: Record<string, any>
  relevance: number
}

export default function SearchPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [query, setQuery] = useState(searchParams.get('q') || '')
  const [results, setResults] = useState<SearchResult[]>([])
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(false)
  const [activeFilter, setActiveFilter] = useState('all')

  const doSearch = async () => {
    if (!query || query.trim().length < 2) return
    setLoading(true)
    try {
      const params = new URLSearchParams({ q: query })
      if (activeFilter !== 'all') params.set('type', activeFilter)
      const response = await fetch(`/api/admin/search?${params}`)
      const data = await response.json()
      setResults(data.results || [])
      setCounts(data.counts || {})
    } catch (error) {
      console.error('Search failed:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const q = searchParams.get('q')
    if (q) {
      setQuery(q)
      setTimeout(doSearch, 100)
    }
  }, [searchParams.get('q')])

  useEffect(() => {
    doSearch()
  }, [activeFilter])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    router.push(`/admin/search?q=${encodeURIComponent(query)}`)
    doSearch()
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">بحث متقدم</h1>

      {/* Search Input */}
      <form onSubmit={handleSearch} className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ابحث عن تعريبات، ألعاب، فرق، مستخدمين..."
            className="pr-10"
            dir="rtl"
          />
        </div>
        <Button type="submit">بحث</Button>
      </form>

      {/* Type Filters */}
      <div className="flex gap-2 flex-wrap">
        {[
          { key: 'all', label: 'الكل', count: Object.values(counts).reduce((a, b) => a + b, 0) },
          { key: 'mod', label: 'تعريبات', count: counts.mod || 0 },
          { key: 'game', label: 'ألعاب', count: counts.game || 0 },
          { key: 'team', label: 'فرق', count: counts.team || 0 },
          { key: 'user', label: 'مستخدمين', count: counts.user || 0 },
        ].map(({ key, label, count }) => (
          <Button
            key={key}
            variant={activeFilter === key ? 'default' : 'outline'}
            size="sm"
            className="min-h-[44px]"
            onClick={() => setActiveFilter(key)}
          >
            {label}
            {count > 0 && (
              <Badge variant="secondary" className="mr-2 text-xs">
                {count}
              </Badge>
            )}
          </Button>
        ))}
      </div>

      {/* Results */}
      {loading ? (
        <div className="text-center py-8 text-muted-foreground">جاري البحث...</div>
      ) : results.length > 0 ? (
        <div className="space-y-2">
          {results.map((result) => (
            <Link
              key={`${result.type}-${result.id}`}
              href={result.url}
              className="block p-4 rounded-lg border hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-start gap-3">
                <Badge className={TYPE_COLORS[result.type]}>{TYPE_LABELS[result.type]}</Badge>
                <div className="flex-1 min-w-0">
                  <div className="font-medium">{result.title}</div>
                  <div className="text-sm text-muted-foreground mt-1">{result.subtitle}</div>
                  {result.highlight && (
                    <div className="text-xs text-muted-foreground mt-2 line-clamp-2">
                      {result.highlight}
                    </div>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">{result.relevance}%</div>
              </div>
            </Link>
          ))}
        </div>
      ) : query ? (
        <div className="text-center py-8 text-muted-foreground">لا توجد نتائج لـ "{query}"</div>
      ) : (
        <div className="text-center py-8 text-muted-foreground">
          ابدأ البحث عن التعريبات والألعاب والفرق
        </div>
      )}
    </div>
  )
}
