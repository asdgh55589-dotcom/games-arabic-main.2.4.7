'use client'

import { PLATFORM_KEYS, SOCIAL_PLATFORMS } from '@/lib/social-platforms'

interface ProfileSocialLinksProps {
  websiteUrl?: string | null
  twitterUrl?: string | null
  instagramUrl?: string | null
  tiktokUrl?: string | null
  youtubeUrl?: string | null
  githubUrl?: string | null
}

const URL_MAP: Record<string, string | null | undefined> = {}

export function ProfileSocialLinks({
  websiteUrl,
  twitterUrl,
  instagramUrl,
  tiktokUrl,
  youtubeUrl,
  githubUrl,
}: ProfileSocialLinksProps) {
  const urlMap: Record<string, string | null | undefined> = {
    websiteUrl,
    twitterUrl,
    instagramUrl,
    tiktokUrl,
    youtubeUrl,
    githubUrl,
  }

  const links = PLATFORM_KEYS.map((key) => {
    const platform = SOCIAL_PLATFORMS[key]
    const url = urlMap[platform.column]
    if (!url) return null
    const Icon = platform.icon
    return {
      key,
      icon: <Icon className="h-4 w-4" />,
      url,
      label: platform.label,
    }
  }).filter(Boolean)

  if (links.length === 0) return null

  return (
    <div className="flex items-center gap-2">
      {links.map((link) => (
        <a
          key={link!.key}
          href={link!.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1a1a1a] text-gray-400 transition-colors hover:text-white"
          title={link!.label}
        >
          {link!.icon}
        </a>
      ))}
    </div>
  )
}
