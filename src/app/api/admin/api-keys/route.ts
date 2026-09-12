import { randomBytes } from 'crypto'
import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { fail, internalError, ok, validationFail } from '@/lib/api-response'
import { apiKeyPrefix, hashApiKey } from '@/lib/api-key-auth'
import { requireAdmin } from '@/lib/auth'
import { db } from '@/lib/db'

// ===== Validation Schemas =====

const CreateApiKeySchema = z.object({
  name: z.string().min(1, 'اسم المفتاح مطلوب').max(100),
  role: z.enum(['moderator', 'admin', 'manager', 'owner']),
  expiresInDays: z.number().int().min(1).max(3650).optional(), // max 10 years
})

// ===== Helpers =====

/** توليد مفتاح آمن: sk_live_ + 64 random hex chars */
function generateApiKey(): string {
  const prefix = 'sk_live_'
  const randomPart = randomBytes(32).toString('hex') // 64 chars
  return `${prefix}${randomPart}`
}

/** إخفاء المفتاح: sk_live_ + أول 8 أحرف فقط */
function maskKey(prefix: string): string {
  return `sk_live_${prefix || '…'}\u2026`
}

/** البادئة المخزنة — تُعرض في القائمة بدل أي جزء من المفتاح */
function storedPrefix(keyPrefix: string | null): string {
  return maskKey(keyPrefix || '')
}

// ===== GET /api/admin/api-keys — قائمة المفاتيح =====

export async function GET() {
  try {
    const user = await requireAdmin()

    const keys = await db.apiKey.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        role: true,
        keyPrefix: true,
        expiresAt: true,
        lastUsedAt: true,
        isActive: true,
        createdAt: true,
        // لا نُرجع key الحقيقية ولا hash — البادئة فقط
      },
    })

    // نُرجع البادئة المخزنة فقط — لا شيء يقترب من المفتاح الخام
    const maskedKeys = keys.map((k) => ({
      ...k,
      keyPreview: storedPrefix(k.keyPrefix),
    }))

    return ok(maskedKeys)
  } catch (err) {
    const status = (err as { status?: number })?.status || 500
    if (status === 401 || status === 403) {
      return fail(
        err instanceof Error ? err.message : 'Unauthorized',
        err instanceof Error ? err.message : 'Unauthorized',
        status,
      )
    }
    console.error('[admin/api-keys GET] failed:', err)
    return internalError('Failed to fetch API keys')
  }
}

// ===== POST /api/admin/api-keys — إنشاء مفتاح جديد =====

export async function POST(req: NextRequest) {
  try {
    const user = await requireAdmin()
    const body = await req.json()

    // التحقق من المدخلات
    const parsed = CreateApiKeySchema.safeParse(body)
    if (!parsed.success) {
      return validationFail(parsed.error.flatten())
    }

    const { name, role, expiresInDays } = parsed.data

    // التحقق من صلاحية الدور: المستخدم لا يمكنه منح دور أعلى من دوره
    const ROLE_HIERARCHY: Record<string, number> = {
      moderator: 1,
      admin: 2,
      manager: 3,
      owner: 4,
    }
    const userLevel = ROLE_HIERARCHY[user.role] || 0
    const requestedLevel = ROLE_HIERARCHY[role] || 0

    if (requestedLevel > userLevel) {
      return fail('FORBIDDEN', `لا يمكنك منح دور أعلى من دورك (${user.role})`, 403)
    }

    // حساب تاريخ الانتهاء
    const expiresAt = expiresInDays
      ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
      : null

    // توليد المفتاح — يُعرض خاماً مرة واحدة فقط أدناه، ولا يُخزَّن أبداً
    const rawKey = generateApiKey()

    // حفظ الـ hash + البادئة فقط (audit D.2 — الخام لا يصل إلى DB)
    const apiKey = await db.apiKey.create({
      data: {
        key: null,
        keyHash: hashApiKey(rawKey),
        keyPrefix: apiKeyPrefix(rawKey),
        name,
        userId: user.id,
        role,
        expiresAt,
      },
      select: {
        id: true,
        name: true,
        role: true,
        expiresAt: true,
        createdAt: true,
      },
    })

    // إرجاع المفتاح الكامل مرة واحدة فقط
    return ok({
      ...apiKey,
      key: rawKey, // يُعرض مرة واحدة فقط — لن يُعرض مرة ثانية
      warning: 'احفظ هذا المفتاح في مكان آمن. لن يُعرض مرة ثانية.',
    })
  } catch (err) {
    const status = (err as { status?: number })?.status || 500
    if (status === 401 || status === 403) {
      return fail(
        err instanceof Error ? err.message : 'Unauthorized',
        err instanceof Error ? err.message : 'Unauthorized',
        status,
      )
    }
    console.error('[admin/api-keys POST] failed:', err)
    return internalError('Failed to create API key')
  }
}
