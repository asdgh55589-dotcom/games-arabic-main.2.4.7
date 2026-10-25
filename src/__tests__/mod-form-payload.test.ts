import { buildModPayload } from '@/lib/mods/payload'

describe('buildModPayload', () => {
  it('converts date-only releaseDate to ISO-8601', () => {
    const out = buildModPayload({ releaseDate: '2026-10-25' })
    expect(out.releaseDate).toBe('2026-10-25T00:00:00.000Z')
  })

  it('leaves already-ISO releaseDate unchanged', () => {
    const out = buildModPayload({ releaseDate: '2026-10-25T12:30:00Z' })
    expect(out.releaseDate).toBe('2026-10-25T12:30:00.000Z')
  })

  it('keeps null releaseDate as null', () => {
    const out = buildModPayload({ releaseDate: null })
    expect(out.releaseDate).toBeNull()
  })

  it('converts empty releaseDate to null', () => {
    const out = buildModPayload({ releaseDate: '' })
    expect(out.releaseDate).toBeNull()
  })

  it('converts invalid date string to null', () => {
    const out = buildModPayload({ releaseDate: 'not-a-date' })
    expect(out.releaseDate).toBeNull()
  })

  it('converts scheduledAt date-only to ISO-8601', () => {
    const out = buildModPayload({ scheduledAt: '2026-11-01' })
    expect(out.scheduledAt).toBe('2026-11-01T00:00:00.000Z')
  })

  it('keeps scheduledAt null as null', () => {
    const out = buildModPayload({ scheduledAt: null })
    expect(out.scheduledAt).toBeNull()
  })

  it('converts empty strings to null for nullable fields', () => {
    const out = buildModPayload({
      categoryId: '',
      seriesId: '',
      teamId: '',
      sectionId: '',
      trailerUrl: '',
      supportUrl: '',
      extrasLabel: '',
    })
    expect(out.categoryId).toBeNull()
    expect(out.seriesId).toBeNull()
    expect(out.teamId).toBeNull()
    expect(out.sectionId).toBeNull()
    expect(out.trailerUrl).toBeNull()
    expect(out.supportUrl).toBeNull()
    expect(out.extrasLabel).toBeNull()
  })

  it('preserves non-empty strings', () => {
    const out = buildModPayload({
      categoryId: 'cat-1',
      trailerUrl: 'https://example.com/t',
    })
    expect(out.categoryId).toBe('cat-1')
    expect(out.trailerUrl).toBe('https://example.com/t')
  })

  it('does not mutate input', () => {
    const input = { releaseDate: '2026-10-25' }
    buildModPayload(input)
    expect(input.releaseDate).toBe('2026-10-25')
  })
})
