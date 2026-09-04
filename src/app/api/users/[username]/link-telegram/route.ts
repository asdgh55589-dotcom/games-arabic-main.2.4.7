import type { NextRequest } from 'next/server'
import { forbidden, internalError, ok, unauthorized, validationFail } from '@/lib/api-response'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { isAuthDateValid, verifyTelegramAuth } from '@/lib/telegram-verify'

interface RouteParams {
  params: Promise<{ username: string }>
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const { username } = await params
    const session = await getSession().catch(() => null)
    if (!session) {
      return unauthorized()
    }

    // فقط صاحب الحساب يمكنه الربط
    if (session.username.toLowerCase() !== username.toLowerCase()) {
      return forbidden('ليس لديك صلاحية ربط هذا الحساب')
    }

    const body = await req.json()
    const { id, first_name, last_name, username: tgUsername, photo_url, auth_date, hash } = body

    if (!id || !hash || !auth_date) {
      return validationFail({ message: 'بيانات Telegram غير مكتملة' })
    }

    if (!isAuthDateValid(auth_date)) {
      return validationFail({ message: 'انتهت صلاحية بيانات Telegram' })
    }

    const dataForVerify: Record<string, string> = {}
    if (id) dataForVerify.id = String(id)
    if (first_name) dataForVerify.first_name = String(first_name)
    if (last_name) dataForVerify.last_name = String(last_name)
    if (tgUsername) dataForVerify.username = String(tgUsername)
    if (photo_url) dataForVerify.photo_url = String(photo_url)
    dataForVerify.auth_date = String(auth_date)
    dataForVerify.hash = String(hash)

    if (!verifyTelegramAuth(dataForVerify)) {
      return validationFail({ message: 'بيانات Telegram غير صحيحة' })
    }

    const telegramId = String(id)

    // تحقق إذا كان حساب Telegram مرتبط بمستخدم آخر
    const existing = await db.oAuthAccount.findFirst({
      where: {
        provider: 'telegram',
        providerAccountId: telegramId,
      },
    })

    if (existing) {
      if (existing.userId === session.id) {
        return ok({ message: 'حسابك مرتبط بالفعل' })
      }
      return validationFail({ message: 'هذا الحساب مرتبط بمستخدم آخر' })
    }

    // تحقق إذا كان المستخدم الحالي لديه ربط سابق
    const alreadyLinked = await db.oAuthAccount.findFirst({
      where: {
        userId: session.id,
        provider: 'telegram',
      },
    })

    if (alreadyLinked) {
      return validationFail({ message: 'لديك حساب Telegram مرتبط بالفعل' })
    }

    await db.oAuthAccount.create({
      data: {
        userId: session.id,
        provider: 'telegram',
        providerAccountId: telegramId,
        providerEmail: `telegram_${telegramId}@telegram.local`,
        providerUsername: tgUsername || null,
        avatarUrl: photo_url || null,
      },
    })

    // تحديث صورة المستخدم إذا لم يكن لديه صورة
    if (photo_url) {
      const currentUser = await db.user.findUnique({
        where: { id: session.id },
        select: { avatarUrl: true },
      })
      if (currentUser && !currentUser.avatarUrl) {
        await db.user.update({
          where: { id: session.id },
          data: { avatarUrl: photo_url },
        })
      }
    }

    return ok({ success: true, message: 'تم ربط حساب Telegram بنجاح' })
  } catch (err) {
    console.error('[link-telegram] failed:', err)
    return internalError('حدث خطأ أثناء ربط الحساب')
  }
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const { username } = await params
    const session = await getSession().catch(() => null)
    if (!session) {
      return unauthorized()
    }

    if (session.username.toLowerCase() !== username.toLowerCase()) {
      return forbidden('ليس لديك صلاحية إلغاء ربط هذا الحساب')
    }

    const deleted = await db.oAuthAccount.deleteMany({
      where: {
        userId: session.id,
        provider: 'telegram',
      },
    })

    if (deleted.count === 0) {
      return validationFail({ message: 'لا يوجد حساب Telegram مرتبط' })
    }

    return ok({ success: true, message: 'تم إلغاء ربط Telegram بنجاح' })
  } catch (err) {
    console.error('[unlink-telegram] failed:', err)
    return internalError('حدث خطأ أثناء إلغاء الربط')
  }
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { username } = await params
    const session = await getSession().catch(() => null)
    if (!session) {
      return unauthorized()
    }

    if (session.username.toLowerCase() !== username.toLowerCase()) {
      return forbidden('ليس لديك صلاحية عرض حالة الربط')
    }

    const linked = await db.oAuthAccount.findFirst({
      where: {
        userId: session.id,
        provider: 'telegram',
      },
      select: {
        providerAccountId: true,
        providerUsername: true,
        avatarUrl: true,
        createdAt: true,
      },
    })

    return ok({ linked: !!linked, account: linked || null })
  } catch (err) {
    console.error('[link-telegram GET] failed:', err)
    return internalError('حدث خطأ')
  }
}
