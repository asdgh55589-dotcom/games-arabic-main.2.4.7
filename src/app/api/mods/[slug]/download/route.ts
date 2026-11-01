import { NextRequest } from 'next/server'
import { fail } from '@/lib/api-response'

interface RouteParams {
  params: Promise<{ slug: string }>
}

// POST — مهمل: استخدم GET /api/mods/[slug]/download/[linkId] بدلاً منه
// تم إهماله لمنع التضارب بين واجهتين — الواجهة الموحدة هي GET مع linkId.
// ملاحظة: هذا المسار لم يكن يعدّ أي تحميل ولا يزيد Mod.downloads — ردّه 410
// ثابت. الواجهة الحيّة هي GET .../download/[linkId] التي تُسجّل الـ DownloadClick.
export async function POST(_req: NextRequest, { params }: RouteParams) {
  const { slug } = await params
  return fail(
    'DEPRECATED_ENDPOINT',
    'هذه الواجهة مهملة — استخدم GET /api/mods/' + slug + '/download/[linkId] مع معرّف الرابط المحدد',
    410,
    { deprecatedSince: '2026-08-23', useInstead: `GET /api/mods/${slug}/download/[linkId]` }
  )
}
