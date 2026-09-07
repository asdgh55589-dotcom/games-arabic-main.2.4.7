/**
 * PHASE 4 Task 1 — rebrand "كن معرّباً" → "انضم لبرنامج منشئ المحتوى".
 * Locks: typo gone everywhere, new program copy present AR+EN.
 */
import * as fs from 'node:fs'
import * as path from 'node:path'

const root = process.cwd()
const src = (p: string) => fs.readFileSync(path.join(root, p), 'utf8')

const TOUCHED = [
  'src/views/settings.tsx',
  'src/lib/studio-i18n/ar.ts',
  'src/lib/studio-i18n/en.ts',
  'src/app/leaderboard/creators/page.tsx',
  'src/app/leaderboard/publishers/page.tsx',
  'src/app/api/creator-requests/route.ts',
]

describe('typo "صبح معرّباً" is gone', () => {
  it.each(TOUCHED)('%s has no typo', (file) => {
    expect(src(file)).not.toContain('صبح معرّباً')
  })
})

describe('old brand "كن معرّباً" is gone from user-facing copy', () => {
  it.each(TOUCHED)('%s has no old CTA', (file) => {
    expect(src(file)).not.toContain('كن معرّباً')
  })
})

describe('new program brand present', () => {
  it('settings tab + hero use the program name', () => {
    const settings = src('src/views/settings.tsx')
    expect(settings).toContain("label: 'برنامج منشئ المحتوى'")
    expect(settings).toContain('انضم لبرنامج منشئ المحتوى')
    expect(settings).toContain('كيف تنضم للبرنامج؟')
    expect(settings).toContain('أنت منشئ محتوى بالفعل')
    expect(settings).toContain('لوحة منشئ المحتوى')
  })

  it('hero states value proposition + tracks + SLA', () => {
    const settings = src('src/views/settings.tsx')
    expect(settings).toContain('معرّب ينشر تعريبات الألعاب')
    expect(settings).toContain('ناشر')
    expect(settings).toContain('48 ساعة')
  })

  it('Arabic apply dict rebranded', () => {
    const ar = src('src/lib/studio-i18n/ar.ts')
    expect(ar).toContain('قدّم طلبك للانضمام إلى برنامج منشئ المحتوى')
    expect(ar).toContain('أنت منشئ محتوى بالفعل أو لديك صلاحيات أعلى')
    expect(ar).toContain('لوحة منشئ المحتوى')
    expect(ar).toContain('سبب الرغبة في الانضمام لبرنامج منشئ المحتوى')
  })

  it('English apply dict rebranded', () => {
    const en = src('src/lib/studio-i18n/en.ts')
    expect(en).toContain('Apply to join the Content Creator Program')
    expect(en).toContain('You are already a content creator or hold a higher role')
  })

  it('leaderboard CTAs point at the program', () => {
    expect(src('src/app/leaderboard/creators/page.tsx')).toContain(
      'انضم لبرنامج منشئ المحتوى',
    )
    expect(src('src/app/leaderboard/publishers/page.tsx')).toContain(
      'انضم لبرنامج منشئ المحتوى',
    )
  })
})
