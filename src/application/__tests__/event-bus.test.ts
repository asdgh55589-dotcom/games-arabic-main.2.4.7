import type { DomainEvent } from '@/domain'
import { InMemoryEventBus } from '../event-bus/in-memory-event-bus'

describe('InMemoryEventBus', () => {
  let bus: InMemoryEventBus

  beforeEach(() => {
    bus = new InMemoryEventBus()
  })

  it('should publish events to subscribers', async () => {
    const handler = jest.fn()
    bus.subscribe('test.event', handler)

    const event: DomainEvent = {
      eventType: 'test.event',
      occurredAt: new Date(),
    }

    await bus.publish(event)

    expect(handler).toHaveBeenCalledWith(event)
  })

  it('should not call handlers for other event types', async () => {
    const handler = jest.fn()
    bus.subscribe('other.event', handler)

    const event: DomainEvent = {
      eventType: 'test.event',
      occurredAt: new Date(),
    }

    await bus.publish(event)

    expect(handler).not.toHaveBeenCalled()
  })

  it('should handle multiple handlers for same event', async () => {
    const handler1 = jest.fn()
    const handler2 = jest.fn()
    bus.subscribe('test.event', handler1)
    bus.subscribe('test.event', handler2)

    const event: DomainEvent = {
      eventType: 'test.event',
      occurredAt: new Date(),
    }

    await bus.publish(event)

    expect(handler1).toHaveBeenCalled()
    expect(handler2).toHaveBeenCalled()
  })

  it('should unsubscribe handlers', async () => {
    const handler = jest.fn()
    bus.subscribe('test.event', handler)
    bus.unsubscribe('test.event', handler)

    const event: DomainEvent = {
      eventType: 'test.event',
      occurredAt: new Date(),
    }

    await bus.publish(event)

    expect(handler).not.toHaveBeenCalled()
  })

  it('should not crash if handler throws', async () => {
    const failingHandler = jest.fn().mockRejectedValue(new Error('Handler error'))
    const successHandler = jest.fn()
    bus.subscribe('test.event', failingHandler)
    bus.subscribe('test.event', successHandler)

    const event: DomainEvent = {
      eventType: 'test.event',
      occurredAt: new Date(),
    }

    await bus.publish(event)

    expect(failingHandler).toHaveBeenCalled()
    expect(successHandler).toHaveBeenCalled()
  })
})
