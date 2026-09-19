'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { Flag, Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
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
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { useToast } from '@/hooks/use-toast'
import { REPORT_REASONS, type ReportTargetType } from '@/lib/reports/constants'
import { ReportFormSchema } from '@/lib/schemas'
import { useAuth } from '@/contexts/auth-context'

interface ReportDialogProps {
  targetType: ReportTargetType
  targetId: string
  children?: React.ReactNode
  onSuccess?: () => void
}

type ReportFormInput = z.input<typeof ReportFormSchema>

export function ReportDialog({ targetType, targetId, children, onSuccess }: ReportDialogProps) {
  const [open, setOpen] = useState(false)
  const { toast } = useToast()
  const { user } = useAuth()
  const router = useRouter()

  const form = useForm<ReportFormInput>({
    resolver: zodResolver(ReportFormSchema),
    defaultValues: { reason: undefined as unknown as ReportFormInput['reason'], description: '' },
  })

  // Auth gate: guests get feedback + login redirect instead of a dead dialog.
  const handleOpenChange = (v: boolean) => {
    if (v && !user) {
      toast({
        title: 'سجّل الدخول',
        description: 'يجب تسجيل الدخول للإبلاغ عن المحتوى',
        variant: 'destructive',
      })
      router.push('/login')
      return
    }
    setOpen(v)
    if (!v) form.reset()
  }

  const handleSubmit = async (data: ReportFormInput) => {
    if (!user) {
      toast({
        title: 'سجّل الدخول',
        description: 'يجب تسجيل الدخول للإبلاغ عن المحتوى',
        variant: 'destructive',
      })
      router.push('/login')
      return
    }
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10_000)
    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetType,
          targetId,
          reason: data.reason,
          description: data.description,
        }),
        signal: controller.signal,
      })

      const resData = await res.json().catch(() => null)

      if (!res.ok) {
        if (res.status === 401) {
          toast({
            title: 'سجّل الدخول',
            description: 'انتهت الجلسة — سجّل الدخول ثم حاول مجدداً',
            variant: 'destructive',
          })
          router.push('/login')
          return
        }
        if (res.status === 429) {
          toast({ title: 'حاول مرة أخرى لاحقاً', description: 'تجاوزت حد المحاولات', variant: 'destructive' })
          return
        }
        const msg = resData?.error?.message || 'فشل إرسال البلاغ'
        form.setError('root', { message: msg })
        toast({ title: msg, variant: 'destructive' })
        return
      }

      toast({ title: 'لقد تم استلام بلاغك', description: 'شكراً لمساهمتك، ستتم مراجعته قريباً' })
      onSuccess?.()
      setOpen(false)
      form.reset()
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        form.setError('root', { message: 'انتهت المهلة — تحقق من اتصالك' })
        toast({ title: 'خطأ في الاتصال', description: 'انتهت المهلة — تحقق من اتصالك', variant: 'destructive' })
      } else {
        form.setError('root', { message: 'حدث خطأ أثناء إرسال البلاغ' })
        toast({ title: 'حدث خطأ أثناء إرسال البلاغ', variant: 'destructive' })
      }
    } finally {
      clearTimeout(timeout)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={handleOpenChange}
    >
      <DialogTrigger asChild>
        {children || (
          <Button
            variant="ghost"
            size="sm"
            className="gap-2 text-muted-foreground hover:text-destructive min-h-[44px]"
          >
            <Flag className="h-4 w-4" />
            إبلاغ
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Flag className="h-5 w-5 text-destructive" />
            الإبلاغ عن محتوى
          </DialogTitle>
          <DialogDescription>
            ساعدنا في الحفاظ على جودة المحتوى. جميع البلاغات تُفحص بسرية تامة.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 py-4">
            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>سبب البلاغ *</FormLabel>
                  <FormControl>
                    <select
                      value={field.value || ''}
                      onChange={(e) => field.onChange(e.target.value)}
                      className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                    >
                      <option value="">اختر سبب البلاغ...</option>
                      {Object.entries(REPORT_REASONS).map(([key, config]) => (
                        <option key={key} value={key}>
                          {config.label}
                        </option>
                      ))}
                    </select>
                  </FormControl>
                  <FormMessage className="text-[11px]" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>تفاصيل إضافية (اختياري)</FormLabel>
                  <FormControl>
                    <textarea
                      placeholder="اشرح المشكلة بالتفصيل..."
                      rows={3}
                      className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage className="text-[11px]" />
                </FormItem>
              )}
            />

            {form.formState.errors.root && (
              <p className="text-[11px] text-destructive">{form.formState.errors.root.message}</p>
            )}
          </form>
        </Form>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            إلغاء
          </Button>
          <Button onClick={form.handleSubmit(handleSubmit)} disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> جاري الإرسال...
              </>
            ) : (
              'إرسال البلاغ'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
