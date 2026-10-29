import * as fs from 'node:fs'
import * as path from 'node:path'

const root = process.cwd()

describe('image optimization (static)', () => {
  it('next.config.ts has image remotePatterns', () => {
    const src = fs.readFileSync(path.join(root, 'next.config.ts'), 'utf8')
    expect(src).toContain('remotePatterns')
    expect(src).toContain('formats')
    expect(src).toContain('image/avif')
  })

  it('next.config.ts has image sizes', () => {
    const src = fs.readFileSync(path.join(root, 'next.config.ts'), 'utf8')
    expect(src).toContain('deviceSizes')
    expect(src).toContain('minimumCacheTTL')
  })

  it('mfa-setup uses next/image', () => {
    const src = fs.readFileSync(
      path.join(root, 'src/components/settings/mfa-setup.tsx'),
      'utf8',
    )
    expect(src).toContain("from 'next/image'")
  })

  it('image-upload uses next/image', () => {
    const src = fs.readFileSync(
      path.join(root, 'src/components/admin/image-upload.tsx'),
      'utf8',
    )
    expect(src).toContain("from 'next/image'")
  })

  it('mod-download-section uses next/image', () => {
    const src = fs.readFileSync(
      path.join(root, 'src/components/mod-download-section.tsx'),
      'utf8',
    )
    expect(src).toContain("from 'next/image'")
  })

  it('static assets cache headers present', () => {
    const src = fs.readFileSync(path.join(root, 'next.config.ts'), 'utf8')
    expect(src).toContain('Cache-Control')
    expect(src).toContain('immutable')
  })
})
