import { cookies } from 'next/headers'
import { ar } from './ar'
import { en } from './en'
import type { StudioDict, StudioDir, StudioLocale } from './types'

export const STUDIO_LOCALE_COOKIE = 'studio-locale'

/** Server-side locale for studio pages (reads the mirrored cookie, AR default). */
export async function getStudioLocale(): Promise<StudioLocale> {
  try {
    const store = await cookies()
    return store.get(STUDIO_LOCALE_COOKIE)?.value === 'en' ? 'en' : 'ar'
  } catch {
    return 'ar'
  }
}

export async function getStudioDict(): Promise<{
  locale: StudioLocale
  dir: StudioDir
  dict: StudioDict
}> {
  const locale = await getStudioLocale()
  return { locale, dir: locale === 'ar' ? 'rtl' : 'ltr', dict: locale === 'en' ? en : ar }
}
