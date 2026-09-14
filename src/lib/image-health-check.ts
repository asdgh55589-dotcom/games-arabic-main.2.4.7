import { FetchError } from 'ofetch'
import { db } from '@/lib/db'
import { http } from '@/lib/http'

// المنصات للتناوب الأسبوعي — مطابقة لـ Game.platform الفعلية
const PLATFORMS = ['PC', 'PS3', 'X360', 'NS']

// الحصول على الأسبوع الحالي من الشهر (1-4)
function getCurrentWeekOfMonth(): number {
  const day = new Date().getDate()
  return Math.min(4, Math.ceil(day / 7))
}

// الحصول على يوم العمل الحالي (0-4، السبت=0 ... الأربعاء=4، الخميس/الجمعة=-1)
function getCurrentWorkingDay(): number {
  const jsDay = new Date().getDay() // 0=الأحد ... 6=السبت
  // خريطة: السبت=0، الأحد=1، الإثنين=2، الثلاثاء=3، الأربعاء=4
  const map: Record<number, number> = { 6: 0, 0: 1, 1: 2, 2: 3, 3: 4 }
  return map[jsDay] ?? -1 // -1 = يوم راحة (الخميس/الجمعة)
}

// حساب الدفعة اليومية
export async function getTodayBatch() {
  const week = getCurrentWeekOfMonth()
  const day = getCurrentWorkingDay()

  if (day === -1) {
    return null // يوم راحة
  }

  const platform = PLATFORMS[(week - 1) % PLATFORMS.length]

  // جلب كل التعديلات لهذه المنصة عبر العلاقة مع اللعبة
  const mods = await db.mod.findMany({
    where: { game: { platform } },
    select: {
      id: true,
      name: true,
      slug: true,
      thumbnailUrl: true,
      imageUrl: true,
      galleryUrls: true,
    },
    orderBy: { id: 'asc' },
  })

  const total = mods.length
  if (total === 0) {
    return {
      platform,
      week,
      day,
      total: 0,
      dailyBatch: 0,
      batch: [] as typeof mods,
      progress: { start: 0, end: 0, total: 0 },
    }
  }

  const dailyBatch = Math.ceil(total / 5)
  const start = day * dailyBatch
  const end = Math.min(start + dailyBatch, total)

  return {
    platform,
    week,
    day,
    total,
    dailyBatch,
    batch: mods.slice(start, end),
    progress: { start, end, total },
  }
}

// فحص رابط واحد مع مهلة وإعادة محاولة (عبر ofetch: timeout + retry مدمجان)
export async function checkUrl(url: string, retries = 3): Promise<boolean> {
  if (!url) return false

  try {
    // ofetch يعيد المحاولة تلقائياً للأخطاء المؤقتة (5xx/شبكة) فقط،
    // ويرمي فوراً لـ 404 — نفس سلوك الحلقة اليدوية السابقة.
    await http.raw(url, {
      method: 'HEAD',
      timeout: 5000, // مهلة 5 ثوانٍ
      retry: retries,
      retryDelay: 1000,
    })
    return true
  } catch (err) {
    if (err instanceof FetchError && err.response?.status === 404) return false // مكسور بالتأكيد
    return false
  }
}

// فحص كل صور التعديل — متوافق مع نموذج Mod الفعلي (thumbnailUrl, imageUrl, galleryUrls)
export async function checkModImages(mod: {
  thumbnailUrl?: string | null
  imageUrl?: string | null
  galleryUrls?: string | null
}) {
  const images: { type: string; url: string }[] = []

  if (mod.thumbnailUrl) images.push({ type: 'cover', url: mod.thumbnailUrl })
  if (mod.imageUrl) images.push({ type: 'banner', url: mod.imageUrl })
  if (mod.galleryUrls) {
    const urls = mod.galleryUrls
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    urls.forEach((url: string, i: number) => {
      if (url) images.push({ type: `screenshot_${i}`, url })
    })
  }

  const broken: { type: string; url: string }[] = []

  // فحص بالتوازي (حد أقصى 5 في المرة لكل تعديل)
  for (let i = 0; i < images.length; i += 5) {
    const chunk = images.slice(i, i + 5)
    const results = await Promise.all(
      chunk.map(async (img) => ({
        ...img,
        alive: await checkUrl(img.url),
      })),
    )
    broken.push(...results.filter((r) => !r.alive))
  }

  return broken
}

// مشغل فحص الصحة اليومي
export async function runDailyHealthCheck() {
  const batch = await getTodayBatch()

  if (!batch) {
    console.log('[ImageHealth] يوم راحة — لا فحص اليوم (الخميس/الجمعة)')
    return { skipped: true, reason: 'rest_day' }
  }

  console.log(
    `[ImageHealth] فحص ${batch.platform} — اليوم ${batch.day + 1}/5 — ` +
      `${batch.batch.length} تعريب من ${batch.total}`,
  )

  // إنشاء سجل البداية
  const log = await db.imageHealthLog.create({
    data: {
      platform: batch.platform,
      week: batch.week,
      day: batch.day,
      checked: 0,
      broken: 0,
      modsAffected: 0,
      status: 'in_progress',
    },
  })

  let checked = 0
  let brokenCount = 0
  const brokenMods: Array<{
    mod: (typeof batch.batch)[number]
    broken: Array<{ type: string; url: string }>
  }> = []

  // معالجة بدفعات متوازية من 10 (تحديد التزامن)
  for (let i = 0; i < batch.batch.length; i += 10) {
    const chunk = batch.batch.slice(i, i + 10)
    const results = await Promise.all(
      chunk.map(async (mod) => {
        const broken = await checkModImages(mod)
        return { mod, broken }
      }),
    )

    for (const { mod, broken } of results) {
      checked++
      if (broken.length > 0) {
        brokenCount += broken.length
        brokenMods.push({ mod, broken })

        // تسجيل الصور المكسورة
        await db.brokenImage.createMany({
          data: broken.map((b) => ({
            modId: mod.id,
            imageType: b.type,
            imageUrl: b.url,
          })),
          skipDuplicates: true,
        })
      }
    }
  }

  // تحديث السجل
  await db.imageHealthLog.update({
    where: { id: log.id },
    data: {
      checked,
      broken: brokenCount,
      modsAffected: brokenMods.length,
      completedAt: new Date(),
      status: 'completed',
    },
  })

  // إشعار المسؤولين عند وجود صور مكسورة
  if (brokenMods.length > 0) {
    await notifyAdminsAboutBrokenImages(brokenMods)
  }

  console.log(`[ImageHealth] اكتمل الفحص: ${checked} تعريب، ${brokenCount} صورة مكسورة`)

  return {
    checked,
    brokenCount,
    brokenMods,
    platform: batch.platform,
    week: batch.week,
    day: batch.day,
  }
}

// إشعار المسؤولين
async function notifyAdminsAboutBrokenImages(
  brokenMods: Array<{ mod: { id: string; name: string; slug: string }; broken: unknown[] }>,
) {
  try {
    const admins = await db.user.findMany({
      where: { role: { in: ['admin', 'owner', 'manager'] } },
      select: { id: true },
      take: 10,
    })

    for (const admin of admins) {
      await db.notification.create({
        data: {
          userId: admin.id,
          type: 'admin_report',
          title: '🖼️ صور مكسورة مكتشفة',
          message: `تم اكتشاف ${brokenMods.length} تعريب بصور مكسورة — راجع /admin/images/health`,
          data: { link: '/admin/images/health' } as unknown as string,
        },
      })
    }
  } catch (err) {
    console.error('[ImageHealth] فشل إرسال الإشعارات:', err)
  }
}

// الحصول على حالة الصحة للوحة التحكم
export async function getHealthStatus() {
  const currentWeek = getCurrentWeekOfMonth()
  const currentDay = getCurrentWorkingDay()
  const currentPlatform = PLATFORMS[(currentWeek - 1) % PLATFORMS.length]

  // إحصائيات الشهر الحالي
  const monthStart = new Date()
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)

  const logs = await db.imageHealthLog.findMany({
    where: { createdAt: { gte: monthStart } },
    orderBy: { createdAt: 'desc' },
  })

  const totalChecked = logs.reduce((sum, log) => sum + log.checked, 0)
  const totalBroken = logs.reduce((sum, log) => sum + log.broken, 0)
  const healthPercent = totalChecked > 0 ? ((totalChecked - totalBroken) / totalChecked) * 100 : 100

  // جدول الأسابيع
  const weeklySchedule = PLATFORMS.map((platform, i) => {
    const week = i + 1
    const weekLogs = logs.filter((log) => log.platform === platform)
    const status =
      weekLogs.length === 5
        ? 'complete'
        : week === currentWeek
          ? 'in_progress'
          : week < currentWeek
            ? 'complete'
            : 'pending'
    const broken = weekLogs.reduce((sum, log) => sum + log.broken, 0)

    return { week, platform, status, broken, logsCount: weekLogs.length }
  })

  // الصور المكسورة الحالية
  const brokenImages = await db.brokenImage.findMany({
    where: { status: 'detected' },
    include: {
      mod: { select: { id: true, name: true, slug: true } },
    },
    orderBy: { detectedAt: 'desc' },
    take: 50,
  })

  // سجل الفحوصات الأخيرة (آخر 10)
  const healthLogs = logs.slice(0, 10)

  // تقدم اليوم
  const todayBatch = await getTodayBatch()
  const todayProgress = todayBatch
    ? {
        checked: 0,
        total: todayBatch.total,
        batchSize: todayBatch.dailyBatch,
        currentBatch: todayBatch.batch.length,
      }
    : { checked: 0, total: 0, batchSize: 0, currentBatch: 0 }

  // إذا كان هناك سجل اليوم، استخدم أرقامه
  if (todayBatch) {
    const todayLog = logs.find(
      (l) =>
        l.platform === todayBatch.platform &&
        l.day === todayBatch.day &&
        l.week === todayBatch.week,
    )
    if (todayLog) {
      todayProgress.checked = todayLog.checked
      todayProgress.total = todayBatch.total
    }
  }

  // استخدام Cloudinary (probe حقيقي — لا يُخفي الفشل كأصفار)
  // SA-3 SENTINEL CONTRACT (per src/lib/cloudinary.ts docblock): getCloudinaryUsage()
  // تُرجع { usage:-1, limit:-1, percentUsed:-1 } عند ANY failure (API error OR
  // missing config). الفحص هنا: usage<0 OR percentUsed<0 OR حقل error OR استثناء
  // → unavailable=true مع تطبيع الأصفار للعرض (الشارة 'غير متاح' تُميّزها عن
  // الصفر الحقيقي). configured من isCloudinaryConfigured() للتمييز بين
  // غير مُكوَّن وغير متاح. تُستهلك في /admin/images/health لشارة
  // متصل/غير مُكوَّن/غير متاح.
  let cloudinaryUsage: {
    storage: number
    storagePercent: number
    bandwidth?: number
    transformations?: number
    unavailable?: boolean
    configured?: boolean
  } = {
    storage: 0,
    storagePercent: 0,
    unavailable: false,
    configured: false,
  }
  try {
    const { getCloudinaryUsage, isCloudinaryConfigured } = await import('@/lib/cloudinary')
    const configured =
      typeof isCloudinaryConfigured === 'function' ? isCloudinaryConfigured() : false
    const usage = await getCloudinaryUsage()
    const usageRecord = usage as { usage?: number; percentUsed?: number; error?: unknown }
    const failedProbe =
      (typeof usageRecord.usage === 'number' && usageRecord.usage < 0) ||
      (typeof usageRecord.percentUsed === 'number' && usageRecord.percentUsed < 0) ||
      usageRecord.error != null
    if (failedProbe) {
      cloudinaryUsage = {
        storage: 0,
        storagePercent: 0,
        bandwidth: 0,
        transformations: 0,
        unavailable: true,
        configured,
      }
    } else {
      cloudinaryUsage = {
        storage: usage.usage,
        storagePercent: Math.round(usage.percentUsed * 10) / 10,
        bandwidth: 0,
        transformations: 0,
        unavailable: false,
        configured,
      }
    }
  } catch {
    // فشل الـ probe — لا تُخفيه كأصفار: unavailable=true
    cloudinaryUsage = { ...cloudinaryUsage, unavailable: true }
  }

  return {
    currentWeek,
    currentPlatform,
    currentDay,
    monthlyStats: {
      totalChecked,
      totalBroken,
      healthPercent: Math.round(healthPercent * 10) / 10,
    },
    weeklySchedule,
    brokenImages,
    healthLogs,
    todayProgress,
    cloudinaryUsage,
  }
}

export { getCurrentWeekOfMonth, getCurrentWorkingDay, PLATFORMS }
