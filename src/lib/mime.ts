export const ALLOWED_IMAGE_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])

export function isAllowedImageMime(mime: string): boolean {
  return ALLOWED_IMAGE_MIMES.has(mime.toLowerCase())
}

// Magic-byte validator: checks file header bytes to confirm MIME type
export function validateImageMagicBytes(buffer: Buffer, expectedMime: string): boolean {
  if (buffer.length < 4) return false
  const header = buffer.subarray(0, 4)
  switch (expectedMime) {
    case 'image/jpeg': return header[0] === 0xFF && header[1] === 0xD8 && header[2] === 0xFF
    case 'image/png': return header[0] === 0x89 && header[1] === 0x50 && header[2] === 0x4E && header[3] === 0x47
    case 'image/gif': return header[0] === 0x47 && header[1] === 0x49 && header[2] === 0x46
    case 'image/webp': return header.subarray(0, 4).toString() === 'RIFF' && buffer.length > 12 && buffer.subarray(8, 12).toString() === 'WEBP'
    default: return false
  }
}
