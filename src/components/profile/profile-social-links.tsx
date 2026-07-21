'use client'

import { Globe, Twitter, Github, MessageSquare } from 'lucide-react'

interface ProfileSocialLinksProps {
  websiteUrl?: string | null
  twitterUrl?: string | null
  githubUrl?: string | null
  discordUrl?: string | null
  accent: string
}

export function ProfileSocialLinks({
  websiteUrl,
  twitterUrl,
  githubUrl,
  discordUrl,
  accent,
}: ProfileSocialLinksProps) {
  const links: { icon: React.ReactNode; url: string; label: string }[] = []

  if (websiteUrl) links.push({ icon: <Globe className="h-4 w-4" />, url: websiteUrl, label: 'الموقع' })
  if (twitterUrl) links.push({ icon: <Twitter className="h-4 w-4" />, url: twitterUrl, label: 'تويتر' })
  if (githubUrl) links.push({ icon: <Github className="h-4 w-4" />, url: githubUrl, label: 'GitHub' })
  if (discordUrl) links.push({ icon: <MessageSquare className="h-4 w-4" />, url: discordUrl, label: 'Discord' })

  if (links.length === 0) return null

  return (
    <div className="flex items-center gap-2">
      {links.map((link, i) => (
        <a
          key={i}
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1a1a1a] text-gray-400 transition-colors hover:text-white"
          style={{ borderColor: '#333' }}
          title={link.label}
        >
          {link.icon}
        </a>
      ))}
    </div>
  )
}
