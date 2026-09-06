/**
 * Phase 1 Task 4 — base64 crop hazard regression guard.
 * Cropped canvas output must be uploaded to the server (https URL);
 * a data: URL must never be written into image state or the save payload.
 */
import fs from 'fs'
import path from 'path'

const root = process.cwd()
const creatorForm = fs.readFileSync(
  path.join(root, 'src/components/creator/mod-form.tsx'),
  'utf8',
)
const adminForm = fs.readFileSync(
  path.join(root, 'src/components/admin/mod-form.tsx'),
  'utf8',
)
const helper = fs.readFileSync(
  path.join(root, 'src/lib/upload-cropped.ts'),
  'utf8',
)

describe('crop upload helper', () => {
  it('exposes data-url detection + server upload returning https URLs', () => {
    expect(helper).toMatch(/isDataUrl/)
    expect(helper).toMatch(/startsWith\('data:'\)/)
    expect(helper).toMatch(/\/api\/storage\/upload-mod-image/)
    expect(helper).toMatch(/startsWith\('https:\/\/'\)/)
  })
})

describe.each([
  ['creator mod-form', creatorForm],
  ['admin mod-form', adminForm],
])('%s', (_name, src) => {
  it('handleCropComplete uploads instead of storing the data URL', () => {
    expect(src).toMatch(/uploadCroppedDataUrl\(/)
    // Raw cropper output only flows into state behind a non-data-URL guard;
    // data: URLs always go through the server upload above.
    expect(src).toMatch(/if \(!isDataUrl\(croppedImage\)\)/)
  })

  it('onSave refuses to persist base64', () => {
    expect(src).toMatch(/cropUploading/)
    expect(src).toMatch(/isDataUrl\(thumbnailUrl\)/)
    expect(src).toMatch(/isDataUrl\(imageUrl\)/)
  })
})
