import { DeliveryStatus, NotificationChannel, NotificationJob } from '@/domain'
import { PrismaJobQueue } from '../repositories/prisma-job-queue'

function makeMockDb() {
  const store = new Map<string, any>()
  return {
    notificationJob: {
      upsert: jest.fn(async ({ where, create, update }: any) => {
        const existing = store.get(where.id)
        if (existing) {
          const updated = { ...existing, ...update, updatedAt: new Date() }
          store.set(where.id, updated)
          return updated
        }
        const created = {
          ...create,
          createdAt: new Date(),
          updatedAt: new Date(),
        }
        store.set(where.id, created)
        return created
      }),
      findFirst: jest.fn(async ({ where }: any) => {
        for (const record of store.values()) {
          if (record.status === where.status && where.scheduledFor?.lte) {
            return record
          }
        }
        return null
      }),
      updateMany: jest.fn(async ({ where, data }: any) => {
        let count = 0
        for (const [id, record] of store.entries()) {
          if (record.id === where.id && record.status === where.status) {
            store.set(id, { ...record, ...data, updatedAt: new Date() })
            count++
          }
        }
        return { count }
      }),
      update: jest.fn(async ({ where, data }: any) => {
        const existing = store.get(where.id)
        if (!existing) throw new Error('Not found')
        const updated = { ...existing, ...data, updatedAt: new Date() }
        store.set(where.id, updated)
        return updated
      }),
      findMany: jest.fn(async ({ where }: any) => {
        const results: any[] = []
        for (const record of store.values()) {
          if (where?.status ? record.status === where.status : true) {
            results.push(record)
          }
        }
        return results
      }),
    },
    _store: store,
  }
}

describe('PrismaJobQueue', () => {
  describe('enqueue', () => {
    it('should upsert a job into the store', async () => {
      const db = makeMockDb() as any
      const queue = new PrismaJobQueue(db)
      const job = NotificationJob.create('notif-1', NotificationChannel.Email)

      await queue.enqueue(job)

      expect(db.notificationJob.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            notificationId: 'notif-1',
            channel: 'email',
          }),
        }),
      )
    })
  })

  describe('dequeue', () => {
    it('should return null when no pending jobs', async () => {
      const db = makeMockDb() as any
      const queue = new PrismaJobQueue(db)

      const result = await queue.dequeue()
      expect(result).toBeNull()
    })

    it('should atomically claim a pending job', async () => {
      const db = makeMockDb()
      const job = NotificationJob.create('notif-1', NotificationChannel.InApp)
      db._store.set(job.id, {
        id: job.id,
        notificationId: 'notif-1',
        channel: 'in_app',
        status: 'pending',
        attempts: 0,
        maxAttempts: 5,
        lastError: null,
        scheduledFor: new Date(),
        processedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const queue = new PrismaJobQueue(db as any)
      const result = await queue.dequeue()

      expect(result).not.toBeNull()
      expect(result!.id).toBe(job.id)
      expect(result!.status).toBe(DeliveryStatus.Processing)
      expect(db.notificationJob.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: job.id, status: 'pending' },
          data: { status: 'processing' },
        }),
      )
    })

    it('should return null if another worker claimed the job', async () => {
      const db = makeMockDb()
      db._store.set('job-1', {
        id: 'job-1',
        notificationId: 'notif-1',
        channel: 'email',
        status: 'pending',
        attempts: 0,
        maxAttempts: 5,
        lastError: null,
        scheduledFor: new Date(),
        processedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      // updateMany returns count 0 (another worker got it)
      db.notificationJob.updateMany.mockResolvedValue({ count: 0 })

      const queue = new PrismaJobQueue(db as any)
      const result = await queue.dequeue()

      expect(result).toBeNull()
    })
  })

  describe('markAsProcessed', () => {
    it('should set status to sent and processedAt', async () => {
      const db = makeMockDb()
      db._store.set('job-1', {
        id: 'job-1',
        notificationId: 'notif-1',
        channel: 'email',
        status: 'processing',
        attempts: 1,
        maxAttempts: 5,
        lastError: null,
        scheduledFor: new Date(),
        processedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      const queue = new PrismaJobQueue(db as any)

      await queue.markAsProcessed('job-1')

      expect(db.notificationJob.update).toHaveBeenCalledWith({
        where: { id: 'job-1' },
        data: { status: 'sent', processedAt: expect.any(Date) },
      })
    })
  })

  describe('moveToDeadLetter', () => {
    it('should set status to dead_letter with error', async () => {
      const db = makeMockDb()
      db._store.set('job-1', {
        id: 'job-1',
        notificationId: 'notif-1',
        channel: 'email',
        status: 'failed',
        attempts: 5,
        maxAttempts: 5,
        lastError: null,
        scheduledFor: new Date(),
        processedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      const queue = new PrismaJobQueue(db as any)

      await queue.moveToDeadLetter('job-1', 'SMTP timeout')

      expect(db.notificationJob.update).toHaveBeenCalledWith({
        where: { id: 'job-1' },
        data: { status: 'dead_letter', lastError: 'SMTP timeout' },
      })
    })
  })

  describe('getDeadLetterJobs', () => {
    it('should return dead letter jobs reconstructed as domain entities', async () => {
      const db = makeMockDb()
      db._store.set('job-dl', {
        id: 'job-dl',
        notificationId: 'notif-5',
        channel: 'email',
        status: 'dead_letter',
        attempts: 5,
        maxAttempts: 5,
        lastError: 'Permanent failure',
        scheduledFor: new Date(),
        processedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const queue = new PrismaJobQueue(db as any)
      const jobs = await queue.getDeadLetterJobs()

      expect(jobs).toHaveLength(1)
      expect(jobs[0].id).toBe('job-dl')
      expect(jobs[0].status).toBe(DeliveryStatus.DeadLetter)
      expect(jobs[0].lastError).toBe('Permanent failure')
    })
  })
})
