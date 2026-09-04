'use client'

import {
  Crown,
  Globe,
  Loader2,
  Palette,
  Save,
  Search,
  Settings,
  Share2,
  Shield,
  Star,
  User as UserIcon,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { DataTableSkeleton } from '@/components/ui/data-skeleton'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'

interface SettingsData {
  [group: string]: {
    [key: string]: string
  }
}

const SETTING_GROUPS = [
  {
    id: 'general',
    label: 'إعدادات عامة',
    icon: Globe,
    fields: [
      { key: 'site_name', label: 'اسم الموقع', type: 'text', placeholder: 'GAMES ARABIC' },
      {
        key: 'site_description',
        label: 'وصف الموقع',
        type: 'textarea',
        placeholder: 'منصة تعريب الألعاب',
      },
      { key: 'site_logo', label: 'رابط الشعار', type: 'text', placeholder: 'https://...' },
      { key: 'site_favicon', label: 'رابط Favicon', type: 'text', placeholder: 'https://...' },
    ],
  },
  {
    id: 'appearance',
    label: 'المظهر',
    icon: Palette,
    fields: [
      { key: 'primary_color', label: 'اللون الأساسي', type: 'text', placeholder: '#3b82f6' },
      {
        key: 'dark_mode_default',
        label: 'الوضع الداكن افتراضي',
        type: 'select',
        options: ['true', 'false'],
      },
    ],
  },
  {
    id: 'seo',
    label: 'تحسين محركات البحث (SEO)',
    icon: Search,
    fields: [
      {
        key: 'site_url',
        label: 'رابط الموقع الرئيسي',
        type: 'text',
        placeholder: 'https://games-arabic.vercel.app',
      },
      {
        key: 'meta_title',
        label: 'عنوان Meta',
        type: 'text',
        placeholder: 'GAMES ARABIC - تعريب ألعاب',
      },
      {
        key: 'meta_description',
        label: 'وصف Meta',
        type: 'textarea',
        placeholder: 'منصة تعريب الألعاب...',
      },
      { key: 'og_image', label: 'صورة OG (Open Graph)', type: 'text', placeholder: 'https://...' },
      { key: 'og_locale', label: 'لغة OG', type: 'text', placeholder: 'ar_SA' },
      { key: 'og_type', label: 'نوع المحتوى OG', type: 'select', options: ['website', 'article'] },
      {
        key: 'theme_color',
        label: 'لون الثيم (theme-color)',
        type: 'text',
        placeholder: '#eab308',
      },
      {
        key: 'robots_txt',
        label: 'قواعد الم crawler',
        type: 'textarea',
        placeholder: 'User-agent: *\nAllow: /',
      },
      {
        key: 'google_analytics_id',
        label: 'معرّف Google Analytics',
        type: 'text',
        placeholder: 'G-XXXXXXXXXX',
      },
      {
        key: 'google_search_console',
        label: 'معرّف Google Search Console',
        type: 'text',
        placeholder: 'verification code',
      },
    ],
  },
  {
    id: 'social',
    label: 'روابط التواصل الاجتماعي',
    icon: Share2,
    fields: [
      { key: 'twitter', label: 'Twitter/X', type: 'text', placeholder: 'https://twitter.com/...' },
      { key: 'discord', label: 'Discord', type: 'text', placeholder: 'https://discord.gg/...' },
      { key: 'youtube', label: 'YouTube', type: 'text', placeholder: 'https://youtube.com/...' },
      { key: 'telegram', label: 'Telegram', type: 'text', placeholder: 'https://t.me/...' },
    ],
  },
]

export default function AdminSettingsPage() {
  const { toast } = useToast()
  const [settings, setSettings] = useState<SettingsData>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeGroup, setActiveGroup] = useState('general')
  const [userRole, setUserRole] = useState<string>('')
  const [loadError, setLoadError] = useState<string | null>(null)

  const fetchSettings = async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const [settingsRes, userRes] = await Promise.all([
        fetch('/api/admin/settings'),
        fetch('/api/auth/me'),
      ])
      if (!settingsRes.ok) throw new Error('فشل تحميل الإعدادات')
      const settingsJson = await settingsRes.json()
      const userJson = userRes.ok ? await userRes.json() : null
      const loaded = settingsJson?.data?.settings || settingsJson?.settings
      if (loaded) setSettings(loaded)
      else if (!settingsJson?.data && !settingsJson?.settings) throw new Error('البيانات فارغة')
      const user = userJson?.data?.user || userJson?.user
      if (user) setUserRole(user.role)
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'فشل تحميل الإعدادات')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSettings()
  }, [])

  const getSetting = (group: string, key: string): string => {
    return settings[group]?.[key] || ''
  }

  const setSetting = (group: string, key: string, value: string) => {
    setSettings((prev) => ({
      ...prev,
      [group]: { ...(prev[group] || {}), [key]: value },
    }))
  }

  const onSave = async () => {
    // حماية من حفظ نموذج فارغ
    const isFormEmpty = Object.values(settings).every(
      (group) => !group || Object.values(group).every((v) => !v || v === ''),
    )
    if (isFormEmpty) {
      toast({
        title: 'تنبيه',
        description: 'لا يمكن حفظ نموذج فارغ — تحقق من تحميل البيانات',
        variant: 'destructive',
      })
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings }),
      })
      if (!res.ok) throw new Error('فشل الحفظ')
      toast({ title: 'تم الحفظ', description: 'تم حفظ الإعدادات بنجاح' })
    } catch (err) {
      toast({
        title: 'خطأ',
        description: err instanceof Error ? err.message : 'فشل',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <DataTableSkeleton rows={5} cols={6} />
  }

  if (loadError) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-lg" dir="rtl">
        <h2 className="text-red-700 font-bold mb-2">⚠️ فشل تحميل الإعدادات</h2>
        <p className="text-red-600 mb-4">{loadError}</p>
        <Button onClick={fetchSettings}>إعادة المحاولة</Button>
      </div>
    )
  }

  const currentGroup = SETTING_GROUPS.find((g) => g.id === activeGroup)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">الإعدادات</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            إعدادات الموقع العامة — متاحة للمالك فقط
          </p>
        </div>
        {userRole === 'owner' && (
          <Button onClick={onSave} disabled={saving}>
            {saving ? (
              <Loader2 className="ml-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="ml-2 h-4 w-4" />
            )}
            حفظ الإعدادات
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
        {/* قائمة المجموعات */}
        <div className="space-y-1">
          {SETTING_GROUPS.map((group) => {
            const Icon = group.icon
            return (
              <button
                key={group.id}
                onClick={() => setActiveGroup(group.id)}
                className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  activeGroup === group.id
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                }`}
              >
                <Icon className="h-4 w-4" />
                {group.label}
              </button>
            )
          })}

          {/* معلومات الأدوار */}
          <div className="mt-4 rounded-xl border border-border bg-card/30 p-3">
            <h3 className="mb-2 text-xs font-bold text-muted-foreground">الأدوار والصلاحيات</h3>
            <div className="space-y-1.5 text-xs">
              <div className="flex items-center gap-1.5">
                <Crown className="h-3 w-3 text-amber-500" /> المالك: كل شيء
              </div>
              <div className="flex items-center gap-1.5">
                <Shield className="h-3 w-3 text-red-500" /> المدير: إدارة المحتوى والمستخدمين
              </div>
              <div className="flex items-center gap-1.5">
                <Star className="h-3 w-3 text-purple-500" /> المشرف: نشر/تعديل تعريباته
              </div>
              <div className="flex items-center gap-1.5">
                <UserIcon className="h-3 w-3 text-blue-500" /> العضو: لا لوحة تحكم
              </div>
            </div>
          </div>
        </div>

        {/* حقول الإعدادات */}
        <div className="lg:col-span-3">
          {currentGroup && (
            <div className="rounded-xl border border-border bg-card/30 p-5">
              <h2 className="mb-4 flex items-center gap-2 text-base font-bold">
                <currentGroup.icon className="h-4 w-4" /> {currentGroup.label}
              </h2>
              <div className="space-y-4">
                {currentGroup.fields.map((field) => (
                  <div key={field.key}>
                    <Label className="text-sm">{field.label}</Label>
                    {field.type === 'textarea' ? (
                      <Textarea
                        value={getSetting(activeGroup, field.key)}
                        onChange={(e) => setSetting(activeGroup, field.key, e.target.value)}
                        placeholder={field.placeholder}
                        className="mt-1"
                        rows={3}
                      />
                    ) : field.type === 'select' ? (
                      <select
                        value={getSetting(activeGroup, field.key)}
                        onChange={(e) => setSetting(activeGroup, field.key, e.target.value)}
                        className="mt-1 h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
                      >
                        {field.options?.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt === 'true' ? 'نعم' : 'لا'}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <Input
                        value={getSetting(activeGroup, field.key)}
                        onChange={(e) => setSetting(activeGroup, field.key, e.target.value)}
                        placeholder={field.placeholder}
                        className="mt-1"
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
