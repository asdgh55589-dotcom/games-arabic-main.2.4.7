import { Globe } from 'lucide-react'
import type { IconType } from 'react-icons'
import {
  SiGithub,
  SiInstagram,
  SiTelegram,
  SiTiktok,
  SiX,
  SiYoutube,
} from 'react-icons/si'

export interface SocialPlatform {
  label: string
  icon: IconType
  column: string
  placeholder: string
}

export const SOCIAL_PLATFORMS: Record<string, SocialPlatform> = {
  twitter: {
    label: 'X (Twitter)',
    icon: SiX,
    column: 'twitterUrl',
    placeholder: 'https://x.com/username',
  },
  instagram: {
    label: 'Instagram',
    icon: SiInstagram,
    column: 'instagramUrl',
    placeholder: 'https://instagram.com/username',
  },
  tiktok: {
    label: 'TikTok',
    icon: SiTiktok,
    column: 'tiktokUrl',
    placeholder: 'https://tiktok.com/@username',
  },
  youtube: {
    label: 'YouTube',
    icon: SiYoutube,
    column: 'youtubeUrl',
    placeholder: 'https://youtube.com/@channel',
  },
  github: {
    label: 'GitHub',
    icon: SiGithub,
    column: 'githubUrl',
    placeholder: 'https://github.com/username',
  },
  telegram: {
    label: 'Telegram',
    icon: SiTelegram,
    column: 'telegramUrl',
    placeholder: 'https://t.me/channel',
  },
  website: {
    label: 'الموقع الشخصي',
    icon: Globe,
    column: 'websiteUrl',
    placeholder: 'https://example.com',
  },
} as const

export const PLATFORM_KEYS = Object.keys(SOCIAL_PLATFORMS) as string[]

export function getColumnForPlatform(key: string): string | undefined {
  return SOCIAL_PLATFORMS[key]?.column
}

export function getPlatformKeyForColumn(column: string): string | undefined {
  return PLATFORM_KEYS.find((key) => SOCIAL_PLATFORMS[key].column === column)
}
