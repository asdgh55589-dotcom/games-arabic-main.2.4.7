'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { Download, ThumbsUp, Eye, CalendarDays, History, Users, FileArchive, Package, MoreVertical, Bookmark, Flag } from 'lucide-react'
import { formatNumber } from '@/lib/format'
import { StatusBadge, getModBadgeStatus } from '@/components/status-badge'
import { PLATFORM_COLORS, PLATFORM_KEY_MAP } from '@/lib/constants/platforms'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { ReportDialog } from '@/components/report-dialog'
import { useBookmarks } from '@/contexts/bookmarks-context'
import { useToast } from '@/hooks/use-toast'
import { CreatorBadge } from '@/components/creator-badge'
import { RoleBadge } from '@/components/role-badge'
import { TierBadge } from '@/components/tier-badge'
import { FALLBACK_GAME_IMAGE } from '@/lib/constants'
import type { ModSummary } from '@/lib/types'

interface ModCardProps {
  mod: ModSummary
  priority?: boolean
  variant?: 'full' | 'compact'
}

export function ModCard({ mod, priority = false, variant = 'full' }: ModCardProps) {
  const badgeStatus = getModBadgeStatus(mod.createdAt, mod.updatedAt)
  const platformKey = mod.game?.platform ? PLATFORM_KEY_MAP[mod.game.platform.toUpperCase()] : null
  const platformColor = platformKey ? PLATFORM_COLORS[platformKey] : undefined
  const router = useRouter()

  const { isBookmarked, toggleBookmark, registerModIds } = useBookmarks()
  const { toast } = useToast()

  useEffect(() => {
    registerModIds([mod.id])
  }, [mod.id, registerModIds])

  const bookmarked = isBookmarked(mod.id)

  return (
    <Link href={`/mod/${mod.slug}`} className="group block h-full">
      <article
        className="relative flex h-full flex-col rounded-none border-[3px] border-border bg-card shadow-[4px_4px_0_0_var(--border)] transition-all duration-150 hover:translate-x-[2px] hover:translate-y-[2px]"
        style={platformColor ? {
          '--card-platform': platformColor,
        } as React.CSSProperties : undefined}
      >
        {/* IMAGE */}
        <div className={`relative w-full overflow-hidden border-b-[3px] border-border bg-muted ${variant === 'compact' ? 'aspect-[16/9]' : 'aspect-video'}`}>
          <Image
            src={mod.thumbnailUrl || FALLBACK_GAME_IMAGE}
            alt={mod.name}
            fill
            sizes="(max-width: 768px) 100vw, 33vw"
            quality={75}
            priority={priority}
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            onError={(e) => {
              const img = e.currentTarget as HTMLImageElement & { dataset: DOMStringMap }
              if (!img.dataset.fallback) {
                img.dataset.fallback = '1'
                img.src = FALLBACK_GAME_IMAGE
                img.style.objectFit = 'cover'
              } else {
                img.style.display = 'none'
              }
            }}
          />
          {/* Platform badge — top start */}
          <span
            className="absolute top-2 start-2 inline-flex items-center gap-1 rounded-none border-2 border-black/50 px-1.5 py-0.5 text-[10px] font-black uppercase leading-none text-white"
            style={{ background: platformColor || 'var(--primary)' }}
          >
            {mod.game?.platform || 'N/A'}
          </span>
          {/* Status badge + kebab — top end, unified container */}
          <div className="absolute top-2 end-2 z-20 flex items-center gap-1">
            {badgeStatus && <StatusBadge status={badgeStatus} />}
            {variant !== 'compact' && (
              <span className="opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 focus-within:opacity-100">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      className="grid h-7 w-7 min-h-[44px] min-w-[44px] place-items-center border-[2px] border-border bg-background/80 text-muted-foreground transition-colors hover:text-foreground"
                      aria-label="خيارات التعريب"
                      onClick={(e) => e.preventDefault()}
                    >
                      <MoreVertical className="h-4 w-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-48 border-[3px] border-border shadow-[4px_4px_0_0_var(--border)]">
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        const method = bookmarked ? 'DELETE' : 'POST'
                        const body = bookmarked ? undefined : JSON.stringify({ modId: mod.id })
                        const url = bookmarked ? `/api/bookmarks?modId=${mod.id}` : '/api/bookmarks'
                        fetch(url, {
                          method,
                          headers: body ? { 'Content-Type': 'application/json' } : undefined,
                          body,
                        }).then((res) => {
                          if (res.ok) {
                            toggleBookmark(mod.id)
                            toast({
                              title: bookmarked ? 'تمت الإزالة من المفضلة' : 'تم الحفظ في المفضلة',
                              description: mod.name,
                            })
                          }
                        }).catch(() => {
                          toast({
                            title: 'خطأ',
                            description: 'حدث خطأ أثناء الحفظ',
                            variant: 'destructive',
                          })
                        })
                      }}
                    >
                      <Bookmark className={`ms-2 h-4 w-4 ${bookmarked ? 'fill-current' : ''}`} />
                      {bookmarked ? 'إزالة من المفضلة' : 'حفظ في المفضلة'}
                    </DropdownMenuItem>
                    <ReportDialog targetType="mod" targetId={mod.id}>
                      <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                        <Flag className="ms-2 h-4 w-4" />
                        إبلاغ عن مشكلة
                      </DropdownMenuItem>
                    </ReportDialog>
                  </DropdownMenuContent>
                </DropdownMenu>
              </span>
            )}
          </div>
        </div>

        {/* BODY */}
        <div className="flex w-full flex-col gap-1.5 p-2 sm:gap-2 sm:p-3">
          {/* ZONE 1: IDENTITY */}
          <h3 className="line-clamp-2 h-[2.6em] w-full text-xs font-bold leading-[1.3] text-foreground transition-colors group-hover:text-primary sm:text-sm">
            {mod.name}
          </h3>
          {mod.isOriginalWork === false && (
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-600">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
              منشور من مصدر خارجي{mod.originalAuthor ? ` • ${mod.originalAuthor}` : ''}
            </span>
          )}

          {variant === 'compact' ? (
            /* COMPACT: تاريخ النشر والتحديث + شريط الإحصائيات */
            <>
              <div className="flex w-full flex-col gap-1 border-t-2 border-border/60 bg-muted/30 px-2.5 py-2">
                <div className="flex items-center gap-1">
                  <CalendarDays className="h-3.5 w-3.5 text-muted-foreground/70" />
                  <span className="w-12 shrink-0 text-[11px] leading-[1.3] text-muted-foreground">النشر</span>
                  <span className="text-border">|</span>
                  <span className="text-xs font-bold leading-[1.3] text-foreground">
                    {new Date(mod.createdAt).toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' })}
                  </span>
                </div>
                {new Date(mod.updatedAt).getTime() !== new Date(mod.createdAt).getTime() && (
                  <div className="flex items-center gap-1">
                    <History className="h-3.5 w-3.5 text-muted-foreground/70" />
                    <span className="w-12 shrink-0 text-[11px] leading-[1.3] text-muted-foreground">التحديث</span>
                    <span className="text-border">|</span>
                    <span className="text-xs font-bold leading-[1.3] text-foreground">
                      {new Date(mod.updatedAt).toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                )}
              </div>
              <div className="grid w-full grid-cols-3 border-t-2 border-border/60 pt-2">
                <div className="flex items-center justify-center gap-1" title="التحميلات">
                  <Download className="h-3 w-3 text-primary" />
                  <span className="text-[10px] font-bold leading-[1.3] text-foreground/90">{formatNumber(mod.downloads)}</span>
                </div>
                <div className="flex items-center justify-center gap-1 border-s border-border/60" title="المشاهدات">
                  <Eye className="h-3 w-3 text-primary" />
                  <span className="text-[10px] font-bold leading-[1.3] text-foreground/90">{formatNumber(mod.views)}</span>
                </div>
                <div className="flex items-center justify-center gap-1 border-s border-border/60" title="الإعجابات">
                  <ThumbsUp className="h-3 w-3 text-primary" />
                  <span className="text-[10px] font-bold leading-[1.3] text-foreground/90">{formatNumber(mod.endorsements)}</span>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Publisher account box — full-width with profile link */}
              {mod.author && (
                <span
                  role="link"
                  tabIndex={0}
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    router.push(`/profile/${encodeURIComponent(mod.author.username)}`)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      e.stopPropagation()
                      router.push(`/profile/${encodeURIComponent(mod.author.username)}`)
                    }
                  }}
                  className="group/publisher hidden w-full items-center gap-2 rounded-lg border border-amber-800/40 bg-gradient-to-l from-amber-900/20 to-orange-900/20 px-2.5 py-1.5 transition-all duration-150 hover:border-amber-600/60 hover:from-amber-900/30 hover:to-orange-900/30 cursor-pointer sm:flex"
                  style={{ boxShadow: '0 0 0 0 rgba(217,119,6,0)' }}
                  onMouseEnter={(e) => (e.currentTarget.style.boxShadow = '0 0 10px rgba(217,119,6,0.25)')}
                  onMouseLeave={(e) => (e.currentTarget.style.boxShadow = '0 0 0 0 rgba(217,119,6,0)')}
                >
                  {mod.author.avatarUrl && (
                    <Image unoptimized width={16} height={16}
                      src={mod.author.avatarUrl}
                      alt=""
                      className="h-4 w-4 shrink-0 rounded-full object-cover border border-amber-700/50"
                      loading="lazy"
                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
                    />
                  )}
                  <span className="text-[11px] font-bold text-foreground flex flex-wrap items-center gap-1">
                    {mod.author.username}
                    <RoleBadge role={mod.author.role} size="sm" />
                    <TierBadge tier={mod.author.tier} role={mod.author.role} size="sm" />
                    <CreatorBadge role={mod.author.role} specialRoles={mod.author.specialRoles} size={12} />
                  </span>
                  <span className="ms-auto text-[10px] font-bold text-amber-400">عرض ملف المؤلف</span>
                </span>
              )}

              {/* ZONE 2: SPEC PANEL */}
              <div className="hidden w-full flex-col gap-1 border-y-2 border-border/60 bg-muted/30 px-2.5 py-2 sm:flex">
                <div className="flex items-center gap-1">
                  <CalendarDays className="h-3.5 w-3.5 text-muted-foreground/70" />
                  <span className="w-16 shrink-0 text-[11px] leading-[1.3] text-muted-foreground">النشر</span>
                  <span className="text-border">|</span>
                  <span className="text-xs font-bold leading-[1.3] text-foreground">
                    {new Date(mod.createdAt).toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' })}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <History className="h-3.5 w-3.5 text-muted-foreground/70" />
                  <span className="w-16 shrink-0 text-[11px] leading-[1.3] text-muted-foreground">التحديث</span>
                  <span className="text-border">|</span>
                  <span className="text-xs font-bold leading-[1.3] text-foreground">
                    {new Date(mod.updatedAt).toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' })}
                  </span>
                </div>
                {mod.translationTeam && (
                  <div className="flex items-center gap-1">
                    <Users className="h-3.5 w-3.5 text-muted-foreground/70" />
                    <span className="w-16 shrink-0 text-[11px] leading-[1.3] text-muted-foreground">الفريق</span>
                    <span className="text-border">|</span>
                    <span className="text-xs font-bold leading-[1.3] text-foreground">{mod.translationTeam}</span>
                  </div>
                )}
                {mod.series && (
                  <div className="flex items-center gap-1">
                    <Package className="h-3.5 w-3.5 text-muted-foreground/70" />
                    <span className="w-16 shrink-0 text-[11px] leading-[1.3] text-muted-foreground">السلسلة</span>
                    <span className="text-border">|</span>
                    <span className="text-xs font-bold leading-[1.3] text-foreground">{mod.series}</span>
                  </div>
                )}
              </div>

              {/* ZONE 3: STATS BAR */}
              <div className="grid w-full grid-cols-3 border-t-2 border-border/60 pt-2">
                <div className="flex items-center justify-center gap-1" title="التحميلات">
                  <Download className="h-3 w-3 text-primary sm:h-3.5 sm:w-3.5" />
                  <span className="text-[10px] font-bold leading-[1.3] text-foreground/90 sm:text-[11px]">{formatNumber(mod.downloads)}</span>
                </div>
                <div className="flex items-center justify-center gap-1 border-s border-border/60" title="المشاهدات">
                  <Eye className="h-3 w-3 text-primary sm:h-3.5 sm:w-3.5" />
                  <span className="text-[10px] font-bold leading-[1.3] text-foreground/90 sm:text-[11px]">{formatNumber(mod.views)}</span>
                </div>
                <div className="flex items-center justify-center gap-1 border-s border-border/60" title="الإعجابات">
                  <ThumbsUp className="h-3 w-3 text-primary sm:h-3.5 sm:w-3.5" />
                  <span className="text-[10px] font-bold leading-[1.3] text-foreground/90 sm:text-[11px]">{formatNumber(mod.endorsements)}</span>
                </div>
              </div>
            </>
          )}
        </div>
      </article>
    </Link>
  )
}

export function ModCardSkeleton({ variant = 'full' }: { variant?: 'full' | 'compact' } = {}) {
  const isCompact = variant === 'compact'
  return (
    <div className="h-full rounded-none border-[3px] border-border bg-card shadow-[4px_4px_0_0_var(--border)]">
      <div className={`w-full bg-muted animate-pulse ${isCompact ? 'aspect-[16/9]' : 'aspect-video'}`} />
      <div className="flex flex-col gap-2 p-3">
        <div className="h-4 bg-muted rounded w-3/4 animate-pulse" />
        {isCompact ? (
          <>
            <div className="flex flex-col gap-1.5 border-t-2 border-border/60 bg-muted/30 px-2.5 py-2">
              {[0, 1].map((i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <div className="h-3.5 w-3.5 bg-muted rounded animate-pulse" />
                  <div className="h-3 bg-muted rounded w-12 animate-pulse" />
                  <div className="h-3 bg-muted rounded w-px animate-pulse" />
                  <div className="h-3 bg-muted rounded w-16 animate-pulse" />
                </div>
              ))}
            </div>
            <div className="grid grid-cols-3 pt-2 border-t-2 border-border/60">
              {[0, 1, 2].map((i) => (
                <div key={i} className={`flex items-center justify-center gap-1 ${i > 0 ? 'border-s border-border/60' : ''}`}>
                  <div className="h-3 w-3 bg-muted rounded animate-pulse" />
                  <div className="h-3 bg-muted rounded w-8 animate-pulse" />
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="h-3 bg-muted rounded w-1/3 animate-pulse" />
            <div className="flex flex-col gap-1.5 border-y-2 border-border/60 bg-muted/30 px-2.5 py-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <div className="h-3.5 w-3.5 bg-muted rounded animate-pulse" />
                  <div className="h-3 bg-muted rounded w-12 animate-pulse" />
                  <div className="h-3 bg-muted rounded w-px animate-pulse" />
                  <div className="h-3 bg-muted rounded w-16 animate-pulse" />
                </div>
              ))}
            </div>
            <div className="grid grid-cols-3 pt-2 border-t-2 border-border/60">
              {[0, 1, 2].map((i) => (
                <div key={i} className={`flex items-center justify-center gap-1 ${i > 0 ? 'border-s border-border/60' : ''}`}>
                  <div className="h-3.5 w-3.5 bg-muted rounded animate-pulse" />
                  <div className="h-3 bg-muted rounded w-8 animate-pulse" />
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
