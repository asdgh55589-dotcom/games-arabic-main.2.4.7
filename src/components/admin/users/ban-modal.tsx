'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

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
    <Dialog open onOpenChange={(open) => !open && resetAndClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>حظر المستخدم</DialogTitle>
          <DialogDescription>اختر سبب ومدة الحظر</DialogDescription>
        </DialogHeader>

        <Textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="سبب الحظر (اختياري)"
          rows={2}
        />

        <RadioGroup
          value={duration}
          onValueChange={(v) => setDuration(v as 'permanent' | 'temp')}
          className="flex gap-4"
        >
          <Label className="flex items-center gap-2 text-sm font-normal">
            <RadioGroupItem value="permanent" />
            دائم
          </Label>
          <Label className="flex items-center gap-2 text-sm font-normal">
            <RadioGroupItem value="temp" />
            مؤقت
          </Label>
        </RadioGroup>

        {duration === 'temp' && (
          <Label className="flex items-center gap-1 text-sm">
            <Input
              type="number"
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className="h-8 w-20"
              min={1}
            />
            يوم
          </Label>
        )}

        <Label className="flex items-center gap-2 text-sm font-normal">
          <Input
            type="checkbox"
            checked={banIp}
            onChange={(e) => setBanIp(e.target.checked)}
            className="h-4 w-4 rounded"
          />
          حظر عنوان IP أيضاً
        </Label>

        <DialogFooter>
          <Button variant="outline" onClick={resetAndClose}>إلغاء</Button>
          <Button
            variant="destructive"
            onClick={() => {
              onSubmit({ userId, reason, duration, days, banIp })
              resetAndClose()
            }}
          >
            حظر
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
