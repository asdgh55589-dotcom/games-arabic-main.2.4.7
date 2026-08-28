import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { requireModerator, canDelete } from '@/lib/auth'
import { ok, notFound, forbidden, internalError } from '@/lib/api-response'

// GET /api/admin/news/[id]
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireModerator()
    const { id } = await params
    const news = await db.news.findUnique({ where: { id } })
    if (!news) return notFound('الخبر غير موجود')
    return ok(news)
  } catch (err) {
    console.error('[admin/news/[id] GET] failed:', err)
    const status = (err as { status?: number })?.status || 500
    return internalError('Failed')
  }
}

// PUT /api/admin/news/[id]
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireModerator()
    const { id } = await params
    const body = await req.json()

    const existing = await db.news.findUnique({ where: { id } })
    if (!existing) return notFound('الخبر غير موجود')

    const data: Record<string, unknown> = {}
    if (body.title !== undefined) data.title = body.title.trim()
    if (body.summary !== undefined) data.summary = body.summary
    if (body.content !== undefined) data.content = body.content
    if (body.imageUrl !== undefined) data.imageUrl = body.imageUrl
    if (body.linkUrl !== undefined) data.linkUrl = body.linkUrl || null
    if (body.category !== undefined) data.category = body.category
    if (body.type !== undefined) data.type = body.type
    if (body.isSticky !== undefined) data.isSticky = body.isSticky
    if (body.isAnimated !== undefined) data.isAnimated = body.isAnimated
    if (body.visible !== undefined) data.visible = body.visible
    if (body.order !== undefined) data.order = body.order
    if (body.publishAt !== undefined) data.publishAt = new Date(body.publishAt)
    if (body.expiresAt !== undefined) data.expiresAt = body.expiresAt ? new Date(body.expiresAt) : null

    const news = await db.news.update({ where: { id }, data })
    return ok(news)
  } catch (err) {
    console.error('[admin/news/[id] PUT] failed:', err)
    const status = (err as { status?: number })?.status || 500
    return internalError('Failed')
  }
}

// DELETE /api/admin/news/[id] — soft delete
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireModerator()
    if (!canDelete(user)) {
      return forbidden('لا تملك صلاحية الحذف')
    }
    const { id } = await params
    await db.news.update({ where: { id }, data: { visible: false } })
    return ok({ success: true })
  } catch (err) {
    console.error('[admin/news/[id] DELETE] failed:', err)
    const status = (err as { status?: number })?.status || 500
    return internalError('Failed')
  }
}
