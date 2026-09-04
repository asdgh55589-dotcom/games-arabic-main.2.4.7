'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import type { DuplicateMatch } from '@/lib/duplicate-detection'

interface DuplicateCheckProps {
  gameId: string
  teamId?: string
  title: string
  titleAr: string
  fileHash?: string
  excludeModId?: string
  onOverride?: (reason: string) => void
}

interface DuplicateCheckResult {
  isDuplicate: boolean
  confidence: number
  matches: DuplicateMatch[]
}

export function DuplicateChecker({
  gameId,
  teamId,
  title,
  titleAr,
  fileHash,
  excludeModId,
  onOverride,
}: DuplicateCheckProps) {
  const [result, setResult] = useState<DuplicateCheckResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [showOverride, setShowOverride] = useState(false)
  const [overrideReason, setOverrideReason] = useState('')
  const [overridden, setOverridden] = useState(false)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  const checkDuplicate = useCallback(async () => {
    if (!gameId || !title) {
      setResult(null)
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/admin/mods/check-duplicate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gameId,
          teamId,
          title,
          titleAr,
          fileHash,
          excludeModId,
        }),
      })
      const data = await response.json()
      setResult(data)
    } catch (error) {
      console.error('Duplicate check failed:', error)
    } finally {
      setLoading(false)
    }
  }, [gameId, teamId, title, titleAr, fileHash, excludeModId])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(checkDuplicate, 500)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [checkDuplicate])

  const handleOverride = () => {
    setOverridden(true)
    setShowOverride(false)
    onOverride?.(overrideReason)
  }

  if (!gameId || !title) return null

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground p-3 rounded-lg border border-dashed">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <span>جاري فحص التكرار...</span>
      </div>
    )
  }

  if (!result) return null

  if (!result.isDuplicate) {
    return (
      <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400 p-3 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
        <CheckCircle2 className="h-4 w-4" />
        <span>لا توجد تكرارات</span>
      </div>
    )
  }

  const isExact = result.matches.some((m) => m.matchType === 'exact')

  return (
    <div
      className={`p-3 rounded-lg border ${
        isExact && !overridden
          ? 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800'
          : 'bg-yellow-50 dark:bg-yellow-950/30 border-yellow-200 dark:border-yellow-800'
      }`}
    >
      <div className="flex items-start gap-2">
        {isExact && !overridden ? (
          <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
        ) : (
          <Info className="h-4 w-4 text-yellow-600 dark:text-yellow-400 mt-0.5 shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <div
            className={`text-sm font-medium ${
              isExact && !overridden
                ? 'text-red-800 dark:text-red-200'
                : 'text-yellow-800 dark:text-yellow-200'
            }`}
          >
            {isExact && !overridden ? 'تكرار مؤكد' : 'تكرار محتمل'}
            <Badge variant="outline" className="mr-2 text-xs">
              {result.confidence}% تطابق
            </Badge>
          </div>
          <ul className="mt-2 space-y-1">
            {result.matches.slice(0, 5).map((match) => (
              <li key={match.modId} className="text-sm flex items-center gap-2">
                <Badge variant="secondary" className="text-xs">
                  {match.matchType === 'exact'
                    ? 'مطابق'
                    : match.matchType === 'similar_name'
                      ? 'اسم مشابه'
                      : 'ملف مطابق'}
                </Badge>
                <span className="truncate">{match.modTitle}</span>
                <span className="text-xs text-muted-foreground">({match.similarity}%)</span>
              </li>
            ))}
          </ul>

          {overridden ? (
            <div className="mt-2 text-xs text-green-700 dark:text-green-300 flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" />
              تم التجاوز
            </div>
          ) : (
            <div className="mt-2 flex gap-2">
              {!showOverride ? (
                <button
                  type="button"
                  onClick={() => setShowOverride(true)}
                  className="text-xs text-muted-foreground hover:text-foreground underline"
                >
                  تجاوز التكرار
                </button>
              ) : (
                <div className="flex-1 space-y-2">
                  <Textarea
                    value={overrideReason}
                    onChange={(e) => setOverrideReason(e.target.value)}
                    placeholder="سبب التجاوز..."
                    className="text-xs min-h-[60px]"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleOverride}
                      disabled={!overrideReason}
                      className="text-xs px-2 py-1 rounded bg-primary text-primary-foreground disabled:opacity-50"
                    >
                      تأكيد
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowOverride(false)}
                      className="text-xs px-2 py-1 rounded border"
                    >
                      إلغاء
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => setResult(null)}
          className="text-muted-foreground hover:text-foreground shrink-0"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
