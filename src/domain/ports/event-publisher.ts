/**
 * EventPublisher — منفذ نشر الأحداث
 * Interface only — implementation provided by infrastructure layer.
 */

import { DomainEvent } from '../events'

export type EventHandler = (event: DomainEvent) => Promise<void>

export interface EventPublisher {
  /** Publish a domain event */
  publish(event: DomainEvent): Promise<void>

  /** Subscribe to an event type */
  subscribe(eventType: string, handler: EventHandler): void

  /** Unsubscribe from an event type */
  unsubscribe(eventType: string, handler: EventHandler): void
}
