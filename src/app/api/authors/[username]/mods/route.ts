import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { serialize } from '@/lib/api-utils'
import type { AuthorModsResponse, ApiError } from '@/lib/types'

// GET /api/authors/[username]/mods - list mods by author username
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params
  const user = await db.user.findUnique({
    where: { username },
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
    return NextResponse.json<ApiError>(
      { error: 'Author not found' },
      { status: 404 }
    )
  }

  // Strip the email field from the response — it's PII we don't want exposed.
  const { email: _email, ...authorWithoutEmail } = user

  return NextResponse.json<AuthorModsResponse>({
    author: authorWithoutEmail,
    mods: user.mods,
  })
}
