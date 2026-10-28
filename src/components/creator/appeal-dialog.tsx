'use client'

import { useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import type { z } from 'zod'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { AppealSchema, AppealFormValues } from '@/lib/schemas/appeal'

interface AppealDialogProps {
  reportId: string
  open?: boolean
  onOpenChange?: (open: boolean) => void
  onSuccess?: () => void
  triggerLabel?: string
}

export function AppealDialog({
  reportId,
  open: openProp,
  onOpenChange,
  onSuccess,
  triggerLabel = 'استئناف',
}: AppealDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false)
  const isControlled = openProp !== undefined
  const open = isControlled ? !!openProp : internalOpen

  const form = useForm<AppealFormValues>({
    resolver: zodResolver(AppealSchema),
    defaultValues: { reason: '', evidenceUrl: '' },
  })

  const setOpen = (value: boolean) => {
    if (!value) form.reset()
    if (!isControlled) setInternalOpen(value)
    onOpenChange?.(value)
  }

  const handleSubmit = async (data: AppealFormValues) => {
    try {
      const res = await fetch(`/api/creator/reports/${reportId}/appeal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: data.reason,
          evidenceUrl: data.evidenceUrl || undefined,
        }),
      })
      const json = await res.json().catch(() => null)
      if (res.ok) {
        form.reset()
        setOpen(false)
        onSuccess?.()
      } else {
        const msg = json?.error?.message || 'فشل إرسال الطعن'
        form.setError('root', { message: msg })
      }
    } catch {
      form.setError('root', { message: 'فشل إرسال الطعن' })
    }
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        {triggerLabel}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent dir="rtl" className="max-w-md">
          <DialogHeader>
            <DialogTitle>استئناف</DialogTitle>
            <DialogDescription>سبب الطعن</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="reason"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>سبب الطعن</FormLabel>
                    <FormControl>
                      <Textarea placeholder="سبب الطعن" {...field} />
                    </FormControl>
                    <FormMessage className="text-[11px]" />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="evidenceUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>رابط دليل (اختياري)</FormLabel>
                    <FormControl>
                      <Input placeholder="رابط دليل (اختياري)" {...field} />
                    </FormControl>
                    <FormMessage className="text-[11px]" />
                  </FormItem>
                )}
              />
              {form.formState.errors.root && (
                <p className="text-[11px] text-destructive">
                  {form.formState.errors.root.message}
                </p>
              )}
              <DialogFooter className="gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOpen(false)}
                  disabled={form.formState.isSubmitting}
                >
                  إلغاء
                </Button>
                <Button type="submit" disabled={form.formState.isSubmitting}>
                  {form.formState.isSubmitting ? 'جاري الإرسال...' : 'استئناف'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  )
}
