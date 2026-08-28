/**
 * Tests for UpdatePreferencesSchema validation
 */
import { UpdatePreferencesSchema } from '@/lib/schemas'

describe('UpdatePreferencesSchema', () => {
  it('should accept empty object (all fields optional)', () => {
    const result = UpdatePreferencesSchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it('should accept valid boolean fields', () => {
    const result = UpdatePreferencesSchema.safeParse({
      emailEnabled: false,
      pushEnabled: true,
      dailySummary: false,
    })
    expect(result.success).toBe(true)
  })

  it('should accept valid summaryIntervalDays', () => {
    expect(UpdatePreferencesSchema.safeParse({ summaryIntervalDays: 1 }).success).toBe(true)
    expect(UpdatePreferencesSchema.safeParse({ summaryIntervalDays: 30 }).success).toBe(true)
    expect(UpdatePreferencesSchema.safeParse({ summaryIntervalDays: 15 }).success).toBe(true)
  })

  it('should reject summaryIntervalDays below 1', () => {
    const result = UpdatePreferencesSchema.safeParse({ summaryIntervalDays: 0 })
    expect(result.success).toBe(false)
  })

  it('should reject summaryIntervalDays above 30', () => {
    const result = UpdatePreferencesSchema.safeParse({ summaryIntervalDays: 31 })
    expect(result.success).toBe(false)
  })

  it('should accept valid likeThreshold', () => {
    expect(UpdatePreferencesSchema.safeParse({ likeThreshold: 5 }).success).toBe(true)
    expect(UpdatePreferencesSchema.safeParse({ likeThreshold: 100 }).success).toBe(true)
    expect(UpdatePreferencesSchema.safeParse({ likeThreshold: 50 }).success).toBe(true)
  })

  it('should reject likeThreshold below 5', () => {
    const result = UpdatePreferencesSchema.safeParse({ likeThreshold: 4 })
    expect(result.success).toBe(false)
  })

  it('should reject likeThreshold above 100', () => {
    const result = UpdatePreferencesSchema.safeParse({ likeThreshold: 101 })
    expect(result.success).toBe(false)
  })

  it('should accept valid quiet hours with both start and end', () => {
    const result = UpdatePreferencesSchema.safeParse({
      quietHoursEnabled: true,
      quietHoursStart: '22:00',
      quietHoursEnd: '07:00',
    })
    expect(result.success).toBe(true)
  })

  it('should reject quietHoursStart with invalid time format', () => {
    const result = UpdatePreferencesSchema.safeParse({
      quietHoursEnabled: true,
      quietHoursStart: 'invalid',
      quietHoursEnd: '07:00',
    })
    expect(result.success).toBe(false)
  })

  it('should reject quietHoursEnd with invalid time format', () => {
    const result = UpdatePreferencesSchema.safeParse({
      quietHoursEnabled: true,
      quietHoursStart: '22:00',
      quietHoursEnd: '25:00',
    })
    expect(result.success).toBe(false)
  })

  it('should require both start and end when quietHours enabled', () => {
    const result = UpdatePreferencesSchema.safeParse({
      quietHoursEnabled: true,
      quietHoursStart: '22:00',
    })
    expect(result.success).toBe(false)
  })

  it('should accept quietHours disabled without start/end', () => {
    const result = UpdatePreferencesSchema.safeParse({
      quietHoursEnabled: false,
    })
    expect(result.success).toBe(true)
  })

  it('should accept nullable quietHours values', () => {
    const result = UpdatePreferencesSchema.safeParse({
      quietHoursStart: null,
      quietHoursEnd: null,
    })
    expect(result.success).toBe(true)
  })

  it('should accept valid typePreferences', () => {
    const result = UpdatePreferencesSchema.safeParse({
      typePreferences: {
        comment_reply: { enabled: true, emailEnabled: false, pushEnabled: true },
        like: { enabled: false },
      },
    })
    expect(result.success).toBe(true)
  })

  it('should reject invalid typePreferences structure', () => {
    const result = UpdatePreferencesSchema.safeParse({
      typePreferences: {
        comment_reply: { enabled: 'not-a-boolean' },
      },
    })
    expect(result.success).toBe(false)
  })

  it('should accept all valid time formats', () => {
    const times = ['00:00', '09:30', '12:00', '23:59', '01:05', '20:30']
    for (const t of times) {
      const result = UpdatePreferencesSchema.safeParse({
        quietHoursEnabled: true,
        quietHoursStart: t,
        quietHoursEnd: '07:00',
      })
      expect(result.success).toBe(true)
    }
  })
})
