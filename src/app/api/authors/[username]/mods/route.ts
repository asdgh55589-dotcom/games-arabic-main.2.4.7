import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { serialize } from '@/lib/api-utils'
import { ok, notFound } from '@/lib/api-response'
import type { AuthorModsResponse } from '@/lib/types'

// GET /api/authors/[username]/mods - list mods by author username
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ username: string }> },
) {
  const { username } = await params
  const user = await db.user.findFirst({
    where: { username: { equals: username, mode: 'insensitive' } },
    include: {
      mods: {
        orderBy: { downloads: 'desc' },
        include: {
          author: true,
          game: { select: { name: true, slug: true, platform: true } },
          category: { select: { name: true, slug: true } },
        },
      },
    },
  })

  if (!user) {
    return notFound('Author not found')
  }

  // Strip the email field from the response — it's PII we don't want exposed.
  const { email: _email, ...authorWithoutEmail } = user

  return ok<AuthorModsResponse>({
    author: authorWithoutEmail,
    mods: user.mods,
  })
}
