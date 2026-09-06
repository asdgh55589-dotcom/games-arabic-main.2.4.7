/**
 * Phase 2 Task 7 — mod-form upload wiring (static source assertions).
 * Locks: Uppy panels are dynamic(ssr:false) code-splits, direct-link URL
 * inputs are retained, IA rows get a provider badge, progress comes from
 * Uppy only (no custom progress code in creator upload paths).
 */
import fs from 'fs'
import path from 'path'

const root = process.cwd()
const media = fs.readFileSync(path.join(root, 'src/components/creator/mod-form/media.tsx'), 'utf8')
const files = fs.readFileSync(path.join(root, 'src/components/creator/mod-form/files.tsx'), 'utf8')
const orchestrator = fs.readFileSync(path.join(root, 'src/components/creator/mod-form.tsx'), 'utf8')

describe('code-split upload panels (bundle-safe)', () => {
  it('media lazy-loads the FreeImage Uppy panel (ssr:false)', () => {
    expect(media).toMatch(/dynamic\(\s*\(\)\s*=>\s*import\('@\/components\/creator\/uppy-uploader'\)/)
    expect(media).toMatch(/ssr:\s*false/)
    expect(media).toMatch(/\/api\/storage\/upload-image/)
  })

  it('files lazy-load the IA Uppy panel (ssr:false)', () => {
    expect(files).toMatch(/dynamic\(\s*\(\)\s*=>\s*import\('@\/components\/creator\/ia-uploader'\)/)
    expect(files).toMatch(/ssr:\s*false/)
  })

  it('orchestrator passes modId to both upload sections (usage attribution)', () => {
    expect(orchestrator).toMatch(/<ModFormMedia[\s\S]*?modId=\{modId\}/)
    expect(orchestrator).toMatch(/<ModFormFiles[\s\S]*?modId=\{modId\}/)
  })
})

describe('direct-link option kept forever', () => {
  it('file rows still accept hand-pasted URLs', () => {
    expect(files).toMatch(/placeholder="https:\/\/\.\.\."/)
    expect(files).toMatch(/links: \[\.\.\.file\.links, \.\.\.links\]/)
  })

  it('IA rows are badged, direct rows keep platform icons', () => {
    expect(files).toMatch(/archive\.org\/download\//)
    expect(files).toMatch(/t\.iaBadge/)
    expect(files).toMatch(/getPlatformInfo\(link\.url\)/)
  })
})

describe('progress comes from Uppy only', () => {
  it('no hand-built progress / XHR upload code in creator upload paths', () => {
    for (const [name, src] of [['media', media], ['files', files]] as const) {
      expect(src).not.toMatch(/onUploadProgress/)
      expect(src).not.toMatch(/new XMLHttpRequest\(\)/)
      expect(src).not.toMatch(/bytesUploaded/)
      expect(src).not.toMatch(/<progress/)
    }
  })
})
