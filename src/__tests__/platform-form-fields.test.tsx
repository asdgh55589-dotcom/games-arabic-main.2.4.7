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
  it('always shows platform selector (method + compat live in basic info)', () => {
    renderSection('')
    expect(screen.getByText('المنصة')).toBeDefined()
    expect(screen.queryByText('طريقة التعريب')).toBeNull()
  })

  it('hides platform dropdown when hidePlatformSelect is true', () => {
    renderSection('PS4', true)
    // No dropdown, no indicator line, no PS4 extras (fields live in basic info)
    expect(screen.queryByText('المنصة')).toBeNull()
    expect(screen.queryByText('معرّف اللعبة (CUSA)')).toBeNull()
  })

  it.each(['PS1', 'PS2'])('shows no extras in platform section for %s (Game ID lives in basic info)', (pl) => {
    renderSection(pl)
    expect(screen.queryByText('معرّف اللعبة (Game ID)')).toBeNull()
  })

  it('PS3 shows no extras in platform section (fields live in basic info)', () => {
    renderSection('PS3')
    expect(screen.queryByText('معرّف اللعبة')).toBeNull()
    expect(screen.queryByText('رقم تحديث اللعبة المتوافق')).toBeNull()
  })

  it('PS4 shows no extras in platform section (fields live in basic info)', () => {
    renderSection('PS4')
    expect(screen.queryByText('معرّف اللعبة (CUSA)')).toBeNull()
    expect(screen.queryByText('تحديث النظام المتوافق')).toBeNull()
  })

  it('PS5 shows no extras in platform section (fields live in basic info)', () => {
    renderSection('PS5')
    expect(screen.queryByText('معرّف اللعبة (PPSA)')).toBeNull()
    expect(screen.queryByText('تحديث النظام المتوافق')).toBeNull()
  })

  it('NS shows no extras in platform section (fields live in basic info)', () => {
    renderSection('NS')
    expect(screen.queryByText('إصدار اللعبة')).toBeNull()
    expect(screen.queryByText('الجهاز')).toBeNull()
  })

  it('X360 shows no extras in platform section (fields live in basic info)', () => {
    renderSection('X360')
    expect(screen.queryByText('معرّف اللعبة (Title ID)')).toBeNull()
    expect(screen.queryByText('معرّف الوسائط (Media ID)')).toBeNull()
  })

  it('ANDROID shows no extras in platform section (fields live in basic info)', () => {
    renderSection('ANDROID')
    expect(screen.queryByText('نوع ملف التثبيت')).toBeNull()
    expect(screen.queryByText('بنية المعالج المتوافقة')).toBeNull()
  })

  it('PC shows no platform-specific extras', () => {
    renderSection('PC')
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
