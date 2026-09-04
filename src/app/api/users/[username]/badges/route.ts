import type { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { ok, notFound, internalError } from '@/lib/api-response'

interface RouteParams {
  params: Promise<{ username: string }>
}

interface Badge {
  id: string
  name: string
  description: string
  icon: string
  earned: boolean
}

// GET /api/users/[username]/badges — شارات المستخدم
export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    const { username } = await params

    const user = await db.user.findFirst({
      where: { username: { equals: username, mode: 'insensitive' } },
      select: {
        id: true,
        role: true,
        mods: { select: { id: true, endorsements: true, downloads: true } },
        _count: { select: { endorsements: true, comments: true } },
      },
    })
    if (!user) {
      return notFound()
    }

    const modCount = user.mods.length
    const totalEndorsements = user.mods.reduce((s, m) => s + m.endorsements, 0)
    const totalDownloads = user.mods.reduce((s, m) => s + m.downloads, 0)

    const badges: Badge[] = [
      {
        id: 'first_mod',
        name: 'مترجم مبتدئ',
        description: 'نشر أول تعريب',
        icon: '🌱',
        earned: modCount >= 1,
      },
      {
        id: 'active_translator',
        name: 'مترجم نشط',
        description: 'نشر 5 تعريبات',
        icon: '⭐',
        earned: modCount >= 5,
      },
      {
        id: 'pro_translator',
        name: 'مترجم محترف',
        description: 'نشر 10 تعريبات',
        icon: '🏆',
        earned: modCount >= 10,
      },
      {
        id: 'endorsement_star',
        name: 'شهادة التميز',
        description: 'حصل على 100 تأييد',
        icon: '🏅',
        earned: totalEndorsements >= 100,
      },
      {
        id: 'top_downloads',
        name: 'الأكثر تحميلاً',
        description: 'حصل على 1000+ تحميل',
        icon: '🚀',
        earned: totalDownloads >= 1000,
      },
      {
        id: 'founder',
        name: 'مؤسس',
        description: 'مالك الموقع',
        icon: '👑',
        earned: user.role === 'owner',
      },
      {
        id: 'moderator',
        name: 'مشرف',
        description: 'مشرف الموقع',
        icon: '🛡️',
        earned: user.role === 'moderator',
      },
      {
        id: 'admin',
        name: 'مدير',
        description: 'مدير الموقع',
        icon: '🔧',
        earned: user.role === 'admin',
      },
    ]

    return ok(
      { badges },
      { headers: { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=120' } },
    )
  } catch (err) {
    console.error('[badges GET] failed:', err)
    return internalError('Failed')
  }
}
