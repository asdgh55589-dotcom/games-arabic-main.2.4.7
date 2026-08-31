export interface UserItem {
  id: string
  username: string
  displayName: string | null
  firstName: string | null
  lastName: string | null
  email: string
  avatarUrl: string | null
  bio: string | null
  role: string
  tier?: number | null
  specialRoles?: string | null
  bannedUntil: string | null
  banStatus: string | null
  banReason: string | null
  bannedAt: string | null
  lastLoginAt: string | null
  loginCount: number
  joinedAt: string
  _count: {
    mods: number
    comments: number
    endorsements: number
  }
}
