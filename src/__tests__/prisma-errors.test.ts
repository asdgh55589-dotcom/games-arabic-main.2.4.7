import { Prisma } from '@prisma/client'
import { handlePrismaError } from '@/lib/prisma-errors'
import * as reporting from '@/lib/error-reporting'

describe('handlePrismaError (Section 7)', () => {
  it('P2002 unique constraint → 409 + Arabic message', () => {
    const err = new Prisma.PrismaClientKnownRequestError('dup', {
      code: 'P2002',
      clientVersion: '6.0.0',
    })
    const r = handlePrismaError(err)
    expect(r.status).toBe(409)
    expect(r.code).toBe('P2002')
    expect(r.message).toBe('هذه البيانات مسجلة بالفعل')
  })

  it('P2025 not found → 404', () => {
    const err = new Prisma.PrismaClientKnownRequestError('nf', {
      code: 'P2025',
      clientVersion: '6.0.0',
    })
    const r = handlePrismaError(err)
    expect(r.status).toBe(404)
    expect(r.message).toBe('العنصر المطلوب غير موجود')
  })

  it('P2003 foreign key → 400', () => {
    const err = new Prisma.PrismaClientKnownRequestError('fk', {
      code: 'P2003',
      clientVersion: '6.0.0',
    })
    const r = handlePrismaError(err)
    expect(r.status).toBe(400)
    expect(r.message).toBe('لا يمكن إتمام العملية لارتباطها بعناصر أخرى')
  })

  it('P1001 connection error → 503', () => {
    const err = new Prisma.PrismaClientKnownRequestError('conn', {
      code: 'P1001',
      clientVersion: '6.0.0',
    })
    const r = handlePrismaError(err)
    expect(r.status).toBe(503)
    expect(r.message).toBe('تعذر الاتصال بقاعدة البيانات، يرجى المحاولة لاحقاً')
  })

  it('PrismaClientInitializationError → 503', () => {
    const err = new Prisma.PrismaClientInitializationError('init', '6.0.0')
    const r = handlePrismaError(err)
    expect(r.status).toBe(503)
  })

  it('unknown error → 500 generic, never leaks raw message', () => {
    const raw = 'password authentication failed for user "admin" at host db.internal'
    const r = handlePrismaError(new Error(raw))
    expect(r.status).toBe(500)
    expect(r.message).toBe('حدث خطأ داخلي في الخادم')
    expect(r.message).not.toContain('password')
    expect(r.message).not.toContain('admin')
  })

  it('P2002 meta still does not leak raw details', () => {
    const err = new Prisma.PrismaClientKnownRequestError('dup detail', {
      code: 'P2002',
      clientVersion: '6.0.0',
      meta: { target: ['email'] },
    })
    const r = handlePrismaError(err)
    expect(r.status).toBe(409)
    expect(r.message).not.toContain('dup detail')
  })
})

describe('handlePrismaError — domain-error passthrough (review R2)', () => {
  it('AuthError 401 passes through as 401, not 500', () => {
    const err = Object.assign(new Error('Unauthorized'), { name: 'AuthError', status: 401 })
    const r = handlePrismaError(err)
    expect(r.status).toBe(401)
    expect(r.code).toBe('UNAUTHORIZED')
    expect(r.message).toBe('يجب تسجيل الدخول')
  })

  it('AuthError 403 passes through as 403 with the caller fallback', () => {
    const err = Object.assign(new Error('Forbidden'), { name: 'AuthError', status: 403 })
    const r = handlePrismaError(err, { fallbackMessage: 'ليس لديك صلاحية' })
    expect(r.status).toBe(403)
    expect(r.code).toBe('FORBIDDEN')
    expect(r.message).toBe('ليس لديك صلاحية')
  })

  it('a non-AuthError domain error does not fake a 401', () => {
    const err = Object.assign(new Error('Provision failed'), { name: 'ProvisionError', status: 503 })
    expect(handlePrismaError(err).status).toBe(500)
  })
})

describe('handlePrismaError — single Sentry report (review R1)', () => {
  it('alreadyReported suppresses the util-level reportError', () => {
    const spy = jest.spyOn(reporting, 'reportError').mockImplementation(() => 'sent')
    const connErr = Object.assign(new Error("Can't reach database server at db.internal:5432"), {
      code: 'P1001',
    })
    handlePrismaError(connErr, { alreadyReported: true })
    expect(spy).not.toHaveBeenCalled()

    handlePrismaError(connErr)
    expect(spy).toHaveBeenCalledTimes(1)
    spy.mockRestore()
  })
})
