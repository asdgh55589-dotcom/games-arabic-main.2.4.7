// ModFormMedia — section 2 (images) + section 7 (videos).
// Presentational only; all state lives in the ModForm orchestrator.

import {
  CheckCircle2,
  Clapperboard,
  ExternalLink,
  Eye,
  Loader2,
  MessageSquare,
  Plus,
  ThumbsUp,
  Trash2,
  Youtube,
  Calendar,
  Video,
} from 'lucide-react'
import Image from 'next/image'
import dynamic from 'next/dynamic'
import { useRef, useState } from 'react'
import { ImageCropper } from '@/components/admin/image-cropper'
import { ImageUpload } from '@/components/admin/image-upload'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatArabicDate, formatNumber } from '@/lib/format'
import { isVimeoUrl } from '@/lib/oembed'
import { useToast } from '@/hooks/use-toast'
import { useStudioLanguage } from '@/lib/studio-i18n/context'
import { Section } from './primitives'

import type { VideoGroup } from './primitives'

// Code-split: Uppy vendor chunk loads only when the panel opens.
const UppyImagePanel = dynamic(
  () => import('@/components/creator/uppy-uploader').then((m) => ({ default: m.UppyUploader })),
  {
    ssr: false,
    loading: () => <div className="h-[120px] animate-pulse rounded-lg bg-muted" />,
  },
)

const FREEIMAGE_MAX_BYTES = 60 * 1024 * 1024 // 60MB unified cap (P2 — server enforces too)

function FreeImagePanel({
  modId,
  single,
  note,
  onPick,
  onError,
}: {
  modId?: string
  single: boolean
  note: string
  onPick: (urls: string[]) => void
  onError: (message: string) => void
}) {
  return (
    <div className="rounded-lg border border-border p-3">
      <UppyImagePanel
        endpoint="/api/storage/upload-image"
        meta={modId ? { modId } : {}}
        allowedFileTypes={['image/*']}
        maxFileSize={FREEIMAGE_MAX_BYTES}
        maxNumberOfFiles={single ? 1 : 5}
        note={note}
        onComplete={(files) => onPick(files.map((f) => f.url))}
        onError={onError}
      />
    </div>
  )
}

interface Props {
  modId?: string
  imageUrl: string
  setImageUrl: (v: string) => void
  thumbnailUrl: string
  setThumbnailUrl: (v: string) => void
  galleryUrls: string[]
  setGalleryUrls: (v: string[] | ((p: string[]) => string[])) => void
  cropperImage: string | null
  cropperOpen: boolean
  setCropperOpen: (v: boolean) => void
  cropperAspect: number
  cropperTarget: 'imageUrl' | 'thumbnailUrl' | 'gallery' | null
  handleImageFileSelect: (
    e: React.ChangeEvent<HTMLInputElement>,
    target: 'imageUrl' | 'thumbnailUrl' | 'gallery',
    aspect: number,
  ) => void
  handleCropComplete: (croppedImage: string) => void
  handleUrlCrop: (url: string, target: 'imageUrl' | 'thumbnailUrl', aspect: number) => void
  videoGroups: VideoGroup[]
  setVideoGroups: (v: VideoGroup[] | ((p: VideoGroup[]) => VideoGroup[])) => void
  fetchingVideoKey: string | null
  onFetchVideoMetadata: (groupIdx: number, videoIdx: number, videoUrl: string) => void
  /** قاعدة التسمية التلقائية (t.me/PS_PC_AR-...) — المعرض يضيف -1، -2... */
  uploadTitleBase?: string
}

export function ModFormMedia(p: Props) {
  const { dict, locale } = useStudioLanguage()
  const { toast } = useToast()
  const t = dict.form
  const [fiOpen, setFiOpen] = useState<'imageUrl' | 'thumbnailUrl' | 'gallery' | null>(null)
  const toggleFi = (target: 'imageUrl' | 'thumbnailUrl' | 'gallery') =>
    setFiOpen((cur) => (cur === target ? null : target))
  const fiError = (message: string) => toast({ title: message, variant: 'destructive' })
  // P2: blur auto-fetch compares against the last FETCHED url (not the render
  // closure value, which is already updated by onChange and made the old
  // `url !== v.url` check always false).
  const lastFetchedVideoUrl = useRef<Record<string, string>>({})
  const maybeFetchOnBlur = (groupIdx: number, videoIdx: number, url: string) => {
    const trimmed = url.trim()
    if (!trimmed) return
    const key = `${groupIdx}-${videoIdx}`
    if (lastFetchedVideoUrl.current[key] === trimmed) return
    lastFetchedVideoUrl.current[key] = trimmed
    p.onFetchVideoMetadata(groupIdx, videoIdx, trimmed)
  }
  return (
    <>
      {/* ===== 2. images ===== */}
      <Section title={t.images}>
        <ImageUpload
          bucket="mods"
          value={p.imageUrl}
          onChange={p.setImageUrl}
          label={t.banner}
          required
          hint={t.bannerHint}
          folder="banners"
          uploadTitle={p.uploadTitleBase || undefined}
        />
        {fiOpen === 'imageUrl' && (
          <FreeImagePanel
            modId={p.modId}
            single
            note={t.freeImageHint}
            onPick={(urls) => {
              if (urls[0]) p.setImageUrl(urls[0])
              setFiOpen(null)
            }}
            onError={fiError}
          />
        )}
        <ImageUpload
          bucket="mods"
          value={p.thumbnailUrl}
          onChange={p.setThumbnailUrl}
          label={t.thumbnail}
          required
          hint={t.thumbnailHint}
          folder="thumbnails"
          uploadTitle={p.uploadTitleBase || undefined}
        />
        {fiOpen === 'thumbnailUrl' && (
          <FreeImagePanel
            modId={p.modId}
            single
            note={t.freeImageHint}
            onPick={(urls) => {
              if (urls[0]) p.setThumbnailUrl(urls[0])
              setFiOpen(null)
            }}
            onError={fiError}
          />
        )}
        <ImageUpload
          bucket="mods"
          values={p.galleryUrls}
          onValuesChange={p.setGalleryUrls}
          multiple
          label={t.gallery}
          hint={t.galleryHint}
          folder="gallery"
          uploadTitle={
            p.uploadTitleBase
              ? (_file, i) => `${p.uploadTitleBase}-${p.galleryUrls.length + i + 1}`
              : undefined
          }
        />
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs text-muted-foreground">{p.galleryUrls.length} {t.imagesCount}</p>
        </div>
        {fiOpen === 'gallery' && (
          <FreeImagePanel
            modId={p.modId}
            single={false}
            note={t.freeImageHint}
            onPick={(urls) => {
              if (urls.length > 0) p.setGalleryUrls((prev) => [...prev, ...urls])
              setFiOpen(null)
            }}
            onError={fiError}
          />
        )}
      </Section>

      {p.cropperImage && (
        <ImageCropper
          image={p.cropperImage}
          open={p.cropperOpen}
          onOpenChange={p.setCropperOpen}
          onCropComplete={p.handleCropComplete}
          aspectRatio={p.cropperAspect}
          title={
            p.cropperTarget === 'imageUrl'
              ? t.cropBanner
              : p.cropperTarget === 'thumbnailUrl'
                ? t.cropThumb
                : t.cropGallery
          }
        />
      )}

      {/* ===== 7. videos ===== */}
      <Section
        title={t.videos}
        icon={<Video className="h-4 w-4" />}
        action={
          <Button
            size="sm"
            className="min-h-[44px]"
            variant="outline"
            onClick={() =>
              p.setVideoGroups((prev) => [...prev, { name: '', videos: [] }])
            }
          >
            <Plus className="me-1 h-4 w-4" /> {t.addSection}
          </Button>
        }
      >
        <p className="text-xs text-muted-foreground mb-3">
          {t.youtubeHint}
        </p>
        {p.videoGroups.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t.noVideoSections}</p>
        ) : (
          <div className="space-y-4">
            {p.videoGroups.map((group, i) => (
              <div key={i} className="rounded-lg border border-border bg-card/40 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <Input
                    value={group.name}
                    onChange={(e) =>
                      p.setVideoGroups((prev) =>
                        prev.map((g, idx) => (idx === i ? { ...g, name: e.target.value } : g)),
                      )
                    }
                    placeholder={t.videoSectionNamePh}
                    className="flex-1 font-medium"
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-9 w-9 text-red-400 min-h-[44px] min-w-[44px]"
                    onClick={() =>
                      p.setVideoGroups((prev) => prev.filter((_, idx) => idx !== i))
                    }
                    aria-label={t.deleteVideoSection}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div className="space-y-3">
                  {group.videos.map((v, j) => {
                    const fetchKey = `${i}-${j}`
                    const isFetching = p.fetchingVideoKey === fetchKey
                    const hasFetched = Boolean(v.title && v.channel)
                    return (
                      <div key={j} className="rounded-md border border-border/50 p-3 space-y-2">
                        <div className="flex items-center gap-2">
                          <div className="relative flex-1">
                            <Input
                              value={v.url}
                              onChange={(e) =>
                                p.setVideoGroups((prev) =>
                                  prev.map((g, idx) =>
                                    idx === i
                                      ? {
                                          ...g,
                                          videos: g.videos.map((vv, vidx) =>
                                            vidx === j ? { ...vv, url: e.target.value } : vv,
                                          ),
                                        }
                                      : g,
                                  ),
                                )
                              }
                              onBlur={(e) => {
                                maybeFetchOnBlur(i, j, e.target.value)
                              }}
                              placeholder="https://youtube.com/watch?v=... أو https://vimeo.com/..."
                              className="flex-1"
                            />
                            {isFetching && (
                              <Loader2 className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-primary" />
                            )}
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              lastFetchedVideoUrl.current[fetchKey] = v.url.trim()
                              p.onFetchVideoMetadata(i, j, v.url)
                            }}
                            disabled={isFetching || !v.url.trim()}
                            className="shrink-0 min-h-[44px]"
                          >
                            {isFetching ? (
                              <Loader2 className="me-1 h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <ExternalLink className="me-1 h-3.5 w-3.5" />
                            )}
                            {hasFetched ? t.refreshData : t.fetchData}
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-9 w-9 text-red-400 shrink-0 min-h-[44px] min-w-[44px]"
                            onClick={() =>
                              p.setVideoGroups((prev) =>
                                prev.map((g, idx) =>
                                  idx === i
                                    ? { ...g, videos: g.videos.filter((_, vidx) => vidx !== j) }
                                    : g,
                                ),
                              )
                            }
                            aria-label={t.deleteVideo}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>

                        {hasFetched && (
                          <div className="overflow-hidden rounded-lg border border-border/60 bg-secondary/20">
                            <div className="flex gap-3 p-3">
                              <div className="relative aspect-video w-32 shrink-0 overflow-hidden rounded-md bg-secondary sm:w-40">
                                {v.thumbnail ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <Image
                                    loading="lazy"
                                    width={40}
                                    height={40}
                                    src={v.thumbnail}
                                    alt={v.title}
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  <div className="grid h-full place-items-center">
                                    {isVimeoUrl(v.url) ? (
                                      <Clapperboard className="h-6 w-6 text-muted-foreground" />
                                    ) : (
                                      <Youtube className="h-6 w-6 text-muted-foreground" />
                                    )}
                                  </div>
                                )}
                                {v.duration && (
                                  <span className="absolute bottom-1 start-1 rounded bg-black/85 px-1.5 py-0.5 text-[10px] font-bold text-white">
                                    {v.duration}
                                  </span>
                                )}
                              </div>
                              <div className="flex min-w-0 flex-1 flex-col gap-1">
                                <div className="flex items-center gap-1.5 text-[11px] text-green-500">
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                  <span>{t.autoFetchedYoutube}</span>
                                </div>
                                <h5 className="line-clamp-2 text-sm font-bold text-foreground">
                                  {v.title}
                                </h5>
                                {v.channel && (
                                  <div className="text-xs text-muted-foreground">{v.channel}</div>
                                )}
                                <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                                  <span className="flex items-center gap-1">
                                    <Eye className="h-3 w-3" />
                                    {formatNumber(v.views || 0)}
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <ThumbsUp className="h-3 w-3" />
                                    {formatNumber(v.likes || 0)}
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <MessageSquare className="h-3 w-3" />
                                    {formatNumber(v.commentsCount || 0)}
                                  </span>
                                  {v.publishedAt && (
                                    <span className="flex items-center gap-1">
                                      <Calendar className="h-3 w-3" />
                                      {formatArabicDate(v.publishedAt, locale)}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            {v.description && (
                              <div className="border-t border-border/50 px-3 py-2">
                                <p className="line-clamp-2 whitespace-pre-line text-[11px] text-muted-foreground">
                                  {v.description}
                                </p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                  <Button
                    size="sm"
                    className="min-h-[44px]"
                    variant="ghost"
                    onClick={() =>
                      p.setVideoGroups((prev) =>
                        prev.map((g, idx) =>
                          idx === i
                            ? {
                                ...g,
                                videos: [
                                  ...g.videos,
                                  {
                                    title: '',
                                    url: '',
                                    thumbnail: '',
                                    duration: '',
                                    description: '',
                                    views: 0,
                                    likes: 0,
                                    commentsCount: 0,
                                    channel: '',
                                    publishedAt: null,
                                  },
                                ],
                              }
                            : g,
                        ),
                      )
                    }
                  >
                    <Plus className="me-1 h-3 w-3" /> {t.addVideo}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>
    </>
  )
}
