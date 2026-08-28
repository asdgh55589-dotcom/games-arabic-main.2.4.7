// Updated for new API response format
import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import { Download, ExternalLink, Link2, Unlink, Search, ChevronLeft, Gamepad2, FolderOpen, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'
import { formatNumber } from '@/lib/format'
import { PLATFORMS } from '@/lib/constants'
import type { TeamMod } from './types'

interface ModWithGame {
  id: string
  name: string
  slug: string
  teamId: string | null
  downloads: number
  endorsements: number
  thumbnailUrl: string
  game: { id: string; name: string; slug: string; platform: string } | null
  category: { id: string; name: string; slug: string } | null
}

interface TeamModsTabProps {
  teamId: string
  mods: TeamMod[]
  onModsChange: (mods: TeamMod[]) => void
}

export function TeamModsTab({ teamId, mods, onModsChange }: TeamModsTabProps) {
  const { toast } = useToast()
  const [allMods, setAllMods] = useState<ModWithGame[]>([])
  const [loadingMods, setLoadingMods] = useState(true)
  const [selectedModId, setSelectedModId] = useState('')
  const [busy, setBusy] = useState(false)

  // Category-first filter state
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null)
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    setLoadingMods(true)
    fetch('/api/admin/mods?limit=500')
      .then((r) => { if (!r.ok) throw new Error('Failed'); return r.json() })
      .then((data) => setAllMods(data?.data || []))
      .catch(() => {})
      .finally(() => setLoadingMods(false))
  }, [])

  const unlinked = useMemo(() => allMods.filter((m) => !m.teamId), [allMods])

  // Derive games from unlinked mods
  const availableGames = useMemo(() => {
    const map = new Map<string, { id: string; name: string; platform: string; count: number }>()
    for (const m of unlinked) {
      if (!m.game) continue
      const existing = map.get(m.game.id)
      if (existing) {
        existing.count++
      } else {
        map.set(m.game.id, { id: m.game.id, name: m.game.name, platform: m.game.platform, count: 1 })
      }
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count)
  }, [unlinked])

  // Derive categories for selected game
  const availableCategories = useMemo(() => {
    if (!selectedPlatform) return []
    const gameMods = unlinked.filter((m) => m.game?.platform === selectedPlatform)
    const map = new Map<string, { id: string; name: string; count: number }>()
    for (const m of gameMods) {
      if (!m.category) continue
      const existing = map.get(m.category.id)
      if (existing) {
        existing.count++
      } else {
        map.set(m.category.id, { id: m.category.id, name: m.category.name, count: 1 })
      }
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count)
  }, [unlinked, selectedPlatform])

  // Filter mods based on selections
  const filteredMods = useMemo(() => {
    let result = unlinked
    if (selectedPlatform) {
      result = result.filter((m) => m.game?.platform === selectedPlatform)
    }
    if (selectedCategoryId) {
      result = result.filter((m) => m.category?.id === selectedCategoryId)
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase()
      result = result.filter((m) => m.name.toLowerCase().includes(q))
    }
    return result.slice(0, 100)
  }, [unlinked, selectedPlatform, selectedCategoryId, searchQuery])

  const step = selectedPlatform ? (selectedCategoryId ? 3 : 2) : 1

  const onLink = async () => {
    if (!selectedModId) return
    setBusy(true)
    try {
      const res = await fetch(`/api/admin/teams/${teamId}/mods`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ linkModId: selectedModId }),
      })
      if (!res.ok) throw new Error('فشل الربط')
      const mod = unlinked.find((m) => m.id === selectedModId)
      if (mod) {
        onModsChange([...mods, { id: mod.id, name: mod.name, slug: mod.slug, downloads: mod.downloads, endorsements: mod.endorsements, thumbnailUrl: mod.thumbnailUrl }])
        setAllMods((p) => p.map((m) => m.id === selectedModId ? { ...m, teamId } : m))
      }
      setSelectedModId('')
      toast({ title: 'تم الربط' })
    } catch (err) {
      toast({ title: 'خطأ', description: err instanceof Error ? err.message : 'فشل', variant: 'destructive' })
    } finally { setBusy(false) }
  }

  const onUnlink = async (modId: string) => {
    if (!confirm('هل أنت متأكد من فصل هذه التعريبة؟')) return
    setBusy(true)
    try {
      const res = await fetch(`/api/admin/teams/${teamId}/mods`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ unlinkModId: modId }),
      })
      if (!res.ok) throw new Error('فشل الفصل')
      const mod = mods.find((m) => m.id === modId)
      onModsChange(mods.filter((m) => m.id !== modId))
      if (mod) {
        setAllMods((p) => [{ id: mod.id, name: mod.name, slug: mod.slug, teamId: null, downloads: mod.downloads, endorsements: mod.endorsements, thumbnailUrl: mod.thumbnailUrl, game: null, category: null }, ...p])
      }
      toast({ title: 'تم الفصل' })
    } catch (err) {
      toast({ title: 'خطأ', description: err instanceof Error ? err.message : 'فشل', variant: 'destructive' })
    } finally { setBusy(false) }
  }

  const resetFilters = () => {
    setSelectedPlatform(null)
    setSelectedCategoryId(null)
    setSearchQuery('')
    setSelectedModId('')
  }

  return (
    <div className="space-y-6">
      {/* Linked mods */}
      <div>
        <h2 className="mb-3 text-sm font-bold">التعريبات المرتبطة ({mods.length})</h2>
        {mods.length === 0 ? (
          <p className="text-sm text-muted-foreground">لا توجد تعريبات مرتبطة بهذا الفريق.</p>
        ) : (
          <div className="space-y-2">
            {mods.map((mod) => (
              <div key={mod.id} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background/30 p-3">
                <div className="flex items-center gap-3">
                  {mod.thumbnailUrl ? (
                    <img src={mod.thumbnailUrl} alt="" className="h-10 w-16 rounded object-cover" />
                  ) : (
                    <span className="grid h-10 w-16 place-items-center rounded bg-muted text-xs text-muted-foreground">—</span>
                  )}
                  <div>
                    <Link href={`/admin/mods/${mod.id}/edit`} className="text-sm font-medium hover:underline">{mod.name}</Link>
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                      <Download className="h-3 w-3" /> {formatNumber(mod.downloads)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Link href={`/admin/mods/${mod.id}/edit`} className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground" title="فتح في الأدمن">
                    <ExternalLink className="h-4 w-4" />
                  </Link>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-red-400 hover:bg-red-500/10 min-h-[44px] min-w-[44px]" onClick={() => onUnlink(mod.id)} disabled={busy} title="فصل" aria-label="فصل">
                    <Unlink className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Link new mod — category-first flow */}
      <div className="rounded-xl border border-border bg-background/50 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold">ربط تعريبة جديدة</h2>
          {(selectedPlatform || selectedCategoryId || searchQuery) && (
            <Button variant="ghost" size="sm" onClick={resetFilters} className="h-7 text-xs min-h-[44px]">
              <X className="ml-1 h-3 w-3" /> مسح الفلتر
            </Button>
          )}
        </div>

        {/* Step indicators */}
        <div className="mb-4 flex items-center gap-2 text-xs text-muted-foreground">
          <span className={`flex items-center gap-1 ${step >= 1 ? 'text-primary font-medium' : ''}`}>
            <Gamepad2 className="h-3 w-3" /> المنصة
          </span>
          <ChevronLeft className="h-3 w-3 rotate-180" />
          <span className={`flex items-center gap-1 ${step >= 2 ? 'text-primary font-medium' : ''}`}>
            <FolderOpen className="h-3 w-3" /> القسم
          </span>
          <ChevronLeft className="h-3 w-3 rotate-180" />
          <span className={`flex items-center gap-1 ${step >= 3 ? 'text-primary font-medium' : ''}`}>
            <Search className="h-3 w-3" /> بحث
          </span>
        </div>

        {loadingMods ? (
          <p className="py-4 text-center text-xs text-muted-foreground">جاري تحميل التعريبات...</p>
        ) : (
          <>
            {/* Step 1: Platform */}
            <div className="mb-3">
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">اختر المنصة</label>
              <div className="flex flex-wrap gap-1.5">
                {PLATFORMS.map((p) => {
                  const count = unlinked.filter((m) => m.game?.platform === p.key).length
                  return (
                    <button
                      key={p.key}
                      onClick={() => {
                        setSelectedPlatform(selectedPlatform === p.key ? null : p.key)
                        setSelectedCategoryId(null)
                        setSearchQuery('')
                        setSelectedModId('')
                      }}
                      className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                        selectedPlatform === p.key
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border hover:border-primary/50 hover:text-foreground'
                      }`}
                    >
                      {p.arabicLabel}
                      <span className="text-[10px] text-muted-foreground">({count})</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Step 2: Category */}
            {selectedPlatform && availableCategories.length > 0 && (
              <div className="mb-3">
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">اختر القسم</label>
                <div className="flex flex-wrap gap-1.5">
                  {availableCategories.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => {
                        setSelectedCategoryId(selectedCategoryId === cat.id ? null : cat.id)
                        setSearchQuery('')
                        setSelectedModId('')
                      }}
                      className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                        selectedCategoryId === cat.id
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border hover:border-primary/50 hover:text-foreground'
                      }`}
                    >
                      {cat.name}
                      <span className="text-[10px] text-muted-foreground">({cat.count})</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Step 3: Search + results */}
            {selectedPlatform && (
              <div>
                <div className="relative mb-3">
                  <Search className="absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => { setSearchQuery(e.target.value); setSelectedModId('') }}
                    placeholder="ابحث عن تعريبة..."
                    className="w-full rounded-md border border-border bg-background pr-9 pl-3 py-2 text-sm"
                  />
                </div>

                {filteredMods.length === 0 ? (
                  <p className="py-4 text-center text-xs text-muted-foreground">
                    لا توجد تعريبات {selectedCategoryId ? 'في هذا القسم' : 'لهذه المنصة'}
                  </p>
                ) : (
                  <>
                    <p className="mb-2 text-xs text-muted-foreground">
                      {filteredMods.length} تعريبة متاحة — اختر واحدة للربط
                    </p>
                    <div className="max-h-64 space-y-1.5 overflow-y-auto">
                      {filteredMods.map((mod) => (
                        <label
                          key={mod.id}
                          className={`flex cursor-pointer items-center gap-3 rounded-lg border p-2.5 transition-colors ${
                            selectedModId === mod.id
                              ? 'border-primary bg-primary/5'
                              : 'border-border hover:border-primary/30 hover:bg-background/80'
                          }`}
                        >
                          <input
                            type="radio"
                            name="mod-select"
                            checked={selectedModId === mod.id}
                            onChange={() => setSelectedModId(mod.id)}
                            className="h-4 w-4 accent-primary"
                          />
                          {mod.thumbnailUrl ? (
                            <img src={mod.thumbnailUrl} alt="" className="h-8 w-12 rounded object-cover" />
                          ) : (
                            <span className="grid h-8 w-12 place-items-center rounded bg-muted text-[10px] text-muted-foreground">—</span>
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-medium">{mod.name}</div>
                            <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                              <span>{mod.game?.name}</span>
                              {mod.category && <span>· {mod.category.name}</span>}
                            </div>
                          </div>
                          <div className="shrink-0 text-[10px] text-muted-foreground">
                            <Download className="ml-0.5 inline h-3 w-3" /> {formatNumber(mod.downloads)}
                          </div>
                        </label>
                      ))}
                    </div>
                    <div className="mt-3 flex justify-end">
                      <Button size="sm" className="min-h-[44px]" onClick={onLink} disabled={!selectedModId || busy}>
                        <Link2 className="ml-1 h-3 w-3" /> ربط التعريبة
                      </Button>
                    </div>
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
