/**
 * SA-1 — avatars/banners to Cloudinary (TDD).
 * Mocks @/lib/cloudinary + db. No prod writes, no real uploads.
 */

jest.mock('@/lib/auth', () => ({
  getOptionalSession: jest.fn(),
}))

jest.mock('@/lib/db', () => ({
  db: {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}))

jest.mock('@/lib/rate-limit', () => ({
  rateLimit: jest.fn(async () => ({ success: true, remaining: 4, resetAt: 0, limit: 5 })),
}))

jest.mock('@/lib/error-reporting', () => ({
  reportError: jest.fn(),
}))

jest.mock('@/lib/cloudinary', () => ({
  uploadToCloudinary: jest.fn(),
  deleteFromCloudinary: jest.fn(),
  isCloudinaryEnabled: jest.fn(),
  verifyCloudinaryConfig: jest.fn(),
  checkAvatarQuota: jest.fn(),
}))

jest.mock('@/lib/supabase/server', () => ({
  createAdminClient: jest.fn(() => null),
}))

import fs from 'fs'
import path from 'path'
import { DELETE as avatarDELETE, POST as avatarPOST } from '@/app/api/users/[username]/avatar/route'
import { DELETE as bannerDELETE, POST as bannerPOST } from '@/app/api/users/[username]/banner/route'
import { getOptionalSession } from '@/lib/auth'
import {
  checkAvatarQuota,
  deleteFromCloudinary,
  isCloudinaryEnabled,
  uploadToCloudinary,
} from '@/lib/cloudinary'
import { db } from '@/lib/db'

const mockSession = getOptionalSession as jest.Mock
const mockUpload = uploadToCloudinary as jest.Mock
const mockDelete = deleteFromCloudinary as jest.Mock
const mockEnabled = isCloudinaryEnabled as jest.Mock
const mockQuota = checkAvatarQuota as jest.Mock
const mockFindUnique = db.user.findUnique as jest.Mock
const mockUpdate = db.user.update as jest.Mock

const USER = { id: 'u1', username: 'ali', email: 'a@x', role: 'member' } as any
const avatarParams = { params: Promise.resolve({ username: 'ali' }) } as any
const bannerParams = { params: Promise.resolve({ username: 'ali' }) } as any

function jpegFile(size: number, name = 'a.jpg', type = 'image/jpeg'): File {
  const bytes = new Uint8Array(size)
  bytes[0] = 0xff
  bytes[1] = 0xd8
  bytes[2] = 0xff
  return new File([bytes], name, { type })
}

function svgFile(): File {
  return new File(['<svg xmlns="http://www.w3.org/2000/svg"></svg>'], 'x.svg', {
    type: 'image/svg+xml',
  })
}

function postReq(file: File, kind: 'avatar' | 'banner'): any {
  const fd = new FormData()
  fd.append('file', file)
  const { NextRequest } = jest.requireActual('next/server') as typeof import('next/server')
  return new NextRequest(`http://x/api/users/ali/${kind}`, { method: 'POST', body: fd })
}

function deleteReq(kind: 'avatar' | 'banner'): any {
  const { NextRequest } = jest.requireActual('next/server') as typeof import('next/server')
  return new NextRequest(`http://x/api/users/ali/${kind}`, { method: 'DELETE' })
}

beforeEach(() => {
  jest.clearAllMocks()
  mockSession.mockResolvedValue(USER)
  mockEnabled.mockReturnValue(true)
  mockUpload.mockResolvedValue({
    url: 'https://res.cloudinary.com/demo/image/upload/v1/x.webp',
    publicId: 'games-arabic/avatars/u1_new',
  })
  mockDelete.mockResolvedValue({ ok: true })
  mockQuota.mockResolvedValue({ ok: true })
  mockFindUnique.mockResolvedValue({ avatarPublicId: null, bannerPublicId: null })
  mockUpdate.mockImplementation(async (args: any) => ({ id: 'u1', ...args.data }))
})

describe('avatar POST → Cloudinary', () => {
  it('happy 200KB JPEG → {url,publicId} + DB write', async () => {
    const res = await avatarPOST(postReq(jpegFile(200 * 1024), 'avatar'), avatarParams)
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.data.url).toMatch(/^https:\/\//)
    expect(typeof body.data.publicId).toBe('string')
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'u1' },
        data: expect.objectContaining({
          avatarUrl: body.data.url,
          avatarPublicId: body.data.publicId,
        }),
      }),
    )
    expect(mockUpload).toHaveBeenCalledTimes(1)
    const [buf, opts] = mockUpload.mock.calls[0]
    expect(Buffer.isBuffer(buf)).toBe(true)
    expect(opts).toMatchObject({
      folder: 'games-arabic/avatars',
      transform: 'w_500,h_500,c_fill,q_auto,f_webp',
    })
  })

  it('deletes old publicId BEFORE upload on update', async () => {
    mockFindUnique.mockResolvedValue({ avatarPublicId: 'old-avatar-id' })
    const res = await avatarPOST(postReq(jpegFile(200 * 1024), 'avatar'), avatarParams)
    expect(res.status).toBe(200)
    expect(mockDelete).toHaveBeenCalledWith('old-avatar-id')
    expect(mockUpload).toHaveBeenCalledTimes(1)
    expect(mockDelete.mock.invocationCallOrder[0]).toBeLessThan(
      mockUpload.mock.invocationCallOrder[0],
    )
  })

  it('delete failure never blocks upload (best-effort, log only)', async () => {
    mockFindUnique.mockResolvedValue({ avatarPublicId: 'old-avatar-id' })
    mockDelete.mockRejectedValueOnce(new Error('gone'))
    const res = await avatarPOST(postReq(jpegFile(200 * 1024), 'avatar'), avatarParams)
    expect(res.status).toBe(200)
    expect(mockUpload).toHaveBeenCalledTimes(1)
    expect(mockUpdate).toHaveBeenCalled()
  })

  it('5MB+1B rejected with Arabic message + no upload call', async () => {
    const res = await avatarPOST(postReq(jpegFile(5 * 1024 * 1024 + 1), 'avatar'), avatarParams)
    const body = await res.json()
    expect(res.status).toBe(422)
    expect(JSON.stringify(body)).toMatch(/حجم الصورة كبير جداً — الحد الأقصى 5MB/)
    expect(mockUpload).not.toHaveBeenCalled()
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('SVG rejected + no upload call', async () => {
    const res = await avatarPOST(postReq(svgFile(), 'avatar'), avatarParams)
    const body = await res.json()
    expect(res.status).toBe(422)
    expect(JSON.stringify(body)).toMatch(/SVG/)
    expect(mockUpload).not.toHaveBeenCalled()
  })

  it('CLOUDINARY disabled → Arabic 503 + no DB write + no upload', async () => {
    mockEnabled.mockReturnValue(false)
    const res = await avatarPOST(postReq(jpegFile(200 * 1024), 'avatar'), avatarParams)
    const body = await res.json()
    expect(res.status).toBe(503)
    expect(JSON.stringify(body)).toMatch(/خدمة الصور غير مفعّلة حالياً/)
    expect(mockUpload).not.toHaveBeenCalled()
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('keeps auth/ownership checks (401/403)', async () => {
    mockSession.mockResolvedValueOnce(null)
    const unauth = await avatarPOST(postReq(jpegFile(1024), 'avatar'), avatarParams)
    expect(unauth.status).toBe(401)
    const forbiddenParams = { params: Promise.resolve({ username: 'other' }) } as any
    const forbidden = await avatarPOST(postReq(jpegFile(1024), 'avatar'), forbiddenParams)
    expect(forbidden.status).toBe(403)
  })

  it('quota denied → Arabic message + no upload call', async () => {
    mockQuota.mockResolvedValueOnce({ ok: false, reasonAr: 'تجاوزت حد صور الحساب (50MB)' })
    const res = await avatarPOST(postReq(jpegFile(200 * 1024), 'avatar'), avatarParams)
    const body = await res.json()
    expect(JSON.stringify(body)).toMatch(/تجاوزت حد صور الحساب/)
    expect(mockUpload).not.toHaveBeenCalled()
    expect(mockUpdate).not.toHaveBeenCalled()
  })
})

describe('banner POST → Cloudinary', () => {
  beforeEach(() => {
    mockUpload.mockResolvedValue({
      url: 'https://res.cloudinary.com/demo/image/upload/v1/b.webp',
      publicId: 'games-arabic/banners/u1_new',
    })
  })

  it('happy 200KB JPEG → {url,publicId} + DB write with banner folder/transform', async () => {
    const res = await bannerPOST(postReq(jpegFile(200 * 1024), 'banner'), bannerParams)
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.data.url).toMatch(/^https:\/\//)
    expect(typeof body.data.publicId).toBe('string')
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'u1' },
        data: expect.objectContaining({
          bannerUrl: body.data.url,
          bannerPublicId: body.data.publicId,
        }),
      }),
    )
    const [, opts] = mockUpload.mock.calls[0]
    expect(opts).toMatchObject({
      folder: 'games-arabic/banners',
      transform: 'w_1500,h_500,c_fill,q_auto,f_webp',
    })
  })

  it('deletes old banner publicId BEFORE upload', async () => {
    mockFindUnique.mockResolvedValue({ bannerPublicId: 'old-banner-id' })
    const res = await bannerPOST(postReq(jpegFile(200 * 1024), 'banner'), bannerParams)
    expect(res.status).toBe(200)
    expect(mockDelete).toHaveBeenCalledWith('old-banner-id')
    expect(mockDelete.mock.invocationCallOrder[0]).toBeLessThan(
      mockUpload.mock.invocationCallOrder[0],
    )
  })

  it('60MB+1B rejected with Arabic message + no upload call (P2 unified cap)', async () => {
    const res = await bannerPOST(postReq(jpegFile(60 * 1024 * 1024 + 1), 'banner'), bannerParams)
    const body = await res.json()
    expect(res.status).toBe(422)
    expect(JSON.stringify(body)).toMatch(/حجم الصورة كبير جداً — الحد الأقصى 60MB/)
    expect(mockUpload).not.toHaveBeenCalled()
  })

  it('CLOUDINARY disabled → Arabic 503 + no DB write', async () => {
    mockEnabled.mockReturnValue(false)
    const res = await bannerPOST(postReq(jpegFile(200 * 1024), 'banner'), bannerParams)
    const body = await res.json()
    expect(res.status).toBe(503)
    expect(JSON.stringify(body)).toMatch(/خدمة الصور غير مفعّلة حالياً/)
    expect(mockUpload).not.toHaveBeenCalled()
    expect(mockUpdate).not.toHaveBeenCalled()
  })
})

describe('DELETE idempotent (always 200)', () => {
  it('avatar DELETE with no asset → 200 (no throw)', async () => {
    mockFindUnique.mockResolvedValue(null)
    const res = await avatarDELETE(deleteReq('avatar'), avatarParams)
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(JSON.stringify(body)).toMatch(/تم حذف|حذف/)
  })

  it('avatar DELETE with asset → deletes publicId + clears DB + 200', async () => {
    mockFindUnique.mockResolvedValue({ avatarPublicId: 'old-avatar-id', avatarUrl: 'https://x/y' })
    const res = await avatarDELETE(deleteReq('avatar'), avatarParams)
    expect(res.status).toBe(200)
    expect(mockDelete).toHaveBeenCalledWith('old-avatar-id')
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'u1' },
        data: expect.objectContaining({ avatarUrl: null, avatarPublicId: null }),
      }),
    )
  })

  it('banner DELETE with no asset → 200', async () => {
    mockFindUnique.mockResolvedValue(null)
    const res = await bannerDELETE(deleteReq('banner'), bannerParams)
    expect(res.status).toBe(200)
  })

  it('banner DELETE with asset → deletes publicId + clears DB + 200', async () => {
    mockFindUnique.mockResolvedValue({ bannerPublicId: 'old-banner-id', bannerUrl: 'https://x/y' })
    const res = await bannerDELETE(deleteReq('banner'), bannerParams)
    expect(res.status).toBe(200)
    expect(mockDelete).toHaveBeenCalledWith('old-banner-id')
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'u1' },
        data: expect.objectContaining({ bannerUrl: null, bannerPublicId: null }),
      }),
    )
  })
})

describe('no key leak', () => {
  it('route sources + responses never contain server secrets', async () => {
    const root = process.cwd()
    const avatarSrc = fs.readFileSync(
      path.join(root, 'src/app/api/users/[username]/avatar/route.ts'),
      'utf8',
    )
    const bannerSrc = fs.readFileSync(
      path.join(root, 'src/app/api/users/[username]/banner/route.ts'),
      'utf8',
    )
    for (const src of [avatarSrc, bannerSrc]) {
      expect(src).not.toMatch(/CLOUDINARY_API_SECRET/)
      expect(src).not.toMatch(/CLOUDINARY_API_KEY/)
      expect(src).not.toMatch(/CLOUDINARY_URL/)
      expect(src).not.toMatch(/supabase.*service_role|SERVICE_ROLE/i)
      expect(src).not.toMatch(/createAdminClient/)
      expect(src).not.toMatch(/from\(['"]avatars['"]\)/)
      expect(src).not.toMatch(/from\(['"]banners['"]\)/)
    }
    // Response bodies carry only url/publicId, never secrets
    const res = await avatarPOST(postReq(jpegFile(10 * 1024), 'avatar'), avatarParams)
    const text = JSON.stringify(await res.json())
    expect(text).not.toMatch(/API_SECRET|API_KEY|service_role/i)
  })
})
