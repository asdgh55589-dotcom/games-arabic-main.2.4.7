'use client'

import {
  CheckCircle,
  Clock,
  ExternalLink,
  FileText,
  Gamepad2,
  Heart,
  Link2,
  Loader2,
  Monitor,
  Plus,
  Send,
  Smartphone,
  Sparkles,
  Store,
  TrendingUp,
  User,
  X,
} from 'lucide-react'
import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/contexts/auth-context'
import { useToast } from '@/hooks/use-toast'
import { timeAgo } from '@/lib/format'

// ===== منصاتنا المدعومة — fallback مطابق للأقسام =====
const FALLBACK_PLATFORMS: { value: string; label: string; icon: React.ElementType }[] = [
  { value: 'PC', label: 'PC', icon: Monitor },
  { value: 'PS1', label: 'PlayStation 1', icon: Gamepad2 },
  { value: 'PS2', label: 'PlayStation 2', icon: Gamepad2 },
  { value: 'PS3', label: 'PlayStation 3', icon: Gamepad2 },
  { value: 'PS4', label: 'PlayStation 4', icon: Gamepad2 },
  { value: 'PS5', label: 'PlayStation 5', icon: Gamepad2 },
  { value: 'X360', label: 'Xbox 360', icon: Gamepad2 },
  { value: 'NS', label: 'Nintendo Switch', icon: Gamepad2 },
  { value: 'Android', label: 'Android', icon: Smartphone },
]

const LABEL_MAP: Record<string, string> = {
  PC: 'PC',
  PS1: 'PlayStation 1',
  PS2: 'PlayStation 2',
  PS3: 'PlayStation 3',
  PS4: 'PlayStation 4',
  PS5: 'PlayStation 5',
  X360: 'Xbox 360',
  NS: 'Nintendo Switch',
  Android: 'Android',
}

const EXCLUDED_PLATFORMS = new Set(['XONE', 'XSX', 'iOS'])

function resolvePlatformIcon(key: string): React.ElementType {
  const k = key.toLowerCase()
  if (k === 'android') return Smartphone
  if (k === 'pc') return Monitor
  return Gamepad2
}

function platformIcon(key: string): React.ElementType {
  const n = key.toLowerCase()
  if (n.includes('android') || n.includes('mobile')) return Smartphone
  if (n === 'pc') return Monitor
  return Gamepad2
}

function statusBadge(status: string) {
  switch (status) {
    case 'accepted':
      return (
        <Badge className="bg-amber-500 hover:bg-amber-600 text-white gap-1">
          <Clock className="h-3 w-3" /> جاري العمل
        </Badge>
      )
    case 'completed':
      return (
        <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white gap-1">
          <CheckCircle className="h-3 w-3" /> مكتمل
        </Badge>
      )
    default:
      return (
        <Badge variant="outline" className="gap-1">
          <Clock className="h-3 w-3" /> مفتوح
        </Badge>
      )
  }
}

function parseStoreLinks(r: { storeLinks?: string | null; storeLink?: string | null }): string[] {
  if (r.storeLinks) {
    try {
      const arr = JSON.parse(r.storeLinks)
      if (Array.isArray(arr)) return arr.filter((s) => typeof s === 'string' && s.trim())
    } catch {
      // biome-ignore lint/suspicious/noEmptyBlockStatements: best-effort request operation
    }
  }
  if (r.storeLink) return [r.storeLink]
  return []
}

interface RequestItem {
  id: string
  gameName: string
  platform: string
  storeLink: string | null
  storeLinks: string | null
  notes: string | null
  status: string
  interestCount: number
  createdAt: string
  user: { id: string; username: string; avatarUrl: string | null }
  acceptedUser?: { id: string; username: string; avatarUrl: string | null } | null
}

interface SearchResult {
  id: string
  gameName: string
  platform: string
  interestCount: number
  user: { username: string }
}

interface SectionOption {
  value: string
  label: string
  icon: React.ElementType
}

export default function RequestPage() {
  const { user } = useAuth()
  const { toast } = useToast()

  const [gameName, setGameName] = useState('')
  const [platform, setPlatform] = useState('')
  const [storeLinks, setStoreLinks] = useState<string[]>([''])
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [requests, setRequests] = useState<RequestItem[]>([])
  const [loading, setLoading] = useState(true)
  const [platformOptions, setPlatformOptions] = useState<SectionOption[]>(FALLBACK_PLATFORMS)

  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [searching, setSearching] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    fetch('/api/sections', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        const sections = json?.data as
          | Array<{ key: string; name: string; nameEn: string; icon: string }>
          | undefined
        if (sections && sections.length > 0) {
          const mapped: SectionOption[] = sections
            .filter((s) => !EXCLUDED_PLATFORMS.has(s.key))
            .map((s) => ({
              value: s.key,
              label:
                LABEL_MAP[s.key] ||
                s.nameEn?.replace(' Arabic', '') ||
                s.name.replace(' ARABIC', '') ||
                s.key,
              icon: resolvePlatformIcon(s.key),
            }))
          const existingKeys = new Set(mapped.map((m) => m.value))
          const missing = FALLBACK_PLATFORMS.filter(
            (f) => !existingKeys.has(f.value) && ['Android', 'PS5'].includes(f.value),
          )
          setPlatformOptions([...mapped, ...missing])
        }
      })
      .catch(() => {})
  }, [])

  const fetchRequests = useCallback(async () => {
    try {
      const res = await fetch('/api/mod-requests', { cache: 'no-store' })
      const json = await res.json()
      if (res.ok) setRequests(json.data?.requests || [])
    } catch {
      // biome-ignore lint/suspicious/noEmptyBlockStatements: best-effort request operation
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchRequests()
  }, [fetchRequests])

  const handleGameNameChange = (value: string) => {
    setGameName(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (value.trim().length < 2) {
      setShowSuggestions(false)
      setSearchResults([])
      return
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await fetch(`/api/mod-requests/search?q=${encodeURIComponent(value.trim())}`, {
          cache: 'no-store',
        })
        const json = await res.json()
        const list: SearchResult[] = json.data?.requests || []
        if (list.length > 0) {
          setSearchResults(list)
          setShowSuggestions(true)
        } else {
          setShowSuggestions(false)
          setSearchResults([])
        }
      } catch {
        setShowSuggestions(false)
      }
      setSearching(false)
    }, 400)
  }

  const handleLikeExisting = async (id: string) => {
    try {
      const res = await fetch(`/api/mod-requests/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'boost' }),
      })
      if (res.ok) {
        toast({ title: 'تم دعم الطلب بنجاح' })
        setSearchResults((prev) =>
          prev.map((r) => (r.id === id ? { ...r, interestCount: r.interestCount + 1 } : r)),
        )
        setRequests((prev) =>
          prev.map((r) => (r.id === id ? { ...r, interestCount: r.interestCount + 1 } : r)),
        )
      } else {
        const json = await res.json().catch(() => ({}))
        if (res.status === 401)
          toast({ title: 'يجب تسجيل الدخول لدعم الطلبات', variant: 'destructive' })
        else
          toast({
            title: json.error?.details || json.error?.message || 'فشل الدعم',
            variant: 'destructive',
          })
      }
    } catch {
      toast({ title: 'حدث خطأ', variant: 'destructive' })
    }
  }

  const addStoreLink = () => {
    if (storeLinks.length >= 5) {
      toast({ title: 'الحد الأقصى 5 روابط', variant: 'destructive' })
      return
    }
    setStoreLinks((prev) => [...prev, ''])
  }
  const removeStoreLink = (idx: number) => setStoreLinks((prev) => prev.filter((_, i) => i !== idx))
  const updateStoreLink = (idx: number, val: string) =>
    setStoreLinks((prev) => prev.map((v, i) => (i === idx ? val : v)))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!gameName.trim() || !platform.trim()) {
      toast({ title: 'يرجى ملء اسم اللعبة والمنصة', variant: 'destructive' })
      return
    }
    const links = storeLinks.map((s) => s.trim()).filter(Boolean)
    for (const link of links) {
      try {
        const u = new URL(link)
        if (!['http:', 'https:'].includes(u.protocol)) throw new Error('invalid')
      } catch {
        toast({ title: `رابط غير صحيح: ${link}`, variant: 'destructive' })
        return
      }
    }
    if (links.length > 5) {
      toast({ title: 'الحد الأقصى 5 روابط', variant: 'destructive' })
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/mod-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gameName: gameName.trim(),
          platform: platform.trim(),
          storeLinks: links.length > 0 ? links : undefined,
          notes: notes.trim() || undefined,
        }),
      })
      const json = await res.json()
      if (res.ok) {
        toast({ title: 'تم إرسال طلبك بنجاح' })
        setGameName('')
        setPlatform('')
        setStoreLinks([''])
        setNotes('')
        setShowSuggestions(false)
        setSearchResults([])
        fetchRequests()
      } else {
        toast({
          title: (json.error?.details as string) || json.error?.message || 'فشل',
          variant: 'destructive',
        })
      }
    } catch {
      toast({ title: 'حدث خطأ', variant: 'destructive' })
    }
    setSubmitting(false)
  }

  const handleBoost = async (id: string) => {
    try {
      const res = await fetch(`/api/mod-requests/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'boost' }),
      })
      if (res.ok) {
        setRequests((prev) =>
          prev.map((r) => (r.id === id ? { ...r, interestCount: r.interestCount + 1 } : r)),
        )
        toast({ title: 'تم دعم الطلب' })
      } else if (res.status === 401)
        toast({ title: 'يجب تسجيل الدخول لدعم الطلبات', variant: 'destructive' })
      else {
        const json = await res.json().catch(() => ({}))
        toast({
          title: json.error?.details || json.error?.message || 'فشل الدعم',
          variant: 'destructive',
        })
      }
    } catch {
      // biome-ignore lint/suspicious/noEmptyBlockStatements: best-effort request operation
    }
  }

  return (
    <div className="container mx-auto py-8 max-w-5xl px-4" dir="rtl">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 mb-4">
          <Gamepad2 className="h-7 w-7 text-primary" />
        </div>
        <h1 className="text-3xl font-bold mb-2">طلب تعريب</h1>
        <p className="text-muted-foreground max-w-xl mx-auto">
          اطلب تعريب لعبة تحبها — سيقوم المُعَرِّبون بمراجعة الطلبات الأكثر دعماً
        </p>
      </div>

      <div className="grid lg:grid-cols-5 gap-6">
        <div className="lg:col-span-2">
          <Card className="sticky top-20">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-base">
                <Send className="h-5 w-5 text-primary" /> تقديم طلب جديد
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!user ? (
                <div className="text-center py-8">
                  <p className="text-sm text-muted-foreground mb-4">يجب تسجيل الدخول لتقديم طلب</p>
                  <Link href="/login">
                    <Button>تسجيل الدخول</Button>
                  </Link>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="gameName" className="flex items-center gap-1.5">
                      <Gamepad2 className="h-4 w-4 text-muted-foreground" /> اسم اللعبة *
                    </Label>
                    <div className="relative">
                      <Input
                        id="gameName"
                        value={gameName}
                        onChange={(e) => handleGameNameChange(e.target.value)}
                        placeholder="مثال: The Witcher 3"
                        required
                        autoComplete="off"
                      />
                      {searching && (
                        <Loader2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                      )}
                    </div>
                    {showSuggestions && searchResults.length > 0 && (
                      <div className="border rounded-lg p-3 bg-muted/40 mt-2 space-y-2">
                        <p className="text-sm font-medium flex items-center gap-1.5">
                          <Sparkles className="h-4 w-4 text-primary" />
                          هذه اللعبة مطلوبة بالفعل! ادعمها بدلاً من إنشاء طلب جديد:
                        </p>
                        {searchResults.map((req) => (
                          <div
                            key={req.id}
                            className="flex items-center justify-between p-2 hover:bg-muted rounded-lg border bg-card"
                          >
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">{req.gameName}</p>
                              <p className="text-xs text-muted-foreground">
                                {req.platform} • بواسطة {req.user.username}
                              </p>
                            </div>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => handleLikeExisting(req.id)}
                              className="shrink-0 mr-2"
                            >
                              <Heart className="h-4 w-4 ml-1" /> ادعم ({req.interestCount})
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label className="flex items-center gap-1.5">
                      <Monitor className="h-4 w-4 text-muted-foreground" /> المنصة *
                    </Label>
                    <Select value={platform} onValueChange={setPlatform} required>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="اختر المنصة" />
                      </SelectTrigger>
                      <SelectContent>
                        {platformOptions.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            <span className="flex items-center gap-2">
                              <opt.icon className="h-4 w-4" /> {opt.label}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <Store className="h-3 w-3" /> المنصات مطابقة لأقسام الموقع الرسمية
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5">
                      <Link2 className="h-4 w-4 text-muted-foreground" /> روابط اللعبة على المتاجر
                      الرسمية
                    </Label>
                    <div className="space-y-2">
                      {storeLinks.map((link, idx) => (
                        <div key={idx} className="flex gap-2">
                          <div className="flex-1 relative">
                            <ExternalLink className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60 pointer-events-none" />
                            <Input
                              type="url"
                              value={link}
                              onChange={(e) => updateStoreLink(idx, e.target.value)}
                              placeholder={
                                idx === 0
                                  ? 'https://store.steampowered.com/app/...'
                                  : 'https://store.playstation.com/...'
                              }
                              dir="ltr"
                              className="pr-10 text-left"
                            />
                          </div>
                          {storeLinks.length > 1 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => removeStoreLink(idx)}
                              className="shrink-0"
                              aria-label="حذف الرابط"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                    {storeLinks.length < 5 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={addStoreLink}
                        className="w-full border-dashed"
                      >
                        <Plus className="h-4 w-4 ml-1" /> إضافة رابط آخر
                      </Button>
                    )}
                    <p className="text-[11px] text-muted-foreground">
                      اختياري — حتى 5 روابط: Steam, PlayStation Store, Xbox, Nintendo eShop, Epic...
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="notes" className="flex items-center gap-1.5">
                      <FileText className="h-4 w-4 text-muted-foreground" /> ملاحظات إضافية
                    </Label>
                    <Textarea
                      id="notes"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="أي تفاصيل إضافية تود إضافتها..."
                      rows={3}
                      className="resize-none"
                    />
                  </div>

                  <Button type="submit" disabled={submitting} className="w-full">
                    {submitting ? (
                      <Loader2 className="h-4 w-4 animate-spin ml-2" />
                    ) : (
                      <Send className="h-4 w-4 ml-2" />
                    )}
                    إرسال الطلب
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-3">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" /> الطلبات
              {requests.length > 0 && (
                <span className="text-sm font-normal text-muted-foreground">
                  ({requests.length})
                </span>
              )}
            </h2>
            {requests.length > 0 && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Sparkles className="h-3.5 w-3.5" /> مرتبة حسب الأكثر دعماً
              </span>
            )}
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : requests.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
                  <Gamepad2 className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground text-sm">
                  لا توجد طلبات حالياً — كن أول من يطلب تعريباً
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {requests.map((r) => {
                const PlatIcon = platformIcon(r.platform)
                const links = parseStoreLinks(r)
                return (
                  <Card key={r.id} className="hover:border-primary/30 transition-colors">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          <div className="p-2 bg-primary/10 rounded-lg shrink-0">
                            <Gamepad2 className="h-5 w-5 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-bold truncate">{r.gameName}</h3>
                              {statusBadge(r.status)}
                            </div>
                            <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1 flex-wrap">
                              <span className="flex items-center gap-1">
                                <PlatIcon className="h-4 w-4" /> {r.platform}
                              </span>
                              {links.length > 0 && (
                                <span className="flex items-center gap-1 flex-wrap">
                                  {links.map((lnk, i) => (
                                    <a
                                      key={i}
                                      href={lnk}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1 text-primary hover:underline text-xs bg-primary/5 px-1.5 py-0.5 rounded"
                                    >
                                      <ExternalLink className="h-3 w-3" /> متجر{' '}
                                      {links.length > 1 ? i + 1 : ''}
                                    </a>
                                  ))}
                                </span>
                              )}
                            </div>
                            {r.notes && (
                              <p className="text-sm mt-2 bg-muted/50 rounded-lg p-2.5 whitespace-pre-wrap break-words">
                                {r.notes}
                              </p>
                            )}
                            <div className="flex items-center gap-2 mt-2.5 text-xs text-muted-foreground flex-wrap">
                              <Avatar className="h-5 w-5">
                                <AvatarImage src={r.user.avatarUrl || undefined} />
                                <AvatarFallback className="text-[10px]">
                                  {r.user.username[0]?.toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <span>{r.user.username}</span>
                              <span>•</span>
                              <span>{timeAgo(r.createdAt)}</span>
                            </div>
                            {r.acceptedUser && (
                              <div className="mt-2">
                                <Badge variant="secondary" className="text-xs gap-1">
                                  <User className="h-3 w-3" /> جاري العمل بواسطة{' '}
                                  {r.acceptedUser.username}
                                </Badge>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col items-center gap-2 shrink-0">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleBoost(r.id)}
                            className="gap-1"
                            disabled={r.status === 'completed'}
                          >
                            <Heart className="h-4 w-4" /> {r.interestCount}
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
