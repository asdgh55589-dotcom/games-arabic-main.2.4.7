import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// ===== EXPANDED GAMES =====
const EXPANDED_GAMES = [
  {
    slug: 'red-dead-redemption-2',
    name: 'Red Dead Redemption 2',
    tagline: 'مغامرة رعاة الغرب الأمريكي',
    description: 'لعبة أكشن مغامرات مفتوحة العالم من Rockstar Games. تتبع حياة آرثر مورغان و GANG Van der Linde في عام 1899.',
    category: 'Adventure',
    platform: 'PS4',
    releaseYear: 2018,
    bannerUrl: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=1200&h=400&fit=crop',
    thumbnailUrl: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=400&h=300&fit=crop',
    logoUrl: '',
    featured: true,
  },
  {
    slug: 'bloodborne',
    name: 'Bloodborne',
    tagline: 'رعب وصيد في عالم مظلم',
    description: 'لعبة أكشن RPG من تطوير FromSoftware. استكشاف مدينة Yharnam الملعونة والتصديق للكائنات المرعبة.',
    category: 'RPG',
    platform: 'PS4',
    releaseYear: 2015,
    bannerUrl: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=1200&h=400&fit=crop',
    thumbnailUrl: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=400&h=300&fit=crop',
    logoUrl: '',
    featured: false,
  },
  {
    slug: 'shadow-of-colossus',
    name: 'Shadow of the Colossus',
    tagline: 'معركة العملاقين',
    description: 'لعبة أكشن مغامرات خيالية. الصعود على 16 عملاقاً لإنقاذ فتاة محبوبة.',
    category: 'Adventure',
    platform: 'PS4',
    releaseYear: 2018,
    bannerUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=1200&h=400&fit=crop',
    thumbnailUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=400&h=300&fit=crop',
    logoUrl: '',
    featured: false,
  },
  {
    slug: 'final-fantasy-7-remake',
    name: 'Final Fantasy VII Remake',
    tagline: 'إعادة صنع الكلاسيكية الخالدة',
    description: 'لعبة RPG من تطوير Square Enix. إعادة إصدار لـ Final Fantasy VII الأصلية برسومات حديثة.',
    category: 'RPG',
    platform: 'PS4',
    releaseYear: 2020,
    bannerUrl: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=1200&h=400&fit=crop',
    thumbnailUrl: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=400&h=300&fit=crop',
    logoUrl: '',
    featured: true,
  },
  {
    slug: 'persona-5',
    name: 'Persona 5 Royal',
    tagline: 'حياة المدرسة والمحاربين السريين',
    description: 'لعبة RPG يابانية من Atlus. قصة طلاب يحاربون الأشرار في عالم آخر.',
    category: 'RPG',
    platform: 'PS4',
    releaseYear: 2019,
    bannerUrl: 'https://images.unsplash.com/photo-1635805737707-575885ab0820?w=1200&h=400&fit=crop',
    thumbnailUrl: 'https://images.unsplash.com/photo-1635805737707-575885ab0820?w=400&h=300&fit=crop',
    logoUrl: '',
    featured: false,
  },
  {
    slug: 'zelda-tears',
    name: 'The Legend of Zelda: Tears of the Kingdom',
    tagline: 'عودة لينك في مغامرة جديدة',
    description: 'لعبة أكشن مغامرات من Nintendo. مغامرة جديدة في عالم هايلو مع قدرات جديدة.',
    category: 'Adventure',
    platform: 'NS',
    releaseYear: 2023,
    bannerUrl: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=1200&h=400&fit=crop',
    thumbnailUrl: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=400&h=300&fit=crop',
    logoUrl: '',
    featured: true,
  },
  {
    slug: 'super-mario-odyssey',
    name: 'Super Mario Odyssey',
    tagline: 'مغامرة ماريو حول العالم',
    description: 'لعبة منصات كلاسيكية من Nintendo. رحلة ماريو لإنقاذ الأميرة بيتش.',
    category: 'Platformer',
    platform: 'NS',
    releaseYear: 2017,
    bannerUrl: 'https://images.unsplash.com/photo-1635805737707-575885ab0820?w=1200&h=400&fit=crop',
    thumbnailUrl: 'https://images.unsplash.com/photo-1635805737707-575885ab0820?w=400&h=300&fit=crop',
    logoUrl: '',
    featured: false,
  },
  {
    slug: 'metal-gear-solid-5',
    name: 'Metal Gear Solid V: The Phantom Pain',
    tagline: 'عميل سري في مهمة أخيرة',
    description: 'لعبة أكشن تسلل من Hideo Kojima. مهمة أخيرة لـ Big Boss في عالم مفتوح.',
    category: 'Action',
    platform: 'PS4',
    releaseYear: 2015,
    bannerUrl: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=1200&h=400&fit=crop',
    thumbnailUrl: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=400&h=300&fit=crop',
    logoUrl: '',
    featured: false,
  },
]

// ===== EXPANDED MODS =====
const EXPANDED_MOD_TEMPLATES = [
  { name: 'تعريب كامل احترافي', summary: 'ترجمة شاملة ومحترفة لجميع نصوص اللعبة', description: 'هذا التعريب يمثل أشهر عمل من فريق Games in Arabic. ترجمة دقيقة تحافظ على روح اللعبة الأصلية مع جعل النص العربي سلساً ومريحاً للقراءة.', version: '3.0.0', fileSize: '55 MB', fileFormat: '7z', tags: 'احترافي,كامل,جودة عالية', translationType: 'unofficial' },
  { name: 'تعريب قصة محسّن', summary: 'ترجمة محسّنة للحوارات مع الحفاظ على السياق الثقافي', description: 'مراجعة شاملة لترجمة القصة مع تحسين الأسلوب العربي وجعل الحوارات أكثر طبيعية.', version: '2.1.0', fileSize: '42 MB', fileFormat: 'zip', tags: 'قصة,تحسين,حوارات', translationType: 'unofficial' },
  { name: 'حزمة تعريب شاملة', summary: 'جميع الترجمات في حزمة واحدة', description: 'يحتوي على ترجمة واجهة المستخدم والقصة والمهام الجانبية في حزمة واحدة.', version: '1.5.0', fileSize: '48 MB', fileFormat: '7z', tags: 'شامل,حزمة,كامل', translationType: 'unofficial' },
  { name: ' تعريب فصحى سهلة', summary: 'ترجمة بلغة عربية سهلة ومفهومة', description: 'ترجمة بلغة عربية فصحى لكن بأسلوب سهل ومفهوم للجميع.', version: '1.2.0', fileSize: '38 MB', fileFormat: 'zip', tags: 'فصحى,سهل,مفهوم', translationType: 'unofficial' },
  { name: 'تعريب مع شرح المفردات', summary: 'ترجمة مع شرح المصطلحات والكلمات الجديدة', description: 'ترجمة شاملة مع إضافة شرح قصير للمصطلحات غير الشائعة.', version: '1.0.0', fileSize: '35 MB', fileFormat: 'zip', tags: 'شرح,مفردات,تعليم', translationType: 'unofficial' },
  { name: ' تعريب معدّل', summary: 'ترجمة معدلة ومحسّنة من الإصدار السابق', description: 'تعديلات وتحسينات على التعريب السابق بناءً على ملاحظات المجتمع.', version: '2.0.1', fileSize: '40 MB', fileFormat: 'zip', tags: 'تعديل,تحسين,ملاحظات', translationType: 'unofficial' },
  { name: ' تعريب خفيف', summary: 'ترجمة خفيفة للنصوص الأساسية فقط', description: 'يحتوي على ترجمة للنصوص الأساسية فقط مع الحفاظ على حجم صغير.', version: '1.0.0', fileSize: '10 MB', fileFormat: 'zip', tags: 'خفيف,أساسي,صغير', translationType: 'unofficial' },
  { name: ' تعريب نهائي متكامل', summary: 'الإصدار النهائي الشامل', description: 'الإصدار النهائي الذي يجمع كل التحسينات والتعديلات السابقة.', version: '4.0.0', fileSize: '60 MB', fileFormat: '7z', tags: 'نهائي,شامل,متكامل', translationType: 'unofficial' },
  { name: ' تعريب + خرائط', summary: 'ترجمة مع خرائط مترجمة', description: 'ترجمة شاملة مع إضافة خرائط مترجمة للمناطق والمهمات.', version: '1.3.0', fileSize: '50 MB', fileFormat: '7z', tags: 'خرائط,ترجمة,شامل', translationType: 'unofficial' },
  { name: ' تعريب مجمّع', summary: 'ترجمة من مصادر متعددة', description: 'جمع أفضل الترجمات من مصادر مختلفة في إصدار واحد.', version: '1.1.0', fileSize: '45 MB', fileFormat: 'zip', tags: 'مجمّع,مصادرمتعددة,أفضل', translationType: 'unofficial' },
]

// ===== EXPANDED SERIES =====
const EXPANDED_SERIES = [
  { slug: 'rpg-classics', name: 'كلاسيكيات RPG', description: 'أفضل تعريبات ألعاب تقمص الأدوار الكلاسيكية', color: '#7c3aed', bannerUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=1200&h=400&fit=crop', logoUrl: '', isFeatured: true, isOfficial: false },
  { slug: 'open-world', name: 'ألعاب العالم المفتوح', description: 'تعريبات ألعاب العالم المفتوح الشهيرة', color: '#0891b2', bannerUrl: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=1200&h=400&fit=crop', logoUrl: '', isFeatured: false, isOfficial: false },
  { slug: 'action-adventure', name: 'أكشن ومغامرات', description: 'أفضل تعريبات ألعاب الأكشن والمغامرات', color: '#dc2626', bannerUrl: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=1200&h=400&fit=crop', logoUrl: '', isFeatured: true, isOfficial: false },
]

// ===== EXPANDED TEAMS =====
const EXPANDED_TEAMS = [
  { slug: 'games-in-arabic', name: 'Games in Arabic', description: 'فريق تعريب ألعاب تأسس عام 2014. نسعى لإثراء المحتوى العربي عن طريق شغفنا بترجمة الألعاب. فلسفتنا تقريب الفصحى من اللهجات العامية.', logoUrl: '', bannerUrl: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=1200&h=400&fit=crop', websiteUrl: 'https://gamesinarabic.com', discordUrl: '', isOfficial: true, isFeatured: true },
  { slug: 'arabic-games-hub', name: 'مركز الألعاب العربية', description: 'مركز متخصص في جمع ونشر تعريبات الألعاب العربية', logoUrl: '', bannerUrl: 'https://images.unsplash.com/photo-1606144042614-b2417e99c4e3?w=1200&h=400&fit=crop', websiteUrl: '', discordUrl: '', isOfficial: false, isFeatured: true },
]

// ===== EXPANDED USERS =====
const EXPANDED_USERS = [
  { username: 'gamesinarabic', email: 'admin@gamesinarabic.com', role: 'owner', bio: 'مؤسس فريق Games in Arabic - تعريب الألعاب منذ 2014', tier: 5 },
  { username: 'translator1', email: 'translator1@example.com', role: 'moderator', bio: 'مترجم محترف متخصص في ألعاب RPG', tier: 3 },
  { username: 'translator2', email: 'translator2@example.com', role: 'moderator', bio: 'مترجم متخصص في ألعاب المغامرات', tier: 2 },
  { username: 'reviewer1', email: 'reviewer1@example.com', role: 'moderator', bio: 'مراجع لغوي للترجمات', tier: 2 },
]

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

async function main() {
  console.log('🌱 Starting expanded seed...\n')

  // ===== 1. CREATE EXPANDED USERS =====
  console.log('\n👤 Creating expanded users...')
  const userRecords: any[] = []
  for (const userData of EXPANDED_USERS) {
    try {
      const user = await prisma.user.create({
        data: {
          username: userData.username,
          email: userData.email,
          role: userData.role,
          bio: userData.bio,
          tier: userData.tier,
        },
      })
      userRecords.push(user)
      console.log(`  ✅ ${user.username} (${user.role})`)
    } catch (e: any) {
      // User might already exist
      const existing = await prisma.user.findUnique({ where: { username: userData.username } })
      if (existing) {
        userRecords.push(existing)
        console.log(`  ⚠️  ${userData.username} already exists`)
      }
    }
  }

  // ===== 2. CREATE EXPANDED GAMES =====
  console.log('\n📦 Creating expanded games...')
  const gameRecords: any[] = []
  for (const game of EXPANDED_GAMES) {
    try {
      const record = await prisma.game.upsert({
        where: { slug: game.slug },
        update: game,
        create: game,
      })
      gameRecords.push(record)
      console.log(`  ✅ ${game.name}`)
    } catch (e: any) {
      console.log(`  ⚠️  ${game.name} skipped: ${e.message?.substring(0, 50)}`)
    }
  }

  // ===== 3. CREATE CATEGORIES FOR EXPANDED GAMES =====
  console.log('\n📂 Creating categories for expanded games...')
  for (const game of gameRecords) {
    const categories = [
      { name: 'ترجمة كاملة', slug: 'full-translation' },
      { name: 'ترجمة واجهة', slug: 'ui-translation' },
    ]
    for (const cat of categories) {
      try {
        await prisma.category.upsert({
          where: { gameId_slug: { gameId: game.id, slug: cat.slug } },
          update: cat,
          create: { ...cat, gameId: game.id },
        })
      } catch {}
    }
    console.log(`  ✅ Categories for ${game.name}`)
  }

  // ===== 4. CREATE EXPANDED MODS =====
  console.log('\n🎮 Creating expanded mods...')
  let modIndex = 0
  const allMods: any[] = []

  for (const game of gameRecords) {
    const cats = await prisma.category.findMany({ where: { gameId: game.id } })
    const author = userRecords[randomInt(0, userRecords.length - 1)]

    for (let i = 0; i < 10; i++) {
      const template = EXPANDED_MOD_TEMPLATES[i % EXPANDED_MOD_TEMPLATES.length]
      const cat = cats[i % cats.length]
      const slug = `${game.slug}-${slugify(template.name)}-${modIndex}`
      const downloads = randomInt(100, 8000)
      const endorsements = randomInt(10, 300)
      const views = randomInt(200, 15000)

      try {
        const mod = await prisma.mod.upsert({
          where: { slug },
          update: {},
          create: {
            slug,
            name: `${template.name} - ${game.name}`,
            summary: template.summary,
            description: template.description,
            changelog: '## التغييرات\n\n- تحسينات عامة\n- إصلاح أخطاء\n- تحديث الترجمة',
            installGuide: '## دليل التركيب\n\n1. حمّل الملف\n2. استخرج المحتوى\n3. انسخ المجلد إلى مجلد اللعبة\n4. شغّل اللعبة واستمتع',
            arabicTitle: template.name,
            compatibility: 'يعمل مع جميع الإصدارات',
            authorId: author.id,
            gameId: game.id,
            categoryId: cat?.id || null,
            thumbnailUrl: game.thumbnailUrl,
            imageUrl: game.bannerUrl,
            galleryUrls: '',
            version: template.version,
            fileSize: template.fileSize,
            fileFormat: template.fileFormat,
            downloads,
            endorsements,
            views,
            comments: randomInt(2, 25),
            rating: Math.round(Math.random() * 2 + 3) * 10 / 10,
            ratingCount: randomInt(5, 40),
            tags: template.tags,
            series: '',
            translationTeam: '',
            translationType: template.translationType,
            isFeatured: i === 0,
            isTrending: downloads > 3000,
            isLatest: i < 3,
            releaseDate: new Date(Date.now() - randomInt(1, 365) * 86400000),
          },
        })
        allMods.push(mod)
        modIndex++
      } catch {}
    }
    console.log(`  ✅ 10 mods for ${game.name}`)
  }

  // ===== 5. CREATE EXPANDED SERIES =====
  console.log('\n📚 Creating expanded series...')
  for (const series of EXPANDED_SERIES) {
    try {
      await prisma.series.upsert({
        where: { slug: series.slug },
        update: series,
        create: series,
      })
      console.log(`  ✅ ${series.name}`)
    } catch (e: any) {
      console.log(`  ⚠️  ${series.name} skipped`)
    }
  }

  // ===== 6. CREATE EXPANDED TEAMS =====
  console.log('\n👥 Creating expanded teams...')
  for (const team of EXPANDED_TEAMS) {
    try {
      const record = await prisma.team.upsert({
        where: { slug: team.slug },
        update: team,
        create: team,
      })
      // Add team owner
      const owner = userRecords.find(u => u.username === 'gamesinarabic')
      if (owner) {
        try {
          await prisma.teamMembership.create({
            data: {
              teamId: record.id,
              userId: owner.id,
              name: owner.username,
              role: 'leader',
              bio: 'مؤسس الفريق',
            },
          })
        } catch {}
      }
      console.log(`  ✅ ${team.name}`)
    } catch (e: any) {
      console.log(`  ⚠️  ${team.name} skipped`)
    }
  }

  // ===== 7. CREATE MORE ENDORSEMENTS =====
  console.log('\n👍 Creating more endorsements...')
  let endorseCount = 0
  const endorseUser = userRecords[0] || await prisma.user.findFirst()
  if (endorseUser) {
    for (const mod of allMods.slice(0, 30)) {
      try {
        await prisma.endorsement.create({
          data: { userId: endorseUser.id, modId: mod.id, value: 'up' },
        })
        endorseCount++
      } catch {}
    }
  }
  console.log(`  ✅ ${endorseCount} endorsements`)

  // ===== 8. CREATE MORE COMMENTS =====
  console.log('\n💬 Creating more comments...')
  const COMMENT_TEXTS = [
    'عمل رائع! شكراً فريق Games in Arabic',
    'أفضل تعريب لقيته، جودة عالية جداً',
    'شكراً على الجهود الرائعة، استمروا',
    'الترجمة سلسة وطبيعية، إحسنتوا',
    'هذا التعريب غيّر تجربتي باللعبة بالكامل',
    'أتمنى لكم التوفيق والنجاح',
    'عمل احترافي يستحق الدعم',
    'الجودة ممتازة والأسلوب واضح',
    'أنا من المعجبين بأعمالكم',
    'هل يمكن ترجمة الألعاب الجديدة قريباً؟',
    'أفضل فريق تعريب عربي',
    'الترجمة دقيقة وتحافظ على روح اللعبة',
    'استمروا في العمل الرائع',
    'هذا التعريب من أفضل ما رأيت',
    'شكراً لكم على التخليص المجاني',
    'أعمالكم تليق بسمعة الفريق',
    'الترجمة ممتازة لكن يمكن تحسين بعض الكلمات',
    'فريق متميز وأعمال رائعة',
    'أتمنى إضافة المزيد من الألعاب',
    'عمل يستحق كل الدعم والتقدير',
  ]
  let commentCount = 0
  const commentUser = userRecords[1] || userRecords[0] || await prisma.user.findFirst()
  if (commentUser) {
    for (const mod of allMods.slice(0, 25)) {
      const text = COMMENT_TEXTS[commentCount % COMMENT_TEXTS.length]
      try {
        await prisma.modComment.create({
          data: {
            modId: mod.id,
            userId: commentUser.id,
            text,
            likes: randomInt(1, 15),
            dislikes: randomInt(0, 2),
          },
        })
        commentCount++
      } catch {}
    }
  }
  console.log(`  ✅ ${commentCount} comments`)

  // ===== 9. CREATE MORE NOTIFICATIONS =====
  console.log('\n🔔 Creating more notifications...')
  const notifUser = userRecords[0] || await prisma.user.findFirst()
  if (notifUser) {
    const NOTIF_TEMPLATES = [
      { type: 'mod_endorse', title: 'تأييد جديد', message: 'أضاف شخص تأييداً على تعريبك' },
      { type: 'comment_reply', title: 'رد جديد', message: 'رد على تعليقك' },
      { type: 'mod_featured', title: 'تعريب مميز', message: 'تمت إضافة تعريبك إلى التعريبات المميزة' },
      { type: 'tier_upgrade', title: 'ترقية المستوى', message: 'تم ترقيتك إلى مستوى جديد' },
      { type: 'special_role_assigned', title: 'دور جديد', message: 'تم تعيينك في دور جديد' },
    ]
    let notifCount = 0
    for (const tmpl of NOTIF_TEMPLATES) {
      try {
        await prisma.notification.create({
          data: {
            userId: notifUser.id,
            type: tmpl.type,
            title: tmpl.title,
            message: tmpl.message,
            data: {},
          },
        })
        notifCount++
      } catch {}
    }
    console.log(`  ✅ ${notifCount} notifications`)
  }

  console.log('\n🎉 Expanded seed completed successfully!')
  console.log(`   Games: ${gameRecords.length}`)
  console.log(`   Mods: ${allMods.length}`)
  console.log(`   Series: ${EXPANDED_SERIES.length}`)
  console.log(`   Teams: ${EXPANDED_TEAMS.length}`)
  console.log(`   Endorsements: ${endorseCount}`)
  console.log(`   Comments: ${commentCount}`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
