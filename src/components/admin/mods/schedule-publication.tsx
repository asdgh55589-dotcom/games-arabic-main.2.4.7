'use client'

import { useState } from 'react'
import { Calendar, Clock, Loader2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface SchedulePublicationProps {
  modId: string
  modName: string
  currentScheduledAt?: string | null
  onScheduled?: () => void
}

export function SchedulePublication({
  modId,
  modName,
  currentScheduledAt,
  onScheduled,
}: SchedulePublicationProps) {
  const [date, setDate] = useState('')
  const [time, setTime] = useState('18:00')
  const [loading, setLoading] = useState(false)
  const [scheduled, setScheduled] = useState(!!currentScheduledAt)

  const handleSchedule = async () => {
    if (!date) return
    setLoading(true)
    try {
      const scheduledAt = new Date(`${date}T${time}:00`)
      const res = await fetch('/api/admin/scheduler', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'telegram_post',
          modId,
          scheduledAt: scheduledAt.toISOString(),
          payload: { modName },
        }),
      })
      const data = await res.json()
      if (data.data) {
        setScheduled(true)
        onScheduled?.()
      } else {
        alert(data.error?.message || 'فشل الجدولة')
      }
    } catch (err) {
      alert('فشل الجدولة')
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = async () => {
    setLoading(true)
    try {
      // Find and cancel the job
      const res = await fetch(`/api/admin/scheduler?status=pending`)
      const data = await res.json()
      const job = data.data?.jobs?.find((j: any) => j.modId === modId)
      if (job) {
        await fetch(`/api/admin/scheduler?id=${job.id}`, { method: 'DELETE' })
        setScheduled(false)
        onScheduled?.()
      }
    } catch (err) {
      alert('فشل الإلغاء')
    } finally {
      setLoading(false)
    }
  }

  if (scheduled) {
    return (
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <Calendar className="h-5 w-5 text-primary" />
            <div>
              <div className="text-sm font-medium">مجدول للنشر</div>
              <div className="text-xs text-muted-foreground">
                {currentScheduledAt
                  ? new Date(currentScheduledAt).toLocaleString('ar-SA')
                  : 'تم الجدولة'}
              </div>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCancel}
            disabled={loading}
            className="text-red-600 min-h-[44px]"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
            إلغاء
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Clock className="h-4 w-4" />
          جدولة النشر
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted-foreground">التاريخ</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">الوقت</label>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm"
            />
          </div>
        </div>
        <Button
          onClick={handleSchedule}
          disabled={!date || loading}
          className="w-full"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : <Calendar className="h-4 w-4 ml-2" />}
          جدولة النشر
        </Button>
      </CardContent>
    </Card>
  )
}
