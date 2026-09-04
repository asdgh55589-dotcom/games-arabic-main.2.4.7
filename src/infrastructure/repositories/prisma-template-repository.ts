/**
 * PrismaTemplateRepository — مستودع القوالب via Prisma
 */

import { PrismaClient } from '@prisma/client'
import type { TemplateStore } from '../adapters/handlebars-template-renderer'

export class PrismaTemplateRepository implements TemplateStore {
  constructor(private readonly db: PrismaClient) {}

  async getTemplate(
    type: string,
    channel: string,
  ): Promise<{
    titleTemplate: string
    bodyTemplate: string
  } | null> {
    const record = await this.db.notificationTemplate.findFirst({
      where: { type, channel, isActive: true },
      orderBy: { version: 'desc' },
    })

    if (!record) return null

    return {
      titleTemplate: record.titleTemplate,
      bodyTemplate: record.bodyTemplate,
    }
  }
}
