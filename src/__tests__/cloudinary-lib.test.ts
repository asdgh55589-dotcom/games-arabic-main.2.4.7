/**
 * Phase 4 Task B (SA-2) — Cloudinary lib tests. SDK/DB fully mocked: no
 * network, no real uploads. Covers: retry-once on 5xx, no-retry on 4xx,
 * circuit-breaker open/half-open, the 6-class Arabic error table, delete
 * 404→ok idempotency, missing-config Arabic + no SDK call, key/buffer
 * hygiene in logs+reports, quota helper (creator engine vs 50MB member
 * cap), and the getCloudinaryUsage unavailable sentinel.
 */

const mockConfig = jest.fn()
const mockUploadStream = jest.fn()
const mockDestroy = jest.fn()
const mockUsage = jest.fn()

jest.mock('cloudinary', () => ({
  v2: {
    config: (...a: any[]) => mockConfig(...a),
    uploader: {
      upload_stream: (...a: any[]) => mockUploadStream(...a),
      destroy: (...a: any[]) => mockDestroy(...a),
    },
    api: {
      usage: (...a: any[]) => mockUsage(...a),
    },
  },
}))

const mockUserFind = jest.fn()
const mockOverrideFind = jest.fn()
const mockPolicyFind = jest.fn()
const mockDailyFind = jest.fn()
const mockStorageFind = jest.fn()

jest.mock('@/lib/db', () => ({
  db: {
    user: { findUnique: (...a: any[]) => mockUserFind(...a) },
    quotaOverride: { findUnique: (...a: any[]) => mockOverrideFind(...a) },
    quotaPolicy: { findUnique: (...a: any[]) => mockPolicyFind(...a) },
    uploadUsageDaily: { findUnique: (...a: any[]) => mockDailyFind(...a) },
    creatorStorage: { findUnique: (...a: any[]) => mockStorageFind(...a) },
  },
}))

const mockLogInfo = jest.fn()
const mockLogWarn = jest.fn()
const mockLogError = jest.fn()

jest.mock('@/lib/logger', () => ({
  logger: {
    info: (...a: any[]) => mockLogInfo(...a),
    warn: (...a: any[]) => mockLogWarn(...a),
    error: (...a: any[]) => mockLogError(...a),
  },
}))

const mockReportError = jest.fn((..._args: any[]) => 'skipped')

jest.mock('@/lib/error-reporting', () => ({
  reportError: (...a: any[]) => mockReportError(...a),
}))

import {
  AVATAR_NON_CREATOR_LIFETIME_BYTES,
  checkAvatarQuota,
  deleteFromCloudinary,
  getCloudinaryUsage,
  isCloudinaryConfigured,
  isCloudinaryEnabled,
  resetCloudinaryCircuitBreaker,
  uploadToCloudinary,
  verifyCloudinaryConfig,
} from '@/lib/cloudinary'

const CLOUD = 'test-cloud'
const KEY = '123456789012345'
const SECRET = 'supersecret-xyz-999'
const MASKED_KEY = '1234…45'
const GB = 1024 ** 3
const MB = 1024 ** 2
const FREE_LIMIT = 25 * GB

const OK_RESULT = {
  secure_url: `https://res.cloudinary.com/${CLOUD}/image/upload/v1/avatars/u1.jpg`,
  url: `http://res.cloudinary.com/${CLOUD}/image/upload/v1/avatars/u1.jpg`,
  public_id: 'avatars/u1',
}

/** Make the next upload_stream call answer (err, result) on a microtask. */
function uploadResponds(err: unknown, result: unknown = null) {
  mockUploadStream.mockImplementationOnce(
    (_opts: unknown, cb: (e: unknown, r: unknown) => void) => {
      queueMicrotask(() => cb(err, result))
      return { end: jest.fn() }
    },
  )
}

function setValidEnv() {
  process.env.CLOUDINARY_CLOUD_NAME = CLOUD
  process.env.CLOUDINARY_API_KEY = KEY
  process.env.CLOUDINARY_API_SECRET = SECRET
}

function clearCloudEnv() {
  delete process.env.CLOUDINARY_CLOUD_NAME
  delete process.env.CLOUDINARY_API_KEY
  delete process.env.CLOUDINARY_API_SECRET
}

beforeEach(() => {
  mockConfig.mockReset()
  mockUploadStream.mockReset()
  mockDestroy.mockReset()
  mockUsage.mockReset()
  mockUserFind.mockReset().mockResolvedValue(null)
  mockOverrideFind.mockReset().mockResolvedValue(null)
  mockPolicyFind.mockReset().mockResolvedValue(null)
  mockDailyFind.mockReset().mockResolvedValue(null)
  mockStorageFind.mockReset().mockResolvedValue(null)
  mockLogInfo.mockReset()
  mockLogWarn.mockReset()
  mockLogError.mockReset()
  mockReportError.mockClear()
  resetCloudinaryCircuitBreaker()
  setValidEnv()
  delete process.env.CLOUDINARY_ENABLED
})

describe('verifyCloudinaryConfig / isCloudinaryEnabled', () => {
  it('throws an Arabic error when credentials are unset', () => {
    clearCloudEnv()
    expect(() => verifyCloudinaryConfig()).toThrow(/غير مُكوَّن/)
  })

  it('upload rejects in Arabic with no SDK call when unconfigured', async () => {
    clearCloudEnv()
    await expect(
      uploadToCloudinary(Buffer.from('img'), { folder: 'avatars' }),
    ).rejects.toThrow(/غير مُكوَّن/)
    expect(mockConfig).not.toHaveBeenCalled()
    expect(mockUploadStream).not.toHaveBeenCalled()
  })

  it('isCloudinaryConfigured reflects the triple vars', () => {
    expect(isCloudinaryConfigured()).toBe(true)
    clearCloudEnv()
    expect(isCloudinaryConfigured()).toBe(false)
  })

  it('isCloudinaryEnabled is fail-closed (default false)', () => {
    expect(isCloudinaryEnabled()).toBe(false) // flag unset
    process.env.CLOUDINARY_ENABLED = 'false'
    expect(isCloudinaryEnabled()).toBe(false)
    process.env.CLOUDINARY_ENABLED = 'true'
    expect(isCloudinaryEnabled()).toBe(true)
    clearCloudEnv() // flag on but unconfigured
    expect(isCloudinaryEnabled()).toBe(false)
  })
})

describe('upload retry policy', () => {
  it('retries ONCE on 5xx then resolves (2 SDK calls)', async () => {
    uploadResponds({ http_code: 500, message: 'Internal Server Error' })
    uploadResponds(null, OK_RESULT)
    const res = await uploadToCloudinary(Buffer.from('img'), {
      folder: 'avatars',
      publicId: 'u1',
    })
    expect(res).toEqual({
      url: OK_RESULT.secure_url,
      publicId: OK_RESULT.public_id,
    })
    expect(mockUploadStream).toHaveBeenCalledTimes(2)
  })

  it('never retries 4xx (1 SDK call)', async () => {
    uploadResponds({ http_code: 400, message: 'Bad Request' })
    await expect(
      uploadToCloudinary(Buffer.from('img'), { folder: 'avatars' }),
    ).rejects.toThrow()
    expect(mockUploadStream).toHaveBeenCalledTimes(1)
  })

  it('passes folder + transformation string + invalidate + 30s timeout', async () => {
    uploadResponds(null, OK_RESULT)
    await uploadToCloudinary(Buffer.from('img'), {
      folder: 'avatars',
      transform: 'w_512,h_512,c_fill',
      publicId: 'u1',
    })
    expect(mockUploadStream).toHaveBeenCalledTimes(1)
    const opts = mockUploadStream.mock.calls[0][0] as Record<string, unknown>
    expect(opts.folder).toBe('avatars')
    expect(opts.transformation).toBe('w_512,h_512,c_fill')
    expect(opts.invalidate).toBe(true)
    expect(opts.timeout).toBe(30000)
    expect(mockConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        cloud_name: CLOUD,
        api_key: KEY,
        api_secret: SECRET,
        timeout: 30000,
      }),
    )
  })

  it('times out after 30s when the SDK never answers (and retries once)', async () => {
    jest.useFakeTimers()
    try {
      mockUploadStream.mockImplementation(() => ({ end: jest.fn() }))
      const p = uploadToCloudinary(Buffer.from('img'), { folder: 'avatars' })
      const assertion = expect(p).rejects.toThrow('انتهت مهلة الاتصال، حاول مرة أخرى')
      await jest.advanceTimersByTimeAsync(65000)
      await assertion
      expect(mockUploadStream).toHaveBeenCalledTimes(2)
    } finally {
      jest.useRealTimers()
    }
  })
})

describe('Arabic error table (one assert per class)', () => {
  const cases: Array<[unknown, string]> = [
    [{ http_code: 401, message: 'Unauthorized' }, 'خطأ في إعدادات الخدمة، تواصل مع الدعم'],
    [{ http_code: 403, message: 'Forbidden' }, 'خطأ في إعدادات الخدمة، تواصل مع الدعم'],
    [{ http_code: 404, message: 'Not Found' }, 'الملف غير موجود'],
    [{ http_code: 413, message: 'Payload Too Large' }, 'حجم الملف يتجاوز الحد الأقصى'],
    [{ http_code: 429, message: 'Too Many Requests' }, 'تم تجاوز الحد المسموح، حاول لاحقًا'],
    [{ code: 'ETIMEDOUT', message: 'timeout of 30000ms exceeded' }, 'انتهت مهلة الاتصال، حاول مرة أخرى'],
    [{ code: 'ECONNRESET', message: 'socket hang up' }, 'تعذر الاتصال بالخدمة، تحقق من الإنترنت'],
  ]

  for (const [sdkErr, arabic] of cases) {
    it(`maps ${JSON.stringify(sdkErr)} → «${arabic}»`, async () => {
      uploadResponds(sdkErr)
      uploadResponds(sdkErr) // second attempt for retryable classes
      await expect(
        uploadToCloudinary(Buffer.from('img'), { folder: 'avatars' }),
      ).rejects.toThrow(arabic)
    })
  }

  it('maps exhausted 5xx to the generic Arabic fallback', async () => {
    uploadResponds({ http_code: 503, message: 'Service Unavailable' })
    uploadResponds({ http_code: 503, message: 'Service Unavailable' })
    await expect(
      uploadToCloudinary(Buffer.from('img'), { folder: 'avatars' }),
    ).rejects.toThrow('حدث خطأ أثناء الرفع، حاول مرة أخرى')
  })
})

describe('circuit breaker (5 fails/60s, half-open 60s)', () => {
  async function failOneUpload() {
    uploadResponds({ http_code: 503, message: 'Service Unavailable' })
    uploadResponds({ http_code: 503, message: 'Service Unavailable' })
    await expect(
      uploadToCloudinary(Buffer.from('img'), { folder: 'avatars' }),
    ).rejects.toThrow('حدث خطأ أثناء الرفع')
  }

  it('opens after 5 failures: next call short-circuits with the 429 Arabic message', async () => {
    for (let i = 0; i < 5; i++) await failOneUpload()
    const calls = mockUploadStream.mock.calls.length
    await expect(
      uploadToCloudinary(Buffer.from('img'), { folder: 'avatars' }),
    ).rejects.toThrow('تم تجاوز الحد المسموح، حاول لاحقًا')
    expect(mockUploadStream.mock.calls.length).toBe(calls)
  })

  it('half-opens after 60s: a successful trial closes the circuit', async () => {
    for (let i = 0; i < 5; i++) await failOneUpload()
    const realNow = Date.now()
    const spy = jest.spyOn(Date, 'now').mockImplementation(() => realNow + 61_000)
    try {
      uploadResponds(null, OK_RESULT)
      const res = await uploadToCloudinary(Buffer.from('img'), { folder: 'avatars' })
      expect(res.publicId).toBe(OK_RESULT.public_id)
      // circuit closed again: a 4xx now reaches the SDK instead of short-circuiting
      uploadResponds({ http_code: 400, message: 'Bad Request' })
      await expect(
        uploadToCloudinary(Buffer.from('img'), { folder: 'avatars' }),
      ).rejects.toThrow()
    } finally {
      spy.mockRestore()
    }
  })

  it('reset seam clears an open circuit', async () => {
    for (let i = 0; i < 5; i++) await failOneUpload()
    resetCloudinaryCircuitBreaker()
    uploadResponds(null, OK_RESULT)
    const res = await uploadToCloudinary(Buffer.from('img'), { folder: 'avatars' })
    expect(res.url).toBe(OK_RESULT.secure_url)
  })
})

describe('deleteFromCloudinary (idempotent)', () => {
  it('returns {ok:true} on success with invalidate:true', async () => {
    mockDestroy.mockResolvedValueOnce({ result: 'ok' })
    await expect(deleteFromCloudinary('avatars/u1')).resolves.toEqual({ ok: true })
    expect(mockDestroy).toHaveBeenCalledWith('avatars/u1', { invalidate: true })
  })

  it('swallows 404 as {ok:true}', async () => {
    mockDestroy.mockRejectedValueOnce({ http_code: 404, message: 'not found' })
    await expect(deleteFromCloudinary('avatars/gone')).resolves.toEqual({ ok: true })
  })

  it('treats result "not found" as {ok:true}', async () => {
    mockDestroy.mockResolvedValueOnce({ result: 'not found' })
    await expect(deleteFromCloudinary('avatars/gone')).resolves.toEqual({ ok: true })
  })

  it('is a no-op returning {ok:true} with no SDK call when unconfigured', async () => {
    clearCloudEnv()
    await expect(deleteFromCloudinary('avatars/u1')).resolves.toEqual({ ok: true })
    expect(mockDestroy).not.toHaveBeenCalled()
  })

  it('throws Arabic on auth failure without retry', async () => {
    mockDestroy.mockRejectedValueOnce({ http_code: 401, message: 'Unauthorized' })
    await expect(deleteFromCloudinary('avatars/u1')).rejects.toThrow(
      'خطأ في إعدادات الخدمة، تواصل مع الدعم',
    )
    expect(mockDestroy).toHaveBeenCalledTimes(1)
  })

  it('retries once on 5xx then throws Arabic', async () => {
    mockDestroy.mockRejectedValueOnce({ http_code: 500, message: 'boom' })
    mockDestroy.mockRejectedValueOnce({ http_code: 500, message: 'boom' })
    await expect(deleteFromCloudinary('avatars/u1')).rejects.toThrow(
      'حدث خطأ أثناء الرفع، حاول مرة أخرى',
    )
    expect(mockDestroy).toHaveBeenCalledTimes(2)
  })
})

describe('reportError discipline', () => {
  it('reports unexpected (5xx) failures, never 4xx', async () => {
    uploadResponds({ http_code: 503, message: 'Service Unavailable' })
    uploadResponds({ http_code: 503, message: 'Service Unavailable' })
    await expect(
      uploadToCloudinary(Buffer.from('img'), { folder: 'avatars' }),
    ).rejects.toThrow()
    expect(mockReportError).toHaveBeenCalledTimes(1)

    mockReportError.mockClear()
    uploadResponds({ http_code: 401, message: 'Unauthorized' })
    await expect(
      uploadToCloudinary(Buffer.from('img'), { folder: 'avatars' }),
    ).rejects.toThrow()
    expect(mockReportError).not.toHaveBeenCalled()
  })
})

describe('key + buffer hygiene', () => {
  it('never logs full keys/buffers; logs only the masked key', async () => {
    const marker = 'BUFFER_SENTINEL_XYZ_987'
    uploadResponds(null, OK_RESULT)
    await uploadToCloudinary(Buffer.from(`img-${marker}`), { folder: 'avatars' })
    uploadResponds({ http_code: 401, message: 'Unauthorized' })
    await expect(
      uploadToCloudinary(Buffer.from(`img-${marker}`), { folder: 'avatars' }),
    ).rejects.toThrow()

    const logged = JSON.stringify([
      mockLogInfo.mock.calls,
      mockLogWarn.mock.calls,
      mockLogError.mock.calls,
    ])
    const reported = JSON.stringify(mockReportError.mock.calls)
    for (const dump of [logged, reported]) {
      expect(dump).not.toContain(SECRET)
      expect(dump).not.toContain(KEY)
      expect(dump).not.toContain(marker)
    }
    expect(logged).toContain(MASKED_KEY)
  })
})

describe('checkAvatarQuota', () => {
  it('routes creators through the quota engine (allowed when fresh)', async () => {
    mockUserFind.mockResolvedValue({ role: 'creator' })
    await expect(checkAvatarQuota('u-creator', 1024)).resolves.toEqual({ ok: true })
  })

  it('denies creators with the engine Arabic reason when storage is full', async () => {
    mockUserFind.mockResolvedValue({ role: 'creator' })
    mockStorageFind.mockResolvedValue({ totalBytes: BigInt(FREE_LIMIT) })
    const res = await checkAvatarQuota('u-creator', 2048)
    expect(res.ok).toBe(false)
    expect(res.reasonAr).toMatch(/مساحتك التخزينية/)
  })

  it('allows non-creators (member) under the 50MB lifetime cap', async () => {
    mockUserFind.mockResolvedValue({ role: 'member' })
    await expect(checkAvatarQuota('u-member', MB)).resolves.toEqual({ ok: true })
    expect(AVATAR_NON_CREATOR_LIFETIME_BYTES).toBe(50 * MB)
  })

  it('denies non-creators over the 50MB lifetime cap with Arabic reason', async () => {
    mockUserFind.mockResolvedValue({ role: 'member' })
    mockStorageFind.mockResolvedValue({ totalBytes: BigInt(50 * MB - 512) })
    const res = await checkAvatarQuota('u-member', 1024)
    expect(res.ok).toBe(false)
    expect(res.reasonAr).toMatch(/50MB/)
  })

  it('denies invalid byte sizes', async () => {
    await expect(checkAvatarQuota('u-member', 0)).resolves.toMatchObject({ ok: false })
    const res = await checkAvatarQuota('u-member', NaN)
    expect(res.ok).toBe(false)
    expect(res.reasonAr).toMatch(/غير صالح/)
  })
})

describe('getCloudinaryUsage', () => {
  it('returns the real usage shape on success', async () => {
    mockUsage.mockResolvedValueOnce({ storage: { usage: 12345 } })
    const res = await getCloudinaryUsage()
    expect(res).toEqual({
      usage: 12345,
      limit: FREE_LIMIT,
      percentUsed: (12345 / FREE_LIMIT) * 100,
    })
  })

  it('returns the -1 sentinel on API error (never masked as zeros)', async () => {
    mockUsage.mockRejectedValueOnce(new Error('boom'))
    await expect(getCloudinaryUsage()).resolves.toEqual({
      usage: -1,
      limit: -1,
      percentUsed: -1,
    })
  })

  it('returns the -1 sentinel when unconfigured', async () => {
    clearCloudEnv()
    await expect(getCloudinaryUsage()).resolves.toEqual({
      usage: -1,
      limit: -1,
      percentUsed: -1,
    })
    expect(mockUsage).not.toHaveBeenCalled()
  })
})
