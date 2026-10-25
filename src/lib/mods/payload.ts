export function buildModPayload(data: Record<string, any>) {
  const payload: any = { ...data }

  if (payload.releaseDate === '') payload.releaseDate = null
  if (typeof payload.releaseDate === 'string') {
    const d = new Date(payload.releaseDate)
    payload.releaseDate = Number.isNaN(d.getTime()) ? null : d.toISOString()
  }

  if (payload.scheduledAt === '') payload.scheduledAt = null
  if (typeof payload.scheduledAt === 'string') {
    const d = new Date(payload.scheduledAt)
    payload.scheduledAt = Number.isNaN(d.getTime()) ? null : d.toISOString()
  }

  const nullableFields = [
    'categoryId',
    'seriesId',
    'teamId',
    'sectionId',
    'trailerUrl',
    'supportUrl',
    'extrasLabel',
  ]
  for (const field of nullableFields) {
    if (payload[field] === '') payload[field] = null
  }

  return payload
}
