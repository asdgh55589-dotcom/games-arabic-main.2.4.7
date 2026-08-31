import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { getOptionalSession } from '@/lib/auth'
import { sanitizeUrl } from '@/lib/sanitize'
import { ok, notFound, unauthorized, forbidden, conflict, internalError, validationFail } from '@/lib/api-response'

interface RouteParams {
  params: Promise<{ username: string }>
}

// GET /api/users/[username]/profile — بيانات الملف الشخصي
export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    const { username } = await params
    const viewer = await getOptionalSession()

    const user = await db.user.findFirst({
      where: { username: { equals: username, mode: 'insensitive' } },
      select: {
        id: true,
        username: true,
        displayName: true,
        firstName: true,
        lastName: true,
        avatarUrl: true,
        bannerUrl: true,
        bio: true,
        websiteUrl: true,
        twitterUrl: true,
        instagramUrl: true,
        tiktokUrl: true,
        youtubeUrl: true,
        githubUrl: true,
        discordUrl: true,
        accentColor: true,
        profileVisibility: true,
        hideJoinDate: true,
        role: true,
        joinedAt: true,
        lastLoginAt: true,
        tier: true,
        specialRoles: true,
        qualityScore: true,
        _count: {
          select: {
            mods: true,
            comments: true,
            endorsements: true,
          },
        },
      },
    })

    if (!user) {
      return notFound()
    }

    const isOwner = viewer?.id === user.id

    if (!isOwner && user.profileVisibility === 'nobody') {
      return forbidden('Profile is private')
    }

    if (!isOwner && user.profileVisibility === 'followers') {
      if (!viewer) {
        return forbidden('Followers only')
      }

      const follow = await db.follow.findFirst({
        where: {
          followerId: viewer.id,
          followingId: user.id,
        },
        select: { id: true },
      })

      if (!follow) {
        return forbidden('Followers only')
      }
    }

    // حساب الإحصائيات
    const mods = await db.mod.findMany({
      where: { authorId: user.id },
      select: { downloads: true, endorsements: true, views: true },
    })

    const totalDownloads = mods.reduce((s, m) => s + m.downloads, 0)
    const totalEndorsements = mods.reduce((s, m) => s + m.endorsements, 0)
    const totalViews = mods.reduce((s, m) => s + m.views, 0)

    // هل المستخدم معرب؟ أي شخص نشر تعريب أو لديه دور إداري
    const isTranslator = user._count.mods > 0 || ['owner', 'admin', 'moderator'].includes(user.role)

    // تاريخ أول تعريب
    let firstModDate: string | null = null
    if (isTranslator) {
      const firstMod = await db.mod.findFirst({
        where: { authorId: user.id },
        orderBy: { createdAt: 'asc' },
        select: { createdAt: true },
      })
      firstModDate = firstMod?.createdAt.toISOString() || null
    }

    // عدد المتابعين والمتابَعين
    const [followersCount, followingCount] = await Promise.all([
      db.follow.count({ where: { followingId: user.id } }),
      db.follow.count({ where: { followerId: user.id } }),
    ])

    // حالة الاتصال
    const now = new Date()
    const onlineStatus =
      user.lastLoginAt && now.getTime() - user.lastLoginAt.getTime() < 5 * 60 * 1000
        ? 'online'
        : 'offline'

    // نظام XP
    const xpPoints = totalDownloads + totalEndorsements
    const xpLevels = [
      { name: 'مبتدئ', nameEn: 'Beginner', max: 100 },
      { name: 'متعلم', nameEn: 'Learner', max: 300 },
      { name: 'ماهر', nameEn: 'Skilled', max: 600 },
      { name: 'محترف', nameEn: 'Professional', max: 1000 },
      { name: 'خبير', nameEn: 'Expert', max: Infinity },
    ]
    const levelIndex = xpLevels.findIndex((l) => xpPoints <= l.max)
    const xpLevel = {
      level: levelIndex + 1,
      name: xpLevels[levelIndex].name,
      nameEn: xpLevels[levelIndex].nameEn,
      points: xpPoints,
    }
    const prevMax = levelIndex > 0 ? xpLevels[levelIndex - 1].max : 0
    const currMax = xpLevels[levelIndex].max
    const xpProgress =
      currMax === Infinity
        ? 100
        : Math.round(((xpPoints - prevMax) / (currMax - prevMax)) * 100)

    return ok(
      {
        profile: {
          ...user,
          stats: {
            mods: user._count.mods,
            totalDownloads,
            totalEndorsements,
            totalViews,
            followersCount,
            followingCount,
          },
          onlineStatus,
          xp: { ...xpLevel, progress: xpProgress },
          isTranslator,
          firstModDate,
          rating: user.qualityScore,
        },
      },
      {
        headers: { 'Cache-Control': 'public, max-age=30, stale-while-revalidate=60' },
      }
    )
  } catch (err: any) {
    console.error('[profile GET] failed:', err?.message, err?.stack)
    return internalError('Failed')
  }
}

// PUT /api/users/[username]/profile — تعديل الملف الشخصي
export async function PUT(req: NextRequest, { params }: RouteParams) {
  try {
    const body = await req.json()
    const { username } = await params
    console.log('[API] Profile PUT - username:', username, 'fields:', Object.keys(body))
    const neonUser = await getOptionalSession()
    if (!neonUser) {
      return unauthorized()
    }

    // فقط صاحب الملف يمكنه التعديل — مقارنة غير حساسة لحالة الأحرف
    if (neonUser.username.toLowerCase() !== username.toLowerCase()) {
      return forbidden()
    }

    const updateData: Record<string, string | null | boolean> = {}

    // Handle username change separately — فحص غير حساس لحالة الأحرف
    if (body.username && body.username.toLowerCase() !== neonUser.username.toLowerCase()) {
      const existingUser = await db.user.findFirst({ where: { username: { equals: body.username, mode: 'insensitive' } } })
      if (existingUser) {
        return conflict('Username already taken')
      }
      updateData.username = body.username
    }

    const allowedFields = ['displayName', 'firstName', 'lastName', 'bio', 'websiteUrl', 'twitterUrl', 'instagramUrl', 'tiktokUrl', 'youtubeUrl', 'githubUrl', 'discordUrl', 'accentColor', 'avatarUrl', 'bannerUrl', 'profileVisibility', 'hideJoinDate']
    const urlFields = ['websiteUrl', 'twitterUrl', 'instagramUrl', 'tiktokUrl', 'youtubeUrl', 'githubUrl', 'discordUrl']
    const booleanFields = ['hideJoinDate']
    const nullableFields = ['avatarUrl', 'bannerUrl', 'displayName', 'firstName', 'lastName']
    const allowedVisibility = ['everyone', 'followers', 'nobody']

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        if (field === 'profileVisibility') {
          if (!allowedVisibility.includes(body[field])) {
            return validationFail('Invalid profile visibility')
          }

          updateData[field] = body[field]
          continue
        }

        if (field === 'accentColor') {
          const value = String(body[field] || '').trim()

          if (value && !/^#([0-9A-F]{3}){1,2}$/i.test(value)) {
            return validationFail('Invalid accent color')
          }

          updateData[field] = value || null
          continue
        }

        if (booleanFields.includes(field)) {
          updateData[field] = Boolean(body[field])
        } else if (nullableFields.includes(field)) {
          updateData[field] = body[field]
        } else {
          const value = body[field] || null
          if (urlFields.includes(field) && value) {
            updateData[field] = sanitizeUrl(value) || null
          } else {
            updateData[field] = value
          }
        }
      }
    }

    const updatedUser = await db.user.update({
      where: { id: neonUser.id },
      data: updateData,
      select: {
        id: true,
        username: true,
        displayName: true,
        firstName: true,
        lastName: true,
        bio: true,
        websiteUrl: true,
        twitterUrl: true,
        instagramUrl: true,
        tiktokUrl: true,
        youtubeUrl: true,
        githubUrl: true,
        discordUrl: true,
        accentColor: true,
        avatarUrl: true,
        bannerUrl: true,
        profileVisibility: true,
        hideJoinDate: true,
      },
    })

    return ok({ profile: updatedUser })
  } catch (err: any) {
    console.error('[profile PUT] failed:', err?.message, err?.stack)
    return internalError('Failed')
  }
}
