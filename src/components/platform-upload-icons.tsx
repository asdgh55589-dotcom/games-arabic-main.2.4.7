'use client'

/**
 * كشف منصة الرفع من الرابط + أيقونات برند SVG حقيقية.
 *
 * بندخّل الرابط، بنحلّل الـ hostname، وبنرجّع:
 *   - id: معرّف المنصة
 *   - name: اسم المنصة بالعربي
 *   - color: لون البرند الأصلي
 *   - icon: عنصر SVG بيRepresent الشعار
 */

export type PlatformId =
  | 'mediafire'
  | 'gdrive'
  | 'mega'
  | 'dropbox'
  | 'onedrive'
  | 'yandex'
  | 'telegram'
  | 'youtube'
  | 'direct'
  | 'unknown'

export interface PlatformInfo {
  id: PlatformId
  name: string
  color: string
  icon: React.ReactNode
}

/** كشف المنصة من الرابط */
export function detectPlatform(url: string): PlatformId {
  const u = url.toLowerCase().trim()
  if (!u) return 'unknown'

  // YouTube
  if (u.includes('youtube.com') || u.includes('youtu.be')) return 'youtube'
  // MediaFire
  if (u.includes('mediafire.com')) return 'mediafire'
  // Google Drive
  if (
    u.includes('drive.google.com') ||
    u.includes('docs.google.com') ||
    u.includes('google.com/file')
  )
    return 'gdrive'
  // MEGA
  if (u.includes('mega.nz') || u.includes('mega.io') || u.includes('mega.co.nz')) return 'mega'
  // Dropbox
  if (u.includes('dropbox.com') || u.includes('db.tt')) return 'dropbox'
  // OneDrive
  if (u.includes('onedrive.live.com') || u.includes('1drv.ms') || u.includes('onedrive.com'))
    return 'onedrive'
  // Yandex Disk
  if (u.includes('disk.yandex.') || u.includes('yadisk.com')) return 'yandex'
  // Telegram
  if (u.includes('t.me') || u.includes('telegram.me') || u.includes('telegram.org'))
    return 'telegram'

  // لو الرابط مباشر (ينتهي بامتداد ملف)
  if (/\.(zip|rar|7z|exe|msi|iso|tar|gz|bz2)(\?|$)/.test(u)) return 'direct'

  return 'unknown'
}

/** اسم المنصة بالعربي */
export function getPlatformName(id: PlatformId): string {
  switch (id) {
    case 'mediafire':
      return 'MediaFire'
    case 'gdrive':
      return 'Google Drive'
    case 'mega':
      return 'MEGA'
    case 'dropbox':
      return 'Dropbox'
    case 'onedrive':
      return 'OneDrive'
    case 'yandex':
      return 'Yandex Disk'
    case 'telegram':
      return 'Telegram'
    case 'youtube':
      return 'YouTube'
    case 'direct':
      return 'تحميل مباشر'
    case 'unknown':
      return 'رابط خارجي'
  }
}

/** لون البرند الأصلي (hex) */
export function getPlatformColor(id: PlatformId): string {
  switch (id) {
    case 'mediafire':
      return '#0172F8' // MediaFire blue
    case 'gdrive':
      return '#0F9D58' // Google Drive green (also has blue/yellow/red but green is primary)
    case 'mega':
      return '#D9272E' // MEGA red
    case 'dropbox':
      return '#0061FF' // Dropbox blue
    case 'onedrive':
      return '#0078D4' // OneDrive blue
    case 'yandex':
      return '#FFCC00' // Yandex yellow
    case 'telegram':
      return '#229ED9' // Telegram blue
    case 'youtube':
      return '#FF0000' // YouTube red
    case 'direct':
      return '#6b7280' // gray
    case 'unknown':
      return '#4b5563' // dark gray
  }
}

/** أيقونة المنصة كـ SVG */
export function getPlatformIcon(id: PlatformId): React.ReactNode {
  switch (id) {
    case 'mediafire':
      // MediaFire — simplified flame
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className="h-full w-full" aria-hidden="true">
          <path d="M12 2c0 3-2 4-2 7a4 4 0 0 0 8 0c0-1-.5-2-1-3 2 1 4 3 4 6a7 7 0 1 1-14 0c0-5 5-7 5-10z" />
        </svg>
      )
    case 'gdrive':
      // Google Drive — triangle logo (3 colored triangles forming the drive shape)
      return (
        <svg viewBox="0 0 24 24" className="h-full w-full" aria-hidden="true">
          <path d="M9 3h6l6 10h-6L9 3z" fill="#0F9D58" />
          <path d="M3 13l3-5 6 0-3 5L3 13z" fill="#FFC107" transform="translate(6 0)" />
          <path d="M3 13l3-5 6 0-3 5z" fill="#FFC107" />
          <path d="M3 21h6l3-5H6L3 21z" fill="#4285F4" />
          <path d="M12 21h6l3-5h-6l-3 5z" fill="#1DA462" />
        </svg>
      )
    case 'mega':
      // MEGA — white "M" on red
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className="h-full w-full" aria-hidden="true">
          <path d="M2 4h4l4 8 4-8h4v16h-3V9l-5 9-5-9v11H2V4z" />
        </svg>
      )
    case 'dropbox':
      // Dropbox — diamond logo
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className="h-full w-full" aria-hidden="true">
          <path d="M6 2L12 6L6 10L0 6L6 2z" />
          <path d="M18 2L24 6L18 10L12 6L18 2z" />
          <path d="M0 13L6 17L12 13L6 9L0 13z" transform="translate(0 1)" />
          <path d="M12 14L18 18L24 14L18 10L12 14z" transform="translate(0 1)" />
          <path d="M6 19L12 23L18 19L12 15L6 19z" />
        </svg>
      )
    case 'onedrive':
      // OneDrive — cloud
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className="h-full w-full" aria-hidden="true">
          <path d="M7 18a4 4 0 0 1 0-8 5 5 0 0 1 9.5-1.5A4.5 4.5 0 0 1 17 18H7z" />
        </svg>
      )
    case 'yandex':
      // Yandex Disk — "Я" (Ya) letter
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className="h-full w-full" aria-hidden="true">
          <path d="M9 4h3.5c2.5 0 4.5 2 4.5 4.5S15 13 12.5 13H11v7H9V4zm2 7h1.5c1.4 0 2.5-1.1 2.5-2.5S13.9 6 12.5 6H11v5z" />
        </svg>
      )
    case 'telegram':
      // Telegram — paper plane
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className="h-full w-full" aria-hidden="true">
          <path
            d="M21.94 4.6L18.5 20.5c-.26 1.15-.94 1.43-1.9.89l-5.26-3.88-2.54 2.44c-.28.28-.51.51-1.05.51l.37-5.32 9.66-8.73c.42-.37-.09-.58-.65-.21L5.13 13.4 0 11.8c-1.12-.35-1.14-1.12.24-1.66L20.5 2.95c.93-.35 1.75.21 1.44 1.65z"
            transform="translate(1 0)"
          />
        </svg>
      )
    case 'youtube':
      // YouTube — play button
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className="h-full w-full" aria-hidden="true">
          <path d="M23 12s0-3.5-.44-5.18a2.5 2.5 0 0 0-1.76-1.76C19.1 4.5 12 4.5 12 4.5s-7.1 0-8.8.56a2.5 2.5 0 0 0-1.76 1.76C1 8.5 1 12 1 12s0 3.5.44 5.18a2.5 2.5 0 0 0 1.76 1.76C4.9 19.5 12 19.5 12 19.5s7.1 0 8.8-.56a2.5 2.5 0 0 0 1.76-1.76C23 15.5 23 12 23 12zM9.75 15.5v-7l6 3.5-6 3.5z" />
        </svg>
      )
    case 'direct':
      // Download arrow
      return (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          className="h-full w-full"
          aria-hidden="true"
        >
          <path
            d="M12 3v14m0 0l5-5m-5 5l-5-5M5 21h14"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )
    case 'unknown':
    default:
      // External link
      return (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          className="h-full w-full"
          aria-hidden="true"
        >
          <path
            d="M14 3h7v7M10 14L21 3M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )
  }
}

/** كل المعلومات عن المنصة في استدعاء واحد */
export function getPlatformInfo(url: string): PlatformInfo {
  const id = detectPlatform(url)
  return {
    id,
    name: getPlatformName(id),
    color: getPlatformColor(id),
    icon: getPlatformIcon(id),
  }
}
