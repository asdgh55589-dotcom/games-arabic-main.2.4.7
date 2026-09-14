/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react'
import { PlatformFieldsSection } from '@/components/shared/platform-fields-section'

const noOp = () => {}

function renderSection(platform = '') {
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
    />,
  )
}

describe('PlatformFieldsSection', () => {
  it('always shows platform selector + translationMethod', () => {
    renderSection('')
    expect(screen.getByText('المنصة')).toBeDefined()
    expect(screen.getByText('طريقة التعريب')).toBeDefined()
  })

  it.each(['PS1', 'PS2'])('shows platformGameId for %s', (pl) => {
    renderSection(pl)
    expect(screen.getByText('معرّف اللعبة (Game ID)')).toBeDefined()
  })

  it('shows PS3 fields', () => {
    renderSection('PS3')
    expect(screen.getByText('معرّف اللعبة (Game ID)')).toBeDefined()
    expect(screen.getByText('رقم تحديث اللعبة المتوافق')).toBeDefined()
  })

  it('shows PS4 fields', () => {
    renderSection('PS4')
    expect(screen.getByText('معرّف اللعبة (CUSA)')).toBeDefined()
    expect(screen.getByText('تحديث النظام المتوافق')).toBeDefined()
    expect(screen.getByText('رقم تحديث اللعبة المتوافق')).toBeDefined()
  })

  it('shows PS5 fields', () => {
    renderSection('PS5')
    expect(screen.getByText('معرّف اللعبة (PPSA)')).toBeDefined()
    expect(screen.getByText('تحديث النظام المتوافق')).toBeDefined()
    expect(screen.getByText('رقم تحديث اللعبة المتوافق')).toBeDefined()
  })

  it('shows Switch fields', () => {
    renderSection('NS')
    expect(screen.getByText('اصدار اللعبه (Title ID)')).toBeDefined()
    expect(screen.getByText('الجهاز')).toBeDefined()
    expect(screen.getByText('رقم التحديث المتوافق')).toBeDefined()
  })

  it('shows Xbox 360 fields', () => {
    renderSection('X360')
    expect(screen.getByText('معرّف اللعبة (Title ID)')).toBeDefined()
    expect(screen.getByText('معرّف الوسائط (Media ID)')).toBeDefined()
    expect(screen.getByText('صيغة اللعبة المدعومة')).toBeDefined()
    expect(screen.getByText('التوافق')).toBeDefined()
  })

  it('shows Android fields', () => {
    renderSection('ANDROID')
    expect(screen.getByText('نوع ملف التثبيت')).toBeDefined()
    expect(screen.getByText('بنية المعالج المتوافقة')).toBeDefined()
    expect(screen.getByText('رقم إصدار اللعبة المتوافق')).toBeDefined()
    expect(screen.getByText('الحد الأدنى لنظام الأندرويد')).toBeDefined()
  })

  it('PC shows no platform-specific extras', () => {
    renderSection('PC')
    expect(screen.getByText('طريقة التعريب')).toBeDefined()
    expect(screen.queryByText('معرّف اللعبة (Game ID)')).toBeNull()
    expect(screen.queryByText('معرّف اللعبة (CUSA)')).toBeNull()
    expect(screen.queryByText('معرّف اللعبة (PPSA)')).toBeNull()
  })

  it('PS4 shows no Android/Switch/Xbox labels', () => {
    renderSection('PS4')
    expect(screen.queryByText('نوع ملف التثبيت')).toBeNull()
    expect(screen.queryByText('اصدار اللعبه (Title ID)')).toBeNull()
    expect(screen.queryByText('معرّف الوسائط (Media ID)')).toBeNull()
  })

  it('ANDROID shows no console labels', () => {
    renderSection('ANDROID')
    expect(screen.queryByText('معرّف اللعبة (CUSA)')).toBeNull()
    expect(screen.queryByText('معرّف اللعبة (PPSA)')).toBeNull()
    expect(screen.queryByText('تحديث النظام المتوافق')).toBeNull()
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
