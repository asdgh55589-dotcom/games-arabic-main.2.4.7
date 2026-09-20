/**
 * lib/image-placeholder.ts — tiny inline shimmer used as next/image
 * blurDataURL for remote images (per-image generated blur would need a
 * new dependency + build-time fetching; this solid shimmer avoids layout
 * pop with zero cost).
 */

// 8x8 dark shimmer GIF (~100 bytes) — neutral under gradients/overlays.
export const BLUR_PLACEHOLDER =
  'data:image/gif;base64,R0lGODlhCAAIAIAAAMzMzP///yH5BAEKAAEALAAAAAAIAAgAAAIKjI+py+0Po5y02ouz3rz7D4biSJbmiabqyrbuC8fyTNpwAAOw=='
