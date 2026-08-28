/**
 * Single source of truth for platform brand colors.
 *
 * Every component that renders a platform color MUST import from here.
 * Never hardcode platform hex values elsewhere.
 */
export const PLATFORM_COLORS = {
  pc:      '#66c0f4',
  xbox360: '#107C10',
  switch:  '#E60012',
  ps5:     '#0E6FFF',
  ps4:     '#0070D1',
  ps3:     '#06b6d4',
  ps2:     '#6366f1',
  ps1:     '#94a3b8',
  android: '#3DDC84',
} as const

export type PlatformKey = keyof typeof PLATFORM_COLORS

/** Map from uppercase platform key (e.g. "PC", "X360") to the canonical key. */
export const PLATFORM_KEY_MAP: Record<string, PlatformKey> = {
  PC:      'pc',
  X360:    'xbox360',
  NS:      'switch',
  PS5:     'ps5',
  PS4:     'ps4',
  PS3:     'ps3',
  PS2:     'ps2',
  PS1:     'ps1',
  ANDROID: 'android',
}

/** Get the brand color for a platform key (case-insensitive). */
export function getPlatformColor(key: string): string {
  const canonical = PLATFORM_KEY_MAP[key.toUpperCase()]
  return canonical ? PLATFORM_COLORS[canonical] : '#94a3b8'
}
