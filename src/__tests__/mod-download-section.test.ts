/**
 * تبويبة التحميل بالمفهوم ٢ المعتمد (الكارت المرآتي).
 * الهيدر + شارات النسخة + عدّادات حقيقية + أزرار بيضاء/سوداء
 * + شيبات إحصائيات لكل رابط + قسم متداخل + روابط مواقع خارجية
 * + وصف فوق التنبيه — مع إبقاء منطق الثقة القديم.
 */
import * as fs from 'node:fs'
import * as path from 'node:path'

const root = process.cwd()

function section(): string {
  return fs.readFileSync(path.join(root, 'src/components/mod-download-section.tsx'), 'utf8')
}

function modApi(): string {
  return fs.readFileSync(path.join(root, 'src/app/api/mods/[slug]/route.ts'), 'utf8')
}

function viewFile(name: string): string {
  return fs.readFileSync(path.join(root, `src/views/${name}`), 'utf8')
}

describe('download section (concept 2 — mirror card)', () => {
  it('each card shows version badge + per-file downloads + size + date', () => {
    expect(section()).toMatch(/v\{file\.version\}/)
    expect(section()).toMatch(/downloadsCount/)
    expect(section()).toMatch(/file\.fileSize/)
    expect(section()).toMatch(/releaseDate/)
  })

  it('exposes download actions per file', () => {
    expect(section()).toMatch(/handleDownloadClick/)
  })

  it('API aggregates real per-file download clicks', () => {
    expect(modApi()).toMatch(/downloadClick\.groupBy/)
    expect(modApi()).toMatch(/downloadsCount/)
  })

  it('uses white/black download buttons (concept 2)', () => {
    // زر أبيض بخط أسود كما في الديمو
    expect(section()).toMatch(/bg-white/)
    expect(section()).toMatch(/text-black/)
    expect(section()).toMatch(/تحميل/)
  })

  it('shows per-link stat chips with real downloadsCount', () => {
    expect(section()).toMatch(/⬇/)
    expect(section()).toMatch(/link\.downloadsCount/)
  })

  it('derives trust badges honestly (no invented working state)', () => {
    expect(section()).toMatch(/isTrustedDownloadUrl/)
    expect(section()).toMatch(/موثوقة/)
    expect(section()).toMatch(/خارجي/)
    // لا نخترع حالة "يعمل" — الشارة مشتقة من بيانات الثقة فقط
    expect(section()).not.toMatch(/يعمل/)
  })

  it('renders nested section with custom title + mini children', () => {
    expect(section()).toMatch(/file\.extrasLabel/)
    expect(section()).toMatch(/ملفات إضافية/)
    expect(section()).toMatch(/children/)
    expect(section()).toMatch(/v\{child\.version\}/)
  })

  it('renders external site links with compatible badge', () => {
    expect(section()).toMatch(/siteLinks/)
    expect(section()).toMatch(/fileId == null/)
    expect(section()).toMatch(/extrasLabel/)
    expect(section()).toMatch(/متوافق/)
    expect(section()).toMatch(/brandLogoUrl/)
  })

  it('shows file description above the alert', () => {
    const src = section()
    expect(src).toMatch(/file\.description/)
    expect(src).toMatch(/file\.alert/)
    // الوصف يظهر قبل التنبيه في الكود
    expect(src.indexOf('file.description')).toBeLessThan(src.indexOf('file.alert'))
  })

  it('keeps untrusted-mirror warning modal behavior unchanged', () => {
    expect(section()).toMatch(/تنبيه — رابط إعلانات/)
    expect(section()).toMatch(/confirmDownload/)
    expect(section()).toMatch(/DEFAULT_WARNING_MESSAGE/)
  })

  it('call sites pass siteLinks + extrasLabel (extended only)', () => {
    for (const name of ['mod-detail.tsx', 'mod-detail-mobile.tsx']) {
      const src = viewFile(name)
      expect(src).toMatch(/ModDownloadSection/)
      expect(src).toMatch(/siteLinks/)
      expect(src).toMatch(/extrasLabel/)
    }
  })
})
