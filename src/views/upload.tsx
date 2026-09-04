// Updated for new API response format
'use client'

import { Check, ChevronLeft, FileArchive, Image as ImageIcon, Tag, Upload } from 'lucide-react'
import Link from 'next/link'
import { useRef, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import type { GameDetail, GameSummary } from '@/lib/types'

export function UploadPage() {
  useDocumentTitle('Upload a Mod')
  const [name, setName] = useState('')
  const [summary, setSummary] = useState('')
  const [description, setDescription] = useState('')
  const [version, setVersion] = useState('1.0.0')
  const [tags, setTags] = useState('')
  const [gameSlug, setGameSlug] = useState('')
  const [category, setCategory] = useState('')
  const [modFileName, setModFileName] = useState<string | null>(null)
  const [imageFileName, setImageFileName] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const { toast } = useToast()
  const modFileRef = useRef<HTMLInputElement>(null)
  const imageFileRef = useRef<HTMLInputElement>(null)

  const { data: gamesData } = useFetch<{ data: GameSummary[] }>('/api/games?sort=name&limit=50')
  const { data: gameData } = useFetch<{ data: GameDetail }>(
    gameSlug ? `/api/games/${gameSlug}` : null,
    [gameSlug],
  )

  const resetForm = () => {
    setName('')
    setSummary('')
    setDescription('')
    setVersion('1.0.0')
    setTags('')
    setGameSlug('')
    setCategory('')
    setModFileName(null)
    setImageFileName(null)
    if (modFileRef.current) modFileRef.current.value = ''
    if (imageFileRef.current) imageFileRef.current.value = ''
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name || !summary || !gameSlug) {
      toast({
        title: 'Missing fields',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      })
      return
    }
    if (!modFileName) {
      toast({
        title: 'Missing mod file',
        description: 'Please select a mod archive to upload',
        variant: 'destructive',
      })
      return
    }
    const game = gameData?.data
    if (!game) {
      toast({
        title: 'Game not found',
        description: 'Please select a valid game',
        variant: 'destructive',
      })
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/admin/mods', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          summary,
          description: description || summary,
          gameId: game.id,
          categoryId: category || undefined,
          version,
          tags,
          thumbnailUrl: game.thumbnailUrl,
          imageUrl: game.bannerUrl,
          fileSize: 'Unknown',
          fileFormat: 'zip',
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        if (res.status === 401) {
          toast({
            title: 'Authentication required',
            description: 'You must be logged in as a moderator to upload mods.',
            variant: 'destructive',
          })
          return
        }
        if (res.status === 403) {
          toast({
            title: 'Insufficient permissions',
            description: 'Only moderators and admins can upload mods. Use the admin panel.',
            variant: 'destructive',
          })
          return
        }
        throw new Error(data?.error || 'Failed to submit mod')
      }
      setSubmitted(true)
      toast({
        title: 'Mod submitted!',
        description: 'Your mod has been created successfully.',
      })
    } catch (err) {
      toast({
        title: 'Submission failed',
        description: err instanceof Error ? err.message : 'Could not submit mod',
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
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
          Thank you for contributing to the community. Your mod &quot;{name}&quot; is now in the
          moderation queue. You&apos;ll receive a notification once it&apos;s approved and live.
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

      <form onSubmit={onSubmit} className="space-y-6">
        <Card className="space-y-4 p-6">
          <h2 className="text-lg font-semibold">Basic Information</h2>

          <div className="space-y-2">
            <Label htmlFor="name">Mod Name *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Unofficial Skyrim Patch"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="summary">Summary *</Label>
            <Input
              id="summary"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="A one-line description of your mod"
              maxLength={200}
              required
            />
            <p className="text-xs text-muted-foreground">{summary.length}/200 characters</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe your mod in detail. Supports markdown formatting…"
              rows={8}
            />
            <p className="text-xs text-muted-foreground">
              Markdown supported. Use ## for headings, - for lists.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="game-select">Game *</Label>
              <Select
                value={gameSlug}
                onValueChange={(v) => {
                  setGameSlug(v)
                  setCategory('')
                }}
              >
                <SelectTrigger id="game-select">
                  <SelectValue placeholder="Select a game" />
                </SelectTrigger>
                <SelectContent>
                  {gamesData?.data?.map((g) => (
                    <SelectItem key={g.id} value={g.slug}>
                      {g.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="category-select">Category</Label>
              <Select value={category} onValueChange={setCategory} disabled={!gameData?.data}>
                <SelectTrigger id="category-select">
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  {gameData?.data?.categories?.map((c) => (
                    <SelectItem key={c.id} value={c.slug}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="version">Version</Label>
              <Input
                id="version"
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                placeholder="1.0.0"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tags">Tags</Label>
              <Input
                id="tags"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="comma, separated, tags"
              />
            </div>
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

          {tags && (
            <div>
              <Label className="mb-2 block">Tag Preview</Label>
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
          )}
        </Card>

        <div className="flex gap-3">
          <Button type="submit" size="lg" className="flex-1" disabled={submitting}>
            <Upload className="mr-2 h-4 w-4" /> {submitting ? 'Submitting...' : 'Submit for Review'}
          </Button>
          <Button type="button" variant="outline" size="lg" asChild>
            <Link href="/">Cancel</Link>
          </Button>
        </div>
      </form>
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
