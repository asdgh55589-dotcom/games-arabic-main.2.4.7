// ModForm — orchestrator: state, loading, save. Sections live in ./mod-form/*.
// Refactored from the 1687-line monolith; behavior identical.

'use client'

import { ChevronRight, Clock, FileArchive, Loader2, Plus, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { NewVersionDialog } from '@/components/admin/mods/new-version-dialog'
import { VersionHistory } from '@/components/admin/mods/version-history'
import { WorkflowActions } from '@/components/admin/mods/workflow-actions'
import { WorkflowHistory } from '@/components/admin/mods/workflow-history'
import { WorkflowStatusBadge } from '@/components/admin/mods/workflow-status-badge'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { normalizeTranslationType, type TranslationType } from '@/lib/schemas'
import { isSupportedVideoUrl } from '@/lib/oembed'
import { extractVideoErrorMessage } from '@/lib/video-errors'
import { useStudioLanguage } from '@/lib/studio-i18n/context'
import {
  isDataUrl,
  uploadCroppedDataUrl,
} from '@/lib/upload-cropped'
import { ModFormActions } from './mod-form/actions'
import { ModFormBasicInfo } from './mod-form/basic-info'
import { ModFormFiles } from './mod-form/files'
import { ModFormMedia } from './mod-form/media'
import { ModFormSettings } from './mod-form/settings'
import { PlatformFieldsSection } from '@/components/shared/platform-fields-section'
import { PlatformSelector } from './mod-form/platform-selector'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  EMPTY_CONTACT,
  EMPTY_FILE,
  EMPTY_GROUP,
  EMPTY_MEMBER,
  EMPTY_TAB,
  Section,
  slugify,
  type ContactLink,
  type CustomTab,
  type DownloadFile,
  type SeriesOpt,
  type TeamMember,
  type TeamOpt,
  type VideoGroup,
} from './mod-form/primitives'

interface ModFormProps {
  modId?: string // لو موجود → تعديل، لو مش موجود → إنشاء
}

export default function ModForm({ modId }: ModFormProps) {
  const router = useRouter()
  const { toast } = useToast()
  const { dict, dir, locale } = useStudioLanguage()
  const t = dict.form
  const isEdit = Boolean(modId)

  const [saving, setSaving] = useState(false)
  const [loadingMod, setLoadingMod] = useState(isEdit)
  const [seriesList, setSeriesList] = useState<SeriesOpt[]>([])
  const [teamsList, setTeamsList] = useState<TeamOpt[]>([])
  const [loadingMeta, setLoadingMeta] = useState(true)
  const [workflowStatus, setWorkflowStatus] = useState('DRAFT')
  const [workflowHistory, setWorkflowHistory] = useState<any[]>([])
  const [versionHistory, setVersionHistory] = useState<any[]>([])
  const [newVersionDialogOpen, setNewVersionDialogOpen] = useState(false)
  const [userRole, setUserRole] = useState('member')

  // Wizard step: 1 = platform selection, 2 = full form
  const [step, setStep] = useState(isEdit ? 2 : 1)
  const [platformChangeDialogOpen, setPlatformChangeDialogOpen] = useState(false)
  const [pendingPlatform, setPendingPlatform] = useState('')

  const [name, setName] = useState('')
  const [summary, setSummary] = useState('')
  const [description, setDescription] = useState('')
  const [changelog, setChangelog] = useState('')
  const [installGuide, setInstallGuide] = useState('')
  const [arabicTitle, setArabicTitle] = useState('')
  const [translationScope, setTranslationScope] = useState('')
  const [compatibility, setCompatibility] = useState('')
  const [tags, setTags] = useState('')
  const [series, setSeries] = useState('')
  const [translationTeam, setTranslationTeam] = useState('')
  const [translationType, setTranslationType] = useState<TranslationType>('unofficial')
  const [seriesId, setSeriesId] = useState('')
  const [teamId, setTeamId] = useState('')
  const [thumbnailUrl, setThumbnailUrl] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [galleryUrls, setGalleryUrls] = useState<string[]>([])
  const [version, setVersion] = useState('1.0.0')
  const [fileSize, setFileSize] = useState('MB 0')
  const [fileFormat, setFileFormat] = useState('zip')
  const [releaseDate, setReleaseDate] = useState('')
  const [isFeatured, setIsFeatured] = useState(false)
  const [isTrending, setIsTrending] = useState(false)
  const [isLatest, setIsLatest] = useState(true)
  const [isOriginalWork, setIsOriginalWork] = useState(true)
  const [originalSource, setOriginalSource] = useState('')
  const [originalAuthor, setOriginalAuthor] = useState('')

  // Platform-specific fields
  const [platform, setPlatform] = useState('')
  const [translationMethod, setTranslationMethod] = useState('')
  const [platformGameId, setPlatformGameId] = useState('')
  const [cusaId, setCusaId] = useState('')
  const [ppsaId, setPpsaId] = useState('')
  const [titleId, setTitleId] = useState('')
  const [mediaId, setMediaId] = useState('')
  const [supportedFormat, setSupportedFormat] = useState('')
  const [systemFirmware, setSystemFirmware] = useState('')
  const [gameUpdateVersion, setGameUpdateVersion] = useState('')
  const [deviceModel, setDeviceModel] = useState('')
  const [installType, setInstallType] = useState('')
  const [cpuArch, setCpuArch] = useState('')
  const [gameVersion, setGameVersion] = useState('')
  const [minAndroidVersion, setMinAndroidVersion] = useState('')

  const [files, setFiles] = useState<DownloadFile[]>([])
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [contactLinks, setContactLinks] = useState<ContactLink[]>([])
  const [videoGroups, setVideoGroups] = useState<VideoGroup[]>([])
  const [customTabs, setCustomTabs] = useState<CustomTab[]>([])
  const [fetchingVideoKey, setFetchingVideoKey] = useState<string | null>(null)
  const [cropperOpen, setCropperOpen] = useState(false)
  const [cropperImage, setCropperImage] = useState<string | null>(null)
  const [cropperAspect, setCropperAspect] = useState(16 / 9)
  const [cropperTarget, setCropperTarget] = useState<
    'imageUrl' | 'thumbnailUrl' | 'gallery' | null
  >(null)
  // True while a cropped image is being uploaded — save is blocked meanwhile
  // so a data: URL can never land in the DB.
  const [cropUploading, setCropUploading] = useState(false)
  const [existingSeries, setExistingSeries] = useState<string[]>([])
  const [existingTeams, setExistingTeams] = useState<string[]>([])

  // تحميل السلاسل والفرق — للعلاقات (dropdown) + للإكمال التلقائي
  useEffect(() => {
    setLoadingMeta(true)
    Promise.all([
      fetch('/api/series').then((r) => r.json()),
      fetch('/api/teams').then((r) => r.json()),
    ])
      .then(([seriesData, teamsData]) => {
        if (seriesData?.data) {
          setSeriesList(seriesData.data.map((s: any) => ({ id: s.id, name: s.name, slug: s.slug })))
          setExistingSeries(seriesData.data.map((s: any) => s.name))
        }
        if (teamsData?.data) {
          setTeamsList(teamsData.data.map((t: any) => ({ id: t.id, name: t.name, slug: t.slug })))
          setExistingTeams(teamsData.data.map((t: any) => t.name))
        }
      })
      .catch(() => {})
      .finally(() => setLoadingMeta(false))
  }, [])

  // جلب دور المستخدم
  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.data?.role) setUserRole(data.data.role)
      })
      .catch(() => {})
  }, [])

  // لو تعديل: حمّل بيانات التعريب
  useEffect(() => {
    if (!modId) return
    fetch(`/api/creator/mods/${modId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data?.data) return
        const m = data.data
        setName(m.name || '')
        setSummary(m.summary || '')
        setDescription(m.description || '')
        setChangelog(m.changelog || '')
        setInstallGuide((m as any).installGuide || '')
        setArabicTitle(m.arabicTitle || '')
        setTranslationScope((m as any).translationScope || '')
        setCompatibility(m.compatibility || '')
        setTags(m.tags || '')
        setSeries(m.series || '')
        setTranslationTeam(m.translationTeam || '')
        setTranslationType(normalizeTranslationType(m.translationType))
        setSeriesId((m as any).seriesId || '')
        setTeamId((m as any).teamId || '')
        setThumbnailUrl(m.thumbnailUrl || '')
        setImageUrl(m.imageUrl || '')
        setGalleryUrls(m.galleryUrls ? m.galleryUrls.split(',').filter(Boolean) : [])
        setVersion(m.version || '1.0.0')
        setFileSize(m.fileSize || 'MB 0')
        setFileFormat(m.fileFormat || 'zip')
        setReleaseDate(m.releaseDate ? new Date(m.releaseDate).toISOString().split('T')[0] : '')
        setIsFeatured(m.isFeatured || false)
        setIsTrending(m.isTrending || false)
        setIsLatest(m.isLatest !== false)
        setIsOriginalWork(m.isOriginalWork !== false)
        setOriginalSource(m.originalSource || '')
        setOriginalAuthor(m.originalAuthor || '')
        setPlatform(m.game?.platform || '')
        setTranslationMethod((m as any).translationMethod || '')
        setPlatformGameId((m as any).platformGameId || '')
        setCusaId((m as any).cusaId || '')
        setPpsaId((m as any).ppsaId || '')
        setTitleId((m as any).titleId || '')
        setMediaId((m as any).mediaId || '')
        setSupportedFormat((m as any).supportedFormat || '')
        setSystemFirmware((m as any).systemFirmware || '')
        setGameUpdateVersion((m as any).gameUpdateVersion || '')
        setDeviceModel((m as any).deviceModel || '')
        setInstallType((m as any).installType || '')
        setCpuArch((m as any).cpuArch || '')
        setGameVersion((m as any).gameVersion || '')
        setMinAndroidVersion((m as any).minAndroidVersion || '')
        setWorkflowStatus(m.workflowStatus || 'DRAFT')
        setWorkflowHistory(m.workflowHistory || [])
        setVersionHistory(m.versionHistory || [])

        setFiles(
          m.files?.length
            ? m.files.map((f: any) => ({
                id: f.id,
                title: f.title,
                description: f.description || '',
                alert: f.alert || '',
                version: f.version,
                releaseDate: f.releaseDate,
                fileSize: f.fileSize,
                fileFormat: f.fileFormat,
                links: f.links?.map((l: any) => ({ url: l.url, label: l.label })) || [],
              }))
            : [],
        )
        setTeamMembers(
          m.teamMembers?.map((t: any) => ({
            id: t.id,
            name: t.name,
            avatarUrl: t.avatarUrl || '',
            role: t.role,
            contribution: t.contribution || '',
          })) || [],
        )
        setContactLinks(
          m.contactLinks?.map((c: any) => ({
            id: c.id,
            type: c.type,
            label: c.label,
            url: c.url,
          })) || [],
        )
        setVideoGroups(
          m.videoGroups?.map((g: any) => ({
            id: g.id,
            name: g.name,
            videos:
              g.videos?.map((v: any) => ({
                id: v.id,
                title: v.title,
                url: v.url,
                thumbnail: v.thumbnail || '',
                duration: v.duration || '',
                description: v.description || '',
                views: v.views || 0,
                likes: v.likes || 0,
                commentsCount: v.commentsCount || 0,
                channel: v.channel || '',
                publishedAt: v.publishedAt || null,
              })) || [],
          })) || [],
        )
        setCustomTabs(
          m.customTabs?.map((t: any) => ({
            id: t.id,
            name: t.name,
            slug: t.slug,
            content: t.content,
            visible: t.visible,
          })) || [],
        )
      })
      .catch(() => {})
      .finally(() => setLoadingMod(false))
  }, [modId])

  // جلب بيانات فيديو يوتيوب/فيميو تلقائياً
  const onFetchVideoMetadata = async (groupIdx: number, videoIdx: number, videoUrl: string) => {
    if (!videoUrl.trim()) return
    if (!isSupportedVideoUrl(videoUrl)) {
      toast({
        title: t.invalidLink,
        description: t.invalidLinkDesc,
        variant: 'destructive',
      })
      return
    }

    const key = `${groupIdx}-${videoIdx}`
    setFetchingVideoKey(key)

    try {
      const res = await fetch('/api/youtube/metadata', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: videoUrl }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(extractVideoErrorMessage(data) || t.fetchFailed)
      // API wraps success as { data: metadata } — unwrap, tolerate raw shape.
      const meta = (data?.data ?? data) as Record<string, any>
      setVideoGroups((prev) =>
        prev.map((g, gi) => {
          if (gi !== groupIdx) return g
          return {
            ...g,
            videos: g.videos.map((v, vi) => {
              if (vi !== videoIdx) return v
              return {
                ...v,
                title: meta.title || v.title,
                channel: meta.channel || v.channel,
                thumbnail: meta.thumbnail || v.thumbnail,
                duration: meta.duration || v.duration,
                description: meta.description || v.description,
                views: meta.views || v.views,
                likes: meta.likes || v.likes,
                commentsCount: meta.commentsCount || v.commentsCount,
                publishedAt: meta.publishedAt || v.publishedAt,
              }
            }),
          }
        }),
      )

      toast({
        title: t.fetched,
        description: meta.source === 'oembed' ? t.partialData : `${t.fetchedVideo}: ${meta.title}`,
      })
    } catch (err) {
      toast({
        title: t.fetchError,
        description: err instanceof Error ? err.message : t.fetchErrorDesc,
        variant: 'destructive',
      })
    } finally {
      setFetchingVideoKey(null)
    }
  }

  // ===== Image Cropping =====
  const handleImageFileSelect = (
    e: React.ChangeEvent<HTMLInputElement>,
    target: 'imageUrl' | 'thumbnailUrl' | 'gallery',
    aspect: number,
  ) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      setCropperImage(reader.result as string)
      setCropperAspect(aspect)
      setCropperTarget(target)
      setCropperOpen(true)
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  // Crop → Blob → server upload → https URL. The data: URL is NEVER
  // stored in state (it would otherwise land in the DB as multi-MB base64).
  const handleCropComplete = async (croppedImage: string) => {
    const target = cropperTarget
    if (!target) return
    if (!isDataUrl(croppedImage)) {
      // Already a URL (e.g. uncropped remote) — keep previous behavior.
      if (target === 'imageUrl') setImageUrl(croppedImage)
      else if (target === 'thumbnailUrl') setThumbnailUrl(croppedImage)
      else setGalleryUrls((prev) => [...prev, croppedImage])
      return
    }
    setCropUploading(true)
    try {
      const url = await uploadCroppedDataUrl(croppedImage, modId)
      if (target === 'imageUrl') setImageUrl(url)
      else if (target === 'thumbnailUrl') setThumbnailUrl(url)
      else setGalleryUrls((prev) => [...prev, url])
    } catch {
      toast({ title: t.cropUploadFailed, variant: 'destructive' })
    } finally {
      setCropUploading(false)
    }
  }

  const handleUrlCrop = (url: string, target: 'imageUrl' | 'thumbnailUrl', aspect: number) => {
    if (!url) {
      toast({ title: t.noImageLink, variant: 'destructive' })
      return
    }
    setCropperImage(url)
    setCropperAspect(aspect)
    setCropperTarget(target)
    setCropperOpen(true)
  }

  // Handle platform selection from step 1
  const handlePlatformSelect = (key: string) => {
    setPlatform(key)
    setStep(2)
  }

  // Handle going back to step 1 from step 2
  const handleBackToStep1 = () => {
    setPendingPlatform('')
    setPlatformChangeDialogOpen(true)
  }

  // Confirm platform change: clear platform-specific fields and go to step 1
  const confirmPlatformChange = () => {
    setPlatformChangeDialogOpen(false)
    // Clear platform-specific fields
    setTranslationMethod('')
    setPlatformGameId('')
    setCusaId('')
    setPpsaId('')
    setTitleId('')
    setMediaId('')
    setSupportedFormat('')
    setSystemFirmware('')
    setGameUpdateVersion('')
    setDeviceModel('')
    setInstallType('')
    setCpuArch('')
    setGameVersion('')
    setMinAndroidVersion('')
    setCompatibility('')
    setStep(1)
  }

  // ===== Save =====
  const onSave = async () => {
    // Defense in depth: never persist base64 — block save while a crop
    // upload is in flight or any image field still holds a data: URL.
    if (cropUploading) {
      toast({ title: t.cropNotUploaded, variant: 'destructive' })
      return
    }
    if (
      isDataUrl(thumbnailUrl) ||
      isDataUrl(imageUrl) ||
      galleryUrls.some((u) => isDataUrl(u))
    ) {
      toast({ title: t.cropUploadFailed, variant: 'destructive' })
      return
    }
    const _name = (name || '').trim()
    const _description = (description || '').trim()
    if (!_name || !_description) {
      const missing: string[] = []
      if (!_name) missing.push(t.missingName)
      if (!_description) missing.push(t.missingDesc)
      toast({
        title: t.incompleteData,
        description: `${t.requiredFields}: ${missing.join(locale === 'ar' ? '، ' : ', ')}`,
        variant: 'destructive',
      })
      return
    }
    const _summary = (summary || '').trim() || _description.slice(0, 150) || _name
    if (!(thumbnailUrl || '').trim() || !(imageUrl || '').trim()) {
      toast({
        title: t.imagesMissing,
        description: t.imagesMissingDesc,
        variant: 'destructive',
      })
      return
    }

    // Publisher must provide source when not original work
    const effectiveIsOriginalWork = userRole === 'publisher' ? false : isOriginalWork
    if (!effectiveIsOriginalWork && !originalSource.trim()) {
      toast({
        title: t.sourceRequired,
        description: t.sourceRequiredDesc,
        variant: 'destructive',
      })
      return
    }

    setSaving(true)
    const payload = {
      name: _name,
      summary: _summary,
      description: _description,
      changelog,
      installGuide,
      arabicTitle,
      translationScope,
      compatibility,
      tags: tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
      series,
      translationTeam,
      translationType,
      seriesId: seriesId || null,
      teamId: teamId || null,
      thumbnailUrl,
      imageUrl,
      galleryUrls,
      version,
      fileSize,
      fileFormat,
      releaseDate: releaseDate || null,
      isFeatured,
      isTrending,
      isLatest,
      isOriginalWork: effectiveIsOriginalWork,
      originalSource: effectiveIsOriginalWork ? null : originalSource.trim(),
      originalAuthor: effectiveIsOriginalWork ? null : originalAuthor.trim() || null,
      translationMethod: translationMethod || null,
      platformGameId: platformGameId || null,
      cusaId: cusaId || null,
      ppsaId: ppsaId || null,
      titleId: titleId || null,
      mediaId: mediaId || null,
      supportedFormat: supportedFormat || null,
      systemFirmware: systemFirmware || null,
      gameUpdateVersion: gameUpdateVersion || null,
      deviceModel: deviceModel || null,
      installType: installType || null,
      cpuArch: cpuArch || null,
      gameVersion: gameVersion || null,
      minAndroidVersion: minAndroidVersion || null,
      files: files.filter((f) => f.title),
      teamMembers: teamMembers.filter((m) => m.name),
      contactLinks: contactLinks.filter((c) => c.url),
      videoGroups: videoGroups
        .filter((g) => g.name)
        .map((g) => ({
          ...g,
          videos: g.videos.filter((v) => v.title && v.url),
        })),
      customTabs: customTabs.filter((t) => t.name),
    }

    try {
      const url = isEdit ? `/api/creator/mods/${modId}` : '/api/creator/mods'
      const method = isEdit ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok)
        throw new Error(
          data?.error?.message ||
            (typeof data?.error === 'string' ? data.error : null) ||
            t.saveFailed,
        )

      toast({
        title: t.saved,
        description: isEdit ? t.updated : t.publishedOk,
      })
      router.push('/creator/mods')
      router.refresh()
    } catch (err) {
      toast({
        title: t.errorTitle,
        description: err instanceof Error ? err.message : t.saveErrorDesc,
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  if (loadingMod || loadingMeta) {
    return (
      <div className="grid place-items-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* رأس */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link href="/creator/mods" className="hover:text-foreground">
            {t.breadcrumbMods}
          </Link>
          <ChevronRight className={`h-4 w-4 ${dir === 'rtl' ? 'rotate-180' : ''}`} />
          <span className="text-foreground">{isEdit ? t.editMod : t.newMod}</span>
          {isEdit && <WorkflowStatusBadge status={workflowStatus} className="ms-2" />}
        </div>
      </div>

      {/* Step indicator for new mods */}
      {!isEdit && (
        <div className="flex items-center gap-3 text-sm">
          <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
            step >= 1 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
          }`}>1</span>
          <span className={step >= 2 ? 'text-foreground' : 'text-muted-foreground'}>
            اختيار المنصة
          </span>
          <span className="text-muted-foreground">←</span>
          <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
            step >= 2 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
          }`}>2</span>
          <span className={step >= 2 ? 'text-foreground' : 'text-muted-foreground'}>
            بيانات التعريب
          </span>
        </div>
      )}

      {/* Step 1: Platform Selection */}
      {step === 1 && (
        <div className="rounded-xl border border-border bg-card/30 p-6">
          <PlatformSelector
            selected={platform}
            onSelect={handlePlatformSelect}
          />
        </div>
      )}

      {/* Step 2: Full Mod Form */}
      {step === 2 && (
        <>
          {/* Back button for new mods */}
          {!isEdit && (
            <button
              type="button"
              onClick={handleBackToStep1}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowRight className="h-4 w-4" />
              تغيير المنصة
            </button>
          )}

      <ModFormBasicInfo
        name={name}
        setName={setName}
        description={description}
        setDescription={setDescription}
        changelog={changelog}
        setChangelog={setChangelog}
        installGuide={installGuide}
        setInstallGuide={setInstallGuide}
        arabicTitle={arabicTitle}
        setArabicTitle={setArabicTitle}
        translationScope={translationScope}
        setTranslationScope={setTranslationScope}
        compatibility={compatibility}
        setCompatibility={setCompatibility}
        tags={tags}
        setTags={setTags}
        translationType={translationType}
        setTranslationType={setTranslationType}
        isOriginalWork={isOriginalWork}
        setIsOriginalWork={setIsOriginalWork}
        originalSource={originalSource}
        setOriginalSource={setOriginalSource}
        originalAuthor={originalAuthor}
        setOriginalAuthor={setOriginalAuthor}
        userRole={userRole}
      />

      <PlatformFieldsSection
        platform={platform}
        setPlatform={setPlatform}
        translationMethod={translationMethod}
        setTranslationMethod={setTranslationMethod}
        platformGameId={platformGameId}
        setPlatformGameId={setPlatformGameId}
        cusaId={cusaId}
        setCusaId={setCusaId}
        ppsaId={ppsaId}
        setPpsaId={setPpsaId}
        titleId={titleId}
        setTitleId={setTitleId}
        mediaId={mediaId}
        setMediaId={setMediaId}
        supportedFormat={supportedFormat}
        setSupportedFormat={setSupportedFormat}
        systemFirmware={systemFirmware}
        setSystemFirmware={setSystemFirmware}
        gameUpdateVersion={gameUpdateVersion}
        setGameUpdateVersion={setGameUpdateVersion}
        deviceModel={deviceModel}
        setDeviceModel={setDeviceModel}
        installType={installType}
        setInstallType={setInstallType}
        cpuArch={cpuArch}
        setCpuArch={setCpuArch}
        gameVersion={gameVersion}
        setGameVersion={setGameVersion}
        minAndroidVersion={minAndroidVersion}
        setMinAndroidVersion={setMinAndroidVersion}
        compatibility={compatibility}
        setCompatibility={setCompatibility}
        hidePlatformSelect={!isEdit}
      />

      {/* أزرار تغيير الحالة */}
      {isEdit && (
        <WorkflowActions
          modId={modId!}
          currentStatus={workflowStatus}
          userRole={userRole}
          onStatusChange={(newStatus) => {
            setWorkflowStatus(newStatus)
            // إعادة تحميل سجل التاريخ
            fetch(`/api/creator/mods/${modId}/workflow`)
              .then((r) => (r.ok ? r.json() : null))
              .then((data) => {
                if (data?.data) setWorkflowHistory(data.data)
              })
              .catch(() => {})
          }}
        />
      )}

      <ModFormMedia
        modId={modId}
        imageUrl={imageUrl}
        setImageUrl={setImageUrl}
        thumbnailUrl={thumbnailUrl}
        setThumbnailUrl={setThumbnailUrl}
        galleryUrls={galleryUrls}
        setGalleryUrls={setGalleryUrls}
        cropperImage={cropperImage}
        cropperOpen={cropperOpen}
        setCropperOpen={setCropperOpen}
        cropperAspect={cropperAspect}
        cropperTarget={cropperTarget}
        handleImageFileSelect={handleImageFileSelect}
        handleCropComplete={handleCropComplete}
        handleUrlCrop={handleUrlCrop}
        videoGroups={videoGroups}
        setVideoGroups={setVideoGroups}
        fetchingVideoKey={fetchingVideoKey}
        onFetchVideoMetadata={onFetchVideoMetadata}
      />

      <ModFormFiles
        modId={modId}
        version={version}
        setVersion={setVersion}
        fileSize={fileSize}
        setFileSize={setFileSize}
        fileFormat={fileFormat}
        setFileFormat={setFileFormat}
        compatibility={compatibility}
        setCompatibility={setCompatibility}
        releaseDate={releaseDate}
        isEdit={isEdit}
        isFeatured={isFeatured}
        setIsFeatured={setIsFeatured}
        isTrending={isTrending}
        setIsTrending={setIsTrending}
        isLatest={isLatest}
        setIsLatest={setIsLatest}
        files={files}
        setFiles={setFiles}
        addEmptyFile={() => setFiles((p) => [...p, { ...EMPTY_FILE }])}
      />

      <ModFormSettings
        seriesId={seriesId}
        setSeriesId={setSeriesId}
        seriesList={seriesList}
        teamId={teamId}
        setTeamId={setTeamId}
        teamsList={teamsList}
        teamMembers={teamMembers}
        setTeamMembers={setTeamMembers}
        addEmptyMember={() => setTeamMembers((p) => [...p, { ...EMPTY_MEMBER }])}
        contactLinks={contactLinks}
        setContactLinks={setContactLinks}
        addEmptyContact={() => setContactLinks((p) => [...p, { ...EMPTY_CONTACT }])}
        customTabs={customTabs}
        setCustomTabs={setCustomTabs}
        addEmptyTab={() => setCustomTabs((p) => [...p, { ...EMPTY_TAB }])}
        slugify={slugify}
      />

      {/* سجل الإصدارات */}
      {isEdit && (
        <Section
          title={t.versions}
          icon={<FileArchive className="h-4 w-4" />}
          action={
            <Button
              size="sm"
              className="min-h-[44px]"
              variant="outline"
              onClick={() => setNewVersionDialogOpen(true)}
            >
              <Plus className="me-1 h-3.5 w-3.5" />
              {t.newVersion}
            </Button>
          }
        >
          <VersionHistory versions={versionHistory} />
        </Section>
      )}

      {/* نافذة إصدار جديد */}
      {isEdit && (
        <NewVersionDialog
          modId={modId!}
          currentVersion={version}
          open={newVersionDialogOpen}
          onOpenChange={setNewVersionDialogOpen}
          onCreated={() => {
            // إعادة تحميل سجل الإصدارات
            fetch(`/api/creator/mods/${modId}/versions`)
              .then((r) => (r.ok ? r.json() : null))
              .then((data) => {
                if (data?.data) setVersionHistory(data.data)
              })
              .catch(() => {})
          }}
        />
      )}

      {/* سجل تغييرات الحالة */}
      {isEdit && workflowHistory.length > 0 && (
        <Section title={t.statusHistory} icon={<Clock className="h-4 w-4" />}>
          <WorkflowHistory history={workflowHistory} />
        </Section>
      )}

      <ModFormActions saving={saving} isEdit={isEdit} onSave={onSave} />

      {/* End step 2 wrapper */}
        </>
      )}

      {/* Platform change warning dialog */}
      <AlertDialog open={platformChangeDialogOpen} onOpenChange={setPlatformChangeDialogOpen}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>تغيير المنصة</AlertDialogTitle>
            <AlertDialogDescription>
              تغيير المنصة سيؤدي إلى مسح جميع الحقول الخاصة بالمنصة الحالية
              (معرّف اللعبة، تحديث النظام، إلخ). البيانات العامة (اسم التعريب،
              الاسم بالعربي، الوصف) لن تتأثر.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={confirmPlatformChange}>
              تغيير ومسح الحقول
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
