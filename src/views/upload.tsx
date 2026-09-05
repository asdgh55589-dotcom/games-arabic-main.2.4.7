// Updated for new API response format
'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { Check, ChevronLeft, FileArchive, Image as ImageIcon, Tag, Upload } from 'lucide-react'
import Link from 'next/link'
import { useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import type { z } from 'zod'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useDocumentTitle } from '@/hooks/use-document-title'
import { useFetch } from '@/hooks/use-fetch'
import { useToast } from '@/hooks/use-toast'
import { UploadModSchema } from '@/lib/schemas'
import type { GameDetail, GameSummary } from '@/lib/types'

type UploadModInput = z.input<typeof UploadModSchema>

export function UploadPage() {
  useDocumentTitle('Upload a Mod')
  const form = useForm<UploadModInput>({
    resolver: zodResolver(UploadModSchema),
    defaultValues: {
      name: '',
      summary: '',
      description: '',
      gameSlug: '',
      category: '',
      version: '1.0.0',
      tags: '',
    },
  })
  const [modFileName, setModFileName] = useState<string | null>(null)
  const [imageFileName, setImageFileName] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [submittedName, setSubmittedName] = useState('')
  const { toast } = useToast()
  const modFileRef = useRef<HTMLInputElement>(null)
  const imageFileRef = useRef<HTMLInputElement>(null)

  const gameSlug = form.watch('gameSlug')

  const { data: gamesData } = useFetch<{ data: GameSummary[] }>('/api/games?sort=name&limit=50')
  const { data: gameData } = useFetch<{ data: GameDetail }>(
    gameSlug ? `/api/games/${gameSlug}` : null,
    [gameSlug],
  )

  const resetForm = () => {
    form.reset()
    setModFileName(null)
    setImageFileName(null)
    if (modFileRef.current) modFileRef.current.value = ''
    if (imageFileRef.current) imageFileRef.current.value = ''
  }

  const onSubmit = async (data: UploadModInput) => {
    if (!modFileName) {
      form.setError('root', { message: 'اختر ملف التعريب أولاً (.zip أو .7z أو .rar)' })
      toast({
        title: 'ملف ناقص',
        description: 'اختر ملف التعريب لرفعه',
        variant: 'destructive',
      })
      return
    }
    const game = gameData?.data
    if (!game) {
      form.setError('root', { message: 'اختر لعبة صحيحة من القائمة' })
      toast({
        title: 'اللعبة غير موجودة',
        description: 'اختر لعبة صحيحة',
        variant: 'destructive',
      })
      return
    }
    try {
      const res = await fetch('/api/admin/mods', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.name,
          summary: data.summary,
          description: data.description || data.summary,
          gameId: game.id,
          categoryId: data.category || undefined,
          version: data.version,
          tags: data.tags,
          thumbnailUrl: game.thumbnailUrl,
          imageUrl: game.bannerUrl,
          fileSize: 'Unknown',
          fileFormat: 'zip',
        }),
      })
      if (!res.ok) {
        const resData = await res.json().catch(() => ({}))
        if (res.status === 401) {
          form.setError('root', { message: 'لازم تسجل الدخول كمُشرف لرفع التعريبات' })
          toast({
            title: 'تسجيل الدخول مطلوب',
            description: 'لازم تسجل الدخول كمُشرف لرفع التعريبات.',
            variant: 'destructive',
          })
          return
        }
        if (res.status === 403) {
          form.setError('root', { message: 'المشرفون والمديرون فقط يقدروا يرفعوا تعريبات' })
          toast({
            title: 'صلاحيات غير كافية',
            description: 'المشرفون والمديرون فقط يقدروا يرفعوا تعريبات.',
            variant: 'destructive',
          })
          return
        }
        throw new Error(resData?.error || 'فشل إرسال التعريب')
      }
      setSubmittedName(data.name)
      setSubmitted(true)
      toast({
        title: 'تم إرسال التعريب!',
        description: 'تم إنشاء التعريب بنجاح.',
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'تعذّر إرسال التعريب'
      form.setError('root', { message: msg })
      toast({
        title: 'فشل الإرسال',
        description: msg,
        variant: 'destructive',
      })
    }
  }

  if (submitted) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <div className="mx-auto mb-6 grid h-16 w-16 place-items-center rounded-full bg-primary/15 text-primary">
          <Check className="h-8 w-8" />
        </div>
        <h1 className="text-3xl font-bold">Mod Submitted!</h1>
        <p className="mt-3 text-muted-foreground">
          Thank you for contributing to the community. Your mod &quot;{submittedName}&quot; is now
          in the moderation queue. You&apos;ll receive a notification once it&apos;s approved and
          live.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Button
            onClick={() => {
              setSubmitted(false)
              resetForm()
            }}
          >
            Upload Another
          </Button>
          <Button asChild variant="outline">
            <Link href="/">Back to Home</Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 lg:px-6">
      <Button asChild variant="ghost" size="sm" className="mb-4 min-h-[44px]">
        <Link href="/">
          <ChevronLeft className="mr-1 h-4 w-4" /> Back
        </Link>
      </Button>

      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">
          <Upload className="mr-2 inline h-7 w-7 text-primary" />
          Upload a Mod
        </h1>
        <p className="mt-1 text-muted-foreground">
          Share your work with the modding community. All uploads are reviewed before going live.
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Card className="space-y-4 p-6">
            <h2 className="text-lg font-semibold">Basic Information</h2>

            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>اسم التعريب *</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Unofficial Skyrim Patch" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="summary"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>الملخص *</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="A one-line description of your mod"
                      maxLength={200}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                  <p className="text-xs text-muted-foreground">
                    {field.value.length}/200 characters
                  </p>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>الوصف</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Describe your mod in detail. Supports markdown formatting…"
                      rows={8}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                  <p className="text-xs text-muted-foreground">
                    Markdown supported. Use ## for headings, - for lists.
                  </p>
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="gameSlug"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>اللعبة *</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={(v) => {
                        field.onChange(v)
                        form.setValue('category', '')
                      }}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a game" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {gamesData?.data?.map((g) => (
                          <SelectItem key={g.id} value={g.slug}>
                            {g.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>التصنيف</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                      disabled={!gameData?.data}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a category" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {gameData?.data?.categories?.map((c) => (
                          <SelectItem key={c.id} value={c.slug}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="version"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>النسخة</FormLabel>
                    <FormControl>
                      <Input placeholder="1.0.0" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="tags"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>الوسوم</FormLabel>
                    <FormControl>
                      <Input placeholder="comma, separated, tags" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </Card>

          <Card className="space-y-4 p-6">
            <h2 className="text-lg font-semibold">Files &amp; Media</h2>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FileDropzone
                icon={<FileArchive className="h-8 w-8" />}
                label="Mod File *"
                hint={modFileName ? modFileName : '.zip, .7z, or .rar (max 2GB)'}
                filled={!!modFileName}
                inputRef={modFileRef}
                accept=".zip,.7z,.rar"
                onFileSelected={(name) => setModFileName(name)}
              />
              <FileDropzone
                icon={<ImageIcon className="h-8 w-8" />}
                label="Hero Image"
                hint={imageFileName ? imageFileName : '.jpg or .png (16:9 recommended)'}
                filled={!!imageFileName}
                inputRef={imageFileRef}
                accept="image/jpeg,image/png"
                onFileSelected={(name) => setImageFileName(name)}
              />
            </div>

            <TagPreview tags={form.watch('tags') || ''} />
          </Card>

          {form.formState.errors.root && (
            <p className="text-sm text-destructive">{form.formState.errors.root.message}</p>
          )}

          <div className="flex gap-3">
            <Button
              type="submit"
              size="lg"
              className="flex-1"
              disabled={form.formState.isSubmitting}
            >
              <Upload className="mr-2 h-4 w-4" />{' '}
              {form.formState.isSubmitting ? 'جارٍ الإرسال...' : 'Submit for Review'}
            </Button>
            <Button type="button" variant="outline" size="lg" asChild>
              <Link href="/">Cancel</Link>
            </Button>
          </div>
        </form>
      </Form>
    </div>
  )
}

function TagPreview({ tags }: { tags: string }) {
  if (!tags) return null
  return (
    <div>
      <p className="mb-2 block text-sm font-medium">Tag Preview</p>
      <div className="flex flex-wrap gap-2">
        {tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean)
          .map((t) => (
            <Badge key={t} variant="secondary" className="gap-1">
              <Tag className="h-3 w-3" /> {t}
            </Badge>
          ))}
      </div>
    </div>
  )
}

function FileDropzone({
  icon,
  label,
  hint,
  filled = false,
  inputRef,
  accept,
  onFileSelected,
}: {
  icon: React.ReactNode
  label: string
  hint: string
  filled?: boolean
  inputRef: React.RefObject<HTMLInputElement | null>
  accept?: string
  onFileSelected: (fileName: string) => void
}) {
  return (
    <button
      type="button"
      onClick={() => inputRef.current?.click()}
      className={`flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 text-center transition-colors ${
        filled
          ? 'border-primary/60 bg-primary/5'
          : 'border-border/60 bg-card/40 hover:border-primary/40 hover:bg-accent'
      }`}
    >
      <div className={filled ? 'text-primary' : 'text-muted-foreground'}>{icon}</div>
      <div className="text-sm font-medium">{label}</div>
      <div
        className={`max-w-full truncate text-xs ${filled ? 'text-primary' : 'text-muted-foreground'}`}
      >
        {hint}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) onFileSelected(file.name)
        }}
      />
    </button>
  )
}
