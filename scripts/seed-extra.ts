// إضافة PS5 + X360 + ANDROID + ربط كل التعريبات بالأقسام
import { db } from '../src/lib/db'
import bcrypt from 'bcryptjs'

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

const EXTRA_GAMES = [
  // ===== PS5 (7 ألعاب) =====
  { slug: 'astrobot-ps5', name: 'Astro Bot', tagline: 'مغامرة روبوتية ممتعة', description: 'Astro Bot هي لعبة منصات ممتعة على PS5.', bannerUrl: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=1600&q=80', thumbnailUrl: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=600&q=80', category: 'Platformer', platform: 'PS5', releaseYear: 2024, featured: true, categories: ['UI', 'Gameplay'] },
  { slug: 'ff7-rebirth-ps5', name: 'Final Fantasy VII Rebirth', tagline: 'ملحمة فاينل فانتسي تستمر', description: 'FF7 Rebirth هي الجزء الثاني من trilogy إعادة التصنيع.', bannerUrl: 'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=1600&q=80', thumbnailUrl: 'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=600&q=80', category: 'RPG', platform: 'PS5', releaseYear: 2024, featured: true, categories: ['UI', 'Gameplay', 'Graphics'] },
  { slug: 'gow-ragnarok-ps5', name: 'God of War Ragnarok', tagline: 'نهاية العالم الإسكندنافي', description: 'God of War Ragnarok تكمل ملحمة كراتوس واتريس.', bannerUrl: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=1600&q=80', thumbnailUrl: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=600&q=80', category: 'Action', platform: 'PS5', releaseYear: 2022, featured: true, categories: ['UI', 'Gameplay', 'Graphics'] },
  { slug: 'horizon-ps5', name: 'Horizon Forbidden West', tagline: 'استكشاف الغرب المحظور', description: 'Horizon Forbidden West على PS5 بجودة أعلى.', bannerUrl: 'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=1600&q=80', thumbnailUrl: 'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=600&q=80', category: 'RPG', platform: 'PS5', releaseYear: 2022, featured: false, categories: ['UI', 'Gameplay'] },
  { slug: 'spider-man-2-ps5', name: "Marvel's Spider-Man 2", tagline: 'الرجل العنكبوت يعود', description: 'Spider-Man 2 تجمع بين بيتر ومالز في مغامرة جديدة.', bannerUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af2176?w=1600&q=80', thumbnailUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af2176?w=600&q=80', category: 'Action', platform: 'PS5', releaseYear: 2023, featured: true, categories: ['UI', 'Gameplay', 'Graphics'] },
  { slug: 'tlou3-ps5', name: 'The Last of Us Part III', tagline: 'نهاية قصة البقاء', description: 'The Last of Us Part III تكمل قصة إيلي.', bannerUrl: 'https://images.unsplash.com/photo-1593305841991-05c297ba4575?w=1600&q=80', thumbnailUrl: 'https://images.unsplash.com/photo-1593305841991-05c297ba4575?w=600&q=80', category: 'Action', platform: 'PS5', releaseYear: 2025, featured: true, categories: ['UI', 'Gameplay'] },
  { slug: 'gran-turismo-7-ps5', name: 'Gran Turismo 7', tagline: 'أفضل محاكاة سباق', description: 'Gran Turismo 7 هي أفضل محاكاة سباق على PS5.', bannerUrl: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=1600&q=80', thumbnailUrl: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=600&q=80', category: 'Racing', platform: 'PS5', releaseYear: 2022, featured: false, categories: ['UI', 'Gameplay'] },

  // ===== X360 (5 ألعاب) =====
  { slug: 'halo-3-x360', name: 'Halo 3', tagline: 'نهاية ملحمة ماستر تشييف', description: 'Halo 3 تكمل ملحمة ماستر تشييف في معركة الخلاص.', bannerUrl: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=1600&q=80', thumbnailUrl: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=600&q=80', category: 'FPS', platform: 'X360', releaseYear: 2007, featured: true, categories: ['UI', 'Gameplay'] },
  { slug: 'gears-x360', name: 'Gears of War', tagline: 'حرب تكتيكية عنيفة', description: 'Gears of War هي لعبة أكشن تكتيكية شهيرة على X360.', bannerUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af2176?w=1600&q=80', thumbnailUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af2176?w=600&q=80', category: 'Action', platform: 'X360', releaseYear: 2006, featured: true, categories: ['UI', 'Gameplay'] },
  { slug: 'fable-x360', name: 'Fable II', tagline: 'عالم خيالي مفتوح', description: 'Fable II هي لعبة RPG عالم مفتوح على X360.', bannerUrl: 'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=1600&q=80', thumbnailUrl: 'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=600&q=80', category: 'RPG', platform: 'X360', releaseYear: 2008, featured: false, categories: ['UI', 'Gameplay'] },
  { slug: 'mass-effect-x360', name: 'Mass Effect', tagline: 'ملحمة فضائية RPG', description: 'Mass Effect هي لعبة RPG فضائية أسطورية.', bannerUrl: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=1600&q=80', thumbnailUrl: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=600&q=80', category: 'RPG', platform: 'X360', releaseYear: 2007, featured: true, categories: ['UI', 'Gameplay'] },
  { slug: 'skyrim-x360', name: 'Skyrim', tagline: 'ملحمة تقمص أدوار عالم مفتوح', description: 'Skyrim على X360 — عالم تامري الضخم.', bannerUrl: 'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=1600&q=80', thumbnailUrl: 'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=600&q=80', category: 'RPG', platform: 'X360', releaseYear: 2011, featured: false, categories: ['UI', 'Gameplay'] },

  // ===== ANDROID (5 ألعاب) =====
  { slug: 'genshin-android', name: 'Genshin Impact', tagline: 'مغامرة عالم مفتوح خيالية', description: 'Genshin Impact هي لعبة RPG عالم مفتوح مجانية.', bannerUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af2176?w=1600&q=80', thumbnailUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af2176?w=600&q=80', category: 'RPG', platform: 'ANDROID', releaseYear: 2020, featured: true, categories: ['UI', 'Gameplay'] },
  { slug: 'pubg-android', name: 'PUBG Mobile', tagline: 'باتل رويال مobail', description: 'PUBG Mobile هي لعبة باتل ر royale الشهيرة.', bannerUrl: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=1600&q=80', thumbnailUrl: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=600&q=80', category: 'Shooter', platform: 'ANDROID', releaseYear: 2018, featured: true, categories: ['UI', 'Gameplay'] },
  { slug: 'cod-mobile-android', name: 'Call of Duty Mobile', tagline: 'الحرب على الهاتف', description: 'Call of Duty Mobile تجربة COD كاملة على الهاتف.', bannerUrl: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=1600&q=80', thumbnailUrl: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=600&q=80', category: 'FPS', platform: 'ANDROID', releaseYear: 2019, featured: true, categories: ['UI', 'Gameplay'] },
  { slug: 'minecraft-android', name: 'Minecraft', tagline: 'عالم البناء لا نهائي الإمكانيات', description: 'Minecraft على Android — ابن عالمك الخاص.', bannerUrl: 'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=1600&q=80', thumbnailUrl: 'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=600&q=80', category: 'Sandbox', platform: 'ANDROID', releaseYear: 2011, featured: true, categories: ['UI', 'Gameplay'] },
  { slug: 'stardew-android', name: 'Stardew Valley', tagline: 'حياة المزرعة الهادئة', description: 'Stardew Valley على Android — استمتع بحياة المزرعة.', bannerUrl: 'https://images.unsplash.com/photo-1518709594023-6eab9bab7b23?w=1600&q=80', thumbnailUrl: 'https://images.unsplash.com/photo-1518709594023-6eab9bab7b23?w=600&q=80', category: 'Simulation', platform: 'ANDROID', releaseYear: 2019, featured: false, categories: ['UI', 'Gameplay'] },
]

// قوالب تعريبات — 25 لكل منصة (نفس بنية المنصات القديمة)
const MOD_SCOPES = [
  { scope: 'واجهة كاملة', tagSuffix: 'UI', cat: 'UI', size: 'MB 45', fmt: 'zip', ver: '2.1.0', days: 5, dl: 12450, end: 1820, views: 45000 },
  { scope: 'ترجمة كاملة', tagSuffix: 'Translation', cat: 'Gameplay', size: 'MB 38', fmt: '7z', ver: '1.5.0', days: 12, dl: 8900, end: 1240, views: 32000 },
  { scope: 'قوائم', tagSuffix: 'Menus', cat: 'UI', size: 'MB 25', fmt: 'zip', ver: '1.2.0', days: 8, dl: 6700, end: 890, views: 24000 },
  { scope: 'DLCs', tagSuffix: 'DLC', cat: 'Gameplay', size: 'MB 28', fmt: 'zip', ver: '1.0.0', days: 3, dl: 3200, end: 445, views: 11000 },
  { scope: 'المحتوى الإضافي', tagSuffix: 'Expansion', cat: 'Gameplay', size: 'MB 22', fmt: 'zip', ver: '1.0.0', days: 18, dl: 2100, end: 312, views: 8500 },
  { scope: 'إعدادات', tagSuffix: 'Settings', cat: 'UI', size: 'MB 12', fmt: 'zip', ver: '1.0.0', days: 14, dl: 4200, end: 560, views: 15000 },
  { scope: 'قوائم فرعية', tagSuffix: 'Submenus', cat: 'UI', size: 'MB 18', fmt: 'zip', ver: '1.1.0', days: 20, dl: 3100, end: 420, views: 12000 },
  { scope: 'ملفات حفظ', tagSuffix: 'Saves', cat: 'Gameplay', size: 'MB 8', fmt: 'zip', ver: '1.0.0', days: 7, dl: 1800, end: 230, views: 6500 },
  { scope: 'تحسين شامل', tagSuffix: 'Enhanced', cat: 'UI', size: 'MB 55', fmt: '7z', ver: '3.0.0', days: 1, dl: 15200, end: 2100, views: 52000 },
  { scope: 'تجربة كاملة', tagSuffix: 'Complete', cat: 'UI', size: 'MB 65', fmt: '7z', ver: '1.0.0', days: 2, dl: 18500, end: 2800, views: 62000 },
  { scope: 'ملفات ترجمة', tagSuffix: 'Files', cat: 'Gameplay', size: 'MB 5', fmt: 'zip', ver: '1.0.0', days: 30, dl: 2400, end: 310, views: 9000 },
  { scope: 'خطوط', tagSuffix: 'Fonts', cat: 'Graphics', size: 'MB 3', fmt: 'zip', ver: '1.0.0', days: 25, dl: 1500, end: 190, views: 5500 },
  { scope: 'عناصر واجهة', tagSuffix: 'Elements', cat: 'Graphics', size: 'MB 15', fmt: 'zip', ver: '1.0.0', days: 10, dl: 3800, end: 500, views: 14000 },
  { scope: 'مهام', tagSuffix: 'Quests', cat: 'Quests', size: 'MB 20', fmt: 'zip', ver: '1.0.0', days: 15, dl: 4500, end: 620, views: 16000 },
  { scope: 'أسماء عناصر', tagSuffix: 'Items', cat: 'Gameplay', size: 'MB 8', fmt: 'zip', ver: '1.0.0', days: 22, dl: 2000, end: 260, views: 7500 },
  { scope: 'واجهة عناصر', tagSuffix: 'ItemsUI', cat: 'UI', size: 'MB 14', fmt: 'zip', ver: '1.0.0', days: 9, dl: 3200, end: 430, views: 12500 },
  { scope: 'خرائط', tagSuffix: 'Maps', cat: 'Gameplay', size: 'MB 6', fmt: 'zip', ver: '1.0.0', days: 28, dl: 1600, end: 210, views: 6000 },
  { scope: 'صوت', tagSuffix: 'Audio', cat: 'Gameplay', size: 'MB 4', fmt: 'zip', ver: '1.0.0', days: 35, dl: 1200, end: 150, views: 4500 },
  { scope: 'شاشة بداية', tagSuffix: 'MainMenu', cat: 'UI', size: 'MB 10', fmt: 'zip', ver: '1.0.0', days: 11, dl: 2800, end: 370, views: 10000 },
  { scope: 'حوارات', tagSuffix: 'Dialogues', cat: 'Gameplay', size: 'MB 30', fmt: 'zip', ver: '1.0.0', days: 6, dl: 5200, end: 710, views: 19000 },
  { scope: 'نسخة خفيفة', tagSuffix: 'Light', cat: 'UI', size: 'MB 15', fmt: 'zip', ver: '1.0.0', days: 20, dl: 3400, end: 450, views: 13000 },
  { scope: 'تحديث', tagSuffix: 'Update', cat: 'UI', size: 'MB 8', fmt: 'zip', ver: '1.1.0', days: 4, dl: 2600, end: 340, views: 9500 },
  { scope: 'ألقاب', tagSuffix: 'Titles', cat: 'Gameplay', size: 'MB 5', fmt: 'zip', ver: '1.0.0', days: 16, dl: 1900, end: 250, views: 7000 },
  { scope: 'إحصائيات', tagSuffix: 'Stats', cat: 'UI', size: 'MB 7', fmt: 'zip', ver: '1.0.0', days: 13, dl: 1700, end: 220, views: 6200 },
  { scope: 'نسخة تجريبية', tagSuffix: 'Demo', cat: 'UI', size: 'MB 2', fmt: 'zip', ver: '0.9.0', days: 1, dl: 800, end: 100, views: 3000 },
]

const TEAM_MEMBERS = [
  { name: 'مomen Hani', avatarUrl: 'https://i.pravatar.cc/150?img=68', role: 'قائد الفريق', contribution: 'إدارة المشروع والمراجعة النهائية' },
  { name: 'أحمد خليل', avatarUrl: 'https://i.pravatar.cc/150?img=12', role: 'مترجم رئيسي', contribution: 'ترجمة النصوص الأساسية والحوار' },
  { name: 'سارة محمد', avatarUrl: 'https://i.pravatar.cc/150?img=23', role: 'مترجمة', contribution: 'ترجمة القوائم والوصف' },
  { name: 'يوسف علي', avatarUrl: 'https://i.pravatar.cc/150?img=15', role: 'محرر لغوي', contribution: 'مراجعة لغوية وتدقيق' },
]

const CONTACT_LINKS = [
  { type: 'mail', label: 'البريد الإلكتروني', url: 'mailto:team@games-arabic.com' },
  { type: 'website', label: 'الموقع الرسمي', url: 'https://games-arabic.com' },
  { type: 'telegram', label: 'قناة Telegram', url: 'https://t.me/games_arabic' },
  { type: 'youtube', label: 'قناة YouTube', url: 'https://youtube.com/@games_arabic' },
  { type: 'discord', label: 'سيرفر Discord', url: 'https://discord.gg/games_arabic' },
]

const VIDEO_GROUPS = [
  { name: 'فيديوهات شرح التركيب', videos: [
    { title: 'شرح التركيب خطوة بخطوة', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', thumbnail: 'https://images.unsplash.com/photo-1518709594023-6eab9bab7b23?w=400&h=225&fit=crop', duration: '12:45', views: 15420, channel: 'Games Arabic' },
    { title: 'كيفية تفعيل العربية', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', thumbnail: 'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=400&h=225&fit=crop', duration: '5:12', views: 23150, channel: 'Games Arabic' },
  ]},
  { name: 'فيديوهات ترويجية', videos: [
    { title: 'معاينة التعريب الرسمي', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', thumbnail: 'https://images.unsplash.com/photo-1551103782-8ab07afd45c1?w=400&h=225&fit=crop', duration: '2:15', views: 45820, channel: 'Games Arabic Official' },
  ]},
]

const CUSTOM_TABS = [
  { name: 'أسئلة شائعة', slug: 'faq', content: '## أسئلة شائعة\n\n**هل التعريب متوافق مع نسختي؟**\nنعم، التعريب متوافق مع كل النسخ المذكورة.\n\n**كيف أبلّغ عن خطأ؟**\nاستخدم تبويب التعليقات أو راسلنا عبر التواصل.' },
  { name: 'الاعتمادات', slug: 'credits', content: '## الاعتمادات\n\nشكر خاص لكل من ساهم:\n\n- فريق الترجمة\n- المراجعين اللغويين\n- المجتمع العربي للألعاب' },
]

const COMMENTS_DATA = [
  { guestName: 'أحمد_جيمر', guestAvatar: 'https://i.pravatar.cc/100?img=12', text: 'التعريب ممتاز جداً، اشتغل معايا بدون أي مشاكل.', likes: 87, dislikes: 2, isPinned: true, replies: [{ guestName: 'مomen Hani', guestAvatar: 'https://i.pravatar.cc/100?img=68', text: 'شكراً على كلامك الطيب!', likes: 24, dislikes: 0 }] },
  { guestName: 'خالد_سنايبر', guestAvatar: 'https://i.pravatar.cc/100?img=33', text: 'التثبيت سهل جداً. بس لاحظت بعض النصوص مش مترجمة.', likes: 45, dislikes: 3, isEdited: true, replies: [] },
  { guestName: 'سارة_بلايز', guestAvatar: 'https://i.pravatar.cc/100?img=23', text: 'تعريب احترافي بمعنى الكلمة. تستاهلون كل خير.', likes: 32, dislikes: 0, replies: [] },
]

function genDesc(gameName: string, scope: string, platform: string): string {
  return `## عن هذا التعريب\n\n تعريب ${scope} للعبة ${gameName} على ${platform}.\n\n## الميزات\n\n- تعريب ${scope} كامل\n- دعم RTL\n- خطوط عربية واضحة\n\n## التثبيت\n\n1. حمل التعريب\n2. استخرج في مجلد اللعبة\n3. اختر العربية\n4. استمتع!`
}
function genCompat(platform: string): string {
  const map: Record<string, string> = { PS5: 'PS5', X360: 'Xbox 360', ANDROID: 'Android' }
  return `متوافق مع ${map[platform] || platform}`
}
function genChangelog(v: string): string {
  return `## v${v} (الإصدار الحالي)\n- إصلاح أخطاء إملائية\n- تحسين الترجمات\n\n## v1.0.0\n- الإصدار الأول\n`
}

async function main() {
  console.log('🎮 Adding extra games...')
  const games: Record<string, any> = {}
  for (const g of EXTRA_GAMES) {
    const game = await db.game.create({
      data: {
        slug: g.slug, name: g.name, tagline: g.tagline, description: g.description,
        bannerUrl: g.bannerUrl, thumbnailUrl: g.thumbnailUrl, category: g.category,
        platform: g.platform, releaseYear: g.releaseYear, featured: g.featured,
      },
    })
    for (const cat of g.categories) await db.category.create({ data: { name: cat, slug: slugify(cat), gameId: game.id } })
    games[g.slug] = game
  }
  console.log(`  ✅ ${Object.keys(games).length} extra games created`)

  // جلب المستخدمين والفِرق والسلاسل والأقسام الموجودة
  const owner = await db.user.findFirst({ where: { role: 'owner' } })
  const existingTeams = await db.team.findMany()
  const existingSeries = await db.series.findMany()
  const existingSections = await db.section.findMany()
  const sectionMap: Record<string, any> = {}
  for (const s of existingSections) sectionMap[s.key] = s

  const allUsers = await db.user.findMany()
  const usersByRole: Record<string, any[]> = {}
  for (const u of allUsers) {
    if (!usersByRole[u.role]) usersByRole[u.role] = []
    usersByRole[u.role].push(u)
  }

  console.log('📦 Creating extra mods...')
  let modCount = await db.mod.count()
  const platforms = ['PS5', 'X360', 'ANDROID']

  for (const platform of platforms) {
    const platformGames = EXTRA_GAMES.filter(g => g.platform === platform)
    console.log(`  ${platform}: ${platformGames.length} games, 25 mods`)
    const section = sectionMap[platform] || null

    for (let i = 0; i < 25; i++) {
      const ms = MOD_SCOPES[i]
      const gameRaw = platformGames[i % platformGames.length]
      if (!gameRaw) continue
      const game = games[gameRaw.slug]
      if (!game) continue
      const gameName = gameRaw.name

      const prefixes = ['تعريب', 'ترجمة', 'حزمة', 'حزمة تعريب']
      const modName = `${prefixes[i % prefixes.length]} ${ms.scope} — ${gameName}`
      const slug = slugify(`${modName}-${gameRaw.slug}-${modCount + 1}`).slice(0, 100)
      const releaseDate = new Date(Date.now() - ms.days * 86400000)
      const categories = await db.category.findMany({ where: { gameId: game.id } })
      const category = categories[0]
      const team = existingTeams[i % existingTeams.length]
      const authorPool = usersByRole['publisher'] || usersByRole['admin'] || [owner]
      const author = authorPool[i % authorPool.length]

      const mod = await db.mod.create({
        data: {
          slug, name: modName, summary: `تعريب ${ms.scope} للعبة ${gameName} مع دعم كامل للعربية`,
          description: genDesc(gameName, ms.scope, platform), changelog: genChangelog(ms.ver),
          arabicTitle: ms.scope, compatibility: genCompat(platform),
          author: { connect: { id: author.id } },
          game: { connect: { id: game.id } },
          ...(category ? { category: { connect: { id: category.id } } } : {}),
          ...(section ? { sectionRelation: { connect: { id: section.id } } } : {}),
          thumbnailUrl: game.thumbnailUrl, imageUrl: game.bannerUrl,
          galleryUrls: `${game.thumbnailUrl},${game.bannerUrl}`,
          version: ms.ver, fileSize: ms.size, fileFormat: ms.fmt,
          downloads: ms.dl, endorsements: ms.end, views: ms.views,
          comments: COMMENTS_DATA.length, rating: 4.0 + (i % 10) * 0.05,
          ratingCount: Math.floor(ms.end * 0.3), tags: `${ms.tagSuffix},Arabic,${platform}`,
          series: '', translationTeam: team.name,
          translationType: i % 5 === 0 ? 'official' : 'unofficial',
          teamRelation: { connect: { id: team.id } },
          isFeatured: i % 4 === 0, isTrending: i % 3 === 0, isLatest: true,
          releaseDate, workflowStatus: 'PUBLISHED',
        },
      })

      // ملفات
      const fileCount = i % 3 === 0 ? 2 : 1
      for (let fi = 0; fi < fileCount; fi++) {
        const f = await db.modFile.create({
          data: {
            modId: mod.id, title: fi === 0 ? `الملف الرئيسي - ${ms.scope}` : `ملف تصحيحي - ${ms.scope}`,
            description: fi === 0 ? 'الملف الأساسي للتعريب' : 'ملف تصحيحي',
            alert: fi === 0 ? 'تأكد من عمل نسخة احتياطية' : 'يتطلب الملف الرئيسي',
            version: ms.ver, releaseDate, fileSize: ms.size, fileFormat: ms.fmt, order: fi,
          },
        })
        await db.modFileLink.create({
          data: { fileId: f.id, url: `https://www.mediafire.com/file/${slug}-${fi}.zip`, label: fi === 0 ? 'MediaFire' : 'Google Drive', order: 0 },
        })
      }

      // فريق
      for (let ti = 0; ti < TEAM_MEMBERS.length; ti++) {
        const tm = TEAM_MEMBERS[ti]
        await db.modTeamMember.create({ data: { modId: mod.id, name: tm.name, avatarUrl: tm.avatarUrl, role: tm.role, contribution: tm.contribution, order: ti } })
      }

      // تواصل
      for (let ci = 0; ci < CONTACT_LINKS.length; ci++) {
        const c = CONTACT_LINKS[ci]
        await db.modContactLink.create({ data: { modId: mod.id, type: c.type, label: c.label, url: c.url, order: ci } })
      }

      // فيديوهات
      for (let gi = 0; gi < VIDEO_GROUPS.length; gi++) {
        const g = VIDEO_GROUPS[gi]
        const group = await db.modVideoGroup.create({ data: { modId: mod.id, name: g.name, order: gi } })
        for (let vi = 0; vi < g.videos.length; vi++) {
          const v = g.videos[vi]
          await db.modVideo.create({ data: { groupId: group.id, title: v.title, url: v.url, thumbnail: v.thumbnail, duration: v.duration, views: v.views, channel: v.channel, order: vi } })
        }
      }

      // تبويبات
      for (let ti = 0; ti < CUSTOM_TABS.length; ti++) {
        const t = CUSTOM_TABS[ti]
        await db.modCustomTab.create({ data: { modId: mod.id, name: t.name, slug: t.slug, content: t.content, order: ti, visible: true } })
      }

      // تعليقات
      for (const c of COMMENTS_DATA) {
        const comment = await db.modComment.create({
          data: { modId: mod.id, guestName: c.guestName, guestAvatar: c.guestAvatar, text: c.text, likes: c.likes, dislikes: c.dislikes, isPinned: c.isPinned || false, isEdited: c.isEdited || false },
        })
        for (const r of c.replies || []) {
          await db.modComment.create({ data: { modId: mod.id, parentId: comment.id, guestName: r.guestName, guestAvatar: r.guestAvatar, text: r.text, likes: r.likes, dislikes: r.dislikes } })
        }
      }
      modCount++
    }
  }

  // ربط التعريبات القديمة بالأقسام
  console.log('🔗 Linking existing mods to sections...')
  const allGames = await db.game.findMany()
  const gameSectionMap: Record<string, string> = {}
  for (const g of allGames) gameSectionMap[g.id] = g.platform

  const unlinkdMods = await db.mod.findMany({ where: { sectionId: null } })
  let linked = 0
  for (const mod of unlinkdMods) {
    const platform = gameSectionMap[mod.gameId]
    const section = sectionMap[platform]
    if (section) {
      await db.mod.update({ where: { id: mod.id }, data: { sectionId: section.id } })
      linked++
    }
  }
  console.log(`  ✅ ${linked} mods linked to sections`)

  // تحديث aggregates
  console.log('📊 Updating aggregates...')
  for (const game of Object.values(games)) {
    const agg = await db.mod.aggregate({ where: { gameId: game.id }, _sum: { downloads: true, endorsements: true }, _count: true })
    await db.game.update({ where: { id: game.id }, data: { modCount: agg._count, totalDownloads: agg._sum.downloads || 0, totalEndorsements: agg._sum.endorsements || 0 } })
  }
  for (const team of existingTeams) {
    const count = await db.mod.count({ where: { teamId: team.id } })
    await db.team.update({ where: { id: team.id }, data: { modCount: count } })
  }

  const totalMods = await db.mod.count()
  const totalGames = await db.game.count()
  console.log(`\n✅ Done! Total: ${totalGames} games, ${totalMods} mods`)
}

main().catch((e) => { console.error(e); process.exit(1) }).finally(async () => { await db.$disconnect() })
