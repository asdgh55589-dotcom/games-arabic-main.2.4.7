'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import type { z } from 'zod'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { AdminPasswordFormSchema } from '@/lib/schemas'

interface PasswordModalProps {
  userId: string
  onClose: () => void
  onSubmit: (userId: string, password: string) => void
}

type AdminPasswordFormInput = z.infer<typeof AdminPasswordFormSchema>

export function PasswordModal({ userId, onClose, onSubmit }: PasswordModalProps) {
  const form = useForm<AdminPasswordFormInput>({
    resolver: zodResolver(AdminPasswordFormSchema),
    defaultValues: { password: '' },
  })

  const submit = (data: AdminPasswordFormInput) => {
    onSubmit(userId, data.password)
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-xl border border-border bg-card p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="mb-3 text-sm font-bold">تغيير كلمة المرور</h3>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(submit)} className="space-y-2">
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="sr-only">كلمة المرور الجديدة</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      dir="ltr"
                      placeholder="كلمة المرور الجديدة (6 أحرف على الأقل)"
                      autoFocus
                      {...field}
                    />
                  </FormControl>
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />
            <div className="mt-3 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="min-h-[44px]"
                onClick={onClose}
              >
                إلغاء
              </Button>
              <Button
                type="submit"
                size="sm"
                className="min-h-[44px]"
                disabled={form.formState.isSubmitting}
              >
                حفظ
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </div>
  )
}
