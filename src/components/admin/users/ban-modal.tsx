'use client'

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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Textarea } from '@/components/ui/textarea'
import { BanUserFormSchema } from '@/lib/schemas'

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

type BanUserFormInput = z.input<typeof BanUserFormSchema>

export function BanModal({ userId, onClose, onSubmit }: BanModalProps) {
  const form = useForm<BanUserFormInput>({
    resolver: zodResolver(BanUserFormSchema),
    defaultValues: { reason: '', duration: 'permanent', days: 7, banIp: false },
  })

  const resetAndClose = () => {
    form.reset()
    onClose()
  }

  const duration = form.watch('duration')

  return (
    <Dialog open onOpenChange={(open) => !open && resetAndClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>حظر المستخدم</DialogTitle>
          <DialogDescription>اختر سبب ومدة الحظر</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((data) => {
              onSubmit({
                userId,
                duration: data.duration,
                days: Number(data.days) || 7,
                banIp: data.banIp,
                reason: data.reason ?? '',
              })
              resetAndClose()
            })}
            className="space-y-4"
          >
            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Textarea
                      placeholder="سبب الحظر (اختياري)"
                      rows={2}
                      {...field}
                      value={field.value ?? ''}
                    />
                  </FormControl>
                  <FormMessage className="text-[11px]" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="duration"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <RadioGroup
                      value={field.value}
                      onValueChange={field.onChange}
                      className="flex gap-4"
                    >
                      <FormLabel className="flex items-center gap-2 text-sm font-normal">
                        <RadioGroupItem value="permanent" />
                        دائم
                      </FormLabel>
                      <FormLabel className="flex items-center gap-2 text-sm font-normal">
                        <RadioGroupItem value="temp" />
                        مؤقت
                      </FormLabel>
                    </RadioGroup>
                  </FormControl>
                  <FormMessage className="text-[11px]" />
                </FormItem>
              )}
            />

            {duration === 'temp' && (
              <FormField
                control={form.control}
                name="days"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-1 text-sm">
                      <FormControl>
                        <Input
                          type="number"
                          className="h-8 w-20"
                          min={1}
                          value={Number(field.value) || 7}
                          onChange={(e) => field.onChange(Number(e.target.value))}
                        />
                      </FormControl>
                      يوم
                    </FormLabel>
                    <FormMessage className="text-[11px]" />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="banIp"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2 text-sm font-normal">
                    <FormControl>
                      <Input
                        type="checkbox"
                        checked={field.value}
                        onChange={(e) => field.onChange(e.target.checked)}
                        className="h-4 w-4 rounded"
                      />
                    </FormControl>
                    حظر عنوان IP أيضاً
                  </FormLabel>
                </FormItem>
              )}
            />
          </form>
        </Form>

        <DialogFooter>
          <Button variant="outline" onClick={resetAndClose}>
            إلغاء
          </Button>
          <Button
            variant="destructive"
            onClick={form.handleSubmit((data) => {
              onSubmit({
                userId,
                duration: data.duration,
                days: Number(data.days) || 7,
                banIp: data.banIp,
                reason: data.reason ?? '',
              })
              resetAndClose()
            })}
            disabled={form.formState.isSubmitting}
          >
            حظر
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
