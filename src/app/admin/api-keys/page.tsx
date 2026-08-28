'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Key,
  Plus,
  Trash2,
  Copy,
  Check,
  Loader2,
  Shield,
  ShieldCheck,
  ShieldOff,
  AlertTriangle,
  Clock,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'

// ===== Types =====

interface ApiKeyItem {
  id: string
  name: string
  role: string
  expiresAt: string | null
  lastUsedAt: string | null
  isActive: boolean
  createdAt: string
  keyPreview: string
}

interface CreatedKeyResponse {
  id: string
  name: string
  role: string
  key: string // المفتاح الكامل — يُعرض مرة واحدة فقط
  expiresAt: string | null
  createdAt: string
  warning: string
}

// ===== Constants =====

const ROLE_OPTIONS = [
  { value: 'moderator', label: 'مشرف', icon: Shield, color: 'text-purple-400' },
  { value: 'admin', label: 'مدير', icon: ShieldCheck, color: 'text-red-400' },
  { value: 'manager', label: 'مدير النظام', icon: ShieldCheck, color: 'text-blue-400' },
  { value: 'owner', label: 'مالك', icon: ShieldCheck, color: 'text-amber-400' },
]

const EXPIRATION_OPTIONS = [
  { value: '30', label: 'شهر واحد' },
  { value: '90', label: '3 أشهر' },
  { value: '180', label: '6 أشهر' },
  { value: '365', label: 'سنة واحدة' },
  { value: '0', label: 'أبداً (لا ينتهي)' },
]

const ROLE_BADGE: Record<string, { label: string; className: string }> = {
  moderator: { label: 'مشرف', className: 'bg-purple-500/20 text-purple-400' },
  admin: { label: 'مدير', className: 'bg-red-500/20 text-red-400' },
  manager: { label: 'مدير النظام', className: 'bg-blue-500/20 text-blue-400' },
  owner: { label: 'مالك', className: 'bg-amber-500/20 text-amber-400' },
}

// ===== Component =====

export default function AdminApiKeysPage() {
  const { toast } = useToast()
  const [keys, setKeys] = useState<ApiKeyItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showKeyDialog, setShowKeyDialog] = useState(false)
  const [createdKey, setCreatedKey] = useState<CreatedKeyResponse | null>(null)
  const [copied, setCopied] = useState(false)

  // Create form state
  const [formName, setFormName] = useState('')
  const [formRole, setFormRole] = useState('moderator')
  const [formExpiration, setFormExpiration] = useState('0')
  const [creating, setCreating] = useState(false)

  // ===== Fetch Keys =====

  const fetchKeys = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/api-keys')
      if (!res.ok) throw new Error('Failed to fetch')
      const json = await res.json()
      setKeys(json.data || [])
    } catch {
      toast({ title: 'خطأ', description: 'فشل تحميل المفاتيح', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    fetchKeys()
  }, [fetchKeys])

  // ===== Create Key =====

  const handleCreate = async () => {
    if (!formName.trim()) {
      toast({ title: 'خطأ', description: 'اسم المفتاح مطلوب', variant: 'destructive' })
      return
    }

    setCreating(true)
    try {
      const body: Record<string, unknown> = {
        name: formName.trim(),
        role: formRole,
      }
      const days = parseInt(formExpiration, 10)
      if (days > 0) body.expiresInDays = days

      const res = await fetch('/api/admin/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error?.message || 'Failed to create')
      }

      const json = await res.json()
      const newKey = json.data as CreatedKeyResponse

      // عرض المفتاح الكامل مرة واحدة
      setCreatedKey(newKey)
      setShowCreateDialog(false)
      setShowKeyDialog(true)

      // إعادة تحميل القائمة
      fetchKeys()

      // إعادة تعيين النموذج
      setFormName('')
      setFormRole('moderator')
      setFormExpiration('0')
    } catch (err) {
      toast({
        title: 'خطأ',
        description: err instanceof Error ? err.message : 'فشل إنشاء المفتاح',
        variant: 'destructive',
      })
    } finally {
      setCreating(false)
    }
  }

  // ===== Revoke Key =====

  const handleRevoke = async (id: string, currentName: string) => {
    if (!confirm(`هل أنت متأكد من تعطيل مفتاح "${currentName}"؟`)) return

    try {
      const res = await fetch(`/api/admin/api-keys/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: false }),
      })

      if (!res.ok) throw new Error('Failed to revoke')

      toast({ title: 'تم التعطيل', description: 'تم تعطيل المفتاح بنجاح' })
      fetchKeys()
    } catch {
      toast({ title: 'خطأ', description: 'فشل تعطيل المفتاح', variant: 'destructive' })
    }
  }

  // ===== Delete Key =====

  const handleDelete = async (id: string, currentName: string) => {
    if (!confirm(`هل أنت متأكد من حذف مفتاح "${currentName}"؟ هذا الإجراء لا يمكن التراجع عنه.`)) return

    try {
      const res = await fetch(`/api/admin/api-keys/${id}`, {
        method: 'DELETE',
      })

      if (!res.ok) throw new Error('Failed to delete')

      toast({ title: 'تم الحذف', description: 'تم حذف المفتاح بنجاح' })
      fetchKeys()
    } catch {
      toast({ title: 'خطأ', description: 'فشل حذف المفتاح', variant: 'destructive' })
    }
  }

  // ===== Copy Key =====

  const handleCopyKey = async () => {
    if (!createdKey?.key) return
    try {
      await navigator.clipboard.writeText(createdKey.key)
      setCopied(true)
      toast({ title: 'تم النسخ', description: 'تم نسخ المفتاح إلى الحافظة' })
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast({ title: 'خطأ', description: 'فشل النسخ', variant: 'destructive' })
    }
  }

  // ===== Format Date =====

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—'
    return new Date(dateStr).toLocaleDateString('ar-SA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  // ===== Render =====

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div dir="rtl" className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">مفاتيح API</h1>
          <p className="text-sm text-muted-foreground mt-1">
            إدارة مفاتيح الوصول البرمجي للـ MCP Server والسكربتات
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          إنشاء مفتاح جديد
        </Button>
      </div>

      {/* Warning Banner */}
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-400 mt-0.5 shrink-0" />
          <div className="text-sm">
            <p className="font-medium text-amber-400">تنبيه أمني</p>
            <p className="text-muted-foreground mt-1">
              المفاتيح توفر وصولاً كاملاً للـ API. لا تشاركها مع أي شخص.
              المفتاح يُعرض مرة واحدة فقط عند الإنشاء.
            </p>
          </div>
        </div>
      </div>

      {/* Keys Table */}
      {keys.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-12 text-center">
          <Key className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-muted-foreground">لا توجد مفاتيح</h3>
          <p className="text-sm text-muted-foreground/60 mt-1">
            أنشئ مفتاحاً جديداً للبدء في الوصول البرمجي
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">الاسم</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">الدور</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">تاريخ الإنشاء</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">تاريخ الانتهاء</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">آخر استخدام</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">الحالة</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {keys.map((key) => {
                  const roleInfo = ROLE_BADGE[key.role] || ROLE_BADGE.moderator
                  return (
                    <tr key={key.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Key className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{key.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${roleInfo.className}`}>
                          {roleInfo.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{formatDate(key.createdAt)}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {key.expiresAt ? (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatDate(key.expiresAt)}
                          </span>
                        ) : (
                          'أبداً'
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {key.lastUsedAt ? formatDate(key.lastUsedAt) : 'لم يُستخدم'}
                      </td>
                      <td className="px-4 py-3">
                        {key.isActive ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-green-500/20 px-2.5 py-0.5 text-xs font-medium text-green-400">
                            نشط
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-red-500/20 px-2.5 py-0.5 text-xs font-medium text-red-400">
                            <ShieldOff className="h-3 w-3" />
                            معطّل
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          {key.isActive && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRevoke(key.id, key.name)}
                              className="text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 min-h-[44px]"
                            >
                              تعطيل
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(key.id, key.name)}
                            className="text-red-400 hover:text-red-300 hover:bg-red-500/10 min-h-[44px]"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ===== Create Dialog ===== */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-md" dir="rtl" aria-describedby="create-key-description">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              إنشاء مفتاح API جديد
            </DialogTitle>
            <DialogDescription id="create-key-description">
              أدخل بيانات المفتاح الجديد — سيُعرض المفتاح مرة واحدة فقط بعد الإنشاء.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="key-name">اسم المفتاح</Label>
              <Input
                id="key-name"
                placeholder="مثال: MCP Server - Office PC"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="key-role">الدور الممنوح</Label>
              <select
                id="key-role"
                value={formRole}
                onChange={(e) => setFormRole(e.target.value)}
                className="flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {ROLE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="key-expiration">مدة الصلاحية</Label>
              <select
                id="key-expiration"
                value={formExpiration}
                onChange={(e) => setFormExpiration(e.target.value)}
                className="flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {EXPIRATION_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              إلغاء
            </Button>
            <Button onClick={handleCreate} disabled={creating}>
              {creating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin ml-2" />
                  جاري الإنشاء...
                </>
              ) : (
                'إنشاء المفتاح'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== Key Display Dialog (show key ONCE) ===== */}
      <Dialog open={showKeyDialog} onOpenChange={setShowKeyDialog}>
        <DialogContent className="sm:max-w-lg" dir="rtl" aria-describedby="key-created-description">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-400">
              <Check className="h-5 w-5" />
              تم إنشاء المفتاح بنجاح
            </DialogTitle>
            <DialogDescription id="key-created-description">
              احفظ هذا المفتاح في مكان آمن — لن يُعرض مرة ثانية.
            </DialogDescription>
          </DialogHeader>

          {createdKey && (
            <div className="space-y-4">
              {/* Warning */}
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
                  <p className="text-sm text-amber-400">
                    احفظ هذا المفتاح في مكان آمن. <strong>لن يُعرض مرة ثانية.</strong>
                  </p>
                </div>
              </div>

              {/* Key Display */}
              <div className="space-y-2">
                <Label>المفتاح</Label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 rounded-md border border-border bg-muted/50 p-3 font-mono text-xs break-all text-foreground">
                    {createdKey.key}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCopyKey}
                    className="shrink-0 min-h-[44px]"
                  >
                    {copied ? (
                      <Check className="h-4 w-4 text-green-400" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              {/* Key Info */}
              <div className="rounded-lg border border-border bg-muted/20 p-3 text-sm space-y-1">
                <p><strong>الاسم:</strong> {createdKey.name}</p>
                <p><strong>الدور:</strong> {ROLE_BADGE[createdKey.role]?.label || createdKey.role}</p>
                <p><strong>الانتهاء:</strong> {createdKey.expiresAt ? formatDate(createdKey.expiresAt) : 'أبداً'}</p>
              </div>

              {/* Usage Example */}
              <div className="space-y-2">
                <Label>مثال الاستخدام</Label>
                <div className="rounded-md border border-border bg-muted/50 p-3 font-mono text-xs text-muted-foreground">
                  <p>curl -H &quot;Authorization: Bearer {createdKey.key.substring(0, 20)}...&quot; \</p>
                  <p className="ml-4">http://localhost:3000/api/admin/mods</p>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button onClick={() => { setShowKeyDialog(false); setCreatedKey(null) }}>
              فهمت، احفظه في مكان آمن
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
