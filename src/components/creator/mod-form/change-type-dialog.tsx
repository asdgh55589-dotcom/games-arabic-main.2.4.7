'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Field } from '@/components/creator/mod-form/primitives'

export type ChangeType = 'release' | 'update' | 'edit'

interface ChangeTypeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (data: { type: ChangeType; title: string; description: string }) => void
  saving?: boolean
}

const CHANGE_TYPE_OPTIONS: { value: ChangeType; label: string; description: string; color: string }[] = [
  {
    value: 'edit',
    label: 'تعديل',
    description: 'إصلاح خطأ أو تحسين بسيط',
    color: 'bg-gray-100 border-gray-300 text-gray-700',
  },
  {
    value: 'update',
    label: 'تحديث',
    description: 'إضافة ميزة أو توافق جديد',
    color: 'bg-blue-100 border-blue-300 text-blue-700',
  },
  {
    value: 'release',
    label: 'إصدار جديد',
    description: 'نسخة كاملة جديدة',
    color: 'bg-green-100 border-green-300 text-green-700',
  },
]

export function ChangeTypeDialog({ open, onOpenChange, onSave, saving }: ChangeTypeDialogProps) {
  const [type, setType] = useState<ChangeType>('edit')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')

  const handleSave = () => {
    if (!title.trim()) return
    onSave({ type, title: title.trim(), description: description.trim() })
    // Reset form
    setType('edit')
    setTitle('')
    setDescription('')
  }

  const handleCancel = () => {
    onOpenChange(false)
    // Reset form
    setType('edit')
    setTitle('')
    setDescription('')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle>ما نوع هذا التغيير؟</DialogTitle>
          <DialogDescription>
            اختر نوع التغيير وأضف عنواناً وصفاً اختيارياً
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Change type selection */}
          <div className="space-y-2">
            {CHANGE_TYPE_OPTIONS.map((option) => (
              <label
                key={option.value}
                className={`flex cursor-pointer items-center gap-3 rounded-lg border-2 p-3 transition-all ${
                  type === option.value
                    ? `${option.color} border-current`
                    : 'border-border hover:border-muted-foreground/30'
                }`}
              >
                <input
                  type="radio"
                  name="changeType"
                  value={option.value}
                  checked={type === option.value}
                  onChange={(e) => setType(e.target.value as ChangeType)}
                  className="sr-only"
                />
                <span className={`flex h-4 w-4 items-center justify-center rounded-full border-2 ${
                  type === option.value ? 'border-current' : 'border-muted-foreground/50'
                }`}>
                  {type === option.value && (
                    <span className="h-2 w-2 rounded-full bg-current" />
                  )}
                </span>
                <div>
                  <span className="text-sm font-bold">{option.label}</span>
                  <span className="mr-2 text-xs text-muted-foreground">{option.description}</span>
                </div>
              </label>
            ))}
          </div>

          {/* Title field */}
          <Field label="عنوان التغيير" required>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="مثال: إضافة دعم منصة جديدة"
              maxLength={200}
            />
          </Field>

          {/* Description field */}
          <Field label="وصف التغيير (اختياري)">
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="وصف مختصر للتغييرات..."
              maxLength={1000}
            />
          </Field>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleCancel} disabled={saving}>
            إلغاء
          </Button>
          <Button onClick={handleSave} disabled={!title.trim() || saving}>
            {saving ? 'جاري الحفظ...' : 'حفظ التغيير'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
