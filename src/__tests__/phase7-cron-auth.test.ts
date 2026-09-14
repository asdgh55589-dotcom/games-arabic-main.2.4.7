/**
 * اختبارات phase7-cron-auth — مُوثّق cron-auth الموحّد
 */

import crypto from 'crypto'

class MockNextResponse {
  status: number
  body: any
  constructor(body: any, init?: { status?: number }) {
    this.body = body
    this.status = init?.status ?? 200
  }
  async json() {
    return this.body
  }
  static json(body: any, init?: { status?: number }) {
    return new MockNextResponse(body, init)
  }
}

class MockNextRequest {
  url: string
  _headers: Record<string, string>
  constructor(url: string, init?: { method?: string; headers?: Record<string, string> }) {
    this.url = url
    this._headers = init?.headers ?? {}
  }
  headers = {
    get: (name: string) => this._headers[name.toLowerCase()] ?? null,
  }
}

jest.mock('next/server', () => ({
  NextRequest: MockNextRequest,
  NextResponse: MockNextResponse,
}))

const { requireCronAuth } = require('@/lib/cron-auth') as typeof import('@/lib/cron-auth')

const originalTimingSafeEqual = crypto.timingSafeEqual

beforeEach(() => {
  ;(crypto as any).timingSafeEqual = originalTimingSafeEqual
})

afterEach(() => {
  ;(crypto as any).timingSafeEqual = originalTimingSafeEqual
})

function makeRequest(headers: Record<string, string> = {}): MockNextRequest {
  return new MockNextRequest('http://localhost/api/cron/test', {
    method: 'GET',
    headers,
  })
}

const CRON_SECRET = 'test-secret-value-12345'

describe('requireCronAuth', () => {
  describe('لا يوجد CRON_SECRET', () => {
    it('يعيد 501 عندما لا يكون CRON_SECRET مُعرَّفًا', async () => {
      const orig = process.env.CRON_SECRET
      delete process.env.CRON_SECRET
      try {
        const req = makeRequest({ authorization: `Bearer ${CRON_SECRET}` })
        const result = await requireCronAuth(req as any)

        expect(result).not.toBeNull()
        const json = await result!.json()
        expect(result!.status).toBe(501)
        expect(json.error).toContain('CRON_SECRET غير مُكوَّن')
      } finally {
        if (orig !== undefined) process.env.CRON_SECRET = orig
      }
    })
  })

  describe('بدون رأس Authorization', () => {
    it('يعيد 401 عندما لا يوجد رأس Authorization', async () => {
      process.env.CRON_SECRET = CRON_SECRET
      const req = makeRequest({})
      const result = await requireCronAuth(req as any)

      expect(result).not.toBeNull()
      const json = await result!.json()
      expect(result!.status).toBe(401)
      expect(json.error).toContain('غير مصرّح')
    })
  })

  describe('رأس Authorization غير صالح', () => {
    it('يعيد 401 عندما يكون الرأس Basic بدل Bearer', async () => {
      process.env.CRON_SECRET = CRON_SECRET
      const req = makeRequest({ authorization: `Basic ${CRON_SECRET}` })
      const result = await requireCronAuth(req as any)

      expect(result).not.toBeNull()
      expect(result!.status).toBe(401)
    })

    it('يعيد 401 عندما يكون الرأس بدون كلمة Bearer', async () => {
      process.env.CRON_SECRET = CRON_SECRET
      const req = makeRequest({ authorization: CRON_SECRET })
      const result = await requireCronAuth(req as any)

      expect(result).not.toBeNull()
      expect(result!.status).toBe(401)
    })
  })

  describe('رمز Bearer خاطئ', () => {
    it('يعيد 401 عندما يكون الرمز مختلفًا', async () => {
      process.env.CRON_SECRET = CRON_SECRET
      const req = makeRequest({ authorization: 'Bearer wrong-secret-value' })
      const result = await requireCronAuth(req as any)

      expect(result).not.toBeNull()
      const json = await result!.json()
      expect(result!.status).toBe(401)
      expect(json.error).toContain('غير مصرّح')
    })

    it(' يستخدم timingSafeEqual للمقارنة', async () => {
      process.env.CRON_SECRET = CRON_SECRET
      let compareCalled = false
      ;(crypto as any).timingSafeEqual = (a: Buffer, b: Buffer) => {
        compareCalled = true
        return false
      }

      const req = makeRequest({ authorization: 'Bearer wrong-secret' })
      await requireCronAuth(req as any)

      expect(compareCalled).toBe(true)
    })
  })

  describe('رمز Bearer صحيح', () => {
    it('يعيد null عندما يكون الرمز صحيحًا', async () => {
      process.env.CRON_SECRET = CRON_SECRET
      const req = makeRequest({ authorization: `Bearer ${CRON_SECRET}` })
      const result = await requireCronAuth(req as any)

      expect(result).toBeNull()
    })
  })

  describe('رأس x-cron-secret مرفوض', () => {
    it('يعيد 401 عندما يتم استخدام x-cron-secret بدل Authorization', async () => {
      process.env.CRON_SECRET = CRON_SECRET
      const req = makeRequest({ 'x-cron-secret': CRON_SECRET })
      const result = await requireCronAuth(req as any)

      expect(result).not.toBeNull()
      expect(result!.status).toBe(401)
    })
  })

  describe('طول مختلف للرمز', () => {
    it('يعيد 401 عندما يكون طول الرمز مختلفًا', async () => {
      process.env.CRON_SECRET = CRON_SECRET
      const req = makeRequest({ authorization: 'Bearer short' })
      const result = await requireCronAuth(req as any)

      expect(result).not.toBeNull()
      expect(result!.status).toBe(401)
    })
  })
})
