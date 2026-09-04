/**
 * Notification DI Container — حاوية حقن التبعيات للإشعارات
 * Singleton factory for NotificationService and related dependencies.
 */

import { PrismaClient } from '@prisma/client'
import { InMemoryEventBus } from '@/application/event-bus/in-memory-event-bus'
import { NotificationQueryService } from '@/application/services/notification-query-service'
import { NotificationService } from '@/application/services/notification-service'
import { DeduplicationPolicy } from '@/domain/policies/deduplication-policy'
import { ExponentialBackoffDeliveryPolicy } from '@/domain/policies/delivery-policy'
import { PreferencePolicy } from '@/domain/policies/preference-policy'
import { HandlebarsTemplateRenderer } from '@/infrastructure/adapters/handlebars-template-renderer'
import { PrismaJobQueue } from '@/infrastructure/repositories/prisma-job-queue'
import { PrismaNotificationRepository } from '@/infrastructure/repositories/prisma-notification-repository'
import { PrismaPreferenceRepository } from '@/infrastructure/repositories/prisma-preference-repository'
import { PrismaTemplateRepository } from '@/infrastructure/repositories/prisma-template-repository'

const db = new PrismaClient()

let notificationService: NotificationService | null = null
let queryService: NotificationQueryService | null = null

export function getNotificationService(): NotificationService {
  if (!notificationService) {
    const notificationRepo = new PrismaNotificationRepository(db)
    const preferenceRepo = new PrismaPreferenceRepository(db)
    const templateRepo = new PrismaTemplateRepository(db)
    const templateRenderer = new HandlebarsTemplateRenderer(templateRepo)
    const eventBus = new InMemoryEventBus()
    const jobQueue = new PrismaJobQueue(db)
    const deduplicationPolicy = new DeduplicationPolicy(notificationRepo)
    const preferencePolicy = new PreferencePolicy(preferenceRepo)
    const deliveryPolicy = new ExponentialBackoffDeliveryPolicy()

    notificationService = new NotificationService({
      notificationRepo,
      preferenceRepo,
      templateRenderer,
      eventPublisher: eventBus,
      jobQueue,
      deduplicationPolicy,
      preferencePolicy,
      deliveryPolicy,
    })
  }
  return notificationService
}

export function getNotificationQueryService(): NotificationQueryService {
  if (!queryService) {
    queryService = new NotificationQueryService(new PrismaNotificationRepository(db))
  }
  return queryService
}
