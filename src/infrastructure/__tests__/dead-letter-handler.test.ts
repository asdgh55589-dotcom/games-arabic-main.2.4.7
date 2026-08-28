import { DeadLetterHandler } from '../resilience/dead-letter-handler'
import { NotificationJob, NotificationChannel } from '@/domain'

describe('DeadLetterHandler', () => {
  let handler: DeadLetterHandler

  beforeEach(() => {
    handler = new DeadLetterHandler()
  })

  it('should add a job to dead letter queue', () => {
    const job = NotificationJob.create('notif-1', NotificationChannel.Email)
    handler.add(job, 'Failed to send')

    expect(handler.getCount()).toBe(1)
  })

  it('should return all dead letter entries', () => {
    const job1 = NotificationJob.create('notif-1', NotificationChannel.Email)
    const job2 = NotificationJob.create('notif-2', NotificationChannel.InApp)

    handler.add(job1, 'Error 1')
    handler.add(job2, 'Error 2')

    const entries = handler.getAll()
    expect(entries).toHaveLength(2)
    expect(entries[0].job.notificationId).toBe('notif-1')
    expect(entries[1].job.notificationId).toBe('notif-2')
  })

  it('should include error message and timestamp', () => {
    const job = NotificationJob.create('notif-1', NotificationChannel.Email)
    handler.add(job, 'Test error')

    const entry = handler.getAll()[0]
    expect(entry.error).toBe('Test error')
    expect(entry.failedAt).toBeInstanceOf(Date)
    expect(entry.originalChannel).toBe(NotificationChannel.Email)
  })

  it('should retry and remove from dead letter', () => {
    const job = NotificationJob.create('notif-1', NotificationChannel.Email)
    handler.add(job, 'Error')

    const entry = handler.retry(job.id)
    expect(entry).not.toBeNull()
    expect(entry?.job.id).toBe(job.id)
    expect(handler.getCount()).toBe(0)
  })

  it('should return null when retrying non-existent job', () => {
    const entry = handler.retry('non-existent')
    expect(entry).toBeNull()
  })

  it('should clear all entries', () => {
    handler.add(NotificationJob.create('notif-1', NotificationChannel.Email), 'Error 1')
    handler.add(NotificationJob.create('notif-2', NotificationChannel.InApp), 'Error 2')

    handler.clear()
    expect(handler.getCount()).toBe(0)
  })
})
