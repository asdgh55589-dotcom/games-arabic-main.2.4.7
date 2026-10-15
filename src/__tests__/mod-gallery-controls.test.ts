/**
 * gallery lightbox controls — wiring tests.
 * Ensures the lightbox exposes: close/prev/next, zoom in/out/reset,
 * download, counter, resolution badge, and a compact thumbnail strip.
 */
import * as fs from 'node:fs'
import * as path from 'node:path'

const root = process.cwd()

function gallery(): string {
  return fs.readFileSync(path.join(root, 'src/components/mod-gallery.tsx'), 'utf8')
}

describe('gallery lightbox controls', () => {
  it('exposes close / prev / next buttons', () => {
    expect(gallery()).toMatch(/aria-label="إغلاق"/)
    expect(gallery()).toMatch(/aria-label="السابق"/)
    expect(gallery()).toMatch(/aria-label="التالي"/)
  })

  it('exposes zoom in / out / reset + download', () => {
    expect(gallery()).toMatch(/aria-label="تكبير"/)
    expect(gallery()).toMatch(/aria-label="تصغير"/)
    expect(gallery()).toMatch(/aria-label="إعادة الضبط"/)
    expect(gallery()).toMatch(/aria-label="تنزيل الصورة"/)
  })

  it('shows counter + real resolution badge near the controls', () => {
    expect(gallery()).toMatch(/lightboxIndex \+ 1\} \/ \{images\.length/)
    expect(gallery()).toMatch(/naturalWidth.*naturalHeight/)
  })

  it('renders a compact thumbnail strip with active-thumb auto-scroll', () => {
    expect(gallery()).toMatch(/thumbsRef/)
    expect(gallery()).toMatch(/scrollIntoView/)
  })
})
