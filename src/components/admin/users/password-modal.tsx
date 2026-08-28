'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface PasswordModalProps {
  userId: string
  onClose: () => void
  onSubmit: (userId: string, password: string) => void
}

export function PasswordModal({ userId, onClose, onSubmit }: PasswordModalProps) {
  const [password, setPassword] = useState('')
  const isValid = password.length >= 6

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-xl border border-border bg-card p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="mb-3 text-sm font-bold">تغيير كلمة المرور</h3>
        <Input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="كلمة المرور الجديدة (6 أحرف على الأقل)"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Enter' && isValid) onSubmit(userId, password)
          }}
        />
        {password.length > 0 && !isValid && (
          <p className="mt-1 text-xs text-destructive">6 أحرف على الأقل</p>
        )}
        <div className="mt-3 flex justify-end gap-2">
          <Button variant="outline" size="sm" className="min-h-[44px]" onClick={onClose}>
            إلغاء
          </Button>
          <Button size="sm" className="min-h-[44px]" disabled={!isValid} onClick={() => onSubmit(userId, password)}>
            حفظ
          </Button>
        </div>
      </div>
    </div>
  )
}
