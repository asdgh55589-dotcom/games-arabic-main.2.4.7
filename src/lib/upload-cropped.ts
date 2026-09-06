/**
 * Upload a cropped canvas image WITHOUT ever storing base64 in the DB.
 * Converts the cropper's data: URL to a File and POSTs it to the existing
 * server route (same validation + Cloudinary pipeline as direct uploads).
 * Resolves with the https:// URL — never a data: URL.
 */
export type CropImageType = 'cover' | 'banner' | 'screenshot'

export function cropTargetToImageType(
  target: 'imageUrl' | 'thumbnailUrl' | 'gallery',
): CropImageType {
  if (target === 'imageUrl') return 'banner'
  if (target === 'thumbnailUrl') return 'cover'
  return 'screenshot'
}

export function isDataUrl(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.startsWith('data:')
}

export async function uploadCroppedDataUrl(
  dataUrl: string,
  imageType: CropImageType,
  modId?: string,
): Promise<string> {
  // data: URL → Blob → File (canvas crops are jpeg/png; keep mime, cap type)
  const fetched = await fetch(dataUrl)
  const blob = await fetched.blob()
  if (!blob.type.startsWith('image/')) {
    throw new Error('Cropped output is not an image')
  }
  const ext = blob.type.includes('png') ? 'png' : blob.type.includes('webp') ? 'webp' : 'jpg'
  const file = new File([blob], `crop-${Date.now()}.${ext}`, { type: blob.type })

  const fd = new FormData()
  fd.append('file', file)
  fd.append('type', imageType)
  fd.append('modId', modId || 'new')

  const res = await fetch('/api/storage/upload-mod-image', {
    method: 'POST',
    body: fd,
  })
  const json = await res.json().catch(() => null)
  if (!res.ok) {
    throw new Error(
      (typeof json?.error?.message === 'string' && json.error.message) ||
        'Crop upload failed',
    )
  }
  const url = json?.data?.url
  if (typeof url !== 'string' || !url.startsWith('https://')) {
    throw new Error('Crop upload returned no URL')
  }
  return url
}
