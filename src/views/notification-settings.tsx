'use client'

import { Check, Clock, Loader2, Moon, Save } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { NotificationType } from '@/domain/value-objects/notification-type'
import { useToast } from '@/hooks/use-toast'

// ===== Types =====

interface TypePreference {
  enabled: boolean
  emailEnabled?: boolean
  pushEnabled?: boolean
}

interface NotificationPreferences {
  id: string
  userId: string
  emailEnabled: boolean
  pushEnabled: boolean
  dailySummary: boolean
  summaryIntervalDays: number
  likeThreshold: number
  quietHoursEnabled: boolean
  quietHoursStart: string | null
  quietHoursEnd: string | null
  typePreferences: Record<string, TypePreference>
}

// ===== Constants =====

const TYPE_LABELS: Record<NotificationType, string> = {
  [NotificationType.CommentReply]: 'رد على تعليق',
  [NotificationType.TopLevelComment]: 'تعليق جديد',
  [NotificationType.Like]: 'إعجاب',
  [NotificationType.Follow]: 'متابعة جديدة',
  [NotificationType.ModEndorse]: 'تصويت على تعريب',
  [NotificationType.ModEndorseMilestone]: 'إنجاز تصويت',
  [NotificationType.ModFeatured]: 'تعريب مميز',
  [NotificationType.ModPublished]: 'تعريب جديد',
  [NotificationType.ModUpdated]: 'تحديث تعريب',
  [NotificationType.ModDeleted]: 'حذف تعريب',
  [NotificationType.TierUpgrade]: 'ترقية مستوى',
  [NotificationType.TierRevoked]: 'سحب مستوى',
  [NotificationType.SpecialRoleAssigned]: 'منح دور خاص',
  [NotificationType.SpecialRoleRemoved]: 'سحب دور خاص',
  [NotificationType.AdminAction]: 'إجراء إداري',
  [NotificationType.AdminUserRegister]: 'تسجيل مستخدم',
  [NotificationType.AdminRequest]: 'طلب مستخدم',
  [NotificationType.AdminReport]: 'بلاغ',
  [NotificationType.AdminMilestone]: 'إنجاز إداري',
  [NotificationType.SystemAnnouncement]: 'إعلان النظام',
}

const TYPE_CATEGORIES: { label: string; types: NotificationType[] }[] = [
  {
    label: 'اجتماعي',
    types: [
      NotificationType.CommentReply,
      NotificationType.TopLevelComment,
      NotificationType.Like,
      NotificationType.Follow,
    ],
  },
  {
    label: 'تعريبات',
    types: [
      NotificationType.ModEndorse,
      NotificationType.ModEndorseMilestone,
      NotificationType.ModFeatured,
      NotificationType.ModPublished,
      NotificationType.ModUpdated,
      NotificationType.ModDeleted,
    ],
  },
  {
    label: 'مستويات وأدوار',
    types: [
      NotificationType.TierUpgrade,
      NotificationType.TierRevoked,
      NotificationType.SpecialRoleAssigned,
      NotificationType.SpecialRoleRemoved,
    ],
  },
  {
    label: 'إداري',
    types: [
      NotificationType.AdminAction,
      NotificationType.AdminUserRegister,
      NotificationType.AdminRequest,
      NotificationType.AdminReport,
      NotificationType.AdminMilestone,
    ],
  },
  {
    label: 'نظام',
    types: [NotificationType.SystemAnnouncement],
  },
]

// ===== Subcomponents =====

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
}) {
  return (
    <button
      onClick={() => onChange(!checked)}
      disabled={disabled}
      className={`relative h-6 w-11 rounded-full transition-colors duration-200 cursor-pointer shrink-0 ${
        checked ? 'bg-primary' : 'bg-muted'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      role="switch"
      aria-checked={checked}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform duration-200 ${
          checked ? 'translate-x-5' : 'translate-x-0.5'
        }`}
      />
    </button>
  )
}

function SettingRow({
  label,
  description,
  children,
}: {
  label: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-4 p-3 rounded-none hover:bg-accent/30 transition-colors">
      <div className="flex-1">
        <p className="text-sm font-medium">{label}</p>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
      {children}
    </div>
  )
}

function NumberInput({
  value,
  onChange,
  min,
  max,
  disabled,
}: {
  value: number
  onChange: (v: number) => void
  min: number
  max: number
  disabled?: boolean
}) {
  return (
    <input
      type="number"
      value={value}
      onChange={(e) => {
        const v = parseInt(e.target.value, 10)
        if (!isNaN(v)) onChange(Math.min(max, Math.max(min, v)))
      }}
      min={min}
      max={max}
      disabled={disabled}
      className="w-20 rounded-none border-2 border-border bg-background p-1.5 text-sm text-center text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
    />
  )
}

function TimeInput({
  value,
  onChange,
  disabled,
}: {
  value: string
  onChange: (v: string) => void
  disabled?: boolean
}) {
  return (
    <input
      type="time"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className="rounded-none border-2 border-border bg-background p-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
    />
  )
}

// ===== Main Component =====

export function NotificationSettings() {
  const { toast } = useToast()
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetch('/api/notifications/preferences', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.data) setPreferences(data.data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const updateField = useCallback(
    <K extends keyof NotificationPreferences>(key: K, value: NotificationPreferences[K]) => {
      setPreferences((prev) => (prev ? { ...prev, [key]: value } : prev))
    },
    [],
  )

  const updateTypePreference = useCallback(
    (type: NotificationType, field: keyof TypePreference, value: boolean) => {
      setPreferences((prev) => {
        if (!prev) return prev
        const current = prev.typePreferences[type] ?? {
          enabled: true,
          emailEnabled: true,
          pushEnabled: true,
        }
        return {
          ...prev,
          typePreferences: {
            ...prev.typePreferences,
            [type]: { ...current, [field]: value },
          },
        }
      })
    },
    [],
  )

  const handleSave = async () => {
    if (!preferences) return
    setSaving(true)
    setSaved(false)
    try {
      const res = await fetch('/api/notifications/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emailEnabled: preferences.emailEnabled,
          pushEnabled: preferences.pushEnabled,
          dailySummary: preferences.dailySummary,
          summaryIntervalDays: preferences.summaryIntervalDays,
          likeThreshold: preferences.likeThreshold,
          quietHoursEnabled: preferences.quietHoursEnabled,
          quietHoursStart: preferences.quietHoursStart,
          quietHoursEnd: preferences.quietHoursEnd,
          typePreferences: preferences.typePreferences,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        if (data?.data) setPreferences(data.data)
        setSaved(true)
        toast({ title: 'تم الحفظ', description: 'تم حفظ تفضيلات الإشعارات بنجاح' })
        setTimeout(() => setSaved(false), 2000)
      } else {
        toast({ title: 'خطأ', description: 'فشل حفظ التغييرات', variant: 'destructive' })
      }
    } catch {
      toast({ title: 'خطأ', description: 'فشل حفظ التغييرات', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!preferences) {
    return (
      <div className="text-center py-12 text-muted-foreground text-sm">فشل في تحميل التفضيلات</div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Section 1: Global Toggles */}
      <div className="rounded-none bg-card border-2 border-border p-6">
        <h3 className="mb-2 text-sm font-bold">الإعدادات العامة</h3>
        <p className="text-xs text-muted-foreground mb-4">التحكم في قنوات الإشعارات الأساسية</p>
        <div className="space-y-1">
          <SettingRow
            label="إشعارات البريد الإلكتروني"
            description="استلام إشعارات عبر البريد عند حدث جديد"
          >
            <Toggle
              checked={preferences.emailEnabled}
              onChange={(v) => updateField('emailEnabled', v)}
            />
          </SettingRow>
          <SettingRow label="إشعارات الموقع" description="استلام إشعارات فورية داخل الموقع">
            <Toggle
              checked={preferences.pushEnabled}
              onChange={(v) => updateField('pushEnabled', v)}
            />
          </SettingRow>
          <SettingRow label="الملخص اليومي" description="استلام ملخص دوري للنشاطات الجديدة">
            <Toggle
              checked={preferences.dailySummary}
              onChange={(v) => updateField('dailySummary', v)}
            />
          </SettingRow>
          <SettingRow label="فترة الملخص (أيام)" description="عدد أيام الانتظار بين الملخصات">
            <NumberInput
              value={preferences.summaryIntervalDays}
              onChange={(v) => updateField('summaryIntervalDays', v)}
              min={1}
              max={30}
              disabled={!preferences.dailySummary}
            />
          </SettingRow>
          <SettingRow label="حد الإعجابات" description="عدد الإعجابات المطلوب لإرسال إشعار">
            <NumberInput
              value={preferences.likeThreshold}
              onChange={(v) => updateField('likeThreshold', v)}
              min={5}
              max={100}
            />
          </SettingRow>
        </div>
      </div>

      {/* Section 2: Quiet Hours */}
      <div className="rounded-none bg-card border-2 border-border p-6">
        <div className="flex items-center gap-2 mb-2">
          <Moon className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-bold">ساعات الهدوء</h3>
        </div>
        <p className="text-xs text-muted-foreground mb-4">لن تستلم إشعارات خلال هذه الفترة</p>
        <div className="space-y-3">
          <SettingRow label="تفعيل ساعات الهدوء">
            <Toggle
              checked={preferences.quietHoursEnabled}
              onChange={(v) => updateField('quietHoursEnabled', v)}
            />
          </SettingRow>
          {preferences.quietHoursEnabled && (
            <div className="flex items-center gap-4 px-3">
              <div className="flex items-center gap-2">
                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-sm">من</span>
                <TimeInput
                  value={preferences.quietHoursStart ?? '22:00'}
                  onChange={(v) => updateField('quietHoursStart', v)}
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm">إلى</span>
                <TimeInput
                  value={preferences.quietHoursEnd ?? '07:00'}
                  onChange={(v) => updateField('quietHoursEnd', v)}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Section 3: Per-Type Preferences */}
      <div className="rounded-none bg-card border-2 border-border p-6">
        <h3 className="mb-2 text-sm font-bold">تفضيلات حسب النوع</h3>
        <p className="text-xs text-muted-foreground mb-4">تحكم في كل نوع إشعار على حدة</p>
        <div className="space-y-4">
          {TYPE_CATEGORIES.map((category) => (
            <div key={category.label}>
              <h4 className="text-xs font-semibold text-muted-foreground mb-2 px-3">
                {category.label}
              </h4>
              <div className="space-y-0.5">
                {category.types.map((type) => {
                  const pref = preferences.typePreferences[type] ?? {
                    enabled: true,
                    emailEnabled: true,
                    pushEnabled: true,
                  }
                  return (
                    <div
                      key={type}
                      className="rounded-none hover:bg-accent/30 transition-colors px-3 py-2"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm min-w-[120px]">{TYPE_LABELS[type]}</span>
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-muted-foreground">مفعل</span>
                            <Toggle
                              checked={pref.enabled}
                              onChange={(v) => updateTypePreference(type, 'enabled', v)}
                            />
                          </div>
                          {pref.enabled && (
                            <>
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs text-muted-foreground">بريد</span>
                                <Toggle
                                  checked={pref.emailEnabled ?? true}
                                  onChange={(v) => updateTypePreference(type, 'emailEnabled', v)}
                                />
                              </div>
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs text-muted-foreground">موقع</span>
                                <Toggle
                                  checked={pref.pushEnabled ?? true}
                                  onChange={(v) => updateTypePreference(type, 'pushEnabled', v)}
                                />
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Section 4: Save Button */}
      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          disabled={saving}
          className={`cursor-pointer transition-all duration-200 ${
            saved
              ? 'bg-status-new text-status-new-foreground hover:bg-status-new/90'
              : 'bg-primary text-primary-foreground hover:bg-primary/90'
          }`}
        >
          {saving ? (
            <>
              <Loader2 className="ml-2 h-4 w-4 animate-spin" /> جاري الحفظ...
            </>
          ) : saved ? (
            <>
              <Check className="ml-2 h-4 w-4" /> تم الحفظ
            </>
          ) : (
            <>
              <Save className="ml-2 h-4 w-4" /> حفظ التغييرات
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
