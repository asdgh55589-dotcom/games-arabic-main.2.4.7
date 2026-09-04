import Handlebars from 'handlebars/dist/cjs/handlebars.js'
import type { NextRequest } from 'next/server'
import { internalError, ok, okPaginated, validationFail } from '@/lib/api-response'
import { requireManager } from '@/lib/auth'
import { db } from '@/lib/db'
import { CreateTemplateSchema, PaginationSchema } from '@/lib/schemas'

export async function GET(req: NextRequest) {
  try {
    await requireManager()

    const { searchParams } = new URL(req.url)
    const parsed = PaginationSchema.safeParse({
      page: searchParams.get('page'),
      limit: searchParams.get('limit'),
    })
    const { page, limit } = parsed.success ? parsed.data : { page: 1, limit: 50 }

    const type = searchParams.get('type')
    const channel = searchParams.get('channel')

    const where: Record<string, unknown> = {}
    if (type) where.type = type
    if (channel) where.channel = channel

    const [templates, total] = await Promise.all([
      db.notificationTemplate.findMany({
        where,
        orderBy: [{ type: 'asc' }, { channel: 'asc' }, { version: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.notificationTemplate.count({ where }),
    ])

    return okPaginated(templates, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    })
  } catch (err) {
    console.error('[admin/templates GET] failed:', err)
    return internalError('Failed to load templates')
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireManager()
    const body = await req.json()

    const parsed = CreateTemplateSchema.safeParse(body)
    if (!parsed.success) {
      return validationFail(parsed.error.flatten())
    }

    const { type, channel, titleTemplate, bodyTemplate, variables, isActive } = parsed.data

    // Validate Handlebars syntax
    try {
      Handlebars.compile(titleTemplate)
    } catch (e) {
      return validationFail({ titleTemplate: `خطأ في صيغة القالب: ${(e as Error).message}` })
    }
    try {
      Handlebars.compile(bodyTemplate)
    } catch (e) {
      return validationFail({ bodyTemplate: `خطأ في صيغة القالب: ${(e as Error).message}` })
    }

    // Check for existing active template with same type+channel
    const existing = await db.notificationTemplate.findUnique({
      where: { type_channel: { type, channel } },
    })

    if (existing) {
      // Update existing
      const updated = await db.notificationTemplate.update({
        where: { type_channel: { type, channel } },
        data: {
          titleTemplate,
          bodyTemplate,
          variables,
          isActive,
          version: existing.version + 1,
        },
      })
      return ok(updated)
    }

    const template = await db.notificationTemplate.create({
      data: {
        type,
        channel,
        titleTemplate,
        bodyTemplate,
        variables,
        isActive,
        version: 1,
      },
    })

    return ok(template)
  } catch (err) {
    console.error('[admin/templates POST] failed:', err)
    return internalError('Failed to create template')
  }
}
