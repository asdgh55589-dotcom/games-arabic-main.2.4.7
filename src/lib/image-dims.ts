/**
 * Image dimension validation (P2).
 * Minimum 200×200px hard error for all roles; banners get a soft
 * 1200×630 recommendation warning (upload still proceeds).
 */

export interface ImageDims {
  width: number
  height: number
}

export const MIN_IMAGE_WIDTH = 200
export const MIN_IMAGE_HEIGHT = 200
export const RECOMMENDED_BANNER_WIDTH = 1200
export const RECOMMENDED_BANNER_HEIGHT = 630

export type ImageRole = 'avatar' | 'banner' | 'thumbnail' | 'logo' | 'general'

/** Read pixel dimensions of a local file. Null when unreadable (non-image, no DOM). */
export async function getImageDimensions(file: Blob): Promise<ImageDims | null> {
  try {
    if (typeof createImageBitmap === 'function') {
      const bitmap = await createImageBitmap(file)
      const dims = { width: bitmap.width, height: bitmap.height }
      bitmap.close?.()
      return dims
    }
    if (typeof Image !== 'undefined' && typeof URL !== 'undefined') {
      const objectUrl = URL.createObjectURL(file)
      try {
        return await new Promise<ImageDims | null>((resolve) => {
          const img = new Image()
          img.onload = () =>
            resolve({ width: img.naturalWidth, height: img.naturalHeight })
          img.onerror = () => resolve(null)
          img.src = objectUrl
        })
      } finally {
        URL.revokeObjectURL(objectUrl)
      }
    }
    return null
  } catch {
    return null
  }
}

export interface DimensionCheck {
  ok: boolean
  /** Hard failure (Arabic) — block the upload. */
  error?: string
  /** Soft recommendation (Arabic) — upload may proceed. */
  warning?: string
}

export function checkImageDimensions(
  dims: ImageDims | null,
  role: ImageRole = 'general',
): DimensionCheck {
  // Unreadable dimensions never block (server still validates type/size).
  if (!dims) return { ok: true }
  if (dims.width < MIN_IMAGE_WIDTH || dims.height < MIN_IMAGE_HEIGHT) {
    return {
      ok: false,
      error: `الصورة صغيرة جدًا (${dims.width}×${dims.height}). الحد الأدنى: ${MIN_IMAGE_WIDTH}×${MIN_IMAGE_HEIGHT} بكسل`,
    }
  }
  if (
    role === 'banner' &&
    (dims.width < RECOMMENDED_BANNER_WIDTH || dims.height < RECOMMENDED_BANNER_HEIGHT)
  ) {
    return {
      ok: true,
      warning: `يُنصح باستخدام صورة بعرض ${RECOMMENDED_BANNER_WIDTH} بكسل على الأقل (الحالية ${dims.width}×${dims.height})`,
    }
  }
  return { ok: true }
}
