'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
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
import { AdminEditUserSchema } from '@/lib/schemas'

interface EditUserDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  user: {
    id: string
    username: string
    displayName: string | null
    email: string
    bio: string | null
  }
  onSuccess: () => void
}

type AdminEditUserInput = z.infer<typeof AdminEditUserSchema>

export function EditUserDialog({ open, onOpenChange, user, onSuccess }: EditUserDialogProps) {
  const form = useForm<AdminEditUserInput>({
    resolver: zodResolver(AdminEditUserSchema),
    defaultValues: {
      username: user.username,
      displayName: user.displayName || '',
      email: user.email,
      bio: user.bio || '',
    },
  })

  useEffect(() => {
    form.reset({
      username: user.username,
      displayName: user.displayName || '',
      email: user.email,
      bio: user.bio || '',
    })
  }, [user, form])

  const handleSubmit = async (data: AdminEditUserInput) => {
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: data.username.trim(),
          displayName: data.displayName?.trim() || null,
          email: data.email.trim(),
          bio: data.bio?.trim() || null,
        }),
      })
      const resData = await res.json().catch(() => ({}))
      if (res.ok) {
        toast.success('تم تحديث بيانات المستخدم بنجاح')
        onOpenChange(false)
        onSuccess()
      } else {
        const msg =
          resData?.error?.message ||
          (typeof resData?.error === 'string' ? resData.error : null) ||
          'فشل تحديث البيانات'
        form.setError('root', { message: msg })
        toast.error(msg)
      }
    } catch {
      form.setError('root', { message: 'خطأ في الاتصال' })
      toast.error('خطأ في الاتصال')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-w-md">
        <DialogHeader>
          <DialogTitle>تعديل بيانات المستخدم</DialogTitle>
          <DialogDescription>تعديل @{user.username}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="username"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>اسم المستخدم</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage className="text-[11px]" />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="displayName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>اسم العرض</FormLabel>
                  <FormControl>
                    <Input placeholder="اختياري" {...field} value={field.value ?? ''} />
                  </FormControl>
                  <FormMessage className="text-[11px]" />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>البريد الإلكتروني</FormLabel>
                  <FormControl>
                    <Input type="email" dir="ltr" {...field} />
                  </FormControl>
                  <FormMessage className="text-[11px]" />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="bio"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>النبذة</FormLabel>
                  <FormControl>
                    <Textarea rows={3} placeholder="اختياري" {...field} value={field.value ?? ''} />
                  </FormControl>
                  <FormMessage className="text-[11px]" />
                </FormItem>
              )}
            />
            {form.formState.errors.root && (
              <p className="text-[11px] text-destructive">{form.formState.errors.root.message}</p>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={form.formState.isSubmitting}
              >
                إلغاء
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? 'جاري الحفظ...' : 'حفظ'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
