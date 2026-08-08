export interface UserItem {
  id: string
  username: string
  email: string
  avatarUrl: string | null
  bio: string | null
  role: string
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
