import type { NextRequest } from 'next/server'
import { fail, forbidden, internalError, ok, okPaginated, validationFail } from '@/lib/api-response'
import { parsePagination } from '@/lib/api-utils'
import { requireCreatorStudio } from '@/lib/auth'
import { db } from '@/lib/db'
import { reportError } from '@/lib/error-reporting'
import { fileCategoryWhere, type FileCategory } from '@/lib/file-types'
import {
  IA_COMING_SOON_MESSAGE,
  iaStorageKey,
  isIaConfigured,
  isIaEnabled,
} from '@/lib/ia'
import { streamIaObject } from '@/lib/ia-stream'
import { logger } from '@/lib/logger'
import { checkUploadQuota, recordUploadUsage } from '@/lib/quota'
import { rateLimitMiddleware } from '@/lib/rate-limit'
import {
  INVALID_UPLOAD_CONTENT_MESSAGE,
  UPLOAD_HEAD_BYTES,
  scanUploadForViruses,
  validateUploadContent,
  validateUploadMeta,
} from '@/lib/upload-validation'

const PROVIDERS = ['freeimage', 'ia', 'direct', 'cloudinary', 'supabase'] as const
const CATEGORIES: FileCategory[] = ['image', 'video', 'archive', 'audio', 'other']

// GET /api/creator/files — ملفاتي فقط (المستخدم يرى ملفاته فقط)
export async function GET(req: NextRequest) {
  try {
    const { user, error } = await requireCreatorStudio(req)
    if (error) return error
    if (!user) return internalError('يجب تسجيل الدخول')

    const limited = await rateLimitMiddleware(req, {
      limit: 60,
      window: 60,
      keyPrefix: `creator:files:${user.id}`,
    })
    if (limited) return limited

    const { searchParams } = new URL(req.url)
    const provider = searchParams.get('provider')?.trim() || null
    const type = searchParams.get('type')?.trim() || null
    const search = searchParams.get('search')?.trim() || null
    // B2 backend — mod filter for the files page (author-scoped: the mod
    // must belong to the caller, otherwise the filter is rejected so one
    // creator can never probe another creator's file linkage).
    const modId = searchParams.get('modId')?.trim() || null
    const { page, limit } = parsePagination(searchParams.get('page'), searchParams.get('limit'), {
      limit: 50,
      maxLimit: 100,
    })

    const where: Record<string, unknown> = { userId: user.id }
    if (provider && (PROVIDERS as readonly string[]).includes(provider)) {
      where.provider = provider
    }
    if (type && (CATEGORIES as string[]).includes(type)) {
      Object.assign(where, fileCategoryWhere(type as FileCategory))
    }
    if (modId) {
      const owned = await db.mod.findFirst({
        where: { id: modId, authorId: user.id },
        select: { id: true },
      })
      if (!owned) {
        const { validationFail } = await import('@/lib/api-response')
        return validationFail('التعريب غير موجود أو ليس لك')
      }
      where.modId = modId
    }
    if (search) {
      where.OR = [
        { originalUrl: { contains: search } },
        { storageKey: { contains: search } },
      ]
    }

    const [total, files] = await Promise.all([
      db.uploadAsset.count({ where }),
      db.uploadAsset.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ])

    const modIds = [...new Set(files.map((f) => f.modId).filter((v): v is string => Boolean(v)))]
    const mods =
      modIds.length > 0
        ? await db.mod.findMany({
            where: { id: { in: modIds } },
            select: { id: true, name: true, slug: true },
          })
        : []
    const modById = new Map(mods.map((m) => [m.id, m]))

    const data = files.map((f) => ({
      ...f,
      bytes: Number(f.bytes),
      mod: f.modId ? (modById.get(f.modId) ?? null) : null,
    }))

    return okPaginated(data, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    }, { headers: { 'Cache-Control': 'private, max-age=30' } })
  } catch (err) {
    logger.error('[creator/files GET] failed:', err)
    reportError(err, { route: 'GET /api/creator/files' })
    return internalError('فشل جلب الملفات')
  }
}

/** 400 — malformed multipart / rejected file (clear Arabic reason). */
function badRequest(message: string) {
  return fail('VALIDATION_ERROR', message, 400)
}

// req.formData() buffers the whole part in memory. Keep this route for small
// files; large uploads must use the streaming relay (flat memory).
const MAX_MULTIPART_BYTES = 10 * 1024 * 1024

// POST /api/creator/files — multipart upload of one creator file to IA.
//
// STORAGE TRADEOFF (documented): `req.formData()` keeps the multipart body
// in memory before this handler runs, so this route is intended for small/
// medium files. The creator UI deliberately sends large files through the
// STREAMING relay (`POST /api/storage/ia/relay`, flat memory) instead. Here
// only the first 64KB is sliced for signature checks, and the provider PUT
// streams `file.stream()` with an explicit Content-Length (IA rejects
// chunked bodies with 411).
export async function POST(req: NextRequest) {
  try {
    const { user, error } = await requireCreatorStudio(req)
    if (error) return error
    if (!user) return badRequest('يجب تسجيل الدخول')

    const limited = await rateLimitMiddleware(req, {
      limit: 20,
      window: 60,
      keyPrefix: `creator:files:upload:${user.id}`,
    })
    if (limited) return limited

    if (!isIaEnabled()) {
      return fail('COMING_SOON', IA_COMING_SOON_MESSAGE, 503)
    }
    if (!isIaConfigured()) {
      return internalError('خدمة رفع الملفات غير متاحة حالياً — حاول لاحقاً')
    }

    const contentLength = Number(req.headers.get('content-length'))
    if (Number.isFinite(contentLength) && contentLength > MAX_MULTIPART_BYTES) {
      return fail(
        'PAYLOAD_TOO_LARGE',
        'حجم الطلب كبير على هذا المسار — استخدم رفع الملفات الكبيرة (relay)',
        413,
      )
    }

    let formData: FormData
    try {
      formData = await req.formData()
    } catch {
      return badRequest('صيغة الطلب غير صالحة — أرسل الملف كـ multipart/form-data')
    }

    const file = formData.get('file')
    if (!(file instanceof File)) {
      return badRequest('لم يتم اختيار ملف')
    }
    if (file.size <= 0) {
      return badRequest('الملف فارغ — اختر ملفاً صالحاً')
    }

    const meta = validateUploadMeta(file.type, file.name)
    if (!meta.ok) return badRequest(meta.message)

    const head = Buffer.from(await file.slice(0, UPLOAD_HEAD_BYTES).arrayBuffer())
    if (!validateUploadContent(head, meta.rule)) {
      return badRequest(INVALID_UPLOAD_CONTENT_MESSAGE)
    }

    // PLACEHOLDER — performs no scanning today; see upload-validation.ts TODO.
    await scanUploadForViruses({ head, filename: file.name, mime: meta.mime })

    const rawModId = formData.get('modId')
    const modId = typeof rawModId === 'string' && rawModId.trim() ? rawModId.trim() : undefined
    let modSlug = 'creator-files'
    if (modId) {
      const mod = await db.mod.findFirst({
        where: { id: modId, authorId: user.id },
        select: { id: true, slug: true },
      })
      if (!mod) return badRequest('التعريب غير موجود أو ليس لك')
      modSlug = mod.slug || modSlug
    }

    // Quota gate MUST run before any provider call.
    const check = await checkUploadQuota(user.id, user.role, file.size)
    if (!check.allowed) {
      return forbidden(check.reason || 'تم رفض الرفع — تجاوزت الحصة')
    }

    const uploaded = await streamIaObject({
      userId: user.id,
      username: user.username,
      modSlug,
      filename: file.name || 'file',
      mime: meta.mime,
      title: file.name || 'file',
      bytes: file.size,
      body: file.stream(),
    })

    const storageKey = iaStorageKey(uploaded.identifier, uploaded.key)

    try {
      const [, , created] = await recordUploadUsage({
        userId: user.id,
        modId,
        kind: meta.rule.kind,
        provider: 'ia',
        originalUrl: uploaded.downloadUrl,
        storageKey,
        bytes: file.size,
        mime: meta.mime,
      })
      return ok({ asset: { ...created, bytes: Number(created.bytes) } }, { status: 201 })
    } catch (usageError) {
      // The object already landed: never fail the request (a retry would
      // create a duplicate object). Usage converges on the next upload.
      logger.error('[creator/files POST] usage record failed:', usageError)
      return ok(
        {
          asset: {
            id: null,
            userId: user.id,
            modId: modId ?? null,
            kind: meta.rule.kind,
            provider: 'ia',
            originalUrl: uploaded.downloadUrl,
            wrappedUrl: null,
            storageKey,
            bytes: file.size,
            mime: meta.mime,
            checksum: null,
            createdAt: new Date().toISOString(),
          },
          usageRecorded: false,
        },
        { status: 201 },
      )
    }
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('UPLOAD_')) {
      return validationFail('بيانات الملف غير صالحة')
    }
    logger.error('[creator/files POST] failed:', err)
    reportError(err, { route: 'POST /api/creator/files' })
    return internalError('فشل رفع الملف — حاول مرة أخرى')
  }
}
