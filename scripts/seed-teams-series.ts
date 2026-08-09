import { db } from '../src/lib/db'

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9\u0600-\u06FF]+/g, '-').replace(/^-|-$/g, '')

const TEAMS = [
  { name: 'فريق التعريب العربي', description: 'أكبر فريق تعريب في العالم العربي، متخصص في تعريب ألعاب PC والمنصات المنزلية', isOfficial: true, isFeatured: true },
  { name: 'Arabic Games Translation', description: 'فريق متخصص في تعريب ألعاب RPG وأكشن عالم مفتوح', isOfficial: true, isFeatured: true },
  { name: 'فريق النخبة للتعريب', description: 'فريق من المترجمين المحترفين لألعاب الفيديو', isOfficial: true, isFeatured: false },
  { name: 'تعريبات بلس', description: 'منصة تعريب شاملة لجميع المنصات', isOfficial: false, isFeatured: true },
  { name: 'فريق الأنمي والألعاب', description: 'متخصص في تعريب ألعاب الأنمي واليابانية', isOfficial: false, isFeatured: false },
  { name: 'Arab Gamers Hub', description: 'مجتمع اللاعبين العرب وفريق التعريب', isOfficial: false, isFeatured: true },
  { name: 'فريق البلايستيشن العربي', description: 'متخصص في تعريب ألعاب PlayStation لجميع الأجيال', isOfficial: true, isFeatured: false },
  { name: 'Nitendo Arabic Team', description: 'فريق متخصص في تعريب ألعاب Nintendo Switch', isOfficial: false, isFeatured: false },
  { name: 'فريق المودات العربي', description: 'متخصص في إنشاء وتعريب المودات للألعاب', isOfficial: false, isFeatured: false },
  { name: 'Arabic RPG Masters', description: 'فريق متخصص في تعريب ألعاب تقمص الأدوار', isOfficial: true, isFeatured: true },
  { name: 'فريق الترجمة الثقافية', description: 'ي التركيز على الترجمة الثقافية وال适应 للألعاب العربية', isOfficial: false, isFeatured: false },
  { name: 'Game Localization Arabia', description: 'شركة تعريب احترافية للألعاب', isOfficial: true, isFeatured: false },
  { name: 'فريق الإصلاح والتعريب', description: 'متخصص في إصلاح مشاكل الترجمة وتحسين الجودة', isOfficial: false, isFeatured: false },
  { name: 'Arab Speed Translation', description: 'فريق سريع في التعريب خلال أول 24 ساعة من الإصدار', isOfficial: false, isFeatured: true },
  { name: 'فريق التعليم والتدريب', description: 'يقدم دورات تعليمية لتعلم فن التعريب', isOfficial: false, isFeatured: false },
]

const SERIES = [
  { name: 'Call of Duty', description: 'سلسلة ألعاب إطلاق النار من منظور الشخص الأول', color: '#FF4500', isFeatured: true, isOfficial: false },
  { name: 'The Witcher', description: 'سلسلة ألعاب تقمص الأدوار الملحمية', color: '#8B0000', isFeatured: true, isOfficial: false },
  { name: 'Grand Theft Auto', description: 'سلسلة ألعاب العالم المفتوح الشهيرة', color: '#228B22', isFeatured: true, isOfficial: false },
  { name: 'FIFA / EA Sports FC', description: 'سلسلة ألعاب كرة القدم الأكثر شعبية', color: '#006400', isFeatured: true, isOfficial: false },
  { name: 'Assassin\'s Creed', description: 'سلسلة ألعاب المغامرات والتاريخ', color: '#4169E1', isFeatured: true, isOfficial: false },
  { name: 'Final Fantasy', description: 'سلسلة ألعاب تقمص الأدوار اليابانية الأسطورية', color: '#4B0082', isFeatured: true, isOfficial: false },
  { name: 'Resident Evil', description: 'سلسلة ألعاب الرعب والبقاء', color: '#8B0000', isFeatured: false, isOfficial: false },
  { name: 'God of War', description: 'سلسلة ألعاب الأكشن الملحمية', color: '#1E90FF', isFeatured: true, isOfficial: false },
  { name: 'Spider-Man', description: 'سلسلة ألعاب بطل الخيوط الخارق', color: '#DC143C', isFeatured: false, isOfficial: false },
  { name: 'Red Dead Redemption', description: 'سلسلة ألعاب الغرب الأمريكي المفتوح', color: '#8B4513', isFeatured: true, isOfficial: false },
  { name: 'Need for Speed', description: 'سلسلة ألعاب السباقات الشهيرة', color: '#FF6347', isFeatured: false, isOfficial: false },
  { name: 'Dragon Ball', description: 'سلسلة ألعاب أنمي دراغون بول', color: '#FFD700', isFeatured: false, isOfficial: false },
  { name: 'Kingdom Hearts', description: 'سلسلة ألعاب المغامرات السحرية', color: '#9370DB', isFeatured: false, isOfficial: false },
  { name: 'Metal Gear Solid', description: 'سلسلة ألعاب التجسس والإثارة', color: '#2F4F4F', isFeatured: false, isOfficial: false },
  { name: 'Persona', description: 'سلسلة ألعاب تقمص الأدوار اليابانية', color: '#FF1493', isFeatured: false, isOfficial: false },
]

async function main() {
  console.log('🎮 Seeding 15 teams...')

  for (let i = 0; i < TEAMS.length; i++) {
    const t = TEAMS[i]
    const slug = slugify(t.name) + '-' + (i + 1)
    await db.team.upsert({
      where: { slug },
      update: {},
      create: {
        slug,
        name: t.name,
        description: t.description,
        isOfficial: t.isOfficial,
        isFeatured: t.isFeatured,
        logoUrl: `https://api.dicebear.com/7.x/shapes/svg?seed=${slug}&backgroundColor=b6e3f4,c0aede,d1d4f9`,
        bannerUrl: `https://images.unsplash.com/photo-1542751371-adc38448a05e?w=800&q=60`,
        order: i + 1,
        modCount: Math.floor(Math.random() * 20) + 1,
      },
    })
    console.log(`  ✅ Team: ${t.name}`)
  }

  console.log('\n📚 Seeding 15 series...')

  for (let i = 0; i < SERIES.length; i++) {
    const s = SERIES[i]
    const slug = slugify(s.name) + '-' + (i + 1)
    await db.series.upsert({
      where: { slug },
      update: {},
      create: {
        slug,
        name: s.name,
        description: s.description,
        color: s.color,
        isFeatured: s.isFeatured,
        isOfficial: s.isOfficial,
        bannerUrl: `https://images.unsplash.com/photo-1511512578047-dfb367046420?w=800&q=60`,
        logoUrl: `https://api.dicebear.com/7.x/shapes/svg?seed=${slug}&backgroundColor=b6e3f4,c0aede,d1d4f9`,
        order: i + 1,
        modCount: Math.floor(Math.random() * 15) + 1,
        totalDownloads: Math.floor(Math.random() * 50000) + 1000,
        totalEndorsements: Math.floor(Math.random() * 500) + 50,
      },
    })
    console.log(`  ✅ Series: ${s.name}`)
  }

  console.log('\n🎉 Done! 15 teams and 15 series seeded.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
