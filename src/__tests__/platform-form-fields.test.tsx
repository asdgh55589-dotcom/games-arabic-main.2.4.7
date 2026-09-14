/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react'
import { PlatformFieldsSection } from '@/components/shared/platform-fields-section'

const noOp = () => {}

function renderSection(platform = '', hidePlatformSelect = false) {
  return render(
    <PlatformFieldsSection
      platform={platform}
      setPlatform={noOp}
      translationMethod=""
      setTranslationMethod={noOp}
      platformGameId=""
      setPlatformGameId={noOp}
      cusaId=""
      setCusaId={noOp}
      ppsaId=""
      setPpsaId={noOp}
      titleId=""
      setTitleId={noOp}
      mediaId=""
      setMediaId={noOp}
      supportedFormat=""
      setSupportedFormat={noOp}
      systemFirmware=""
      setSystemFirmware={noOp}
      gameUpdateVersion=""
      setGameUpdateVersion={noOp}
      deviceModel=""
      setDeviceModel={noOp}
      installType=""
      setInstallType={noOp}
      cpuArch=""
      setCpuArch={noOp}
      gameVersion=""
      setGameVersion={noOp}
      minAndroidVersion=""
      setMinAndroidVersion={noOp}
      compatibility=""
      setCompatibility={noOp}
      hidePlatformSelect={hidePlatformSelect}
    />,
  )
}

describe('PlatformFieldsSection', () => {
  it('always shows platform selector + translationMethod', () => {
    renderSection('')
    expect(screen.getByText('المنصة')).toBeDefined()
    expect(screen.getByText('طريقة التعريب')).toBeDefined()
  })

  it('hides platform dropdown when hidePlatformSelect is true', () => {
    renderSection('PS4', true)
    // Platform name should be shown in description when hidePlatformSelect is true
    expect(screen.getByText(/ألعاب البلايستيشن 4/)).toBeDefined()
  })

  it.each(['PS1', 'PS2'])('shows platformGameId for %s', (pl) => {
    renderSection(pl)
    expect(screen.getByText('معرّف اللعبة')).toBeDefined()
  })

  it('shows PS3 fields', () => {
    renderSection('PS3')
    expect(screen.getByText('معرّف اللعبة')).toBeDefined()
    expect(screen.getByText('رقم تحديث اللعبة')).toBeDefined()
  })

  it('shows PS4 fields', () => {
    renderSection('PS4')
    expect(screen.getByText('معرّف اللعبة')).toBeDefined()
    expect(screen.getByText('تحديث النظام')).toBeDefined()
    expect(screen.getByText('رقم تحديث اللعبة')).toBeDefined()
  })

  it('shows PS5 fields', () => {
    renderSection('PS5')
    expect(screen.getByText('معرّف اللعبة')).toBeDefined()
    expect(screen.getByText('تحديث النظام')).toBeDefined()
    expect(screen.getByText('رقم تحديث اللعبة')).toBeDefined()
  })

  it('shows Switch fields', () => {
    renderSection('NS')
    expect(screen.getByText('إصدار اللعبة')).toBeDefined()
    expect(screen.getByText('الجهاز')).toBeDefined()
    expect(screen.getByText('رقم التحديث')).toBeDefined()
  })

  it('shows Xbox 360 fields', () => {
    renderSection('X360')
    expect(screen.getByText('معرّف اللعبة')).toBeDefined()
    expect(screen.getByText('معرّف الوسائط')).toBeDefined()
    expect(screen.getByText('الصيغة')).toBeDefined()
    expect(screen.getByText('التوافق')).toBeDefined()
  })

  it('shows Android fields', () => {
    renderSection('ANDROID')
    expect(screen.getByText('نوع التثبيت')).toBeDefined()
    expect(screen.getByText('بنية المعالج')).toBeDefined()
    expect(screen.getByText('إصدار اللعبة')).toBeDefined()
    expect(screen.getByText('الحد الأدنى للأندرويد')).toBeDefined()
  })

  it('PC shows no platform-specific extras', () => {
    renderSection('PC')
    expect(screen.getByText('طريقة التعريب')).toBeDefined()
    expect(screen.queryByText('معرّف اللعبة')).toBeNull()
  })

  it('PS4 shows no Android/Switch/Xbox labels', () => {
    renderSection('PS4')
    expect(screen.queryByText('نوع التثبيت')).toBeNull()
    expect(screen.queryByText('إصدار اللعبة')).toBeNull()
    expect(screen.queryByText('معرّف الوسائط')).toBeNull()
  })

  it('ANDROID shows no console labels', () => {
    renderSection('ANDROID')
    expect(screen.queryByText('تحديث النظام')).toBeNull()
  })

  it('old label نطاق التعريب no longer appears', () => {
    const { container } = renderSection('')
    const all = container.textContent || ''
    expect(all).not.toContain('نطاق التعريب')
  })

  it('old label توافق التعريب no longer appears as form label', () => {
    renderSection('')
    expect(screen.queryByText('توافق التعريب')).toBeNull()
  })
})
