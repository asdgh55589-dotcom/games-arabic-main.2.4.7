import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// ===== GAMES =====
const GAMES = [
  {
    slug: 'god-of-war',
    name: 'God of War',
    tagline: 'مغامرة كراتوس الأسطورية',
    description: 'لعبة أكشن مغامرات من تطوير Santa Monica Studio. تتبع رحلة كراتوس وابنه أتريوس في عالم الأساطير الإسكندنافية.',
    category: 'RPG',
    platform: 'PS4',
    releaseYear: 2018,
    bannerUrl: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=1200&h=400&fit=crop',
    thumbnailUrl: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=400&h=300&fit=crop',
    logoUrl: null,
    featured: true,
  },
  {
    slug: 'horizon-zero-dawn',
    name: 'Horizon Zero Dawn',
    tagline: 'استكشاف عالم ما بعد الانقراض',
    description: 'لعبة أكشن مغامرات في عالم مفتوح. تتبع آلوين وهي صيادة في عالم يسيطر عليه الروبوتات العملاقة.',
    category: 'RPG',
    platform: 'PS4',
    releaseYear: 2017,
    bannerUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=1200&h=400&fit=crop',
    thumbnailUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=400&h=300&fit=crop',
    logoUrl: null,
    featured: true,
  },
  {
    slug: 'spider-man',
    name: "Marvel's Spider-Man",
    tagline: 'ابنِ العنكبوت يحرر نيويورك',
    description: 'لعبة أكشن مغامرات مفتوحة العالم. لعب دور سبايدر مان في حرير نيويورك من الأشرار.',
    category: 'Action',
    platform: 'PS4',
    releaseYear: 2018,
    bannerUrl: 'https://images.unsplash.com/photo-1635805737707-575885ab0820?w=1200&h=400&fit=crop',
    thumbnailUrl: 'https://images.unsplash.com/photo-1635805737707-575885ab0820?w=400&h=300&fit=crop',
    logoUrl: null,
    featured: false,
  },
  {
    slug: 'zelda-botw',
    name: 'The Legend of Zelda: Breath of the Wild',
    tagline: 'مغامرة لينك في هايلو',
    description: 'لعبة أكشن مغامرات مفتوحة العالم. استكشاف مملكة هايلو ومحاربة الشر.',
    category: 'Adventure',
    platform: 'NS',
    releaseYear: 2017,
    bannerUrl: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=1200&h=400&fit=crop',
    thumbnailUrl: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=400&h=300&fit=crop',
    logoUrl: null,
    featured: true,
  },
  {
    slug: 'last-of-us',
    name: 'The Last of Us Part II',
    tagline: 'نهاية العالم في عالم مليء بالموتى',
    description: 'لعبة أكشن مغامرات في عالم ما بعد الكارثة. تتبع إيلي في رحلة الانتقام والبقاء.',
    category: 'Adventure',
    platform: 'PS4',
    releaseYear: 2020,
    bannerUrl: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=1200&h=400&fit=crop',
    thumbnailUrl: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=400&h=300&fit=crop',
    logoUrl: null,
    featured: true,
  },
]

// ===== CATEGORIES PER GAME =====
const CATEGORIES: Record<string, { name: string; slug: string }[]> = {
  'god-of-war': [
    { name: 'ترجمة كاملة', slug: 'full-translation' },
    { name: 'ترجمة واجهة', slug: 'ui-translation' },
    { name: 'ترجمة قصة', slug: 'story-translation' },
  ],
  'horizon-zero-dawn': [
    { name: 'ترجمة كاملة', slug: 'full-translation' },
    { name: 'ترجمة واجهة', slug: 'ui-translation' },
  ],
  'spider-man': [
    { name: 'ترجمة كاملة', slug: 'full-translation' },
    { name: 'ترجمة واجهة', slug: 'ui-translation' },
  ],
  'zelda-botw': [
    { name: 'ترجمة كاملة', slug: 'full-translation' },
    { name: 'ترجمة واجهة', slug: 'ui-translation' },
    { name: 'ترجمة مهام', slug: 'quest-translation' },
  ],
  'last-of-us': [
    { name: 'ترجمة كاملة', slug: 'full-translation' },
    { name: 'ترجمة واجهة', slug: 'ui-translation' },
  ],
}

// ===== MODS DATA =====
const MOD_TEMPLATES = [
  { name: 'تعريب كامل - النسخة الفاخرة', summary: 'ترجمة شاملة لكل النصوص بما في ذلك القوائم والحوارات والمهام', description: 'هذا التعريب يغطي جميع نصوص اللعبة بشكل كامل وشامل. تم التدقيق المراجعة بدقة للحفاظ على جودة الترجمة.', version: '2.0.0', fileSize: '45 MB', fileFormat: 'zip', tags: 'ترجمة كاملة,تعريب,نص كامل', translationType: 'unofficial' },
  { name: 'تعريب واجهة المستخدم', summary: 'ترجمة جميع قوائم وواجهات اللعبة', description: 'يحتوي على ترجمة كاملة لجميع قوائم اللعبة والخيارات والاعدادات.', version: '1.5.0', fileSize: '12 MB', fileFormat: 'zip', tags: 'واجهة,قوائم,ترجمة', translationType: 'unofficial' },
  { name: 'تعريب قصة+', summary: 'ترجمة محسنة للحوارات مع الحفاظ على السياق الثقافي', description: 'ترجمة متقدمة للحوارات مع مراعاة السياق الثقافي العربي.', version: '1.2.0', fileSize: '35 MB', fileFormat: '7z', tags: 'قصة,حوارات,سياق', translationType: 'unofficial' },
  { name: 'تعريب المهام الجانبية', summary: 'ترجمة جميع المهام الجانبية وال附加 المحتوى', description: 'يغطي جميع المهام الجانبية وال附加 المحتوى القابل للتحميل.', version: '1.0.0', fileSize: '20 MB', fileFormat: 'zip', tags: 'مهام,附加,محتوى', translationType: 'unofficial' },
  { name: 'حزمة تعريب كاملة v3', summary: 'الإصدار الأحدث والأشمل', description: 'الإصدار الثالث من التعريب الكامل مع تحسينات كثيرة وإصلاحات.', version: '3.0.0', fileSize: '50 MB', fileFormat: '7z', tags: 'تحديث,إصدار جديد,كامل', translationType: 'unofficial' },
  { name: 'تعريب عربي فصحى', summary: 'ترجمة بلغة عربية فصحى رسمية', description: 'ترجمة بأسلوب رسمي بلغة عربية فصحى مناسبة لجميع الفئات العمرية.', version: '1.1.0', fileSize: '40 MB', fileFormat: 'zip', tags: 'فصحى,رسمي,عربية', translationType: 'unofficial' },
  { name: 'تعريب محترف+', summary: 'ترجمة احترافية مع مراجعة لغوية', description: 'ترجمة احترافية مراجعة من قبل مترجمين محترفين.', version: '2.1.0', fileSize: '42 MB', fileFormat: 'zip', tags: 'محترف,مراجعة,جودة', translationType: 'unofficial' },
  { name: 'تعريب مختصر', summary: 'ترجمة مختصرة للنصوص الأساسية فقط', description: 'يحتوي على ترجمة للنصوص الأساسية والهامة فقط.', version: '1.0.0', fileSize: '8 MB', fileFormat: 'zip', tags: 'مختصر,أساسي,خفيف', translationType: 'unofficial' },
  { name: ' تعريب + شرح', summary: 'ترجمة مع شرح المصطلحات وال Slang', description: 'ترجمة شاملة مع شرح للمصطلحات والكلمات غير الشائعة.', version: '1.3.0', fileSize: '30 MB', fileFormat: '7z', tags: 'شرح,مصطلحات,تعليم', translationType: 'unofficial' },
  { name: 'تعريب نهائي', summary: 'الإصدار النهائي المتكامل', description: 'الإصدار النهائي الذي يجمع أفضل الترجمات مع التحسينات الأخيرة.', version: '4.0.0', fileSize: '55 MB', fileFormat: '7z', tags: 'نهائي,متكامل,أفضل', translationType: 'unofficial' },
]

// ===== SERIES =====
const SERIES = [
  { slug: 'god-of-war-series', name: 'سلسلة God of War', description: 'جميع تعريبات سلسلة God of War', color: '#dc2626', bannerUrl: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=1200&h=400&fit=crop', logoUrl: '', isFeatured: true, isOfficial: false },
  { slug: 'zelda-series', name: 'سلسلة The Legend of Zelda', description: 'جميع تعريبات سلسلة زيلدا', color: '#16a34a', bannerUrl: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=1200&h=400&fit=crop', logoUrl: '', isFeatured: true, isOfficial: false },
  { slug: 'ps4-exclusive', name: 'حصريات PS4', description: 'تعريبات الألعاب الحصرية لجهاز بلايستيشن 4', color: '#2563eb', bannerUrl: 'https://images.unsplash.com/photo-1606144042614-b2417e99c4e3?w=1200&h=400&fit=crop', logoUrl: '', isFeatured: false, isOfficial: false },
  { slug: 'adventure-games', name: 'ألعاب المغامرات', description: ' أفضل تعريبات ألعاب المغامرات', color: '#9333ea', bannerUrl: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=1200&h=400&fit=crop', logoUrl: '', isFeatured: false, isOfficial: false },
  { slug: 'nintendo-switch', name: 'تعريبات Nintendo Switch', description: 'جميع تعريبات ألعاب الننتندو سويتش', color: '#e11d48', bannerUrl: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=1200&h=400&fit=crop', logoUrl: '', isFeatured: true, isOfficial: false },
]

// ===== TEAMS =====
const TEAMS = [
  { slug: 'arabic-games-team', name: 'فريق تعريب الألعاب العربي', description: 'فريق متخصص في تعريب الألعاب إلى اللغة العربية', logoUrl: '', bannerUrl: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=1200&h=400&fit=crop', websiteUrl: '', discordUrl: '', isOfficial: true, isFeatured: true },
  { slug: 'ps4-translators', name: 'مترجمو بلايستيشن', description: 'فريق متخصص في تعريب ألعاب بلايستيشن', logoUrl: '', bannerUrl: 'https://images.unsplash.com/photo-1606144042614-b2417e99c4e3?w=1200&h=400&fit=crop', websiteUrl: '', discordUrl: '', isOfficial: false, isFeatured: true },
  { slug: 'nintendo-arabic', name: 'تعريب الننتندو', description: 'فريق تعريب ألعاب الننتندو', logoUrl: '', bannerUrl: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=1200&h=400&fit=crop', websiteUrl: '', discordUrl: '', isOfficial: false, isFeatured: false },
  { slug: 'rpg-translators', name: 'مترجمو RPG', description: 'متخصصون في تعريب ألعاب تقمص الأدوار', logoUrl: '', bannerUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=1200&h=400&fit=crop', websiteUrl: '', discordUrl: '', isOfficial: false, isFeatured: false },
  { slug: 'indie-games-arabic', name: 'تعريب الألعاب المستقلة', description: 'فريق متخصص في تعريب الألعاب المستقلة', logoUrl: '', bannerUrl: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=1200&h=400&fit=crop', websiteUrl: '', discordUrl: '', isOfficial: false, isFeatured: false },
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
  console.log('🌱 Starting seed...\n')

  // Get existing user
  const user = await prisma.user.findFirst({ where: { username: 'testuser' } })
  if (!user) {
    console.error('❌ No user found. Create a user first.')
    return
  }
  console.log(`✅ Using user: ${user.username} (${user.id})`)

  // ===== 1. CREATE GAMES =====
  console.log('\n📦 Creating games...')
  const gameRecords: any[] = []
  for (const game of GAMES) {
    const record = await prisma.game.upsert({
      where: { slug: game.slug },
      update: game,
      create: game,
    })
    gameRecords.push(record)
    console.log(`  ✅ ${game.name}`)
  }

  // ===== 2. CREATE CATEGORIES =====
  console.log('\n📂 Creating categories...')
  for (const game of gameRecords) {
    const cats = CATEGORIES[game.slug] || []
    for (const cat of cats) {
      await prisma.category.upsert({
        where: { gameId_slug: { gameId: game.id, slug: cat.slug } },
        update: cat,
        create: { ...cat, gameId: game.id },
      })
    }
    console.log(`  ✅ ${cats.length} categories for ${game.name}`)
  }

  // ===== 3. CREATE MODS =====
  console.log('\n🎮 Creating mods...')
  let modIndex = 0
  const allMods: any[] = []

  for (const game of gameRecords) {
    const cats = await prisma.category.findMany({ where: { gameId: game.id } })
    for (let i = 0; i < 10; i++) {
      const template = MOD_TEMPLATES[i % MOD_TEMPLATES.length]
      const cat = cats[i % cats.length]
      const slug = `${game.slug}-${slugify(template.name)}-${modIndex}`
      const downloads = randomInt(50, 5000)
      const endorsements = randomInt(5, 200)
      const views = randomInt(100, 10000)

      const mod = await prisma.mod.upsert({
        where: { slug },
        update: {},
        create: {
          slug,
          name: `${template.name} - ${game.name}`,
          summary: template.summary,
          description: template.description,
          changelog: '## التغييرات\n\n- تحسينات عامة\n- إصلاح أخطاء',
          installGuide: '## دليل التركيب\n\n1. حمّل الملف\n2. استخرج المحتوى\n3. انسخ المجلد إلى مجلد اللعبة',
          arabicTitle: template.name,
          compatibility: 'يعمل مع جميع الإصدارات',
          authorId: user.id,
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
          comments: randomInt(0, 20),
          rating: Math.round(Math.random() * 2 + 3) * 10 / 10,
          ratingCount: randomInt(1, 30),
          tags: template.tags,
          series: '',
          translationTeam: '',
          translationType: template.translationType,
          isFeatured: i === 0,
          isTrending: downloads > 2000,
          isLatest: i < 3,
          releaseDate: new Date(Date.now() - randomInt(1, 365) * 86400000),
        },
      })
      allMods.push(mod)
      modIndex++
    }
    // Update game mod count
    await prisma.game.update({
      where: { id: game.id },
      data: {
        modCount: 10,
        totalDownloads: allMods.filter(m => m.gameId === game.id).reduce((s, m) => s + m.downloads, 0),
        totalEndorsements: allMods.filter(m => m.gameId === game.id).reduce((s, m) => s + m.endorsements, 0),
      },
    })
    console.log(`  ✅ 10 mods for ${game.name}`)
  }

  // ===== 4. CREATE SERIES =====
  console.log('\n📚 Creating series...')
  for (const series of SERIES) {
    const record = await prisma.series.upsert({
      where: { slug: series.slug },
      update: series,
      create: series,
    })
    console.log(`  ✅ ${series.name}`)
  }

  // ===== 5. CREATE TEAMS =====
  console.log('\n👥 Creating teams...')
  for (const team of TEAMS) {
    const record = await prisma.team.upsert({
      where: { slug: team.slug },
      update: team,
      create: team,
    })
    // Add team owner
    await prisma.teamMembership.create({
      data: {
        teamId: record.id,
        userId: user.id,
        name: user.username,
        role: 'leader',
        bio: 'مؤسس الفريق',
      },
    })
    console.log(`  ✅ ${team.name}`)
  }

  // ===== 6. CREATE SOME ENDORSEMENTS =====
  console.log('\n👍 Creating endorsements...')
  let endorseCount = 0
  for (const mod of allMods.slice(0, 20)) {
    try {
      await prisma.endorsement.create({
        data: { userId: user.id, modId: mod.id, value: 'up' },
      })
      endorseCount++
    } catch {}
  }
  console.log(`  ✅ ${endorseCount} endorsements`)

  // ===== 7. CREATE SOME COMMENTS =====
  console.log('\n💬 Creating comments...')
  const COMMENT_TEXTS = [
    'تعليق رائع! شكراً على هذا التعريب',
    'ممتاز، الترجمة جيدة جداً',
    'شكراً لكم على الجهود الرائعة',
    'أفضل تعريب لقيته',
    'عمل احترافي، أتمنى التوفيق',
    'هل يمكن إضافة ترجمة للأسماء أيضاً؟',
    'جودة الترجمة ممتازة',
    'أنا منتظر التحديث القادم',
    'عمل جميل واستمر',
    'هذا التعريب غيّر تجربتي باللعبة',
  ]
  let commentCount = 0
  for (const mod of allMods.slice(0, 15)) {
    const text = COMMENT_TEXTS[commentCount % COMMENT_TEXTS.length]
    await prisma.modComment.create({
      data: {
        modId: mod.id,
        userId: user.id,
        text,
        likes: randomInt(0, 10),
        dislikes: randomInt(0, 2),
      },
    })
    commentCount++
  }
  console.log(`  ✅ ${commentCount} comments`)

  // ===== 8. CREATE SOME NOTIFICATIONS =====
  console.log('\n🔔 Creating notifications...')
  const NOTIF_TEMPLATES = [
    { type: 'mod_endorse', title: 'تأييد جديد', message: 'أضاف شخص تأييداً على تعريبك' },
    { type: 'comment_reply', title: 'رد جديد', message: 'رد على تعليقك' },
    { type: 'mod_featured', title: 'تعريب مميز', message: 'تمت إضافة تعريبك إلى التعريبات المميزة' },
  ]
  let notifCount = 0
  for (const tmpl of NOTIF_TEMPLATES) {
    await prisma.notification.create({
      data: {
        userId: user.id,
        type: tmpl.type,
        title: tmpl.title,
        message: tmpl.message,
        data: {},
      },
    })
    notifCount++
  }
  console.log(`  ✅ ${notifCount} notifications`)

  console.log('\n🎉 Seed completed successfully!')
  console.log(`   Games: ${gameRecords.length}`)
  console.log(`   Mods: ${allMods.length}`)
  console.log(`   Series: ${SERIES.length}`)
  console.log(`   Teams: ${TEAMS.length}`)
  console.log(`   Endorsements: ${endorseCount}`)
  console.log(`   Comments: ${commentCount}`)
  console.log(`   Notifications: ${notifCount}`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
