import type { NextRequest } from 'next/server'
import { notFound, ok } from '@/lib/api-response'
import { serialize } from '@/lib/api-utils'
import { db } from '@/lib/db'
import { authorPublicSelect, modCardSelect } from '@/lib/prisma-selects'
import type { AuthorModsResponse } from '@/lib/types'

// GET /api/authors/[username]/mods - list mods by author username
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ username: string }> },
) {
  const { username } = await params
  const user = await db.user.findFirst({
    where: { username: { equals: username, mode: 'insensitive' } },
    select: {
      ...authorPublicSelect,
      mods: {
        orderBy: { downloads: 'desc' },
        select: modCardSelect,
      },
    },
  })

  if (!user) {
    return notFound('Author not found')
  }

  const { mods, ...author } = user

  return ok<AuthorModsResponse>({
    author,
    mods,
  })
}
