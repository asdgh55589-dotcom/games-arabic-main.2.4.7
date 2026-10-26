'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Field } from '@/components/creator/mod-form/primitives'

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  onSave: (data: { name: string; email?: string; role: string; avatarUrl?: string; bio?: string }) => Promise<void>
  saving?: boolean
}

const ROLES = ['admin', 'moderator', 'translator', 'member', 'tester']

export function TeamGhostMemberModal({ open, onOpenChange, onSave, saving }: Props) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('member')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [bio, setBio] = useState('')
  const [error, setError] = useState<string | null>(null)

  const reset = () => {
    setName('')
    setEmail('')
    setRole('member')
    setAvatarUrl('')
    setBio('')
    setError(null)
  }

  const submit = async () => {
    if (!name.trim()) {
      setError('الاسم مطلوب')
      return
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('البريد الإلكتروني غير صالح')
      return
    }
    setError(null)
    await onSave({ name: name.trim(), email: email.trim() || undefined, role, avatarUrl: avatarUrl.trim() || undefined, bio: bio.trim() || undefined })
    reset()
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v) }}>
      <DialogContent className="sm:max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle>إضافة عضو ضيف</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <Field label="الاسم" required>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="اسم العضو" />
          </Field>
          <Field label="البريد (اختياري)">
            <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@example.com" />
          </Field>
          <Field label="الدور">
            <select value={role} onChange={(e) => setRole(e.target.value)} className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm">
              {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </Field>
          <Field label="رابط الصورة (اختياري)">
            <Input value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} placeholder="https://..." />
          </Field>
          <Field label="نبذة (اختياري)">
            <Textarea value={bio} onChange={(e) => setBio(e.target.value)} placeholder="نبذة قصيرة" />
          </Field>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { reset(); onOpenChange(false) }} disabled={saving}>إلغاء</Button>
          <Button onClick={submit} disabled={saving}>{saving ? 'جاري الحفظ...' : 'إضافة'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
