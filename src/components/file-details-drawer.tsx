'use client'

import { Check, Copy, ExternalLink, Loader2, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { useToast } from '@/hooks/use-toast'

export interface ManagedFile {
  id: string
  userId: string
  modId: string | null
  kind: string
  provider: string
  originalUrl: string
  wrappedUrl: string | null
  storageKey: string | null
  bytes: number
  mime: string | null
  checksum: string | null
  createdAt: string
  user?: { id: string; username: string; avatarUrl: string | null; role: string } | null
  mod?: { id: string; name: string; slug: string } | null
}

interface LinkedRef {
  id: string
  label: string | null
  provider: string
  file: { id: string; title: string; modId: string }
}

const PROVIDER_LABELS: Record<string, string> = {
  ia: 'Internet Archive',
  freeimage: 'FreeImage',
  direct: 'رابط مباشر',
  cloudinary: 'Cloudinary',
  supabase: 'Supabase',
}

function fmtBytes(n: number): string {
  if (!Number.isFinite(n) || n < 0) return '—'
  if (n >= 1024 ** 3) return `${Number((n / 1024 ** 3).toFixed(1))}GB`
  if (n >= 1024 ** 2) return `${Number((n / 1024 ** 2).toFixed(1))}MB`
  if (n >= 1024) return `${Number((n / 1024).toFixed(1))}KB`
  return `${n}B`
}

function fileNameOf(url: string): string {
  try {
    const parts = new URL(url).pathname.split('/').filter(Boolean)
    return decodeURIComponent(parts[parts.length - 1] || url)
  } catch {
    return url
  }
}

export function FileDetailsDrawer({
  file,
  open,
  onOpenChange,
  detailsBase,
  deleteBase,
  onDeleted,
  embedEndpoint,
}: {
  file: ManagedFile | null
  open: boolean
  onOpenChange: (v: boolean) => void
  /** GET base, e.g. /api/admin/files */
  detailsBase: string
  /** DELETE base, e.g. /api/admin/files */
  deleteBase: string
  onDeleted: (id: string) => void
  /** POST embed endpoint (creator scope) — hidden when omitted. */
  embedEndpoint?: string
}) {
  const { toast } = useToast()
  const [linked, setLinked] = useState<LinkedRef[] | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [copiedFormat, setCopiedFormat] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !file) {
      setLinked(null)
      setConfirming(false)
      return
    }
    fetch(`${detailsBase}/${file.id}`, { credentials: 'include' })
      .then((r) => r.json())
      .then((j) => setLinked(Array.isArray(j?.data?.linkedIn) ? j.data.linkedIn : []))
      .catch(() => setLinked([]))
  }, [open, file, detailsBase])

  if (!file) return null

  const handleCopyEmbed = async (format: 'html' | 'markdown' | 'bbcode') => {
    if (!embedEndpoint || !file) return
    try {
      const res = await fetch(embedEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ fileId: file.id, format }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || typeof data?.data?.code !== 'string') {
        throw new Error(data?.error?.message || 'فشل إنشاء كود التضمين')
      }
      await navigator.clipboard.writeText(data.data.code)
      setCopiedFormat(format)
      toast({ title: 'تم نسخ كود التضمين' })
    } catch (err) {
      toast({
        title: 'فشل نسخ الكود',
        description: err instanceof Error ? err.message : 'حاول مرة أخرى',
        variant: 'destructive',
      })
    }
  }

  const handleDelete = async () => {
    if (!confirming) {
      setConfirming(true)
      return
    }
    setDeleting(true)
    try {
      const res = await fetch(`${deleteBase}/${file.id}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        throw new Error(data?.error?.message || 'فشل حذف الملف')
      }
      toast({ title: 'تم حذف الملف' })
      onDeleted(file.id)
      onOpenChange(false)
    } catch (err) {
      toast({
        title: 'فشل الحذف',
        description: err instanceof Error ? err.message : 'حاول مرة أخرى',
        variant: 'destructive',
      })
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="break-all text-start">{fileNameOf(file.originalUrl)}</SheetTitle>
          <SheetDescription className="text-start">
            {PROVIDER_LABELS[file.provider] || file.provider} • {fmtBytes(file.bytes)}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-3 text-sm">
          <div className="flex items-center gap-2">
            <Badge variant={file.provider === 'ia' ? 'default' : 'secondary'}>
              {PROVIDER_LABELS[file.provider] || file.provider}
            </Badge>
            <Badge variant="outline">{file.kind === 'image' ? 'صورة' : 'ملف'}</Badge>
          </div>

          <dl className="space-y-2 rounded-lg border border-border p-3">
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">الحجم</dt>
              <dd className="font-mono" dir="ltr">{fmtBytes(file.bytes)}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">النوع</dt>
              <dd className="font-mono" dir="ltr">{file.mime || '—'}</dd>
            </div>
            {file.storageKey && (
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">مفتاح التخزين</dt>
                <dd className="break-all font-mono text-xs" dir="ltr">{file.storageKey}</dd>
              </div>
            )}
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">الرافع</dt>
              <dd>{file.user?.username || '—'}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">التعريب</dt>
              <dd>{file.mod?.name || '—'}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">تاريخ الرفع</dt>
              <dd>{new Date(file.createdAt).toLocaleString('ar')}</dd>
            </div>
          </dl>

          <Button variant="outline" className="w-full" asChild>
            <a href={file.originalUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="me-2 h-4 w-4" />
              فتح رابط التحميل
            </a>
          </Button>

          {embedEndpoint && (
            <div>
              <h4 className="mb-2 font-semibold">نسخ كود التضمين</h4>
              <div className="flex gap-2">
                {(['html', 'markdown', 'bbcode'] as const).map((format) => (
                  <Button
                    key={format}
                    variant="outline"
                    size="sm"
                    className="flex-1 font-mono"
                    dir="ltr"
                    onClick={() => handleCopyEmbed(format)}
                  >
                    {copiedFormat === format ? (
                      <Check className="me-1 h-3.5 w-3.5" />
                    ) : (
                      <Copy className="me-1 h-3.5 w-3.5" />
                    )}
                    {format === 'html' ? 'HTML' : format === 'markdown' ? 'MD' : 'BBCode'}
                  </Button>
                ))}
              </div>
            </div>
          )}

          <div>
            <h4 className="mb-2 font-semibold">مستخدم في المودات</h4>
            {linked === null ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> جارٍ التحميل…
              </div>
            ) : linked.length === 0 ? (
              <p className="text-muted-foreground">غير مرتبط بأي ملف تعريب.</p>
            ) : (
              <ul className="space-y-1">
                {linked.map((l) => (
                  <li key={l.id} className="rounded-md border border-border/60 px-2 py-1.5">
                    {l.file.title}
                    {l.label ? <span className="text-muted-foreground"> — {l.label}</span> : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <SheetFooter className="mt-6">
          <Button variant={confirming ? 'destructive' : 'outline'} onClick={handleDelete} disabled={deleting} className="w-full">
            {deleting ? (
              <Loader2 className="me-2 h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="me-2 h-4 w-4" />
            )}
            {confirming ? 'تأكيد الحذف النهائي؟' : 'حذف الملف'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
