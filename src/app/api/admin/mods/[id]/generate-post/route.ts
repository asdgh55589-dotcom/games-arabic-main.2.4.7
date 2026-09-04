import { db } from '@/lib/db'
import { requireModerator } from '@/lib/auth'
import { ok, notFound, internalError } from '@/lib/api-response'
import type { NextRequest } from 'next/server'
import { formatPost, validatePostLength, getDefaultTemplate } from '@/lib/telegram-templates'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireModerator()
    const { id } = await params
    const body = await req.json()
    const { templateId, customOverrides } = body

    const mod = await db.mod.findUnique({
      where: { id },
      include: {
        game: { select: { name: true, platform: true } },
        teamRelation: { select: { name: true } },
        files: {
          select: {
            links: { select: { url: true }, take: 1 },
          },
          take: 1,
        },
      },
    })

    if (!mod) {
      return notFound('التعريب غير موجود')
    }

    const downloadUrl = mod.files[0]?.links[0]?.url || ''

    const { content, variables } = formatPost(
      {
        name: mod.name,
        arabicTitle: mod.arabicTitle || undefined,
        version: mod.version,
        description: mod.description || undefined,
        summary: mod.summary || undefined,
        fileSize: mod.fileSize || undefined,
        game: mod.game,
        teamRelation: mod.teamRelation,
        files: [{ downloadUrl }],
      },
      getDefaultTemplate(),
      customOverrides,
    )

    const validation = validatePostLength(content)

    return ok({
      post: content,
      variables,
      validation,
      modId: mod.id,
      modName: mod.name,
    })
  } catch (err) {
    console.error('[admin/mods/generate-post] failed:', err)
    return internalError('فشل في توليد المنشور')
  }
}
