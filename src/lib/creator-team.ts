import { db } from '@/lib/db'

export interface OwnedTeam {
  id: string
  slug: string
  name: string
  description: string
  logoUrl: string
  bannerUrl: string
  websiteUrl: string
  telegramUrl: string
  ownerId: string | null
  modCount: number
  createdAt: Date
  updatedAt: Date
}

/** Return the team owned by this user, or null. Single-team invariant is app-enforced. */
export async function getOwnedTeam(userId: string): Promise<OwnedTeam | null> {
  const team = await db.team.findFirst({
    where: { ownerId: userId },
    select: {
      id: true,
      slug: true,
      name: true,
      description: true,
      logoUrl: true,
      bannerUrl: true,
      websiteUrl: true,
      telegramUrl: true,
      ownerId: true,
      modCount: true,
      createdAt: true,
      updatedAt: true,
    },
  })
  return team
}

/** Load owned team or return null when the caller owns none. Callers map null → 404 empty-state contract. */
export async function requireTeamOwner(userId: string): Promise<OwnedTeam | null> {
  return getOwnedTeam(userId)
}
