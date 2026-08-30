import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { Card, CardContent } from '@/components/ui/card'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { LeaveTeamButton } from '@/components/teams/leave-team-button'
import { Users, Crown } from 'lucide-react'

interface PageProps {
  params: Promise<{ user: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { user } = await params
  const username = decodeURIComponent(user)
  return {
    title: `فرقي - ${username} | Games Arabic`,
    description: `الفرق التي ينتمي إليها ${username} على Games Arabic`,
  }
}

export default async function MyTeamsPage({ params }: PageProps) {
  const { user: usernameParam } = await params
  const username = decodeURIComponent(usernameParam)

  const user = await db.user.findFirst({
    where: { username: { equals: username, mode: 'insensitive' } },
    select: { id: true, username: true },
  })

  if (!user) notFound()

  const currentUser = await getSession().catch(() => null)
  const isOwnProfile = currentUser?.id === user.id

  // Get all teams where this user is linked (userId = user.id)
  const memberships = await db.teamMembership.findMany({
    where: { userId: user.id },
    include: {
      team: {
        select: {
          id: true,
          slug: true,
          name: true,
          logoUrl: true,
          ownerId: true,
          isOfficial: true,
          _count: { select: { memberships: true, mods: true } },
        },
      },
    },
    orderBy: { joinedAt: 'desc' },
  })

  return (
    <div className="container mx-auto py-8 max-w-4xl px-4" dir="rtl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Users className="h-6 w-6" />
          فرقي
        </h1>
        <p className="text-muted-foreground mt-1">
          {isOwnProfile ? 'الفرق التي أنت عضو فيها' : `الفرق التي ينتمي إليها ${user.username}`}
        </p>
      </div>

      {memberships.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">لست عضواً في أي فريق حالياً</p>
            <p className="text-xs text-muted-foreground mt-1">عندما يربطك مُعَرِّب بفريق، ستظهر فرقك هنا ويمكنك المغادرة في أي وقت</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {memberships.map((m) => {
            const isOwner = m.team.ownerId === user.id

            return (
              <Card key={m.id}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-4 flex-wrap">
                    {/* Team info */}
                    <Link
                      href={`/teams/${m.team.slug}`}
                      className="flex items-center gap-3 flex-1 min-w-0 hover:opacity-80 transition-opacity"
                    >
                      <Avatar className="h-14 w-14 shrink-0">
                        <AvatarImage src={m.team.logoUrl || undefined} />
                        <AvatarFallback>{m.team.name[0]?.toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold truncate">{m.team.name}</span>
                          {m.team.isOfficial && (
                            <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20">
                              رسمي
                            </Badge>
                          )}
                          {isOwner && (
                            <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20">
                              <Crown className="h-3 w-3 ml-1" />
                              المالك
                            </Badge>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground mt-0.5">
                          {m.team._count.memberships} عضو · {m.team._count.mods} تعريب
                        </div>
                        <div className="text-xs text-muted-foreground">
                          انضممت في {new Date(m.joinedAt).toLocaleDateString('ar-EG')}
                        </div>
                      </div>
                    </Link>

                    {/* Leave button — فقط لصاحب الملف ويجب أن يكون مسجلاً */}
                    {isOwnProfile ? (
                      <LeaveTeamButton teamId={m.team.id} teamName={m.team.name} isOwner={isOwner} />
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
