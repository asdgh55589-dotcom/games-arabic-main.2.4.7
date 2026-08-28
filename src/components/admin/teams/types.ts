export interface TeamMember {
  id: string
  name: string
  userId: string | null
  avatarUrl: string | null
  role: string
  bio: string | null
}

export interface TeamContactLinkInput {
  type: string
  label: string
  url: string
}

export interface TeamMod {
  id: string
  name: string
  slug: string
  downloads: number
  endorsements: number
  thumbnailUrl: string
}

export interface TeamCustomTabData {
  id?: string
  title: string
  content: string
  order: number
  visible: boolean
}

export interface TeamAdminData {
  id: string
  slug: string
  name: string
  description: string
  logoUrl: string
  bannerUrl: string
  websiteUrl: string
  discordUrl: string
  ownerId: string | null
  isFeatured: boolean
  isOfficial: boolean
  order: number
  hiddenTabs: string
  memberships: TeamMember[]
  contactLinks: Array<{ id: string; type: string; label: string; url: string; order: number }>
  customTabs: TeamCustomTabData[]
  mods: TeamMod[]
  _count: { mods: number; memberships: number; follows: number }
}
