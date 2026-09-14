/**
 * Phase 2 Task 3 — Uppy integration tests.
 *
 * NOTE (honest): Uppy v6 + its graph (nanoid/p-queue/p-retry,
 * @transloadit/prettier-bytes) ship ESM-only and cannot load under this
 * repo's CommonJS jest setup (no jsdom either), so live Uppy instances are
 * NOT constructed here. Live behavior was verified with node:
 *   ar cancel → "الغاء", en cancel → "Cancel",
 *   restrictions + XHRUpload endpoint opts stored correctly.
 * These tests cover the (dependency-free) envelope module for real, plus
 * static wiring assertions on the component source.
 */
import fs from 'fs'
import path from 'path'
import {
  parseUppyErrorEnvelope,
  parseUppySuccessEnvelope,
  pickStoredUrl,
} from '@/lib/uppy-envelope'

const componentSrc = fs.readFileSync(
  path.join(process.cwd(), 'src/components/creator/uppy-uploader.tsx'),
  'utf8',
)

describe('envelope parsing (real unit tests)', () => {
  it('extracts data urls from success envelope', () => {
    const body = parseUppySuccessEnvelope(
      JSON.stringify({ data: { url: 'https://x/y.jpg', wrappedUrl: 'https://w/y.jpg' } }),
    )
    expect(body.url).toBe('https://x/y.jpg')
    expect(body.wrappedUrl).toBe('https://w/y.jpg')
  })

  it('returns {} on garbage (never throws)', () => {
    expect(parseUppySuccessEnvelope('not-json{{{')).toEqual({})
    expect(parseUppySuccessEnvelope('')).toEqual({})
  })

  it('extracts Arabic server reason from failure envelope', () => {
    const msg = parseUppyErrorEnvelope({
      responseText: JSON.stringify({ error: { message: 'تجاوزت حد الرفع اليومي' } }),
    })
    expect(msg).toMatch(/حد الرفع اليومي/)
  })

  it('returns empty string when no reason present', () => {
    expect(parseUppyErrorEnvelope({ responseText: '{}' })).toBe('')
    expect(parseUppyErrorEnvelope(null)).toBe('')
  })
})

describe('pickStoredUrl', () => {
  it('prefers the edge-wrapped URL, falls back to original/url', () => {
    expect(
      pickStoredUrl({ originalUrl: 'https://o/x.jpg', wrappedUrl: 'https://w/x.jpg' }),
    ).toBe('https://w/x.jpg')
    expect(pickStoredUrl({ url: 'https://o/x.jpg' })).toBe('https://o/x.jpg')
  })

  it('rejects non-https (never store data: or http)', () => {
    expect(pickStoredUrl({ url: 'data:image/png;base64,xx' })).toBe('')
    expect(pickStoredUrl({ url: 'http://o/x.jpg' })).toBe('')
    expect(pickStoredUrl({})).toBe('')
  })
})

describe('component wiring (static)', () => {
  it('uses Dashboard inline + XHRUpload multipart (no custom engine)', () => {
    expect(componentSrc).toMatch(/uppy\.use\(Dashboard,/)
    expect(componentSrc).toMatch(/inline:\s*true/)
    expect(componentSrc).toMatch(/uppy\.use\(XHRUpload,/)
    expect(componentSrc).toMatch(/formData:\s*true/)
    expect(componentSrc).toMatch(/bundle:\s*false/)
    expect(componentSrc).not.toMatch(/XMLHttpRequest\(\)/)
    expect(componentSrc).not.toMatch(/onUploadProgress/)
  })

  it('selects ar_SA default / en_US by studio locale and destroys on unmount', () => {
    expect(componentSrc).toMatch(/ar_SA/)
    expect(componentSrc).toMatch(/en_US/)
    expect(componentSrc).toMatch(/locale === 'ar' \? ar_SA : en_US/)
    expect(componentSrc).toMatch(/uppy\.destroy\(\)/)
  })

  it('passes quota-driven restrictions through', () => {
    expect(componentSrc).toMatch(/maxFileSize/)
    expect(componentSrc).toMatch(/maxNumberOfFiles/)
    expect(componentSrc).toMatch(/allowedFileTypes/)
  })
})
