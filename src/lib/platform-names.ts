/**
 * Platform display names (P2).
 * Database + form values stay English codes (PC, PS5, …).
 * Use these labels for DISPLAY ONLY — Arabic in parentheses.
 */
export const PLATFORM_DISPLAY_NAMES: Record<string, string> = {
  PC: 'PC (حاسوب)',
  PS1: 'PlayStation 1 (بلايستيشن 1)',
  PS2: 'PlayStation 2 (بلايستيشن 2)',
  PS3: 'PlayStation 3 (بلايستيشن 3)',
  PS4: 'PlayStation 4 (بلايستيشن 4)',
  PS5: 'PlayStation 5 (بلايستيشن 5)',
  X360: 'Xbox 360 (إكس بوكس 360)',
  XONE: 'Xbox One (إكس بوكس ون)',
  XSX: 'Xbox Series X|S (إكس بوكس سيريس)',
  NS: 'Nintendo Switch (ننتندو سويتش)',
  Android: 'Android (أندرويد)',
  iOS: 'iOS (آي أو إس)',
}

/** Display label for a platform code — falls back to the raw code. */
export function platformDisplayName(code: string): string {
  return PLATFORM_DISPLAY_NAMES[code] ?? code
}
