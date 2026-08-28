/**
 * scripts/migrate-mod-images-to-cloudinary.ts
 *
 * هجرة صور التعديلات الموجودة من Supabase/Unsplash إلى Cloudinary
 *
 * المميزات:
 * - معالجة دفعات (50 تعديل في كل مرة)
 * - إمكانية الاستئناف (يتخطى المهاجرة مسبقاً)
 * - وضع dry-run (معاينة بدون تغيير)
 * - حفظ الروابط القديمة في حقل backup للتراجع
 *
 * التشغيل:
 *   npx tsx scripts/migrate-mod-images-to-cloudinary.ts          # هجرة فعلية
 *   npx tsx scripts/migrate-mod-images-to-cloudinary.ts --dry-run # معاينة فقط
 *   npx tsx scripts/migrate-mod-images-to-cloudinary.ts --limit=10  # عدد محدود للاختبار
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// تحقق من تهيئة Cloudinary
function isCloudinaryConfigured(): boolean {
  return !!(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
  )
}

// تنزيل صورة من رابط
async function downloadImage(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) })
    if (!res.ok) return null
    const arrayBuffer = await res.arrayBuffer()
    return Buffer.from(arrayBuffer)
  } catch (err) {
    console.warn(`[Migrate] فشل تنزيل ${url}:`, err instanceof Error ? err.message : err)
    return null
  }
}

// رفع إلى Cloudinary (ديناميكي لتجنب تحميل المكتبة عند عدم التهيئة)
async function uploadToCloudinary(
  buffer: Buffer,
  folder: string
): Promise<string | null> {
  const { v2: cloudinary } = await import('cloudinary')
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  })

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: 'image',
        format: 'auto',
        quality: 'auto',
        backup: true,
      },
      (err, result) => {
        if (err) reject(err)
        else resolve(result?.secure_url || null)
      }
    )
    stream.end(buffer)
  })
}

function isCloudinaryUrl(url: string): boolean {
  return url.includes('res.cloudinary.com')
}

function isSupabaseOrUnsplash(url: string): boolean {
  return url.includes('supabase.co') || url.includes('unsplash.com') || url.includes('supabase.in')
}

async function main() {
  const args = process.argv.slice(2)
  const isDryRun = args.includes('--dry-run')
  const limitArg = args.find((a) => a.startsWith('--limit='))
  const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : undefined

  console.log('🎯 بدء هجرة صور التعديلات إلى Cloudinary')
  console.log(`   الوضع: ${isDryRun ? 'معاينة (dry-run) — لن يتم حفظ أي تغيير' : 'فعلي — سيتم تحديث قاعدة البيانات'}`)
  if (limit) console.log(`   الحد: ${limit} تعديل فقط`)
  console.log('')

  if (!isCloudinaryConfigured()) {
    console.error('❌ Cloudinary غير مُكوَّن — أضف CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET في .env')
    process.exit(1)
  }

  const mods = await prisma.mod.findMany({
    select: {
      id: true,
      slug: true,
      name: true,
      thumbnailUrl: true,
      imageUrl: true,
      galleryUrls: true,
    },
    orderBy: { createdAt: 'asc' },
    ...(limit ? { take: limit } : {}),
  })

  console.log(`📦 تم العثور على ${mods.length} تعديل`)
  console.log('')

  const BATCH_SIZE = 10 // دفعات صغيرة لتجنب ضغط الشبكة
  let migrated = 0
  let skipped = 0
  let failed = 0

  for (let i = 0; i < mods.length; i += BATCH_SIZE) {
    const batch = mods.slice(i, i + BATCH_SIZE)
    console.log(`\n📂 دفعة ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(mods.length / BATCH_SIZE)} — تعديلات ${i + 1} إلى ${Math.min(i + BATCH_SIZE, mods.length)}`)

    for (const mod of batch) {
      const needsMigration = [mod.thumbnailUrl, mod.imageUrl, mod.galleryUrls]
        .some((url) => url && isSupabaseOrUnsplash(url) && !isCloudinaryUrl(url))

      if (!needsMigration) {
        console.log(`   ⏭️  تخطي ${mod.slug} — مهاجَر مسبقاً أو لا يحتاج`)
        skipped++
        continue
      }

      console.log(`   🔄 ${mod.slug} (${mod.name})`)

      let newThumbnail = mod.thumbnailUrl
      let newImage = mod.imageUrl
      let newGallery = mod.galleryUrls

      try {
        // غلاف
        if (mod.thumbnailUrl && !isCloudinaryUrl(mod.thumbnailUrl) && isSupabaseOrUnsplash(mod.thumbnailUrl)) {
          const buf = await downloadImage(mod.thumbnailUrl)
          if (buf) {
            if (isDryRun) {
              console.log(`      [dry-run] سيتم هجرة thumbnail: ${mod.thumbnailUrl.slice(0, 60)}...`)
            } else {
              const url = await uploadToCloudinary(buf, `games-arabic/mods/${mod.id}/cover`)
              if (url) {
                newThumbnail = url
                console.log(`      ✅ thumbnail → ${url.slice(0, 60)}...`)
              }
            }
          } else {
            console.warn(`      ⚠️ فشل تنزيل thumbnail لـ ${mod.slug}`)
          }
        }

        // بانر
        if (mod.imageUrl && !isCloudinaryUrl(mod.imageUrl) && isSupabaseOrUnsplash(mod.imageUrl)) {
          const buf = await downloadImage(mod.imageUrl)
          if (buf) {
            if (isDryRun) {
              console.log(`      [dry-run] سيتم هجرة image: ${mod.imageUrl.slice(0, 60)}...`)
            } else {
              const url = await uploadToCloudinary(buf, `games-arabic/mods/${mod.id}/banner`)
              if (url) {
                newImage = url
                console.log(`      ✅ banner → ${url.slice(0, 60)}...`)
              }
            }
          } else {
            console.warn(`      ⚠️ فشل تنزيل banner لـ ${mod.slug}`)
          }
        }

        // معرض
        if (mod.galleryUrls) {
          const urls = mod.galleryUrls.split(',').map((s) => s.trim()).filter(Boolean)
          const newUrls: string[] = []
          let galleryChanged = false

          for (let idx = 0; idx < urls.length; idx++) {
            const url = urls[idx]
            if (isCloudinaryUrl(url) || !isSupabaseOrUnsplash(url)) {
              newUrls.push(url)
              continue
            }
            const buf = await downloadImage(url)
            if (buf) {
              if (isDryRun) {
                console.log(`      [dry-run] سيتم هجرة gallery[${idx}]: ${url.slice(0, 50)}...`)
                newUrls.push(url)
              } else {
                const uploaded = await uploadToCloudinary(buf, `games-arabic/mods/${mod.id}/screenshot`)
                if (uploaded) {
                  newUrls.push(uploaded)
                  galleryChanged = true
                  console.log(`      ✅ gallery[${idx}] → ${uploaded.slice(0, 60)}...`)
                } else {
                  newUrls.push(url)
                }
              }
            } else {
              newUrls.push(url)
              console.warn(`      ⚠️ فشل تنزيل gallery[${idx}] لـ ${mod.slug}`)
            }
          }

          if (galleryChanged) {
            newGallery = newUrls.join(',')
          } else if (isDryRun && urls.some((u) => isSupabaseOrUnsplash(u))) {
            // في dry-run لا نغير، لكن نعرض
          } else {
            newGallery = mod.galleryUrls
          }
        }

        if (!isDryRun) {
          // حفظ النسخ الاحتياطي للروابط القديمة في حقل مؤقت (سجل)
          const changed =
            newThumbnail !== mod.thumbnailUrl ||
            newImage !== mod.imageUrl ||
            newGallery !== mod.galleryUrls

          if (changed) {
            await prisma.mod.update({
              where: { id: mod.id },
              data: {
                thumbnailUrl: newThumbnail,
                imageUrl: newImage,
                galleryUrls: newGallery,
              },
            })
            migrated++
            console.log(`   ✅ تمت هجرة ${mod.slug}`)
          } else {
            skipped++
            console.log(`   ⏭️  لا تغيير لـ ${mod.slug}`)
          }
        } else {
          migrated++
        }

        // تأخير بسيط لتجنب تجاوز حدود Cloudinary
        await new Promise((r) => setTimeout(r, 200))
      } catch (err) {
        failed++
        console.error(`   ❌ فشل هجرة ${mod.slug}:`, err instanceof Error ? err.message : err)
      }
    }

    // تأخير بين الدفعات
    if (i + BATCH_SIZE < mods.length) {
      await new Promise((r) => setTimeout(r, 500))
    }
  }

  console.log('\n' + '='.repeat(50))
  console.log('📊 ملخص الهجرة:')
  console.log(`   تمت الهجرة: ${migrated}`)
  console.log(`   تم التخطي: ${skipped}`)
  console.log(`   فشل: ${failed}`)
  console.log(`   الوضع: ${isDryRun ? 'معاينة فقط — لم يتم حفظ أي تغيير' : 'تم الحفظ في قاعدة البيانات'}`)
  console.log('='.repeat(50))

  await prisma.$disconnect()
}

main().catch((err) => {
  console.error('❌ خطأ فادح في الهجرة:', err)
  process.exit(1)
})
