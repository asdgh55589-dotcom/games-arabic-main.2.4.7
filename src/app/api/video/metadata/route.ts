/**
 * P3 alias: /api/video/metadata → same handler as /api/youtube/metadata.
 * The handler accepts YouTube + Vimeo URLs. The old path is kept forever
 * (both forms + external callers may still use it).
 */
export { POST } from '@/app/api/youtube/metadata/route'
export const runtime = 'nodejs'
