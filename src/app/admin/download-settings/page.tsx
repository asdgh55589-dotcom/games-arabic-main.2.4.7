'use client'

// صفحة الإدارة "إدارة روابط التحميل" — ثلاث تبويبات:
// أ) خدمات التخزين الموثوقة (عرض/إضافة/تعديل/حذف/حفظ + إعادة ترتيب + فاحص رابط)
// ب) مواقع التحميل المتوافقة (CRUD ضد /api/compatible-sites + فاحص رابط)
// ج) الرسائل والتنبيهات (محرر رسالة الإعلانات الحالي + بطاقات "قريباً" placeholder)
import {
  ArrowDown,
  ArrowUp,
  Globe,
  Link2,
  Loader2,
  Pencil,
  Plus,
  Save,
  Search,
  ShieldCheck,
  Trash2,
  TriangleAlert,
  X,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { DataTableSkeleton } from '@/components/ui/data-skeleton'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { ApiError, apiFetch } from '@/lib/api-client'
import {
  brandLogoUrl,
  isCompatibleSiteUrl,
  isTrustedDownloadUrl,
} from '@/lib/download-trust'

interface HostService {
  name: string
  domains: string[]
  logoUrl?: string
}

// موقع متوافق كما يرجع من GET العام (بدون enabled/order) + حقول محلية اختيارية
interface CompatibleSiteItem {
  id: string
  name: string
  domains: string[]
  logoUrl?: string | null
  notes?: string | null
  enabled?: boolean
  order?: number
}

export default function AdminDownloadSettingsPage() {
  const { toast } = useToast()
  const [services, setServices] = useState<HostService[]>([])
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDomains, setNewDomains] = useState('')
  const [tab, setTab] = useState('storage')

  // فاحص رابط التخزين الموثوق
  const [checkUrl, setCheckUrl] = useState('')
  const [checkResult, setCheckResult] = useState<
    { kind: 'trusted'; serviceName: string } | { kind: 'untrusted' } | null
  >(null)

  // مواقع التحميل المتوافقة
  const [sites, setSites] = useState<CompatibleSiteItem[]>([])
  const [sitesLoading, setSitesLoading] = useState(true)
  const [newSiteName, setNewSiteName] = useState('')
  const [newSiteDomains, setNewSiteDomains] = useState('')
  const [newSiteNotes, setNewSiteNotes] = useState('')
  const [addingSite, setAddingSite] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editDomains, setEditDomains] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [editEnabled, setEditEnabled] = useState(true)
  const [editOrder, setEditOrder] = useState(0)
  const [savingSite, setSavingSite] = useState(false)
  const [siteCheckUrl, setSiteCheckUrl] = useState('')
  const [siteCheckResult, setSiteCheckResult] = useState<
    { kind: 'found'; site: CompatibleSiteItem } | { kind: 'not-found' } | null
  >(null)

  // تحميل إعدادات التخزين الموثوقة + رسالة التحذير
  useEffect(() => {
    apiFetch<{ data: { services: HostService[]; warningMessage: string } }>(
      '/api/download-settings',
    )
      .then((json) => {
        setServices(json.data.services || [])
        setMessage(json.data.warningMessage || '')
      })
      .catch((err) => {
        toast({
          title: 'خطأ',
          description: err instanceof Error ? err.message : 'فشل تحميل الإعدادات',
          variant: 'destructive',
        })
      })
      .finally(() => setLoading(false))
  }, [toast])

  // تحميل المواقع المتوافقة من GET العام
  useEffect(() => {
    apiFetch<{ data: CompatibleSiteItem[] }>('/api/compatible-sites')
      .then((json) => {
        const list = Array.isArray(json.data) ? json.data : []
        setSites(
          list.map((s, i) => ({
            ...s,
            enabled: s.enabled ?? true,
            order: typeof s.order === 'number' ? s.order : i,
          })),
        )
      })
      .catch(() => {
        // الفشل لا يكسر الصفحة — نعرض قائمة فارغة
        setSites([])
      })
      .finally(() => setSitesLoading(false))
  }, [])

  const updateService = (idx: number, patch: Partial<HostService>) => {
    setServices((prev) => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)))
  }

  const removeService = (idx: number) => {
    setServices((prev) => prev.filter((_, i) => i !== idx))
  }

  // تحريك خدمة لأعلى/لأسفل قبل الحفظ
  const moveService = (idx: number, dir: -1 | 1) => {
    setServices((prev) => {
      const next = [...prev]
      const j = idx + dir
      if (j < 0 || j >= next.length) return prev
      const tmp = next[idx]
      next[idx] = next[j]
      next[j] = tmp
      return next
    })
  }

  const addService = () => {
    const name = newName.trim()
    const domains = newDomains
      .split(',')
      .map((d) => d.trim().toLowerCase())
      .filter(Boolean)
    if (!name || domains.length === 0) {
      toast({
        title: 'بيانات ناقصة',
        description: 'أدخل اسم الخدمة ونطاقاً واحداً على الأقل (افصل بين النطاقات بفاصلة)',
        variant: 'destructive',
      })
      return
    }
    setServices((prev) => [...prev, { name, domains }])
    setNewName('')
    setNewDomains('')
  }

  // حفظ الخدمات + رسالة التحذير (نفس الـ PUT الحالي)
  const save = async () => {
    if (saving) return
    setSaving(true)
    try {
      const json = await apiFetch<{ data: { services: HostService[]; warningMessage: string } }>(
        '/api/download-settings',
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            services: services.map((s) => ({
              name: s.name,
              domains: Array.isArray(s.domains) ? s.domains : String(s.domains ?? '').split(','),
              logoUrl: s.logoUrl || '',
            })),
            warningMessage: message,
          }),
        },
      )
      setServices(json.data.services || [])
      setMessage(json.data.warningMessage || '')
      toast({ title: 'تم الحفظ', description: 'تم تحديث قائمة الروابط الموثوقة والرسالة' })
    } catch (err) {
      toast({
        title: 'خطأ',
        description:
          err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'فشل الحفظ',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  // فاحص رابط التخزين: يفحص عبر isTrustedDownloadUrl ضد القائمة الحالية
  const runTrustCheck = () => {
    const url = checkUrl.trim()
    if (!url) {
      toast({ title: 'أدخل رابطاً للفحص', variant: 'destructive' })
      return
    }
    const trusted = isTrustedDownloadUrl(url, services)
    if (!trusted) {
      setCheckResult({ kind: 'untrusted' })
      return
    }
    // إيجاد اسم الخدمة المطابقة لعرضها
    let foundName = ''
    try {
      const host = new URL(url).hostname.toLowerCase()
      outer: for (const s of services) {
        for (const raw of s.domains || []) {
          const d = String(raw).trim().toLowerCase().replace(/^\*\./, '')
          if (!d) continue
          if (host === d || host.endsWith(`.${d}`)) {
            foundName = s.name
            break outer
          }
        }
      }
    } catch {
      foundName = ''
    }
    setCheckResult({ kind: 'trusted', serviceName: foundName || 'خدمة موثوقة' })
  }

  // إضافة موقع متوافق (POST)
  const addSite = async () => {
    const name = newSiteName.trim()
    const domainsRaw = newSiteDomains.trim()
    if (!name || !domainsRaw) {
      toast({ title: 'بيانات ناقصة', description: 'أدخل اسم الموقع والنطاقات', variant: 'destructive' })
      return
    }
    if (newSiteNotes.length > 2000) {
      toast({ title: 'الملاحظات طويلة', description: 'حتى 2000 حرف فقط', variant: 'destructive' })
      return
    }
    setAddingSite(true)
    try {
      const json = await apiFetch<{ data: CompatibleSiteItem }>('/api/compatible-sites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          domains: domainsRaw,
          notes: newSiteNotes.trim() || null,
        }),
      })
      const created = json.data
      setSites((prev) => [...prev, { ...created, enabled: true, order: prev.length }])
      setNewSiteName('')
      setNewSiteDomains('')
      setNewSiteNotes('')
      toast({ title: 'تمت الإضافة', description: `تمت إضافة ${created.name}` })
    } catch (err) {
      toast({
        title: 'خطأ',
        description:
          err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'فشل الإضافة',
        variant: 'destructive',
      })
    } finally {
      setAddingSite(false)
    }
  }

  const startEdit = (s: CompatibleSiteItem) => {
    setEditingId(s.id)
    setEditName(s.name)
    setEditDomains((s.domains || []).join(', '))
    setEditNotes(s.notes || '')
    setEditEnabled(s.enabled ?? true)
    setEditOrder(typeof s.order === 'number' ? s.order : 0)
  }

  const cancelEdit = () => {
    setEditingId(null)
  }

  // تعديل موقع متوافق (PUT)
  const saveEdit = async (id: string) => {
    if (savingSite) return
    if (editNotes.length > 2000) {
      toast({ title: 'الملاحظات طويلة', description: 'حتى 2000 حرف فقط', variant: 'destructive' })
      return
    }
    setSavingSite(true)
    try {
      const json = await apiFetch<{ data: CompatibleSiteItem }>(`/api/compatible-sites/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName.trim(),
          domains: editDomains,
          notes: editNotes.trim() || null,
          enabled: editEnabled,
          order: editOrder,
        }),
      })
      const updated = json.data
      setSites((prev) => prev.map((s) => (s.id === id ? { ...s, ...updated } : s)))
      setEditingId(null)
      toast({ title: 'تم الحفظ', description: 'تم تحديث الموقع المتوافق' })
    } catch (err) {
      toast({
        title: 'خطأ',
        description:
          err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'فشل الحفظ',
        variant: 'destructive',
      })
    } finally {
      setSavingSite(false)
    }
  }

  // حذف موقع متوافق (DELETE) بتأكيد
  const deleteSite = async (id: string, name: string) => {
    if (!window.confirm(`حذف "${name}"؟ لا يمكن التراجع.`)) return
    try {
      await apiFetch(`/api/compatible-sites/${id}`, { method: 'DELETE' })
      setSites((prev) => prev.filter((s) => s.id !== id))
      toast({ title: 'تم الحذف', description: `تم حذف ${name}` })
    } catch (err) {
      toast({
        title: 'خطأ',
        description:
          err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'فشل الحذف',
        variant: 'destructive',
      })
    }
  }

  // فاحص رابط المواقع: عبر isCompatibleSiteUrl ضد GET العام + عرض الموقع المطابق وشعاره
  const runSiteCheck = () => {
    const url = siteCheckUrl.trim()
    if (!url) {
      toast({ title: 'أدخل رابطاً للفحص', variant: 'destructive' })
      return
    }
    const ok = isCompatibleSiteUrl(url, sites)
    if (!ok) {
      setSiteCheckResult({ kind: 'not-found' })
      return
    }
    // إيجاد الموقع المطابق لعرض اسمه وشعاره
    let found: CompatibleSiteItem | null = null
    try {
      const host = new URL(url).hostname.toLowerCase()
      outer: for (const s of sites) {
        for (const raw of s.domains || []) {
          const d = String(raw).trim().toLowerCase().replace(/^\*\./, '')
          if (!d) continue
          if (host === d || host.endsWith(`.${d}`)) {
            found = s
            break outer
          }
        }
      }
    } catch {
      found = null
    }
    if (found) setSiteCheckResult({ kind: 'found', site: found })
    else setSiteCheckResult({ kind: 'not-found' })
  }

  if (loading) {
    return (
      <div className="space-y-4 p-4 sm:p-6" dir="rtl">
        <DataTableSkeleton />
      </div>
    )
  }

  return (
    <div className="space-y-6 p-4 sm:p-6" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-black">
            <Link2 className="h-5 w-5 text-primary" />
            إدارة روابط التحميل
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            الخدمات الموثوقة تُفتح مباشرة بدون تحذير — أي رابط آخر يعرض تنبيه روابط الإعلانات
          </p>
        </div>
        <Button onClick={save} disabled={saving} className="gap-1.5 min-h-[44px]">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          حفظ التغييرات
        </Button>
      </div>

      <Tabs value={tab} onValueChange={setTab} dir="rtl">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="storage">خدمات التخزين الموثوقة</TabsTrigger>
          <TabsTrigger value="sites">مواقع التحميل المتوافقة</TabsTrigger>
          <TabsTrigger value="messages">الرسائل والتنبيهات</TabsTrigger>
        </TabsList>

        {/* تبويبة خدمات التخزين الموثوقة */}
        <TabsContent value="storage" className="space-y-4">
          <div className="rounded-none border-[3px] border-border bg-card p-4 shadow-[4px_4px_0_0_var(--border)]">
            <h2 className="text-sm font-black">خدمات التخزين المعتمدة ({services.length})</h2>
            <div className="mt-3 space-y-2">
              {services.map((s, i) => (
                <div key={i} className="flex flex-col gap-2 rounded-lg border border-border/60 p-2.5 sm:flex-row sm:items-center">
                  {/* لوجو الخدمة الرسمي — يُعيَّن تلقائياً عند الحفظ */}
                  <img
                    src={s.logoUrl || brandLogoUrl((s.domains || [''])[0] || 'example.com')}
                    alt=""
                    width={36}
                    height={36}
                    loading="lazy"
                    className="h-9 w-9 shrink-0 rounded-md border border-border/60 bg-white object-contain p-0.5"
                    onError={(e) => {
                      ;(e.currentTarget as HTMLImageElement).style.display = 'none'
                    }}
                  />
                  <Input
                    value={s.name}
                    onChange={(e) => updateService(i, { name: e.target.value })}
                    placeholder="اسم الخدمة"
                    className="sm:w-44"
                  />
                  <Input
                    value={(s.domains || []).join(', ')}
                    onChange={(e) =>
                      updateService(i, {
                        domains: e.target.value.split(',').map((d) => d.trim().toLowerCase()),
                      })
                    }
                    placeholder="drive.google.com, docs.google.com"
                    className="flex-1 font-mono text-xs"
                    dir="ltr"
                  />
                  {/* أسهم إعادة الترتيب قبل الحفظ */}
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-9 w-9 min-h-[44px] min-w-[44px]"
                      onClick={() => moveService(i, -1)}
                      disabled={i === 0}
                      aria-label={`تحريك ${s.name} لأعلى`}
                    >
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-9 w-9 min-h-[44px] min-w-[44px]"
                      onClick={() => moveService(i, 1)}
                      disabled={i === services.length - 1}
                      aria-label={`تحريك ${s.name} لأسفل`}
                    >
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-9 w-9 shrink-0 text-red-400 min-h-[44px] min-w-[44px]"
                    onClick={() => removeService(i)}
                    aria-label={`حذف ${s.name}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              {services.length === 0 && (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  لا توجد خدمات — كل الروابط ستعرض التنبيه
                </p>
              )}
            </div>

            {/* إضافة خدمة */}
            <div className="mt-4 flex flex-col gap-2 border-t-2 border-border/60 pt-4 sm:flex-row sm:items-center">
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="اسم الخدمة الجديدة"
                className="sm:w-44"
              />
              <Input
                value={newDomains}
                onChange={(e) => setNewDomains(e.target.value)}
                placeholder="النطاقات مفصولة بفاصلة: example.com, files.example.com"
                className="flex-1 font-mono text-xs"
                dir="ltr"
              />
              <Button onClick={addService} variant="outline" className="gap-1 shrink-0 min-h-[44px]">
                <Plus className="h-4 w-4" /> إضافة
              </Button>
            </div>
          </div>

          {/* فاحص رابط التخزين */}
          <div className="rounded-none border-[3px] border-border bg-card p-4 shadow-[4px_4px_0_0_var(--border)]">
            <Label className="flex items-center gap-1.5 text-sm font-black">
              <Search className="h-4 w-4 text-primary" />
              فاحص رابط التخزين
            </Label>
            <p className="mt-1 text-xs text-muted-foreground">
              افحص أي رابط ضد القائمة الحالية قبل الحفظ
            </p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
              <Input
                value={checkUrl}
                onChange={(e) => setCheckUrl(e.target.value)}
                placeholder="https://drive.google.com/..."
                className="flex-1 font-mono text-xs"
                dir="ltr"
              />
              <Button onClick={runTrustCheck} variant="outline" className="gap-1 shrink-0 min-h-[44px]">
                <ShieldCheck className="h-4 w-4" /> فحص الرابط
              </Button>
            </div>
            {checkResult && (
              <div
                className={`mt-3 rounded-lg border px-3 py-2 text-sm font-bold ${
                  checkResult.kind === 'trusted'
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                    : 'border-amber-500/30 bg-amber-500/10 text-amber-300'
                }`}
              >
                {checkResult.kind === 'trusted'
                  ? `موثوق (${checkResult.serviceName})`
                  : 'غير موثوق — سيظهر التنبيه'}
              </div>
            )}
          </div>
        </TabsContent>

        {/* تبويبة مواقع التحميل المتوافقة */}
        <TabsContent value="sites" className="space-y-4">
          <div className="rounded-none border-[3px] border-border bg-card p-4 shadow-[4px_4px_0_0_var(--border)]">
            <h2 className="flex items-center gap-1.5 text-sm font-black">
              <Globe className="h-4 w-4 text-primary" />
              مواقع التحميل المتوافقة ({sites.length})
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              روابط هذه المواقع تُعرض كإضافات مباشرة — تُفتح في تبويب جديد لأن الناشر أضافها صراحة
            </p>
            {sitesLoading ? (
              <div className="mt-3"><DataTableSkeleton /></div>
            ) : (
              <div className="mt-3 space-y-2">
                {sites.map((s) => (
                  <div key={s.id} className="rounded-lg border border-border/60 p-2.5">
                    {editingId === s.id ? (
                      // نموذج التعديل الداخلي
                      <div className="space-y-2">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                          <Input
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            placeholder="اسم الموقع"
                            className="sm:w-44"
                          />
                          <Input
                            value={editDomains}
                            onChange={(e) => setEditDomains(e.target.value)}
                            placeholder="النطاقات مفصولة بفاصلة"
                            className="flex-1 font-mono text-xs"
                            dir="ltr"
                          />
                        </div>
                        <Textarea
                          value={editNotes}
                          onChange={(e) => setEditNotes(e.target.value)}
                          placeholder="ملاحظات/توصيات حتى 2000 حرف"
                          rows={2}
                          maxLength={2000}
                          dir="rtl"
                        />
                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            size="sm"
                            variant={editEnabled ? 'default' : 'outline'}
                            onClick={() => setEditEnabled(!editEnabled)}
                            className="min-h-[44px]"
                          >
                            {editEnabled ? 'مفعّل' : 'مغلّق'}
                          </Button>
                          <Label className="text-xs">الترتيب:</Label>
                          <Input
                            type="number"
                            value={editOrder}
                            onChange={(e) => setEditOrder(Number(e.target.value) || 0)}
                            className="w-20"
                            dir="ltr"
                          />
                          <div className="ms-auto flex gap-2">
                            <Button size="sm" variant="ghost" onClick={cancelEdit} className="min-h-[44px]">
                              <X className="h-4 w-4" /> إلغاء
                            </Button>
                            <Button size="sm" onClick={() => saveEdit(s.id)} disabled={savingSite} className="min-h-[44px]">
                              {savingSite ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                              حفظ
                            </Button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      // بطاقة العرض
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        <img
                          src={s.logoUrl || brandLogoUrl((s.domains || [''])[0] || 'example.com')}
                          alt=""
                          width={36}
                          height={36}
                          loading="lazy"
                          className="h-9 w-9 shrink-0 rounded-md border border-border/60 bg-white object-contain p-0.5"
                          onError={(e) => {
                            ;(e.currentTarget as HTMLImageElement).style.display = 'none'
                          }}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-black">{s.name}</span>
                            <Badge variant={s.enabled ?? true ? 'default' : 'secondary'}>
                              {(s.enabled ?? true) ? 'مفعّل' : 'مغلّق'}
                            </Badge>
                            <span className="text-[11px] text-muted-foreground">ترتيب: {s.order ?? 0}</span>
                          </div>
                          <p className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground" dir="ltr">
                            {(s.domains || []).join(', ')}
                          </p>
                          {s.notes && (
                            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{s.notes}</p>
                          )}
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-9 w-9 min-h-[44px] min-w-[44px]"
                            onClick={() => startEdit(s)}
                            aria-label={`تعديل ${s.name}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-9 w-9 text-red-400 min-h-[44px] min-w-[44px]"
                            onClick={() => deleteSite(s.id, s.name)}
                            aria-label={`حذف ${s.name}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                {sites.length === 0 && (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    لا توجد مواقع متوافقة بعد
                  </p>
                )}
              </div>
            )}

            {/* نموذج الإضافة */}
            <div className="mt-4 space-y-2 border-t-2 border-border/60 pt-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Input
                  value={newSiteName}
                  onChange={(e) => setNewSiteName(e.target.value)}
                  placeholder="اسم الموقع الجديد"
                  className="sm:w-44"
                />
                <Input
                  value={newSiteDomains}
                  onChange={(e) => setNewSiteDomains(e.target.value)}
                  placeholder="النطاقات مفصولة بفاصلة"
                  className="flex-1 font-mono text-xs"
                  dir="ltr"
                />
              </div>
              <Textarea
                value={newSiteNotes}
                onChange={(e) => setNewSiteNotes(e.target.value)}
                placeholder="ملاحظات/توصيات حتى 2000 حرف"
                rows={2}
                maxLength={2000}
                dir="rtl"
              />
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-muted-foreground">{newSiteNotes.length} / 2000</span>
                <Button onClick={addSite} disabled={addingSite} variant="outline" className="gap-1 shrink-0 min-h-[44px]">
                  {addingSite ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  إضافة الموقع
                </Button>
              </div>
            </div>
          </div>

          {/* فاحص رابط المواقع */}
          <div className="rounded-none border-[3px] border-border bg-card p-4 shadow-[4px_4px_0_0_var(--border)]">
            <Label className="flex items-center gap-1.5 text-sm font-black">
              <Search className="h-4 w-4 text-primary" />
              فاحص رابط المواقع
            </Label>
            <p className="mt-1 text-xs text-muted-foreground">
              افحص أي رابط ضد القائمة العامة للمواقع المتوافقة
            </p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
              <Input
                value={siteCheckUrl}
                onChange={(e) => setSiteCheckUrl(e.target.value)}
                placeholder="https://fitgirl-repacks.site/..."
                className="flex-1 font-mono text-xs"
                dir="ltr"
              />
              <Button onClick={runSiteCheck} variant="outline" className="gap-1 shrink-0 min-h-[44px]">
                <ShieldCheck className="h-4 w-4" /> فحص الرابط
              </Button>
            </div>
            {siteCheckResult && (
              <div className="mt-3">
                {siteCheckResult.kind === 'found' ? (
                  <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2">
                    <img
                      src={siteCheckResult.site.logoUrl || brandLogoUrl((siteCheckResult.site.domains || [''])[0] || 'example.com')}
                      alt=""
                      width={28}
                      height={28}
                      loading="lazy"
                      className="h-7 w-7 rounded-md border border-border/60 bg-white object-contain p-0.5"
                      onError={(e) => {
                        ;(e.currentTarget as HTMLImageElement).style.display = 'none'
                      }}
                    />
                    <span className="text-sm font-bold text-emerald-400">
                      متوافق — {siteCheckResult.site.name}
                    </span>
                  </div>
                ) : (
                  <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm font-bold text-amber-300">
                    غير متوافق — ليس ضمن القائمة
                  </div>
                )}
              </div>
            )}
          </div>
        </TabsContent>

        {/* تبويبة الرسائل والتنبيهات */}
        <TabsContent value="messages" className="space-y-4">
          {/* محرر رسالة الإعلانات (كما هو — نفس الـ PUT) */}
          <div className="rounded-none border-[3px] border-border bg-card p-4 shadow-[4px_4px_0_0_var(--border)]">
            <Label className="flex items-center gap-1.5 text-sm font-black">
              <TriangleAlert className="h-4 w-4 text-amber-500" />
              رسالة تنبيه روابط الإعلانات
            </Label>
            <p className="mt-1 text-xs text-muted-foreground">
              تظهر للمستخدم عند الضغط على رابط ليس من الخدمات المعتمدة، مع الحجم المتوقع للملف
            </p>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              maxLength={2000}
              className="mt-3"
              dir="rtl"
            />
            <div className="mt-2 flex items-center justify-between">
              <p className="text-[11px] text-muted-foreground">{message.length} / 2000</p>
              <Button onClick={save} disabled={saving} size="sm" className="gap-1.5 min-h-[44px]">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                حفظ الرسالة
              </Button>
            </div>
          </div>

          {/* بطاقات placeholder معطّلة لأنواع الرسائل القادمة — عرض فقط */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {[
              { title: 'تحذير موقع كراك', desc: 'تنبيه خاص بروابط مواقع الكراك عند رصدها في الإضافات.' },
              { title: 'رسالة انتظار قبل التحميل', desc: 'عدّاد انتظار قصير قبل إتاحة زر التحميل النهائي.' },
              { title: 'صفحة تحويل وسيطة', desc: 'صفحة وسيطة تعرض وجهة الرابط الخارجي قبل المتابعة.' },
              { title: 'قوالب رسائل جاهزة', desc: 'قوالب نصية جاهزة لإشعارات التحميل والأخطاء الشائعة.' },
            ].map((c) => (
              <div
                key={c.title}
                aria-disabled="true"
                className="rounded-none border-[3px] border-border/50 bg-card p-4 opacity-60 shadow-[4px_4px_0_0_var(--border)]"
              >
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-black">{c.title}</h3>
                  <Badge variant="secondary">قريباً</Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{c.desc}</p>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  مكانها محجوز هنا — ستُفعّل لاحقاً بدون أي باك-إند إضافي الآن.
                </p>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
