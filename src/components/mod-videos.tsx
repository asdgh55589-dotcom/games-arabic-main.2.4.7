'use client'

import { useState } from 'react'
import { Play, Clock, Eye, Youtube, ChevronLeft, X, VideoOff, ThumbsUp, MessageSquare, Calendar } from 'lucide-react'
import { formatNumber, formatArabicDate } from '@/lib/format'
import type { ModVideoGroup } from '@/lib/types'

interface ModVideosProps {
  videoGroups: ModVideoGroup[]
}

/**
 * ModVideos — قسم الفيديوهات (تصميم اسكندنافي داكن).
 * كل بيانات الفيديو تُقرأ ديناميكياً من الـ DB عبر props:
 * العنوان، الوصف، القناة، المشاهدات، الإعجابات، التعليقات، المدة، وتاريخ النشر.
 * - الفيديوهات مجمّعة في أقسام هادئة بحدود رفيعة
 * - كل فيديو بطاقة أفقية عريضة
 * - عند الضغط يفتح modal مع تضمين YouTube
 */
export function ModVideos({ videoGroups }: ModVideosProps) {
  const [activeVideo, setActiveVideo] = useState<{
    title: string
    url: string
    channel?: string | null
    description?: string | null
    views: number
    likes: number
    commentsCount: number
    publishedAt?: string | null
    thumbnail?: string | null
  } | null>(null)

  // استخراج YouTube video ID من الرابط
  const extractYouTubeId = (url: string): string => {
    const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]{11})/)
    return match ? match[1] : ''
  }

  if (!videoGroups || videoGroups.length === 0) {
    return (
      <div className="grid place-items-center rounded-xl border border-border/50 bg-card/30 py-16 text-center">
        <div className="mb-4 grid h-14 w-14 place-items-center rounded-full bg-secondary/60">
          <VideoOff className="h-7 w-7 text-muted-foreground/60" />
        </div>
        <h3 className="text-base font-bold text-foreground">لا توجد فيديوهات</h3>
        <p className="mt-1.5 text-sm text-muted-foreground">لم تتم إضافة أي فيديوهات لهذا التعريب بعد.</p>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-10">
        {videoGroups.map((group) => (
          <section key={group.id}>
            {/* عنوان القسم — رأس هادئ بحد رفيع */}
            <div className="mb-5 flex items-center gap-3">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-red-500/10 text-red-500">
                <Youtube className="h-5 w-5" />
              </div>
              <h3 className="text-base font-bold tracking-tight text-foreground">{group.name}</h3>
              <span className="rounded-full border border-border/60 px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                {group.videos.length} فيديو
              </span>
              <div className="ms-auto h-px flex-1 bg-border/40" />
            </div>

            {/* قائمة الفيديوهات — بطاقات أفقية هادئة */}
            {group.videos.length === 0 ? (
              <p className="text-sm text-muted-foreground">لا توجد فيديوهات في هذا القسم.</p>
            ) : (
              <div className="space-y-3">
                {group.videos.map((video) => (
                  <button
                    key={video.id}
                    onClick={() => setActiveVideo({
                      title: video.title,
                      url: video.url,
                      channel: video.channel,
                      description: video.description,
                      views: video.views,
                      likes: video.likes,
                      commentsCount: video.commentsCount,
                      publishedAt: video.publishedAt,
                      thumbnail: video.thumbnail,
                    })}
                    className="group flex w-full items-stretch gap-4 overflow-hidden rounded-xl border border-border/50 bg-card/40 text-right transition-all duration-200 hover:border-border hover:bg-card cursor-pointer"
                  >
                    {/* الصورة المصغّرة */}
                    <div className="relative aspect-video w-44 shrink-0 overflow-hidden bg-secondary sm:w-52 md:w-60">
                      {video.thumbnail ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={video.thumbnail}
                          alt={video.title}
                          loading="lazy"
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                        />
                      ) : (
                        <div className="grid h-full place-items-center bg-secondary">
                          <Youtube className="h-9 w-9 text-muted-foreground/70" />
                        </div>
                      )}
                      {/* overlay خفيف عند الـ hover */}
                      <div className="absolute inset-0 bg-black/0 transition-colors duration-200 group-hover:bg-black/25" />
                      {/* زر التشغيل */}
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                        <div className="grid h-11 w-11 place-items-center rounded-full bg-red-600 shadow-lg transition-transform duration-200 group-hover:scale-105">
                          <Play className="h-5 w-5 fill-white text-white" />
                        </div>
                      </div>
                      {/* مدة الفيديو */}
                      {video.duration && (
                        <div className="absolute bottom-1.5 left-1.5 rounded bg-black/85 px-1.5 py-0.5 text-[11px] font-bold tabular-nums text-white">
                          {video.duration}
                        </div>
                      )}
                    </div>

                    {/* بيانات الفيديو */}
                    <div className="flex min-w-0 flex-1 flex-col justify-center gap-2 py-3 pe-4">
                      <h4 className="line-clamp-2 text-sm font-bold leading-relaxed text-foreground transition-colors group-hover:text-primary sm:text-[15px]">
                        {video.title}
                      </h4>
                      {video.channel && (
                        <div className="text-xs font-bold text-foreground/80">{video.channel}</div>
                      )}
                      <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] font-bold text-foreground/70">
                        <span className="flex items-center gap-1.5">
                          <Eye className="h-3.5 w-3.5 text-muted-foreground/70" />
                          <span className="tabular-nums">{formatNumber(video.views)}</span>
                        </span>
                        <span className="flex items-center gap-1.5">
                          <ThumbsUp className="h-3.5 w-3.5 text-muted-foreground/70" />
                          <span className="tabular-nums">{formatNumber(video.likes)}</span>
                        </span>
                        <span className="flex items-center gap-1.5">
                          <MessageSquare className="h-3.5 w-3.5 text-muted-foreground/70" />
                          <span className="tabular-nums">{formatNumber(video.commentsCount)}</span>
                        </span>
                        {video.publishedAt && (
                          <span className="flex items-center gap-1.5">
                            <Calendar className="h-3.5 w-3.5 text-muted-foreground/70" />
                            <span>{formatArabicDate(video.publishedAt)}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>
        ))}
      </div>

      {/* Modal تشغيل الفيديو */}
      {activeVideo && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/95 p-4 backdrop-blur-sm"
          onClick={() => setActiveVideo(null)}
        >
          <button
            onClick={() => setActiveVideo(null)}
            className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-lg bg-white/10 text-white transition-colors hover:bg-red-600 cursor-pointer"
            aria-label="إغلاق"
          >
            <X className="h-5 w-5" />
          </button>

          <div
            className="w-full max-w-4xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative aspect-video overflow-hidden rounded-xl bg-black shadow-2xl">
              {extractYouTubeId(activeVideo.url) ? (
                <iframe
                  src={`https://www.youtube.com/embed/${extractYouTubeId(activeVideo.url)}?autoplay=1`}
                  title={activeVideo.title}
                  className="h-full w-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <div className="flex h-full items-center justify-center text-white/60">
                  تعذّر تحميل الفيديو
                </div>
              )}
            </div>
            <div className="mt-4 flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <h3 className="text-lg font-bold text-white">{activeVideo.title}</h3>
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-white/60">
                  {activeVideo.channel && <span className="font-medium text-white/80">{activeVideo.channel}</span>}
                  <span className="flex items-center gap-1.5">
                    <Eye className="h-3.5 w-3.5" />
                    <span className="tabular-nums">{formatNumber(activeVideo.views)}</span> مشاهدة
                  </span>
                  <span className="flex items-center gap-1.5">
                    <ThumbsUp className="h-3.5 w-3.5" />
                    <span className="tabular-nums">{formatNumber(activeVideo.likes)}</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <MessageSquare className="h-3.5 w-3.5" />
                    <span className="tabular-nums">{formatNumber(activeVideo.commentsCount)}</span>
                  </span>
                  {activeVideo.publishedAt && (
                    <span className="flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5" />
                      {formatArabicDate(activeVideo.publishedAt)}
                    </span>
                  )}
                </div>
                {activeVideo.description && (
                  <p className="mt-3 max-h-24 overflow-y-auto whitespace-pre-line text-sm leading-relaxed text-white/60 scrollbar-thin">{activeVideo.description}</p>
                )}
              </div>
              <a
                href={activeVideo.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex shrink-0 items-center gap-1.5 rounded-lg bg-white/10 px-3 py-2 text-sm text-white transition-colors hover:bg-white/20"
              >
                فتح على YouTube
                <ChevronLeft className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
