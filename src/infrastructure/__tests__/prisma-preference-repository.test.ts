import { NotificationPreference } from '@/domain'
import { PrismaPreferenceRepository } from '../repositories/prisma-preference-repository'

function makeMockDb() {
  const store = new Map<string, any>()
  return {
    notificationPreference: {
      findUnique: jest.fn(async ({ where }: any) => store.get(where.userId) ?? null),
      upsert: jest.fn(async ({ where, create, update }: any) => {
        const existing = store.get(where.userId)
        if (existing) {
          const updated = { ...existing, ...update, updatedAt: new Date() }
          store.set(where.userId, updated)
          return updated
        }
        const created = {
          id: `pref-${Date.now()}`,
          createdAt: new Date(),
          updatedAt: new Date(),
          ...create,
        }
        store.set(where.userId, created)
        return created
      }),
    },
    _store: store,
  }
}

describe('PrismaPreferenceRepository', () => {
  describe('findByUserId', () => {
    it('should return null when no record exists', async () => {
      const db = makeMockDb() as any
      const repo = new PrismaPreferenceRepository(db)
      const result = await repo.findByUserId('user-1')
      expect(result).toBeNull()
    })

    it('should reconstruct preference with quietHours fields from DB', async () => {
      const db = makeMockDb()
      db._store.set('user-1', {
        id: 'pref-1',
        userId: 'user-1',
        emailEnabled: true,
        pushEnabled: false,
        dailySummary: true,
        summaryIntervalDays: 5,
        likeThreshold: 10,
        quietHoursEnabled: true,
        quietHoursStart: '23:00',
        quietHoursEnd: '07:00',
        typePreferences: { like: { enabled: false } },
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-06-01'),
      })

      const repo = new PrismaPreferenceRepository(db as any)
      const result = await repo.findByUserId('user-1')

      expect(result).not.toBeNull()
      expect(result!.quietHoursEnabled).toBe(true)
      expect(result!.quietHoursStart).toBe('23:00')
      expect(result!.quietHoursEnd).toBe('07:00')
      expect(result!.typePreferences).toEqual({ like: { enabled: false } })
      expect(result!.emailEnabled).toBe(true)
      expect(result!.pushEnabled).toBe(false)
    })

    it('should handle null typePreferences in DB', async () => {
      const db = makeMockDb()
      db._store.set('user-1', {
        id: 'pref-1',
        userId: 'user-1',
        emailEnabled: true,
        pushEnabled: true,
        dailySummary: true,
        summaryIntervalDays: 3,
        likeThreshold: 25,
        quietHoursEnabled: false,
        quietHoursStart: null,
        quietHoursEnd: null,
        typePreferences: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const repo = new PrismaPreferenceRepository(db as any)
      const result = await repo.findByUserId('user-1')

      expect(result).not.toBeNull()
      expect(result!.typePreferences).toEqual({})
    })

    it('should handle string typePreferences in DB (JSON string)', async () => {
      const db = makeMockDb()
      db._store.set('user-1', {
        id: 'pref-1',
        userId: 'user-1',
        emailEnabled: true,
        pushEnabled: true,
        dailySummary: true,
        summaryIntervalDays: 3,
        likeThreshold: 25,
        quietHoursEnabled: false,
        quietHoursStart: null,
        quietHoursEnd: null,
        typePreferences: JSON.stringify({ like: { enabled: false } }),
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const repo = new PrismaPreferenceRepository(db as any)
      const result = await repo.findByUserId('user-1')

      expect(result).not.toBeNull()
      expect(result!.typePreferences).toEqual({ like: { enabled: false } })
    })

    it('should handle invalid JSON string typePreferences gracefully', async () => {
      const db = makeMockDb()
      db._store.set('user-1', {
        id: 'pref-1',
        userId: 'user-1',
        emailEnabled: true,
        pushEnabled: true,
        dailySummary: true,
        summaryIntervalDays: 3,
        likeThreshold: 25,
        quietHoursEnabled: false,
        quietHoursStart: null,
        quietHoursEnd: null,
        typePreferences: 'not-valid-json{{{',
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const repo = new PrismaPreferenceRepository(db as any)
      const result = await repo.findByUserId('user-1')

      expect(result).not.toBeNull()
      expect(result!.typePreferences).toEqual({})
    })

    it('should handle array typePreferences in DB gracefully', async () => {
      const db = makeMockDb()
      db._store.set('user-1', {
        id: 'pref-1',
        userId: 'user-1',
        emailEnabled: true,
        pushEnabled: true,
        dailySummary: true,
        summaryIntervalDays: 3,
        likeThreshold: 25,
        quietHoursEnabled: false,
        quietHoursStart: null,
        quietHoursEnd: null,
        typePreferences: ['invalid', 'array'],
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const repo = new PrismaPreferenceRepository(db as any)
      const result = await repo.findByUserId('user-1')

      expect(result).not.toBeNull()
      expect(result!.typePreferences).toEqual({})
    })
  })

  describe('upsert', () => {
    it('should create new preference with quietHours and typePreferences', async () => {
      const db = makeMockDb() as any
      const repo = new PrismaPreferenceRepository(db)

      const pref = NotificationPreference.createDefault('user-new')
      const updated = pref.updatePreference({
        quietHoursEnabled: true,
        quietHoursStart: '22:00',
        quietHoursEnd: '06:00',
        typePreferences: { follow: { enabled: false } },
      })

      const result = await repo.upsert(updated)

      expect(result.quietHoursEnabled).toBe(true)
      expect(result.quietHoursStart).toBe('22:00')
      expect(result.quietHoursEnd).toBe('06:00')
      expect(result.typePreferences).toEqual({ follow: { enabled: false } })

      // Verify Prisma was called with the new fields
      expect(db.notificationPreference.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            quietHoursEnabled: true,
            quietHoursStart: '22:00',
            quietHoursEnd: '06:00',
          }),
          update: expect.objectContaining({
            quietHoursEnabled: true,
            quietHoursStart: '22:00',
            quietHoursEnd: '06:00',
          }),
        }),
      )
    })

    it('should round-trip typePreferences through JSON', async () => {
      const db = makeMockDb() as any
      const repo = new PrismaPreferenceRepository(db)

      const pref = NotificationPreference.createDefault('user-1')
      const typePrefs = {
        comment_reply: { enabled: true, emailEnabled: false },
        like: { enabled: false },
      }
      const updated = pref.updatePreference({ typePreferences: typePrefs })

      const result = await repo.upsert(updated)
      expect(result.typePreferences).toEqual(typePrefs)

      // Read it back
      const found = await repo.findByUserId('user-1')
      expect(found!.typePreferences).toEqual(typePrefs)
    })
  })
})
