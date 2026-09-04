/**
 * InMemoryEventBus — ناقل الأحداث في الذاكرة
 * In-process event bus for domain events.
 */

import type { DomainEvent, EventHandler, EventPublisher } from '@/domain'
import { notificationLogger } from '@/infrastructure/observability/logger'

export class InMemoryEventBus implements EventPublisher {
  private handlers = new Map<string, Set<EventHandler>>()

  async publish(event: DomainEvent): Promise<void> {
    const eventHandlers = this.handlers.get(event.eventType)
    if (!eventHandlers) return

    for (const handler of eventHandlers) {
      try {
        await handler(event)
      } catch (error) {
        notificationLogger.error('Event handler failed', {
          action: 'event.handler_error',
          eventType: event.eventType,
          error: error instanceof Error ? error.message : 'Unknown',
        })
      }
    }
  }

  subscribe(eventType: string, handler: EventHandler): void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set())
    }
    this.handlers.get(eventType)!.add(handler)
  }

  unsubscribe(eventType: string, handler: EventHandler): void {
    this.handlers.get(eventType)?.delete(handler)
  }
}
