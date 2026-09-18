/**
 * File type categories (P3) — MIME-first, extension fallback.
 * Used by file list filters, storage stats, and embed-code generation.
 */

export type FileCategory = 'image' | 'video' | 'archive' | 'audio' | 'other'

const ARCHIVE_MIMES = new Set([
  'application/zip',
  'application/x-zip-compressed',
  'application/x-rar-compressed',
  'application/vnd.rar',
  'application/x-7z-compressed',
  'application/x-tar',
  'application/gzip',
  'application/x-gzip',
  'application/x-bzip2',
  'application/x-xz',
  'application/x-iso9660-image',
])

const ARCHIVE_EXTS = ['.zip', '.rar', '.7z', '.tar', '.gz', '.bz2', '.xz', '.iso']

export function fileCategory(mime: string | null | undefined, url: string): FileCategory {
  const m = (mime || '').toLowerCase()
  if (m.startsWith('image/')) return 'image'
  if (m.startsWith('video/')) return 'video'
  if (m.startsWith('audio/')) return 'audio'
  if (m && ARCHIVE_MIMES.has(m)) return 'archive'
  const path = url.split('?')[0]?.toLowerCase() || ''
  if (ARCHIVE_EXTS.some((ext) => path.endsWith(ext))) return 'archive'
  if (/\.(png|jpe?g|webp|gif|avif|svg|bmp|ico)$/.test(path)) return 'image'
  if (/\.(mp4|webm|mkv|mov|avi)$/.test(path)) return 'video'
  if (/\.(mp3|wav|ogg|flac|m4a)$/.test(path)) return 'audio'
  return 'other'
}

export const FILE_CATEGORY_LABELS: Record<FileCategory, string> = {
  image: 'صور',
  video: 'فيديو',
  archive: 'أرشيف',
  audio: 'صوت',
  other: 'أخرى',
}

/**
 * Prisma `where` fragment for UploadAsset category filtering.
 * Archive matches known MIME types OR archive extensions in the URL.
 */
export function fileCategoryWhere(category: FileCategory): Record<string, unknown> {
  switch (category) {
    case 'image':
      return { mime: { startsWith: 'image/' } }
    case 'video':
      return { mime: { startsWith: 'video/' } }
    case 'audio':
      return { mime: { startsWith: 'audio/' } }
    case 'archive':
      return {
        OR: [
          { mime: { in: [...ARCHIVE_MIMES] } },
          ...ARCHIVE_EXTS.map((ext) => ({ originalUrl: { endsWith: ext } })),
        ],
      }
    case 'other':
      return {
        NOT: {
          OR: [
            { mime: { startsWith: 'image/' } },
            { mime: { startsWith: 'video/' } },
            { mime: { startsWith: 'audio/' } },
            { mime: { in: [...ARCHIVE_MIMES] } },
          ],
        },
      }
  }
}
