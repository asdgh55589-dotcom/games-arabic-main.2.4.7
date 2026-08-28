/**
 * DomainEvent — base interface for all domain events
 */

export interface DomainEvent {
  readonly eventType: string
  readonly occurredAt: Date
}
