'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { CreateModSchema } from '@/lib/schemas'
import { z } from 'zod'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Save, Send, AlertCircle } from 'lucide-react'
import type { UserRole } from '@/lib/roles'

type FormData = z.infer<typeof CreateModSchema>

interface ModFormProps {
  mode: 'create' | 'edit'
  modId?: string
  initialData?: Partial<FormData & { platform?: string }>
  userRole: UserRole
  games: Array<{ id: string; name: string; slug: string }>
  platforms?: Array<{ key: string; name: string }>
  sections?: Array<{ id: string; name: string }>
}

export function ModForm({ mode, modId, initialData, userRole, games, platforms, sections }: ModFormProps) {
  const router = useRouter()
  const [isSaving, setIsSaving] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isPublisher = userRole === 'publisher' && mode === 'create'

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(CreateModSchema as never) as never,
    defaultValues: {
      isOriginalWork: isPublisher ? false : (initialData?.isOriginalWork ?? true),
      ...initialData,
    } as unknown as FormData,
  })

  const isOriginalWork = watch('isOriginalWork' as unknown as keyof FormData) as unknown as boolean

  const onSave = async (data: FormData) => {
    setIsSaving(true)
    setError(null)
    try {
      const url = mode === 'create' ? '/api/creator/mods' : `/api/creator/mods/${modId}`
      const res = await fetch(url, {
        method: mode === 'create' ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, action: 'draft' }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(json.error?.message || json.error?.details || json.error || 'حدث خطأ أثناء الحفظ')
      }
      router.push('/creator/mods')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حدث خطأ')
    } finally {
      setIsSaving(false)
    }
  }

  const onSubmitForReview = async (data: FormData) => {
    setIsSubmitting(true)
    setError(null)
    try {
      const url = mode === 'create' ? '/api/creator/mods' : `/api/creator/mods/${modId}`
      const res = await fetch(url, {
        method: mode === 'create' ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, action: 'submit' }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(json.error?.message || json.error?.details || json.error || 'حدث خطأ أثناء الإرسال')
      }
      router.push('/creator/mods')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حدث خطأ')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form className="space-y-6" dir="rtl" onSubmit={(e) => e.preventDefault()}>
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Basic info */}
      <Card>
        <CardHeader>
          <CardTitle>المعلومات الأساسية</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="name">اسم التعريب *</Label>
            <Input id="name" {...register('name')} placeholder="مثال: تعريب لعبة The Witcher 3" />
            {errors.name && <p className="text-sm text-destructive mt-1">{(errors.name as unknown as { message: string }).message}</p>}
          </div>

          <div>
            <Label htmlFor="summary">الملخص *</Label>
            <Input id="summary" {...register('summary')} placeholder="ملخص قصير للتعريب" />
            {(errors as unknown as Record<string, { message: string }>).summary && (
              <p className="text-sm text-destructive mt-1">{(errors as unknown as Record<string, { message: string }>).summary.message}</p>
            )}
          </div>

          <div>
            <Label htmlFor="description">الوصف *</Label>
            <Textarea id="description" {...register('description')} rows={5} placeholder="اكتب وصفاً تفصيلياً للتعريب..." />
            {errors.description && <p className="text-sm text-destructive mt-1">{(errors.description as unknown as { message: string }).message}</p>}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>اللعبة *</Label>
              <Select onValueChange={(v) => setValue('gameId' as unknown as keyof FormData, v as unknown as never)} defaultValue={(initialData as unknown as { gameId?: string })?.gameId}>
                <SelectTrigger>
                  <SelectValue placeholder="اختر اللعبة" />
                </SelectTrigger>
                <SelectContent>
                  {games.map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {(errors as unknown as Record<string, { message: string }>).gameId && (
                <p className="text-sm text-destructive mt-1">{(errors as unknown as Record<string, { message: string }>).gameId.message}</p>
              )}
            </div>

            <div>
              <Label>المنصة</Label>
              <Select
                onValueChange={(v) => setValue('platform' as unknown as keyof FormData, v as unknown as never)}
                defaultValue={(initialData as unknown as { platform?: string })?.platform}
              >
                <SelectTrigger>
                  <SelectValue placeholder="اختر المنصة" />
                </SelectTrigger>
                <SelectContent>
                  {(platforms || []).map((p) => (
                    <SelectItem key={p.key} value={p.key}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="version">الإصدار</Label>
              <Input id="version" {...register('version')} placeholder="1.0.0" />
            </div>
            <div>
              <Label htmlFor="thumbnailUrl">رابط الصورة المصغرة *</Label>
              <Input id="thumbnailUrl" {...register('thumbnailUrl')} placeholder="https://..." />
              {errors.thumbnailUrl && <p className="text-sm text-destructive mt-1">{(errors.thumbnailUrl as unknown as { message: string }).message}</p>}
            </div>
          </div>

          <div>
            <Label htmlFor="imageUrl">رابط الصورة الرئيسية *</Label>
            <Input id="imageUrl" {...register('imageUrl')} placeholder="https://..." />
            {errors.imageUrl && <p className="text-sm text-destructive mt-1">{(errors.imageUrl as unknown as { message: string }).message}</p>}
          </div>
        </CardContent>
      </Card>

      {/* Original vs External */}
      <Card>
        <CardHeader>
          <CardTitle>مصدر التعريب</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <Switch
              id="isOriginalWork"
              checked={!!isOriginalWork}
              onCheckedChange={(v) => setValue('isOriginalWork' as unknown as keyof FormData, v as unknown as never)}
              disabled={isPublisher}
            />
            <Label htmlFor="isOriginalWork">{isOriginalWork ? 'هذا التعريب من ترجمتي الخاصة' : 'هذا التعريب من مصدر خارجي'}</Label>
          </div>

          {!isOriginalWork && (
            <div className="space-y-4 p-4 bg-amber-500/10 rounded-lg border border-amber-500/20">
              <p className="text-sm text-amber-600">⚠️ كناشر، يجب عليك ذكر المصدر الأصلي للتعريب</p>
              <div>
                <Label htmlFor="originalSource">المصدر الأصلي *</Label>
                <Input id="originalSource" {...register('originalSource' as unknown as keyof FormData)} placeholder="رابط أو اسم المصدر" />
                {(errors as unknown as Record<string, { message: string }>).originalSource && (
                  <p className="text-sm text-destructive mt-1">{(errors as unknown as Record<string, { message: string }>).originalSource.message}</p>
                )}
              </div>
              <div>
                <Label htmlFor="originalAuthor">اسم المترجم الأصلي</Label>
                <Input id="originalAuthor" {...register('originalAuthor' as unknown as keyof FormData)} placeholder="اسم الشخص أو الفريق الذي ترجم" />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex items-center gap-4 flex-wrap">
        <Button type="button" variant="outline" onClick={handleSubmit(onSave as unknown as never)} disabled={isSaving || isSubmitting} className="min-h-[44px]">
          {isSaving ? <Loader2 className="h-4 w-4 ml-2 animate-spin" /> : <Save className="h-4 w-4 ml-2" />}
          حفظ كمسودة
        </Button>
        <Button type="button" onClick={handleSubmit(onSubmitForReview as unknown as never)} disabled={isSaving || isSubmitting} className="min-h-[44px]">
          {isSubmitting ? <Loader2 className="h-4 w-4 ml-2 animate-spin" /> : <Send className="h-4 w-4 ml-2" />}
          إرسال للمراجعة
        </Button>
      </div>
    </form>
  )
}
