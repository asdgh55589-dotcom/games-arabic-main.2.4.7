// Seed script شامل — بيانات تجريبية واقعية لجميع نماذج قاعدة البيانات
// يشمل: Users, Follows, Endorsements, News, AuditLog, SiteSettings,
//        HomepageAds, Notifications, IpBans, TrustScores, Reports,
//        Bookmarks, CommentLikes, UserActions, TierRules, TierHistory,
//        SpecialRoles, TeamMemberships, TeamContactLinks, TeamCustomTabs, TeamFollows
import { db } from '../src/lib/db'
import bcrypt from 'bcryptjs'

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9\u0600-\u06FF]+/g, '-').replace(/^-|-$/g, '')

// ===== مستخدمون تجريبيون =====
const TEST_USERS = [
  { username: 'ahmed_gamer', email: 'ahmed@test.com', avatarUrl: 'https://i.pravatar.cc/300?img=1', bio: 'لاعب محترف ومترجم هاوي. أحب ألعاب RPG وأكشن.', role: 'member', tier: 2, websiteUrl: 'https://ahmed-gamer.blogspot.com', twitterUrl: 'https://twitter.com/ahmed_gamer' },
  { username: 'sara_translator', email: 'sara@test.com', avatarUrl: 'https://i.pravatar.cc/300?img=5', bio: 'مترجمة متخصصة في تعريب ألعاب الفيديو. عملت على أكثر من 15 تعريب.', role: 'member', tier: 3, websiteUrl: 'https://sara-translation.com' },
  { username: 'omar_dev', email: 'omar@test.com', avatarUrl: 'https://i.pravatar.cc/300?img=8', bio: 'مطور ألعاب ومحترف في إنشاء المودات.', role: 'member', tier: 1, githubUrl: 'https://github.com/omar-dev' },
  { username: 'fatima_reviewer', email: 'fatima@test.com', avatarUrl: 'https://i.pravatar.cc/300?img=9', bio: 'مراجع لغوي محترف. أتحقق من جودة الترجمة وجودة النصوص.', role: 'member', tier: 2 },
  { username: 'youssef_patcher', email: 'youssef@test.com', avatarUrl: 'https://i.pravatar.cc/300?img=11', bio: 'متخصص في إنشاء الـ patches والملفات التصحيحية.', role: 'member', tier: 1, discordUrl: 'https://discord.gg/youssef' },
  { username: 'layla_designer', email: 'layla@test.com', avatarUrl: 'https://i.pravatar.cc/300?img=16', bio: 'مصممة واجهات مستخدم. أعمل على تحسين شكل التعريبات.', role: 'member', tier: 2, instagramUrl: 'https://instagram.com/layla_designs' },
  { username: 'hassan_modder', email: 'hassan@test.com', avatarUrl: 'https://i.pravatar.cc/300?img=12', bio: 'محترف في إنشاء المودات والتعريبات التقنية.', role: 'member', tier: 4, youtubeUrl: 'https://youtube.com/@hassan_mods' },
  { username: 'nora_writer', email: 'nora@test.com', avatarUrl: 'https://i.pravatar.cc/300?img=20', bio: 'كاتبة محتوى ومراجعة ألعاب. أكتب مراجعات تفصيلية.', role: 'member', tier: 2, tiktokUrl: 'https://tiktok.com/@nora_gaming' },
  { username: 'mohamed_speed', email: 'mohamed@test.com', avatarUrl: 'https://i.pravatar.cc/300?img=14', bio: 'مترجم سريع. أعمل على التعريب في أول 24 ساعة من الإصدار.', role: 'member', tier: 1 },
  { username: 'dina_beta', email: 'dina@test.com', avatarUrl: 'https://i.pravatar.cc/300?img=25', bio: 'مختبرة بيتا للتعريبات. أتحقق من التوافق والأخطاء.', role: 'member', tier: 1 },
]

// ===== ألعاب (للاستخدام في التعريفات) =====
const GAME_SLUGS = [
  'the-witcher-3-pc', 'skyrim-special-edition-pc', 'cyberpunk-2077-pc',
  'zelda-breath-of-the-wild-ns', 'super-mario-odyssey-ns', 'animal-crossing-ns',
  'god-of-war-ps4', 'spider-man-ps4', 'bloodborne-ps4',
  'last-of-us-ps3', 'red-dead-redemption-ps3',
  'shadow-of-the-colossus-ps2', 'god-of-war-2-ps2',
  'final-fantasy-7-ps1', 'metal-gear-solid-ps1',
]

// ===== أخبار واقعية =====
const NEWS_DATA = [
  { slug: 'witcher-3-arabic-v2', title: 'إصدار التعريب الكامل لـ The Witcher 3 النسخة 2.1.0', summary: 'تم إصدار التعريب الكامل لـ The Witcher 3 مع دعم الـ Next-Gen وتحسينات جديدة', content: '## إصدار التعريب الكامل\n\nيسرنا الإعلان عن إصدار التعريب الكامل لـ The Witcher 3: Wild Hunt النسخة 2.1.0. يشمل هذا الإصدار:\n\n- دعم كامل للنسخة Next-Gen\n- تحسين دقة الترجمة لأكثر من 5000 نص\n- إصلاح أخطاء سابقة في القوائم الفرعية\n- خطوط عربية جديدة وأوضح\n\n### كيفية التثبيت\n1. حمل الملف من صفحة التعريب\n2. استخرج الملفات في مجلد اللعبة\n3. اختر العربية من الإعدادات\n\nنتمنى أن تستمتعوا بالتجربة!', category: 'announcement', type: 'featured', isSticky: true, visible: true, order: 1, views: 12450 },
  { slug: 'site-update-v3', title: 'تحديث المنصة الجديد — واجهة محسّنة وسرعة أعلى', summary: 'تحديث كبير للمنصة يشمل تحسينات في الواجهة والسرعة والبحث', content: '## تحديث المنصة v3.0\n\nأطلقنا تحديثاً كبيراً للمنصة يشمل:\n\n- واجهة جديدة كلياً\n- تحسين سرعة التحميل بنسبة 40%\n- بحث متقدم عن التعريفات\n- نظام إشعارات جديد\n- دعم الظلام الداكن\n\n### ملاحظات\nالتحديث تم إطلاقه تدريجياً. إذا واجهت أي مشاكل، أبلغنا عبر Discord.', category: 'update', type: 'featured', isSticky: false, visible: true, order: 2, views: 8920 },
  { slug: 'modding-contest-2026', title: 'مسابقة تعريب الألعاب 2026 — سجّل الآن!', summary: 'انضم لمسابقة تعريب الألعاب الكبرى واربح جوائز قيمة', content: '## مسابقة التعريب 2026\n\nنعلن عن انطلاق مسابقة تعريب الألعاب الكبرى لعام 2026!\n\n### التفاصيل\n- **الفئة الأولى:** أفضل تعريب لواجهة لعبة\n- **الفئة الثانية:** أفضل تعريب لمحتوى قصة\n- **الفئة الثالثة:** أفضل تعريب تقني\n\n### الجوائز\n- المركز الأول: 500$ + شهادة تقدير\n- المركز الثاني: 300$ + شهادة تقدير\n- المركز الثالث: 150$ + شهادة تقدير\n\n### التسجيل\nالتسجيل مفتوح حتى 30 مارس 2026.\n\nسجّل الآن وانضم لأفضل المترجمين العرب!', category: 'event', type: 'featured', isSticky: false, visible: true, order: 3, views: 15600 },
  { slug: 'god-of-war-ragnarok-arabic', title: 'بداية مشروع تعريب God of War Ragnarök', summary: 'فريق التعريب العربي يعلن عن بدء العمل على تعريب God of War Ragnarök', content: '## مشروع تعريب God of War Ragnarök\n\nيسرنا الإعلان عن بدء العمل على مشروع تعريب God of War Ragnarök. المشروع يشمل:\n\n- تعريب كامل للواجهة\n- ترجمة الحوارات والنصوص\n- دعم RTL كامل\n\n### فريق العمل\n- قائد المشروع: مomen Hani\n- مترجمون رئيسيون: 4 أعضاء\n- مراجعون لغويون: 2 أعضاء\n\n### الجدول الزمني\nنتوقع الانتهاء خلال 3 أشهر.\n\nتابعونا للحصول على آخر التحديثات!', category: 'announcement', type: 'ticker', isSticky: false, visible: true, order: 4, views: 6780 },
  { slug: 'switch-hacking-guide', title: 'دليل شامل لكسر حماية Nintendo Switch', summary: 'دليل خطوة بخطوة لكسر حماية Nintendo Switch وتثبيت التعريبات', content: '## دليل كسر حماية Nintendo Switch\n\n### المطلوب\n- Nintendo Switch (أي إصدار)\n- بطاقة SD بسعة 64GB على الأقل\n- جهاز كمبيوتر\n\n### الخطوات\n1. حمل Atmosphère من الموقع الرسمي\n2. استخرج الملفات على بطاقة SD\n3. أعد تشغيل الجهاز في وضع payloads\n4. ثبّت Homebrew Menu\n\n### ملاحظات أمنية\n- استخدم نسخة احتياطية من NAND\n- لا تستخدم الحساب الرسمي في وضع CFW\n- تحقق من توافق كل تعريب مع إصدار Atmosphère الخاص بك', category: 'general', type: 'featured', isSticky: false, visible: true, order: 5, views: 23400 },
  { slug: 'weekly-mod-highlights', title: 'أفضل التعريبات هذا الأسبوع — مارس 2026', summary: 'قائمة بأفضل التعريبات والإصدارات الجديدة هذا الأسبوع', content: '## أفضل التعريبات هذا الأسبوع\n\n### 1. تعريب God of War Ragnarök (تمهيدي)\nالإصدار: v0.1.0 | التنزيلات: 3,200\n\n### 2. تعريب Zelda: Tears of the Kingdom\nالإصدار: v2.0.0 | التنزيلات: 8,900\n\n### 3. تعريب Final Fantasy XVI\nالإصدار: v1.0.0 | التنزيلات: 5,600\n\n### 4. تعريب Spider-Man 2\nالإصدار: v1.2.0 | التنزيلات: 4,100\n\nتمنياتنا بتجربة ممتعة!', category: 'general', type: 'ticker', isSticky: true, visible: true, order: 6, views: 9870 },
  { slug: 'community-rules-update', title: 'تحديث قواعد المجتمع — يرجى القراءة', summary: 'تم تحديث قواعد المجتمع. اقرأها للمحافظة على بيئة م Helm', content: '## قواعد المجتمع المحدثة\n\n### القواعد الجديدة\n1. **ممنوع التكرار:** لا تنشر نفس التعليق أكثر من مرة\n2. **احترام المترجمين:** انتقد العمل وليس الشخص\n3. **ممنوع الروابط المشبوهة:** فقط روابط موثوقة\n4. **التقييم العادل:** قيّم بناءً على جودة العمل\n\n### العقوبات\n- التكرار: تحذير أول ثم حظر مؤقت\n- الإهانة: حظر فوري\n- الروابط المشبوهة: حذف التعليق + تحذير\n\nنتمنى Cooperation من الجميع.', category: 'announcement', type: 'featured', isSticky: false, visible: true, order: 7, views: 4560 },
]

// ===== إعدادات الموقع =====
const SITE_SETTINGS = [
  { key: 'site_name', value: 'ألعاب بالعربي', group: 'general' },
  { key: 'site_description', value: 'أكبر منصة لتعريب وأرشفة ألعاب الفيديو في العالم العربي', group: 'general' },
  { key: 'site_url', value: 'https://games-arabic.com', group: 'general' },
  { key: 'contact_email', value: 'support@games-arabic.com', group: 'general' },
  { key: 'discord_url', value: 'https://discord.gg/games-arabic', group: 'social' },
  { key: 'twitter_url', value: 'https://twitter.com/games_arabic', group: 'social' },
  { key: 'youtube_url', value: 'https://youtube.com/@games_arabic', group: 'social' },
  { key: 'telegram_url', value: 'https://t.me/games_arabic', group: 'social' },
  { key: 'primary_color', value: '#ff8c00', group: 'appearance' },
  { key: 'dark_mode_enabled', value: 'true', group: 'appearance' },
  { key: 'rtl_enabled', value: 'true', group: 'appearance' },
  { key: 'meta_title', value: 'ألعاب بالعربي — تعريب ألعاب الفيديو', group: 'seo' },
  { key: 'meta_description', value: 'منصة عربية متخصصة في تعريب وأرشفة ألعاب الفيديو لجميع المنصات', group: 'seo' },
  { key: 'analytics_enabled', value: 'true', group: 'general' },
  { key: 'maintenance_mode', value: 'false', group: 'general' },
]

// ===== إعلانات الصفحة الرئيسية =====
const HOMEPAGE_ADS = [
  { type: 'youtube', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', title: 'شرح تعريب The Witcher 3', description: 'فيديو شرح خطوة بخطوة لتثبيت التعريب', size: 'large', order: 1, visible: true },
  { type: 'image', url: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=800&q=80', title: 'مسابقة التعريب الكبرى', description: 'سجّل الآن في مسابقة تعريب الألعاب 2026', link: 'https://games-arabic.com/contest', size: 'medium', order: 2, visible: true },
  { type: 'html', url: '<div style="background:linear-gradient(135deg,#ff8c00,#ff6600);color:white;padding:20px;border-radius:12px;text-align:center;"><h3 style="margin:0;">انضم لفريق التعريب</h3><p style="margin:8px 0;">نبحث عن مترجمين موهوبين</p><a href="#" style="color:white;font-weight:bold;">سجّل الآن</a></div>', title: 'انضم لفريقنا', description: 'نبحث عن مترجمين جدد', size: 'small', order: 3, visible: true },
]

// ===== تعريفات تجريبية =====
const ENDORSEMENT_MODS: string[] = [] // will be filled dynamically

// ===== تعليقات إضافية =====
const EXTRA_COMMENTS = [
  { guestName: 'عمر_الروبوت', guestAvatar: 'https://i.pravatar.cc/100?img=8', text: 'أفضل تعريب شفته! الجودة عالية جداً والترجمة طبيعية.', likes: 56, dislikes: 1, isPinned: false },
  { guestName: 'فاطمة_قيراط', guestAvatar: 'https://i.pravatar.cc/100?img=9', text: 'التعريب شغال معايا على PS4 بدون مشاكل. شكراً جزيلاً لفريق العمل!', likes: 34, dislikes: 0, isPinned: false },
  { guestName: 'يوسف_بلاستيشن', guestAvatar: 'https://i.pravatar.cc/100?img=11', text: 'هل في تعريب للنسخة الـ GOTY؟ حملت اللعبة كاملة بس التعريب يشتغل مع النسخة العادية بس.', likes: 28, dislikes: 5, isPinned: false },
  { guestName: 'نورا_الأنمي', guestAvatar: 'https://i.pravatar.cc/100?img=20', text: 'الخط العربي واضح جداً وحلو. بس في بعض الكلمات مترجمة حرفياً ومش مفهومة.', likes: 19, dislikes: 8, isPinned: false },
  { guestName: 'حسن_المودز', guestAvatar: 'https://i.pravatar.cc/100?img=12', text: 'ممتاز! بس ملاحظة بسيطة: بعض الأيقونات متداخلة مع النص العربي. ممكن تتظبط؟', likes: 15, dislikes: 2, isPinned: false },
]

// ===== بلاغات تجريبية =====
const REPORTS_DATA = [
  { targetType: 'comment' as const, reason: 'inappropriate' as const, priority: 'high' as const, description: 'تعليق يحتوي على كلمات بذيئة وإهانة للمترجمين', status: 'new' as const },
  { targetType: 'mod' as const, reason: 'technical' as const, priority: 'medium' as const, description: 'رابط MediaFire لا يعمل ويُظهر خطأ 404', status: 'under_review' as const },
  { targetType: 'user' as const, reason: 'spam' as const, priority: 'low' as const, description: 'حساب جديد ينشر روابط مشبوهة فقط', status: 'resolved' as const },
  { targetType: 'comment' as const, reason: 'spam' as const, priority: 'medium' as const, description: 'تعليقات متكررة لإعلان مواقع أخرى', status: 'new' as const },
  { targetType: 'mod' as const, reason: 'other' as const, priority: 'high' as const, description: 'الملف يحتوي على فيروس حسب تقرير Windows Defender', status: 'new' as const },
]

// ===== أدوار خاصة =====
const SPECIAL_ROLES = [
  { key: 'official_translator', name: 'مترجم رسمي', nameEn: 'Official Translator', icon: 'Languages', color: '#ff8c00', description: 'مترجم معتمد من المنصة', isActive: true },
  { key: 'reviewer', name: 'مراجع', nameEn: 'Reviewer', icon: 'Search', color: '#3b82f6', description: 'مراجع لغوي معتمد', isActive: true },
  { key: 'beta_tester', name: 'مختبر بيتا', nameEn: 'Beta Tester', icon: 'Bug', color: '#8b5cf6', description: 'مختبر بيتا للتعريبات', isActive: true },
  { key: 'mod_creator', name: 'منشئ مودات', nameEn: 'Mod Creator', icon: 'Wrench', color: '#10b981', description: 'منشئ مودات محترف', isActive: true },
  { key: 'community_leader', name: 'قائد مجتمع', nameEn: 'Community Leader', icon: 'Crown', color: '#f59e0b', description: 'قائد نشط في المجتمع', isActive: true },
]

// ===== قواعد المستويات =====
const TIER_RULES = [
  { tier: 0, name: 'مبتدئ', nameEn: 'Beginner', requiredMods: 0, requiredDownloads: 0, requiredRating: 0, requiredQualityScore: 0, badge: 'bronze', badgeColor: '#cd7f32' },
  { tier: 1, name: 'مترجم', nameEn: 'Translator', requiredMods: 1, requiredDownloads: 100, requiredRating: 3.0, requiredQualityScore: 20, badge: 'silver', badgeColor: '#c0c0c0' },
  { tier: 2, name: 'محترف', nameEn: 'Professional', requiredMods: 5, requiredDownloads: 1000, requiredRating: 4.0, requiredQualityScore: 50, badge: 'gold', badgeColor: '#ffd700' },
  { tier: 3, name: 'خبير', nameEn: 'Expert', requiredMods: 15, requiredDownloads: 5000, requiredRating: 4.5, requiredQualityScore: 75, badge: 'platinum', badgeColor: '#e5e4e2' },
  { tier: 4, name: 'مشرف', nameEn: 'Supervisor', requiredMods: 30, requiredDownloads: 15000, requiredRating: 4.7, requiredQualityScore: 90, badge: 'diamond', badgeColor: '#b9f2ff' },
  { tier: 5, name: 'مدير', nameEn: 'Director', requiredMods: 50, requiredDownloads: 50000, requiredRating: 4.9, requiredQualityScore: 95, badge: 'crown', badgeColor: '#ffd700' },
]

async function main() {
  console.log('🎮 Starting comprehensive seed...\n')

  // ===== 1. المستخدمون =====
  console.log('👤 Seeding users...')
  const passwordHash = await bcrypt.hash('Test@123456', 10)
  const createdUsers: any[] = []

  for (const u of TEST_USERS) {
    const user = await db.user.create({
      data: {
        username: u.username,
        email: u.email,
        password: passwordHash,
        avatarUrl: u.avatarUrl,
        bio: u.bio,
        role: u.role,
        tier: u.tier,
        websiteUrl: u.websiteUrl,
        twitterUrl: u.twitterUrl,
        instagramUrl: u.instagramUrl,
        tiktokUrl: u.tiktokUrl,
        youtubeUrl: u.youtubeUrl,
        githubUrl: u.githubUrl,
        discordUrl: u.discordUrl,
        joinedAt: new Date(Date.now() - Math.floor(Math.random() * 365 + 30) * 86400000),
        lastLoginAt: new Date(Date.now() - Math.floor(Math.random() * 7) * 86400000),
        loginCount: Math.floor(Math.random() * 100) + 5,
        emailVerified: true,
      },
    })
    createdUsers.push(user)
    console.log(`  ✅ ${user.username}`)
  }

  // ===== 2. المتابعات (Follows) =====
  console.log('\n👥 Seeding follows...')
  let followCount = 0
  for (const user of createdUsers) {
    // كل مستخدم يتبع 3-6 مستخدمين عشوائيين
    const followCountTarget = Math.floor(Math.random() * 4) + 3
    const otherUsers = createdUsers.filter(u => u.id !== user.id)
    const shuffled = otherUsers.sort(() => 0.5 - Math.random()).slice(0, followCountTarget)
    for (const following of shuffled) {
      try {
        await db.follow.create({
          data: { followerId: user.id, followingId: following.id },
        })
        followCount++
      } catch { }
    }
  }
  console.log(`  ✅ ${followCount} follows created`)

  // ===== 3. التصويتات (Endorsements) =====
  console.log('\n👍 Seeding endorsements...')
  const allMods = await db.mod.findMany({ select: { id: true, name: true } })
  let endorsementCount = 0
  for (const user of createdUsers) {
    // كل مستخدم يصوت لـ 5-10 تعريبات
    const modsToVote = allMods.sort(() => 0.5 - Math.random()).slice(0, Math.floor(Math.random() * 6) + 5)
    for (const mod of modsToVote) {
      try {
        await db.endorsement.create({
          data: { userId: user.id, modId: mod.id, value: Math.random() > 0.15 ? 'up' : 'down' },
        })
        endorsementCount++
      } catch { }
    }
  }
  console.log(`  ✅ ${endorsementCount} endorsements created`)

  // ===== 4. الأخبار =====
  console.log('\n📰 Seeding news...')
  let newsCount = 0
  for (const n of NEWS_DATA) {
    await db.news.create({
      data: {
        slug: n.slug,
        title: n.title,
        summary: n.summary,
        content: n.content,
        imageUrl: `https://images.unsplash.com/photo-1542751371-adc38448a05e?w=800&q=60`,
        category: n.category,
        type: n.type,
        isSticky: n.isSticky,
        isAnimated: true,
        visible: n.visible,
        order: n.order,
        views: n.views,
        publishAt: new Date(Date.now() - Math.floor(Math.random() * 30) * 86400000),
      },
    })
    newsCount++
    console.log(`  ✅ ${n.title.slice(0, 50)}...`)
  }

  // ===== 5. إعدادات الموقع =====
  console.log('\n⚙️  Seeding site settings...')
  let settingsCount = 0
  for (const s of SITE_SETTINGS) {
    await db.siteSetting.upsert({
      where: { key: s.key },
      update: { value: s.value },
      create: { key: s.key, value: s.value, group: s.group },
    })
    settingsCount++
  }
  console.log(`  ✅ ${settingsCount} settings created`)

  // ===== 6. إعلانات الصفحة الرئيسية =====
  console.log('\n📢 Seeding homepage ads...')
  let adsCount = 0
  for (const a of HOMEPAGE_ADS) {
    await db.homepageAd.create({
      data: {
        type: a.type,
        url: a.url,
        title: a.title,
        description: a.description,
        link: a.link || null,
        size: a.size,
        order: a.order,
        visible: a.visible,
      },
    })
    adsCount++
  }
  console.log(`  ✅ ${adsCount} ads created`)

  // ===== 7. الإشعارات =====
  console.log('\n🔔 Seeding notifications...')
  const NOTIFICATION_TYPES = ['mod_new', 'mod_update', 'comment_new', 'endorsement', 'follow', 'mention', 'announcement']
  const NOTIFICATION_TITLES: Record<string, string[]> = {
    mod_new: ['تعريب جديد متاح', 'تم نشر تعريب جديد'],
    mod_update: ['تحديث التعريب', 'إصدار جديد للتعريب'],
    comment_new: ['تعليق جديد', 'رد على تعليقك'],
    endorsement: ['تصويت جديد', 'أحد أعجب بعملك'],
    follow: ['متابع جديد', 'بدأ بمتابعتك'],
    mention: ['إشارة لك', 'ذُكر اسمك في تعليق'],
    announcement: ['إعلان هام', 'تحديث على المنصة'],
  }
  let notificationCount = 0
  for (const user of createdUsers.slice(0, 5)) {
    // كل مستخدم يحصل على 5-10 إشعارات
    const count = Math.floor(Math.random() * 6) + 5
    for (let i = 0; i < count; i++) {
      const type = NOTIFICATION_TYPES[Math.floor(Math.random() * NOTIFICATION_TYPES.length)]
      const titles = NOTIFICATION_TITLES[type]
      const title = titles[Math.floor(Math.random() * titles.length)]
      await db.notification.create({
        data: {
          userId: user.id,
          actorId: createdUsers[Math.floor(Math.random() * createdUsers.length)].id,
          type,
          title,
          message: `${title} — تحقق من التفاصيل`,
          isRead: Math.random() > 0.5,
          readAt: Math.random() > 0.5 ? new Date(Date.now() - Math.floor(Math.random() * 7) * 86400000) : null,
        },
      })
      notificationCount++
    }
  }
  console.log(`  ✅ ${notificationCount} notifications created`)

  // ===== 8. تفضيلات الإشعارات =====
  console.log('\n⚙️  Seeding notification preferences...')
  let prefCount = 0
  for (const user of createdUsers) {
    await db.notificationPreference.create({
      data: {
        userId: user.id,
        emailEnabled: Math.random() > 0.3,
        pushEnabled: Math.random() > 0.2,
        dailySummary: Math.random() > 0.4,
        summaryIntervalDays: Math.floor(Math.random() * 7) + 1,
        likeThreshold: Math.floor(Math.random() * 50) + 10,
      },
    })
    prefCount++
  }
  console.log(`  ✅ ${prefCount} preferences created`)

  // ===== 9. حظر IP =====
  console.log('\n🚫 Seeding IP bans...')
  const IP_BANS = [
    { ipAddress: '192.168.1.100', reason: 'نشر روابط مشبوهة', bannedBy: null },
    { ipAddress: '10.0.0.55', reason: 'حساب مزيف', bannedBy: null },
    { ipAddress: '172.16.0.200', reason: 'إهانة المستخدمين', bannedBy: null },
  ]
  let banCount = 0
  for (const b of IP_BANS) {
    await db.ipBan.create({
      data: {
        ipAddress: b.ipAddress,
        reason: b.reason,
        bannedBy: null,
        bannedByUsername: 'GADMIx',
        expiresAt: Math.random() > 0.5 ? new Date(Date.now() + 30 * 86400000) : null,
      },
    })
    banCount++
  }
  console.log(`  ✅ ${banCount} IP bans created`)

  // ===== 10. نقاط الثقة =====
  console.log('\n🎯 Seeding trust scores...')
  let trustCount = 0
  for (const user of createdUsers) {
    const totalReports = Math.floor(Math.random() * 20) + 1
    const confirmedReports = Math.floor(Math.random() * totalReports)
    await db.userTrustScore.create({
      data: {
        userId: user.id,
        score: Math.floor(Math.random() * 60) + 40,
        reportAccuracy: totalReports > 0 ? confirmedReports / totalReports : 0,
        totalReports,
        confirmedReports,
        rejectedReports: totalReports - confirmedReports,
        reportsReceived: Math.floor(Math.random() * 5),
        reportsReceivedConfirmed: 0,
      },
    })
    trustCount++
  }
  console.log(`  ✅ ${trustCount} trust scores created`)

  // ===== 11. البلاغات =====
  console.log('\n🚨 Seeding reports...')
  let reportCount = 0
  for (const r of REPORTS_DATA) {
    const reporter = createdUsers[Math.floor(Math.random() * createdUsers.length)]
    const assignedTo = createdUsers[0] // admin
    await db.report.create({
      data: {
        reporterId: reporter.id,
        targetType: r.targetType,
        targetModId: allMods.length > 0 ? allMods[Math.floor(Math.random() * allMods.length)].id : null,
        targetCommentId: null,
        targetUserId: null,
        reason: r.reason,
        priority: r.priority,
        description: r.description,
        status: r.status,
        assignedToId: assignedTo.id,
        fraudScore: Math.random() * 0.3,
        repeatOffenseLevel: 0,
      },
    })
    reportCount++
    console.log(`  ✅ ${r.reason}`)
  }

  // ===== 12. إشارات البلاغات المزيفة =====
  console.log('\n🔍 Seeding fraud signals...')
  const reports = await db.report.findMany({ select: { id: true } })
  let signalCount = 0
  for (const report of reports.slice(0, 3)) {
    const signalTypes = ['duplicate_pattern', 'timing_anomaly', 'target_harassment']
    for (const st of signalTypes) {
      if (Math.random() > 0.5) {
        await db.reportFraudSignal.create({
          data: {
            reportId: report.id,
            signalType: st,
            score: Math.random() * 0.5,
            description: `إشارة ${st} مكتشفة تلقائياً`,
          },
        })
        signalCount++
      }
    }
  }
  console.log(`  ✅ ${signalCount} fraud signals created`)

  // ===== 13. المفضلة (Bookmarks) =====
  console.log('\n🔖 Seeding bookmarks...')
  let bookmarkCount = 0
  for (const user of createdUsers) {
    const modsToBookmark = allMods.sort(() => 0.5 - Math.random()).slice(0, Math.floor(Math.random() * 5) + 2)
    for (const mod of modsToBookmark) {
      try {
        await db.bookmark.create({
          data: { userId: user.id, modId: mod.id },
        })
        bookmarkCount++
      } catch { }
    }
  }
  console.log(`  ✅ ${bookmarkCount} bookmarks created`)

  // ===== 14. إعجابات التعليقات =====
  console.log('\n❤️  Seeding comment likes...')
  const comments = await db.modComment.findMany({ select: { id: true } })
  let commentLikeCount = 0
  for (const user of createdUsers.slice(0, 6)) {
    const commentsToLike = comments.sort(() => 0.5 - Math.random()).slice(0, Math.floor(Math.random() * 4) + 1)
    for (const comment of commentsToLike) {
      try {
        await db.commentLike.create({
          data: {
            userId: user.id,
            commentId: comment.id,
            value: Math.random() > 0.2 ? 'like' : 'dislike',
          },
        })
        commentLikeCount++
      } catch { }
    }
  }
  console.log(`  ✅ ${commentLikeCount} comment likes created`)

  // ===== 15. إجراءات المستخدمين =====
  console.log('\n⚡ Seeding user actions...')
  const ACTIONS = ['login', 'logout', 'password_change', 'email_verified']
  let actionCount = 0
  for (const user of createdUsers) {
    const actionCountTarget = Math.floor(Math.random() * 4) + 2
    for (let i = 0; i < actionCountTarget; i++) {
      const action = ACTIONS[Math.floor(Math.random() * ACTIONS.length)]
      await db.userAction.create({
        data: {
          userId: user.id,
          action,
          byUserId: null,
          byUsername: null,
          ipAddress: `192.168.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
        },
      })
      actionCount++
    }
  }
  console.log(`  ✅ ${actionCount} user actions created`)

  // ===== 16. قواعد المستويات =====
  console.log('\n🏆 Seeding tier rules...')
  for (const r of TIER_RULES) {
    await db.tierRule.upsert({
      where: { tier: r.tier },
      update: {},
      create: {
        tier: r.tier,
        name: r.name,
        nameEn: r.nameEn,
        requiredMods: r.requiredMods,
        requiredDownloads: r.requiredDownloads,
        requiredRating: r.requiredRating,
        requiredQualityScore: r.requiredQualityScore,
        badge: r.badge,
        badgeColor: r.badgeColor,
      },
    })
  }
  console.log(`  ✅ ${TIER_RULES.length} tier rules created`)

  // ===== 17. سجل تغيير المستويات =====
  console.log('\n📊 Seeding tier history...')
  let tierHistoryCount = 0
  for (const user of createdUsers) {
    if (user.tier > 0) {
      await db.tierHistory.create({
        data: {
          userId: user.id,
          fromTier: 0,
          toTier: user.tier,
          reason: 'auto',
          notes: 'ترقية تلقائية بناءً على النشاط',
        },
      })
      tierHistoryCount++
    }
  }
  console.log(`  ✅ ${tierHistoryCount} tier history records created`)

  // ===== 18. الأدوار الخاصة =====
  console.log('\n🎭 Seeding special roles...')
  for (const r of SPECIAL_ROLES) {
    await db.specialRole.upsert({
      where: { key: r.key },
      update: {},
      create: {
        key: r.key,
        name: r.name,
        nameEn: r.nameEn,
        icon: r.icon,
        color: r.color,
        description: r.description,
        isActive: r.isActive,
      },
    })
  }
  console.log(`  ✅ ${SPECIAL_ROLES.length} special roles created`)

  // ===== 19. سجل التدقيق (Audit Log) =====
  console.log('\n📝 Seeding audit logs...')
  const AUDIT_ACTIONS = ['create', 'update', 'delete', 'login', 'moderate']
  const AUDIT_ENTITIES = ['mod', 'game', 'user', 'comment', 'setting']
  let auditCount = 0
  for (let i = 0; i < 20; i++) {
    const user = createdUsers[Math.floor(Math.random() * createdUsers.length)]
    const action = AUDIT_ACTIONS[Math.floor(Math.random() * AUDIT_ACTIONS.length)]
    const entity = AUDIT_ENTITIES[Math.floor(Math.random() * AUDIT_ENTITIES.length)]
    await db.auditLog.create({
      data: {
        userId: user.id,
        username: user.username,
        action,
        entity,
        entityId: null,
        details: JSON.stringify({ action, entity, timestamp: new Date().toISOString() }),
        ipAddress: `192.168.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
      },
    })
    auditCount++
  }
  console.log(`  ✅ ${auditCount} audit logs created`)

  // ===== ملخص نهائي =====
  console.log('\n' + '='.repeat(50))
  console.log('🎉 Comprehensive seed completed successfully!')
  console.log('='.repeat(50))
  console.log(`  👤 Users:        ${createdUsers.length}`)
  console.log(`  👥 Follows:      ${followCount}`)
  console.log(`  👍 Endorsements: ${endorsementCount}`)
  console.log(`  📰 News:         ${newsCount}`)
  console.log(`  ⚙️  Settings:     ${settingsCount}`)
  console.log(`  📢 Ads:          ${adsCount}`)
  console.log(`  🔔 Notifications: ${notificationCount}`)
  console.log(`  ⚙️  Preferences:  ${prefCount}`)
  console.log(`  🚫 IP Bans:      ${banCount}`)
  console.log(`  🎯 Trust Scores: ${trustCount}`)
  console.log(`  🚨 Reports:      ${reportCount}`)
  console.log(`  🔍 Fraud Signals: ${signalCount}`)
  console.log(`  🔖 Bookmarks:    ${bookmarkCount}`)
  console.log(`  ❤️  Comment Likes: ${commentLikeCount}`)
  console.log(`  ⚡ User Actions: ${actionCount}`)
  console.log(`  🏆 Tier Rules:   ${TIER_RULES.length}`)
  console.log(`  📊 Tier History: ${tierHistoryCount}`)
  console.log(`  🎭 Special Roles: ${SPECIAL_ROLES.length}`)
  console.log(`  📝 Audit Logs:   ${auditCount}`)
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
