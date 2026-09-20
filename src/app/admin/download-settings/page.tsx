'use client'

import { Link2, Loader2, Plus, Save, Trash2, TriangleAlert } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { DataTableSkeleton } from '@/components/ui/data-skeleton'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { ApiError, apiFetch } from '@/lib/api-client'
import { brandLogoUrl } from '@/lib/download-trust'

interface HostService {
  name: string
  domains: string[]
  logoUrl?: string
}

export default function AdminDownloadSettingsPage() {
  const { toast } = useToast()
  const [services, setServices] = useState<HostService[]>([])
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDomains, setNewDomains] = useState('')

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

  const updateService = (idx: number, patch: Partial<HostService>) => {
    setServices((prev) => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)))
  }

  const removeService = (idx: number) => {
    setServices((prev) => prev.filter((_, i) => i !== idx))
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
            روابط التحميل الموثوقة
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            روابط هذه الخدمات تُفتح مباشرة بدون تحذير — أي رابط آخر يعرض تنبيه رابط الإعلانات مع
            حجم الملف المتوقع
          </p>
        </div>
        <Button onClick={save} disabled={saving} className="gap-1.5 min-h-[44px]">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          حفظ التغييرات
        </Button>
      </div>

      {/* رسالة التحذير */}
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
        <p className="mt-1 text-[11px] text-muted-foreground">{message.length} / 2000</p>
      </div>

      {/* الخدمات الموثوقة */}
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
    </div>
  )
}
