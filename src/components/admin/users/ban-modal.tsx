'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface BanModalProps {
  userId: string
  onClose: () => void
  onSubmit: (data: {
    userId: string
    reason: string
    duration: 'permanent' | 'temp'
    days: number
    banIp: boolean
  }) => void
}

export function BanModal({ userId, onClose, onSubmit }: BanModalProps) {
  const [reason, setReason] = useState('')
  const [duration, setDuration] = useState<'permanent' | 'temp'>('permanent')
  const [days, setDays] = useState(7)
  const [banIp, setBanIp] = useState(false)

  const resetAndClose = () => {
    setReason('')
    setDuration('permanent')
    setDays(7)
    setBanIp(false)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/50"
      onClick={resetAndClose}
    >
      <div
        className="w-full max-w-sm rounded-xl border border-border bg-card p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="mb-3 text-sm font-bold">حظر المستخدم</h3>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="سبب الحظر (اختياري)"
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          rows={2}
        />
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              checked={duration === 'permanent'}
              onChange={() => setDuration('permanent')}
            />
            دائم
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              checked={duration === 'temp'}
              onChange={() => setDuration('temp')}
            />
            مؤقت
          </label>
          {duration === 'temp' && (
            <label className="flex items-center gap-1 text-sm">
              <Input
                type="number"
                value={days}
                onChange={(e) => setDays(Number(e.target.value))}
                className="h-8 w-20"
                min={1}
              />
              يوم
            </label>
          )}
        </div>
        <label className="mt-3 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={banIp}
            onChange={(e) => setBanIp(e.target.checked)}
            className="rounded"
          />
          حظر عنوان IP أيضاً (منع إنشاء حسابات جديدة من نفس الجهاز)
        </label>
        <div className="mt-3 flex justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={resetAndClose}
          >
            إلغاء
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={() => {
              onSubmit({
                userId,
                reason,
                duration,
                days,
                banIp,
              })
              resetAndClose()
            }}
          >
            حظر
          </Button>
        </div>
      </div>
    </div>
  )
}
