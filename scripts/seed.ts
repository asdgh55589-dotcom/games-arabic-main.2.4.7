// Seed script — بيانات حقيقية وواقعية للمنصة
// 5 تعريبات لكل منصة (PC, NS, PS4, PS3, PS2, PS1) = 30 تعريب
// كل تعريب فيه: ملفات تحميل، فريق تعريب، روابط تواصل، فيديوهات، تبويبات مخصصة، تعليقات
import { db } from '../src/lib/db'
import bcrypt from 'bcryptjs'

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

// ===== بيانات ألعاب حقيقية لكل منصة =====
const GAMES = [
  // ===== PC =====
  {
    slug: 'the-witcher-3-pc',
    name: 'The Witcher 3: Wild Hunt',
    tagline: 'لعبة تقمص أدوار عالم مفتوح ملحمية',
    description: 'The Witcher 3: Wild Hunt هي لعبة تقمص أدوار عالم مفتوح تدور أحداثها في عالم خيالي مليء بالخيارات ذات المعنى والعواقب المؤثرة. خوض مغامرة جرالت من ريفيا وهو يبحث عن طفل النبوءة.',
    bannerUrl: 'https://images.unsplash.com/photo-1593305841991-05c297ba4575?w=1600&q=80',
    thumbnailUrl: 'https://images.unsplash.com/photo-1593305841991-05c297ba4575?w=600&q=80',
    category: 'RPG',
    platform: 'PC',
    releaseYear: 2015,
    featured: true,
    categories: ['UI', 'Gameplay', 'Graphics', 'Quests'],
  },
  {
    slug: 'skyrim-special-edition-pc',
    name: 'Skyrim Special Edition',
    tagline: 'لعبة تقمص أدوار عالم مفتوح ملحمية',
    description: 'Skyrim Special Edition تعيد إحياء الملحمة الخيالية بتفاصيل مذهلة. تشمل النسخة الخاصة اللعبة والإضافات مع ميزات جديدة كلياً.',
    bannerUrl: 'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=1600&q=80',
    thumbnailUrl: 'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=600&q=80',
    category: 'RPG',
    platform: 'PC',
    releaseYear: 2016,
    featured: true,
    categories: ['UI', 'Gameplay', 'Graphics', 'Quests'],
  },
  {
    slug: 'cyberpunk-2077-pc',
    name: 'Cyberpunk 2077',
    tagline: 'لعبة تقمص أدوار وأكشن عالم مفتوح',
    description: 'Cyberpunk 2077 هي لعبة تقمص أدوار وأكشن عالم مفتوح تدور أحداثها في مستقبل مدينة الليل المظلم.',
    bannerUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af2176?w=1600&q=80',
    thumbnailUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af2176?w=600&q=80',
    category: 'RPG',
    platform: 'PC',
    releaseYear: 2020,
    featured: true,
    categories: ['UI', 'Gameplay', 'Graphics'],
  },

  // ===== NS (Nintendo Switch) =====
  {
    slug: 'zelda-breath-of-the-wild-ns',
    name: 'The Legend of Zelda: Breath of the Wild',
    tagline: 'مغامرة مفتوحة في عالم هيرول',
    description: 'استكشف عالم هيرول الشاسع في هذه المغامرة المفتوحة. تسلق أي جبل، اسبح في أي بحيرة، واكتشف أسرار العالم القديم.',
    bannerUrl: 'https://images.unsplash.com/photo-1551103782-8ab07afd45c1?w=1600&q=80',
    thumbnailUrl: 'https://images.unsplash.com/photo-1551103782-8ab07afd45c1?w=600&q=80',
    category: 'Adventure',
    platform: 'NS',
    releaseYear: 2017,
    featured: true,
    categories: ['Saves', 'Gameplay', 'Graphics'],
  },
  {
    slug: 'super-mario-odyssey-ns',
    name: 'Super Mario Odyssey',
    tagline: 'مغامرة ماريو حول العالم',
    description: 'انضم لماريو في رحلة حول العالم لإنقاذ الأميرة بيتش من باوزر. استخدم قبعة كابي للامتلاك والتحكم في الأعداء.',
    bannerUrl: 'https://images.unsplash.com/photo-1493238792000-8113da705763?w=1600&q=80',
    thumbnailUrl: 'https://images.unsplash.com/photo-1493238792000-8113da705763?w=600&q=80',
    category: 'Adventure',
    platform: 'NS',
    releaseYear: 2017,
    featured: false,
    categories: ['Saves', 'Gameplay'],
  },
  {
    slug: 'animal-crossing-ns',
    name: 'Animal Crossing: New Horizons',
    tagline: 'ابن جزيرتك الخاصة',
    description: 'ابن جزيرتك من الصفر، استكشف، اجمع، وكون صداقات مع سكان الجزيرة.',
    bannerUrl: 'https://images.unsplash.com/photo-1518709594023-6eab9bab7b23?w=1600&q=80',
    thumbnailUrl: 'https://images.unsplash.com/photo-1518709594023-6eab9bab7b23?w=600&q=80',
    category: 'Simulation',
    platform: 'NS',
    releaseYear: 2020,
    featured: true,
    categories: ['Saves', 'UI'],
  },

  // ===== PS4 =====
  {
    slug: 'god-of-war-ps4',
    name: 'God of War',
    tagline: 'كراتوس يعود في مغامرة نوردية',
    description: 'كراتوس يعيش الآن في عالم الإسكندنافيين — عالم قاسٍ وبارد يسكنه الآلهة والوحوش الأسطورية.',
    bannerUrl: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=1600&q=80',
    thumbnailUrl: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=600&q=80',
    category: 'Action',
    platform: 'PS4',
    releaseYear: 2018,
    featured: true,
    categories: ['Saves', 'Gameplay'],
  },
  {
    slug: 'spider-man-ps4',
    name: "Marvel's Spider-Man",
    tagline: 'كما العنكبوت تماماً',
    description: 'انطلق في مغامرة أكشن عالم مفتوح مع الرجل العنكبوت وهو يواجه أبشع الأعداء في مدينة نيويورك.',
    bannerUrl: 'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=1600&q=80',
    thumbnailUrl: 'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=600&q=80',
    category: 'Action',
    platform: 'PS4',
    releaseYear: 2018,
    featured: true,
    categories: ['Saves', 'Gameplay'],
  },
  {
    slug: 'bloodborne-ps4',
    name: 'Bloodborne',
    tagline: 'رعب أكشن من FromSoftware',
    description: 'استكشف مدينة يارنام الغامضة المليئة بالوحوش والأسرار في هذه اللعبة الأكشن RPG.',
    bannerUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af2176?w=1600&q=80',
    thumbnailUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af2176?w=600&q=80',
    category: 'RPG',
    platform: 'PS4',
    releaseYear: 2015,
    featured: false,
    categories: ['Saves', 'Gameplay'],
  },

  // ===== PS3 =====
  {
    slug: 'last-of-us-ps3',
    name: 'The Last of Us',
    tagline: 'بقاء في عالم ما بعد الكارثة',
    description: 'جويل وإيلي يخوضان رحلة عبر الولايات المتحدة بعد تفشي فطر يحوّل البشر إلى وحوش.',
    bannerUrl: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=1600&q=80',
    thumbnailUrl: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=600&q=80',
    category: 'Action',
    platform: 'PS3',
    releaseYear: 2013,
    featured: true,
    categories: ['Saves', 'Gameplay'],
  },
  {
    slug: 'red-dead-redemption-ps3',
    name: 'Red Dead Redemption',
    tagline: 'الغرب الأمريكي القديم',
    description: 'عيش حياة الخارج عن القانون جون مارستون وهو يحاول العودة لعائلته في الغرب الأمريكي المتلاشي.',
    bannerUrl: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=1600&q=80',
    thumbnailUrl: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=600&q=80',
    category: 'Action',
    platform: 'PS3',
    releaseYear: 2010,
    featured: false,
    categories: ['Saves', 'Gameplay'],
  },

  // ===== PS2 =====
  {
    slug: 'shadow-of-the-colossus-ps2',
    name: 'Shadow of the Colossus',
    tagline: 'مغامرة فنية ملحمية',
    description: 'اقتحم عالماً شاسعاً وواجه ستة عشر عملاقاً في سعي محموم لإنقاذ فتاة.',
    bannerUrl: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=1600&q=80',
    thumbnailUrl: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=600&q=80',
    category: 'Adventure',
    platform: 'PS2',
    releaseYear: 2005,
    featured: true,
    categories: ['Saves', 'Gameplay'],
  },
  {
    slug: 'god-of-war-2-ps2',
    name: 'God of War II',
    tagline: 'غضب كراتوس يستمر',
    description: 'بعد خيانة زيوس، يعود كراتوس للانتقام في الجزء الثاني من ملحمة God of War.',
    bannerUrl: 'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=1600&q=80',
    thumbnailUrl: 'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=600&q=80',
    category: 'Action',
    platform: 'PS2',
    releaseYear: 2007,
    featured: false,
    categories: ['Saves', 'Gameplay'],
  },

  // ===== PS1 =====
  {
    slug: 'final-fantasy-7-ps1',
    name: 'Final Fantasy VII',
    tagline: 'اللعبة التي عرّفت الـ RPG للعالم',
    description: 'كلود سترايف ينضم لفريق أفالانش لوقف شركة شينرا من استنزاف كوكب الأرض.',
    bannerUrl: 'https://images.unsplash.com/photo-1531219432768-9f540ce0ec55?w=1600&q=80',
    thumbnailUrl: 'https://images.unsplash.com/photo-1531219432768-9f540ce0ec55?w=600&q=80',
    category: 'RPG',
    platform: 'PS1',
    releaseYear: 1997,
    featured: true,
    categories: ['Saves', 'Gameplay'],
  },
  {
    slug: 'metal-gear-solid-ps1',
    name: 'Metal Gear Solid',
    tagline: 'تجسس تكتيكي من كوجيما',
    description: 'سنيك يتسلل لجزيرة نوعية لوقف إطلاق ميتال غير ركس. لعبة تجسس تكتيكية مع قصة عميقة.',
    bannerUrl: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=1600&q=80',
    thumbnailUrl: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=600&q=80',
    category: 'Action',
    platform: 'PS1',
    releaseYear: 1998,
    featured: false,
    categories: ['Saves', 'Gameplay'],
  },
]

// ===== 5 تعريبات لكل منصة =====
const PLATFORM_MODS: Record<string, Array<{
  name: string
  arabicTitle: string
  summary: string
  description: string
  changelog: string
  compatibility: string
  version: string
  fileSize: string
  fileFormat: string
  tags: string[]
  series: string
  translationTeam: string
  translationType: 'official' | 'unofficial'
  isFeatured: boolean
  isTrending: boolean
  releaseDaysAgo: number
  downloads: number
  endorsements: number
  views: number
  gameSlug: string
  files: Array<{
    title: string
    description: string
    alert: string
    version: string
    fileSize: string
    fileFormat: string
    links: Array<{ url: string; label: string }>
  }>
}>> = {
  PC: [
    {
      name: 'تعريب كامل لواجهة The Witcher 3',
      arabicTitle: 'تعريب الواجهة الكامل',
      summary: 'تعريب شامل لكل قوائم وإعدادات The Witcher 3: Wild Hunt مع دعم RTL كامل',
      description: '## عن هذا التعريب\n\nتعريب شامل لكل قوائم وإعدادات اللعبة The Witcher 3: Wild Hunt. يشمل التعريب كل النصوص الظاهرة في الواجهة من قوائم رئيسية وفرعية وإعدادات وخيارات.\n\n## الميزات\n\n- تعريب 100% لواجهة اللعبة\n- دعم كامل للكتابة من اليمين لليسار (RTL)\n- خطوط عربية واضحة ومقروءة\n- توافق مع كل إصدارات اللعبة\n\n## التثبيت\n\n1. حمل ملف التعريب\n2. استخرج الملفات في مجلد اللعبة\n3. اختر العربية من إعدادات اللغة\n4. استمتع باللعب!',
      changelog: '## v2.1.0 (الإصدار الحالي)\n- إصلاح بعض الأخطاء الإملائية\n- تحسين دقة بعض الترجمات\n- إضافة دعم للإصدار 4.04\n\n## v2.0.0\n- إصدار كامل بعد التحديث الكبير\n- دعم إضافات Next-Gen\n\n## v1.0.0\n- الإصدار الأول العام',
      compatibility: 'متوافق مع كل إصدارات اللعبة من 1.0 إلى 4.04 + Next-Gen',
      version: '2.1.0',
      fileSize: 'MB 45',
      fileFormat: 'zip',
      tags: ['UI', 'Arabic', 'RTL', 'Localization'],
      series: 'The Witcher',
      translationTeam: 'فريق Arab4Games',
      translationType: 'unofficial',
      isFeatured: true,
      isTrending: true,
      releaseDaysAgo: 5,
      downloads: 12450,
      endorsements: 1820,
      views: 45000,
      gameSlug: 'the-witcher-3-pc',
      files: [
        {
          title: 'الملف الرئيسي - تعريب الواجهة',
          description: 'الملف الأساسي للتعريب — يحتوي على كل ملفات الترجمة',
          alert: 'تأكد من عمل نسخة احتياطية من ملفات اللعبة الأصلية قبل التركيب',
          version: '2.1.0',
          fileSize: 'MB 45',
          fileFormat: 'zip',
          links: [
            { url: 'https://www.mediafire.com/file/witcher3-arabic-ui-v2.1.0.zip', label: 'MediaFire' },
            { url: 'https://drive.google.com/file/d/witcher3-arabic-ui-v2.1.0', label: 'Google Drive' },
            { url: 'https://mega.nz/file/witcher3-arabic-ui-v2.1.0', label: 'MEGA' },
          ],
        },
        {
          title: 'ملف تصحيحي - إصلاحات إضافية',
          description: 'ملف تصحيحي صغير لإصلاح بعض المشاكل البسيطة',
          alert: 'يجب تثبيت الملف الرئيسي أولاً',
          version: '2.1.1',
          fileSize: 'MB 5',
          fileFormat: 'zip',
          links: [
            { url: 'https://www.mediafire.com/file/witcher3-arabic-patch-v2.1.1.zip', label: 'MediaFire' },
            { url: 'https://drive.google.com/file/d/witcher3-arabic-patch-v2.1.1', label: 'Google Drive' },
          ],
        },
      ],
    },
    {
      name: 'تعريب Skyrim Special Edition الكامل',
      arabicTitle: 'تعريب سكايرم النسخة الخاصة',
      summary: 'تعريب كامل لـ Skyrim Special Edition يشمل القوائم والترجمة الكاملة',
      description: '## عن هذا التعريب\n\nتعريب كامل للعبة Skyrim Special Edition. يشمل تعريب كل القوائم والإعدادات والنصوص الفرعية.\n\n## الميزات\n\n- تعريب شامل للقوائم\n- دعم RTL\n- خطوط عربية احترافية\n- متوافق مع الـ mods الشائعة',
      changelog: '## v1.5.0\n- تحديث لدعم الإصدار 1.6.1170\n- إصلاح أخطاء\n\n## v1.0.0\n- الإصدار الأول',
      compatibility: 'متوافق مع الإصدارات 1.5.97 إلى 1.6.1170',
      version: '1.5.0',
      fileSize: 'MB 38',
      fileFormat: '7z',
      tags: ['UI', 'Arabic', 'Localization', 'Skyrim'],
      series: 'The Elder Scrolls',
      translationTeam: 'فريق GamesArabia',
      translationType: 'unofficial',
      isFeatured: true,
      isTrending: false,
      releaseDaysAgo: 12,
      downloads: 8900,
      endorsements: 1240,
      views: 32000,
      gameSlug: 'skyrim-special-edition-pc',
      files: [
        {
          title: 'التعريب الكامل - Skyrim SE',
          description: 'ملف التعريب الكامل لـ Skyrim Special Edition',
          alert: 'مطلوب نسخة اللعبة 1.5.97 أو أحدث',
          version: '1.5.0',
          fileSize: 'MB 38',
          fileFormat: '7z',
          links: [
            { url: 'https://www.mediafire.com/file/skyrim-se-arabic-v1.5.0.7z', label: 'MediaFire' },
            { url: 'https://drive.google.com/file/d/skyrim-se-arabic-v1.5.0', label: 'Google Drive' },
          ],
        },
      ],
    },
    {
      name: 'تعريب Cyberpunk 2077 - الواجهة',
      arabicTitle: 'تعريب سايبربانك 2077',
      summary: 'تعريب واجهة Cyberpunk 2077 مع دعم كامل للنصوص العربية',
      description: '## عن هذا التعريب\n\nتعريب واجهة Cyberpunk 2077 — يشمل القوائم الرئيسية والإعدادات وخيارات اللعب.\n\n## الميزات\n\n- تعريب الواجهة الكامل\n- دعم RTL\n- متوافق مع Update 2.2',
      changelog: '## v1.2.0\n- دعم Update 2.2\n- إصلاحات\n\n## v1.0.0\n- الإصدار الأول',
      compatibility: 'متوافق مع Update 2.0 إلى 2.2',
      version: '1.2.0',
      fileSize: 'MB 52',
      fileFormat: 'zip',
      tags: ['UI', 'Arabic', 'Cyberpunk', 'Localization'],
      series: 'Cyberpunk',
      translationTeam: 'فريق التعريب العربي',
      translationType: 'unofficial',
      isFeatured: false,
      isTrending: true,
      releaseDaysAgo: 8,
      downloads: 6700,
      endorsements: 890,
      views: 24000,
      gameSlug: 'cyberpunk-2077-pc',
      files: [
        {
          title: 'تعريب Cyberpunk 2077',
          description: 'الملف الرئيسي للتعريب',
          alert: 'مطلوب Update 2.0 أو أحدث',
          version: '1.2.0',
          fileSize: 'MB 52',
          fileFormat: 'zip',
          links: [
            { url: 'https://www.mediafire.com/file/cyberpunk-arabic-v1.2.0.zip', label: 'MediaFire' },
            { url: 'https://mega.nz/file/cyberpunk-arabic-v1.2.0', label: 'MEGA' },
          ],
        },
      ],
    },
    {
      name: 'حزمة تعريب إضافية - The Witcher 3',
      arabicTitle: 'حزمة الترجمة الإضافية',
      summary: 'حزمة إضافية لتعريب الـ DLCs والمراحل الإضافية لـ The Witcher 3',
      description: '## عن هذه الحزمة\n\nحزمة إضافية لتعريب محتوى الـ DLCs لـ The Witcher 3. تتطلب التعريب الرئيسي.\n\n## الميزات\n\n- تعريب Hearts of Stone\n- تعريب Blood and Wine\n- ترجمة المهام الإضافية',
      changelog: '## v1.0.0\n- الإصدار الأول\n- تعريب DLCs كاملة',
      compatibility: 'يتطلب التعريب الرئيسي v2.1.0 + DLCs مثبتة',
      version: '1.0.0',
      fileSize: 'MB 28',
      fileFormat: 'zip',
      tags: ['DLC', 'Arabic', 'Witcher', 'Localization'],
      series: 'The Witcher',
      translationTeam: 'فريق Arab4Games',
      translationType: 'unofficial',
      isFeatured: false,
      isTrending: false,
      releaseDaysAgo: 3,
      downloads: 3200,
      endorsements: 445,
      views: 11000,
      gameSlug: 'the-witcher-3-pc',
      files: [
        {
          title: 'حزمة تعريب DLCs',
          description: 'تعريب Hearts of Stone + Blood and Wine',
          alert: 'يتطلب التعريب الرئيسي v2.1.0',
          version: '1.0.0',
          fileSize: 'MB 28',
          fileFormat: 'zip',
          links: [
            { url: 'https://www.mediafire.com/file/witcher3-dlc-arabic-v1.0.0.zip', label: 'MediaFire' },
          ],
        },
      ],
    },
    {
      name: 'تعريب Skyrim - المحتوى الإضافي',
      arabicTitle: 'تعريب المحتوى الإضافي',
      summary: 'تعريب إضافات Skyrim SE: Dawnguard و Dragonborn',
      description: '## عن هذا التعريب\n\nتعريب المحتوى الإضافي لـ Skyrim Special Edition — Dawnguard و Dragonborn.\n\n## الميزات\n\n- تعريب Dawnguard\n- تعريب Dragonborn\n- ترجمة المهام',
      changelog: '## v1.0.0\n- الإصدار الأول',
      compatibility: 'يتطلب التعريب الرئيسي v1.5.0',
      version: '1.0.0',
      fileSize: 'MB 22',
      fileFormat: 'zip',
      tags: ['DLC', 'Arabic', 'Skyrim', 'Localization'],
      series: 'The Elder Scrolls',
      translationTeam: 'فريق GamesArabia',
      translationType: 'unofficial',
      isFeatured: false,
      isTrending: true,
      releaseDaysAgo: 18,
      downloads: 2100,
      endorsements: 312,
      views: 8500,
      gameSlug: 'skyrim-special-edition-pc',
      files: [
        {
          title: 'تعريب المحتوى الإضافي',
          description: 'Dawnguard + Dragonborn',
          alert: 'يتطلب التعريب الرئيسي v1.5.0',
          version: '1.0.0',
          fileSize: 'MB 22',
          fileFormat: 'zip',
          links: [
            { url: 'https://www.mediafire.com/file/skyrim-dlc-arabic-v1.0.0.zip', label: 'MediaFire' },
          ],
        },
      ],
    },
  ],

  NS: [
    {
      name: 'تعريب Zelda: Breath of the Wild',
      arabicTitle: 'تعريب زيلدا: نفحة البرية',
      summary: 'تعريب كامل للعبة Zelda: Breath of the Wild على Nintendo Switch',
      description: '## عن هذا التعريب\n\nتعريب كامل للعبة The Legend of Zelda: Breath of the Wild على Nintendo Switch.\n\n## الميزات\n\n- تعريب القوائم والإعدادات\n- دعم RTL\n- متوافق مع كل إصدارات Switch',
      changelog: '## v1.3.0\n- دعم Update 1.6.0\n- إصلاحات\n\n## v1.0.0\n- الإصدار الأول',
      compatibility: 'متوافق مع كل إصدارات Switch',
      version: '1.3.0',
      fileSize: 'MB 35',
      fileFormat: 'zip',
      tags: ['UI', 'Arabic', 'Zelda', 'Switch'],
      series: 'The Legend of Zelda',
      translationTeam: 'فريق Arab4Games',
      translationType: 'unofficial',
      isFeatured: true,
      isTrending: true,
      releaseDaysAgo: 7,
      downloads: 9800,
      endorsements: 1560,
      views: 38000,
      gameSlug: 'zelda-breath-of-the-wild-ns',
      files: [
        {
          title: 'تعريب Zelda BOTW الكامل',
          description: 'الملف الرئيسي للتعريب',
          alert: 'مطلوب Switch مكسور الحماية',
          version: '1.3.0',
          fileSize: 'MB 35',
          fileFormat: 'zip',
          links: [
            { url: 'https://www.mediafire.com/file/zelda-botw-arabic-v1.3.0.zip', label: 'MediaFire' },
            { url: 'https://drive.google.com/file/d/zelda-botw-arabic-v1.3.0', label: 'Google Drive' },
            { url: 'https://mega.nz/file/zelda-botw-arabic-v1.3.0', label: 'MEGA' },
          ],
        },
      ],
    },
    {
      name: 'تعريب Super Mario Odyssey',
      arabicTitle: 'تعريب سوبر ماريو أوديسي',
      summary: 'تعريب واجهة Super Mario Odyssey على Nintendo Switch',
      description: '## عن هذا التعريب\n\nتعريب واجهة Super Mario Odyssey — يشمل القوائم والإعدادات.\n\n## الميزات\n\n- تعريب القوائم\n- دعم RTL',
      changelog: '## v1.1.0\n- إصلاحات\n\n## v1.0.0\n- الإصدار الأول',
      compatibility: 'متوافق مع Update 1.0.2',
      version: '1.1.0',
      fileSize: 'MB 18',
      fileFormat: 'zip',
      tags: ['UI', 'Arabic', 'Mario', 'Switch'],
      series: 'Super Mario',
      translationTeam: 'مترجم مستقل',
      translationType: 'unofficial',
      isFeatured: false,
      isTrending: false,
      releaseDaysAgo: 14,
      downloads: 4500,
      endorsements: 620,
      views: 16000,
      gameSlug: 'super-mario-odyssey-ns',
      files: [
        {
          title: 'تعريب Mario Odyssey',
          description: 'الملف الرئيسي',
          alert: 'مطلوب Switch مكسور الحماية',
          version: '1.1.0',
          fileSize: 'MB 18',
          fileFormat: 'zip',
          links: [
            { url: 'https://www.mediafire.com/file/mario-odyssey-arabic-v1.1.0.zip', label: 'MediaFire' },
          ],
        },
      ],
    },
    {
      name: 'تعريب Animal Crossing: New Horizons',
      arabicTitle: 'تعريب أنيمال كروسينغ',
      summary: 'تعريب واجهة Animal Crossing: New Horizons',
      description: '## عن هذا التعريب\n\nتعريب واجهة Animal Crossing: New Horizons على Nintendo Switch.\n\n## الميزات\n\n- تعريب القوائم\n- دعم RTL',
      changelog: '## v1.0.0\n- الإصدار الأول',
      compatibility: 'متوافق مع Update 2.0.6',
      version: '1.0.0',
      fileSize: 'MB 25',
      fileFormat: 'zip',
      tags: ['UI', 'Arabic', 'Animal Crossing', 'Switch'],
      series: 'Animal Crossing',
      translationTeam: 'فريق GamesArabia',
      translationType: 'unofficial',
      isFeatured: true,
      isTrending: false,
      releaseDaysAgo: 20,
      downloads: 5600,
      endorsements: 780,
      views: 21000,
      gameSlug: 'animal-crossing-ns',
      files: [
        {
          title: 'تعريب Animal Crossing',
          description: 'الملف الرئيسي',
          alert: 'مطلوب Switch مكسور الحماية',
          version: '1.0.0',
          fileSize: 'MB 25',
          fileFormat: 'zip',
          links: [
            { url: 'https://www.mediafire.com/file/animal-crossing-arabic-v1.0.0.zip', label: 'MediaFire' },
            { url: 'https://drive.google.com/file/d/animal-crossing-arabic-v1.0.0', label: 'Google Drive' },
          ],
        },
      ],
    },
    {
      name: 'حزمة تعريب Zelda الإضافية',
      arabicTitle: 'حزمة الترجمة الإضافية',
      summary: 'حزمة إضافية لتعريب محتوى DLCs لـ Zelda BOTW',
      description: '## عن هذه الحزمة\n\nحزمة إضافية لتعريب DLCs لـ Zelda: Breath of the Wild.\n\n## الميزات\n\n- تعريب The Master Trials\n- تعريب The Champions Ballad',
      changelog: '## v1.0.0\n- الإصدار الأول',
      compatibility: 'يتطلب التعريب الرئيسي v1.3.0',
      version: '1.0.0',
      fileSize: 'MB 15',
      fileFormat: 'zip',
      tags: ['DLC', 'Arabic', 'Zelda', 'Switch'],
      series: 'The Legend of Zelda',
      translationTeam: 'فريق Arab4Games',
      translationType: 'unofficial',
      isFeatured: false,
      isTrending: false,
      releaseDaysAgo: 4,
      downloads: 2800,
      endorsements: 380,
      views: 9500,
      gameSlug: 'zelda-breath-of-the-wild-ns',
      files: [
        {
          title: 'حزمة تعريب DLCs',
          description: 'The Master Trials + The Champions Ballad',
          alert: 'يتطلب التعريب الرئيسي v1.3.0',
          version: '1.0.0',
          fileSize: 'MB 15',
          fileFormat: 'zip',
          links: [
            { url: 'https://www.mediafire.com/file/zelda-dlc-arabic-v1.0.0.zip', label: 'MediaFire' },
          ],
        },
      ],
    },
    {
      name: 'تعريب Animal Crossing - محتوى موسمي',
      arabicTitle: 'تعريب المحتوى الموسمي',
      summary: 'تعريب المحتوى الموسمي والفعاليات في Animal Crossing',
      description: '## عن هذا التعريب\n\nتعريب المحتوى الموسمي والفعاليات في Animal Crossing: New Horizons.\n\n## الميزات\n\n- تعريف الفعاليات الموسمية\n- ترجمة العناصر الموسمية',
      changelog: '## v1.0.0\n- الإصدار الأول',
      compatibility: 'يتطلب التعريب الرئيسي v1.0.0',
      version: '1.0.0',
      fileSize: 'MB 12',
      fileFormat: 'zip',
      tags: ['Seasonal', 'Arabic', 'Animal Crossing', 'Switch'],
      series: 'Animal Crossing',
      translationTeam: 'فريق GamesArabia',
      translationType: 'unofficial',
      isFeatured: false,
      isTrending: false,
      releaseDaysAgo: 9,
      downloads: 1900,
      endorsements: 245,
      views: 7200,
      gameSlug: 'animal-crossing-ns',
      files: [
        {
          title: 'تعريب المحتوى الموسمي',
          description: 'فعاليات ومحتوى موسمي',
          alert: 'يتطلب التعريب الرئيسي v1.0.0',
          version: '1.0.0',
          fileSize: 'MB 12',
          fileFormat: 'zip',
          links: [
            { url: 'https://www.mediafire.com/file/animal-crossing-seasonal-arabic.zip', label: 'MediaFire' },
          ],
        },
      ],
    },
  ],

  PS4: [
    {
      name: 'تعريب God of War (2018)',
      arabicTitle: 'تعريب إله الحرب',
      summary: 'تعريب كامل لـ God of War على PS4 — قوائم وترجمة كاملة',
      description: '## عن هذا التعريب\n\nتعريب كامل للعبة God of War (2018) على PS4.\n\n## الميزات\n\n- تعريب القوائم والإعدادات\n- دعم RTL\n- متوافق مع كل إصدارات PS4',
      changelog: '## v1.2.0\n- دعم Update 1.50\n- إصلاحات\n\n## v1.0.0\n- الإصدار الأول',
      compatibility: 'متوافق مع CFW PS4 + Update 1.50',
      version: '1.2.0',
      fileSize: 'MB 42',
      fileFormat: 'zip',
      tags: ['UI', 'Arabic', 'God of War', 'PS4'],
      series: 'God of War',
      translationTeam: 'فريق Arab4Games',
      translationType: 'unofficial',
      isFeatured: true,
      isTrending: true,
      releaseDaysAgo: 6,
      downloads: 11200,
      endorsements: 1690,
      views: 41000,
      gameSlug: 'god-of-war-ps4',
      files: [
        {
          title: 'تعريب God of War PS4',
          description: 'الملف الرئيسي للتعريب',
          alert: 'مطلوب PS4 بـ CFW',
          version: '1.2.0',
          fileSize: 'MB 42',
          fileFormat: 'zip',
          links: [
            { url: 'https://www.mediafire.com/file/god-of-war-arabic-v1.2.0.zip', label: 'MediaFire' },
            { url: 'https://drive.google.com/file/d/god-of-war-arabic-v1.2.0', label: 'Google Drive' },
          ],
        },
      ],
    },
    {
      name: 'تعريب Marvel Spider-Man',
      arabicTitle: 'تعريب الرجل العنكبوت',
      summary: 'تعريب واجهة Marvel Spider-Man على PS4',
      description: '## عن هذا التعريب\n\nتعريب واجهة Marvel Spider-Man على PS4.\n\n## الميزات\n\n- تعريب القوائم\n- دعم RTL',
      changelog: '## v1.1.0\n- إصلاحات\n\n## v1.0.0\n- الإصدار الأول',
      compatibility: 'متوافق مع CFW PS4',
      version: '1.1.0',
      fileSize: 'MB 30',
      fileFormat: 'zip',
      tags: ['UI', 'Arabic', 'Spider-Man', 'PS4'],
      series: 'Spider-Man',
      translationTeam: 'فريق GamesArabia',
      translationType: 'unofficial',
      isFeatured: true,
      isTrending: false,
      releaseDaysAgo: 11,
      downloads: 7300,
      endorsements: 980,
      views: 27000,
      gameSlug: 'spider-man-ps4',
      files: [
        {
          title: 'تعريب Spider-Man PS4',
          description: 'الملف الرئيسي',
          alert: 'مطلوب PS4 بـ CFW',
          version: '1.1.0',
          fileSize: 'MB 30',
          fileFormat: 'zip',
          links: [
            { url: 'https://www.mediafire.com/file/spider-man-arabic-v1.1.0.zip', label: 'MediaFire' },
          ],
        },
      ],
    },
    {
      name: 'تعريب Bloodborne',
      arabicTitle: 'تعريب بلودبورن',
      summary: 'تعريب واجهة Bloodborne على PS4',
      description: '## عن هذا التعريب\n\nتعريب واجهة Bloodborne على PS4.\n\n## الميزات\n\n- تعريب القوائم\n- دعم RTL',
      changelog: '## v1.0.0\n- الإصدار الأول',
      compatibility: 'متوافق مع CFW PS4',
      version: '1.0.0',
      fileSize: 'MB 28',
      fileFormat: 'zip',
      tags: ['UI', 'Arabic', 'Bloodborne', 'PS4'],
      series: 'Souls',
      translationTeam: 'مترجم مستقل',
      translationType: 'unofficial',
      isFeatured: false,
      isTrending: false,
      releaseDaysAgo: 25,
      downloads: 3400,
      endorsements: 450,
      views: 13000,
      gameSlug: 'bloodborne-ps4',
      files: [
        {
          title: 'تعريب Bloodborne',
          description: 'الملف الرئيسي',
          alert: 'مطلوب PS4 بـ CFW',
          version: '1.0.0',
          fileSize: 'MB 28',
          fileFormat: 'zip',
          links: [
            { url: 'https://www.mediafire.com/file/bloodborne-arabic-v1.0.0.zip', label: 'MediaFire' },
          ],
        },
      ],
    },
    {
      name: 'حزمة تعريب God of War - المحتوى الإضافي',
      arabicTitle: 'حزمة المحتوى الإضافي',
      summary: 'تعريب المحتوى الإضافي لـ God of War',
      description: '## عن هذه الحزمة\n\nحزمة إضافية لتعريب المحتوى الإضافي لـ God of War.\n\n## الميزات\n\n- تعريب Valhalla DLC\n- ترجمة المهام الإضافية',
      changelog: '## v1.0.0\n- الإصدار الأول',
      compatibility: 'يتطلب التعريب الرئيسي v1.2.0',
      version: '1.0.0',
      fileSize: 'MB 18',
      fileFormat: 'zip',
      tags: ['DLC', 'Arabic', 'God of War', 'PS4'],
      series: 'God of War',
      translationTeam: 'فريق Arab4Games',
      translationType: 'unofficial',
      isFeatured: false,
      isTrending: false,
      releaseDaysAgo: 2,
      downloads: 2100,
      endorsements: 290,
      views: 8000,
      gameSlug: 'god-of-war-ps4',
      files: [
        {
          title: 'حزمة تعريب DLC',
          description: 'Valhalla DLC',
          alert: 'يتطلب التعريب الرئيسي v1.2.0',
          version: '1.0.0',
          fileSize: 'MB 18',
          fileFormat: 'zip',
          links: [
            { url: 'https://www.mediafire.com/file/god-of-war-dlc-arabic.zip', label: 'MediaFire' },
          ],
        },
      ],
    },
    {
      name: 'تعريب Spider-Man - المحتوى الإضافي',
      arabicTitle: 'تعريب المحتوى الإضافي',
      summary: 'تعريب DLCs لـ Spider-Man: City That Never Sleeps',
      description: '## عن هذا التعريب\n\nتعريب المحتوى الإضافي لـ Spider-Man — The City That Never Sleeps.\n\n## الميزات\n\n- تعريف الـ 3 فصول الإضافية\n- ترجمة المهام',
      changelog: '## v1.0.0\n- الإصدار الأول',
      compatibility: 'يتطلب التعريب الرئيسي v1.1.0',
      version: '1.0.0',
      fileSize: 'MB 16',
      fileFormat: 'zip',
      tags: ['DLC', 'Arabic', 'Spider-Man', 'PS4'],
      series: 'Spider-Man',
      translationTeam: 'فريق GamesArabia',
      translationType: 'unofficial',
      isFeatured: false,
      isTrending: false,
      releaseDaysAgo: 15,
      downloads: 1700,
      endorsements: 220,
      views: 6500,
      gameSlug: 'spider-man-ps4',
      files: [
        {
          title: 'تعريب Spider-Man DLCs',
          description: 'The City That Never Sleeps',
          alert: 'يتطلب التعريب الرئيسي v1.1.0',
          version: '1.0.0',
          fileSize: 'MB 16',
          fileFormat: 'zip',
          links: [
            { url: 'https://www.mediafire.com/file/spider-man-dlc-arabic.zip', label: 'MediaFire' },
          ],
        },
      ],
    },
  ],

  PS3: [
    {
      name: 'تعريب The Last of Us',
      arabicTitle: 'تعريب ذا لاست أوف أس',
      summary: 'تعريب كامل لـ The Last of Us على PS3',
      description: '## عن هذا التعريب\n\nتعريب كامل للعبة The Last of Us على PS3.\n\n## الميزات\n\n- تعريب القوائم\n- دعم RTL',
      changelog: '## v1.0.0\n- الإصدار الأول',
      compatibility: 'متوافق مع CFW PS3',
      version: '1.0.0',
      fileSize: 'MB 32',
      fileFormat: 'zip',
      tags: ['UI', 'Arabic', 'Last of Us', 'PS3'],
      series: 'The Last of Us',
      translationTeam: 'فريق Arab4Games',
      translationType: 'unofficial',
      isFeatured: true,
      isTrending: false,
      releaseDaysAgo: 22,
      downloads: 5400,
      endorsements: 720,
      views: 19000,
      gameSlug: 'last-of-us-ps3',
      files: [
        {
          title: 'تعريب The Last of Us',
          description: 'الملف الرئيسي',
          alert: 'مطلوب PS3 بـ CFW',
          version: '1.0.0',
          fileSize: 'MB 32',
          fileFormat: 'zip',
          links: [
            { url: 'https://www.mediafire.com/file/last-of-us-arabic-v1.0.0.zip', label: 'MediaFire' },
          ],
        },
      ],
    },
    {
      name: 'تعريب Red Dead Redemption',
      arabicTitle: 'تعريب ريد ديد ريديمبشن',
      summary: 'تعريب واجهة Red Dead Redemption على PS3',
      description: '## عن هذا التعريب\n\nتعريب واجهة Red Dead Redemption على PS3.\n\n## الميزات\n\n- تعريب القوائم\n- دعم RTL',
      changelog: '## v1.0.0\n- الإصدار الأول',
      compatibility: 'متوافق مع CFW PS3',
      version: '1.0.0',
      fileSize: 'MB 26',
      fileFormat: 'zip',
      tags: ['UI', 'Arabic', 'Red Dead', 'PS3'],
      series: 'Red Dead',
      translationTeam: 'مترجم مستقل',
      translationType: 'unofficial',
      isFeatured: false,
      isTrending: false,
      releaseDaysAgo: 30,
      downloads: 2800,
      endorsements: 380,
      views: 10500,
      gameSlug: 'red-dead-redemption-ps3',
      files: [
        {
          title: 'تعريب Red Dead Redemption',
          description: 'الملف الرئيسي',
          alert: 'مطلوب PS3 بـ CFW',
          version: '1.0.0',
          fileSize: 'MB 26',
          fileFormat: 'zip',
          links: [
            { url: 'https://www.mediafire.com/file/red-dead-arabic-v1.0.0.zip', label: 'MediaFire' },
          ],
        },
      ],
    },
    {
      name: 'تعريب The Last of Us - Left Behind',
      arabicTitle: 'تعريب المحتوى الإضافي',
      summary: 'تعريب DLC Left Behind لـ The Last of Us',
      description: '## عن هذا التعريب\n\nتعريب المحتوى الإضافي Left Behind لـ The Last of Us.\n\n## الميزات\n\n- تعريف القصة الإضافية\n- ترجمة المهام',
      changelog: '## v1.0.0\n- الإصدار الأول',
      compatibility: 'يتطلب التعريب الرئيسي v1.0.0',
      version: '1.0.0',
      fileSize: 'MB 14',
      fileFormat: 'zip',
      tags: ['DLC', 'Arabic', 'Last of Us', 'PS3'],
      series: 'The Last of Us',
      translationTeam: 'فريق Arab4Games',
      translationType: 'unofficial',
      isFeatured: false,
      isTrending: false,
      releaseDaysAgo: 10,
      downloads: 1500,
      endorsements: 195,
      views: 5800,
      gameSlug: 'last-of-us-ps3',
      files: [
        {
          title: 'تعريب Left Behind DLC',
          description: 'القصة الإضافية',
          alert: 'يتطلب التعريب الرئيسي v1.0.0',
          version: '1.0.0',
          fileSize: 'MB 14',
          fileFormat: 'zip',
          links: [
            { url: 'https://www.mediafire.com/file/last-of-us-dlc-arabic.zip', label: 'MediaFire' },
          ],
        },
      ],
    },
    {
      name: 'حزمة تعريب PS3 - ملفات حفظ',
      arabicTitle: 'حزمة ملفات الحفظ',
      summary: 'حزمة ملفات حفظ عربية لألعاب PS3',
      description: '## عن هذه الحزمة\n\nحزمة ملفات حفظ عربية لألعاب PS3 المختلفة.\n\n## الميزات\n\n- ملفات حفظ كاملة\n- ترجمة في ملفات الحفظ',
      changelog: '## v1.0.0\n- الإصدار الأول',
      compatibility: 'متوافق مع CFW PS3',
      version: '1.0.0',
      fileSize: 'MB 8',
      fileFormat: 'zip',
      tags: ['Saves', 'Arabic', 'PS3'],
      series: 'PS3 Saves',
      translationTeam: 'مترجم مستقل',
      translationType: 'unofficial',
      isFeatured: false,
      isTrending: false,
      releaseDaysAgo: 5,
      downloads: 1100,
      endorsements: 145,
      views: 4200,
      gameSlug: 'last-of-us-ps3',
      files: [
        {
          title: 'حزمة ملفات الحفظ',
          description: 'ملفات حفظ متعددة',
          alert: 'مطلوب PS3 بـ CFW',
          version: '1.0.0',
          fileSize: 'MB 8',
          fileFormat: 'zip',
          links: [
            { url: 'https://www.mediafire.com/file/ps3-saves-arabic.zip', label: 'MediaFire' },
          ],
        },
      ],
    },
    {
      name: 'تعريب Red Dead - Undead Nightmare',
      arabicTitle: 'تعريب كابوس الموتى',
      summary: 'تعريب DLC Undead Nightmare لـ Red Dead Redemption',
      description: '## عن هذا التعريب\n\nتعريب المحتوى الإضافي Undead Nightmare لـ Red Dead Redemption.\n\n## الميزات\n\n- تعريف القصة الإضافية\n- ترجمة المهام',
      changelog: '## v1.0.0\n- الإصدار الأول',
      compatibility: 'يتطلب التعريب الرئيسي v1.0.0',
      version: '1.0.0',
      fileSize: 'MB 16',
      fileFormat: 'zip',
      tags: ['DLC', 'Arabic', 'Red Dead', 'PS3'],
      series: 'Red Dead',
      translationTeam: 'مترجم مستقل',
      translationType: 'unofficial',
      isFeatured: false,
      isTrending: false,
      releaseDaysAgo: 17,
      downloads: 980,
      endorsements: 128,
      views: 3700,
      gameSlug: 'red-dead-redemption-ps3',
      files: [
        {
          title: 'تعريب Undead Nightmare',
          description: 'DLC',
          alert: 'يتطلب التعريب الرئيسي v1.0.0',
          version: '1.0.0',
          fileSize: 'MB 16',
          fileFormat: 'zip',
          links: [
            { url: 'https://www.mediafire.com/file/red-dead-undead-arabic.zip', label: 'MediaFire' },
          ],
        },
      ],
    },
  ],

  PS2: [
    {
      name: 'تعريب Shadow of the Colossus',
      arabicTitle: 'تعريب ظل العملاق',
      summary: 'تعريب كامل لـ Shadow of the Colossus على PS2',
      description: '## عن هذا التعريب\n\nتعريب كامل للعبة Shadow of the Colossus على PS2.\n\n## الميزات\n\n- تعريب القوائم\n- دعم RTL',
      changelog: '## v1.0.0\n- الإصدار الأول',
      compatibility: 'متوافق مع PS2 OPL',
      version: '1.0.0',
      fileSize: 'MB 20',
      fileFormat: 'zip',
      tags: ['UI', 'Arabic', 'Shadow of the Colossus', 'PS2'],
      series: 'Team Ico',
      translationTeam: 'فريق Arab4Games',
      translationType: 'unofficial',
      isFeatured: true,
      isTrending: false,
      releaseDaysAgo: 28,
      downloads: 3200,
      endorsements: 425,
      views: 12000,
      gameSlug: 'shadow-of-the-colossus-ps2',
      files: [
        {
          title: 'تعريب Shadow of the Colossus',
          description: 'الملف الرئيسي',
          alert: 'مطلوب PS2 مع OPL',
          version: '1.0.0',
          fileSize: 'MB 20',
          fileFormat: 'zip',
          links: [
            { url: 'https://www.mediafire.com/file/shadow-colossus-arabic.zip', label: 'MediaFire' },
          ],
        },
      ],
    },
    {
      name: 'تعريب God of War II',
      arabicTitle: 'تعريب إله الحرب 2',
      summary: 'تعريب واجهة God of War II على PS2',
      description: '## عن هذا التعريب\n\nتعريب واجهة God of War II على PS2.\n\n## الميزات\n\n- تعريب القوائم\n- دعم RTL',
      changelog: '## v1.0.0\n- الإصدار الأول',
      compatibility: 'متوافق مع PS2 OPL',
      version: '1.0.0',
      fileSize: 'MB 18',
      fileFormat: 'zip',
      tags: ['UI', 'Arabic', 'God of War', 'PS2'],
      series: 'God of War',
      translationTeam: 'مترجم مستقل',
      translationType: 'unofficial',
      isFeatured: false,
      isTrending: false,
      releaseDaysAgo: 35,
      downloads: 2400,
      endorsements: 312,
      views: 9100,
      gameSlug: 'god-of-war-2-ps2',
      files: [
        {
          title: 'تعريب God of War II',
          description: 'الملف الرئيسي',
          alert: 'مطلوب PS2 مع OPL',
          version: '1.0.0',
          fileSize: 'MB 18',
          fileFormat: 'zip',
          links: [
            { url: 'https://www.mediafire.com/file/god-of-war-2-arabic.zip', label: 'MediaFire' },
          ],
        },
      ],
    },
    {
      name: 'تعريب Shadow of the Colossus - نسخة HD',
      arabicTitle: 'تعريب النسخة HD',
      summary: 'تعريب نسخة HD من Shadow of the Colossus',
      description: '## عن هذا التعريب\n\nتعريب نسخة HD من Shadow of the Colossus.\n\n## الميزات\n\n- تعريب القوائم\n- دعم HD',
      changelog: '## v1.0.0\n- الإصدار الأول',
      compatibility: 'متوافق مع PS2 OPL + نسخة HD',
      version: '1.0.0',
      fileSize: 'MB 22',
      fileFormat: 'zip',
      tags: ['HD', 'Arabic', 'Shadow of the Colossus', 'PS2'],
      series: 'Team Ico',
      translationTeam: 'فريق Arab4Games',
      translationType: 'unofficial',
      isFeatured: false,
      isTrending: false,
      releaseDaysAgo: 12,
      downloads: 1450,
      endorsements: 198,
      views: 5600,
      gameSlug: 'shadow-of-the-colossus-ps2',
      files: [
        {
          title: 'تعريب Shadow HD',
          description: 'نسخة HD',
          alert: 'مطلوب نسخة HD من اللعبة',
          version: '1.0.0',
          fileSize: 'MB 22',
          fileFormat: 'zip',
          links: [
            { url: 'https://www.mediafire.com/file/shadow-hd-arabic.zip', label: 'MediaFire' },
          ],
        },
      ],
    },
    {
      name: 'تعريب God of War II - المحتوى الإضافي',
      arabicTitle: 'تعريب المحتوى الإضافي',
      summary: 'تعريب المحتوى الإضافي والمراحل لـ God of War II',
      description: '## عن هذا التعريب\n\nتعريب المحتوى الإضافي لـ God of War II.\n\n## الميزات\n\n- تعريف المراحل الإضافية\n- ترجمة المهام',
      changelog: '## v1.0.0\n- الإصدار الأول',
      compatibility: 'يتطلب التعريب الرئيسي v1.0.0',
      version: '1.0.0',
      fileSize: 'MB 10',
      fileFormat: 'zip',
      tags: ['DLC', 'Arabic', 'God of War', 'PS2'],
      series: 'God of War',
      translationTeam: 'مترجم مستقل',
      translationType: 'unofficial',
      isFeatured: false,
      isTrending: false,
      releaseDaysAgo: 8,
      downloads: 820,
      endorsements: 110,
      views: 3100,
      gameSlug: 'god-of-war-2-ps2',
      files: [
        {
          title: 'تعريب God of War II DLC',
          description: 'محتوى إضافي',
          alert: 'يتطلب التعريب الرئيسي v1.0.0',
          version: '1.0.0',
          fileSize: 'MB 10',
          fileFormat: 'zip',
          links: [
            { url: 'https://www.mediafire.com/file/god-of-war-2-dlc-arabic.zip', label: 'MediaFire' },
          ],
        },
      ],
    },
    {
      name: 'حزمة تعريب PS2 - ملفات حفظ',
      arabicTitle: 'حزمة ملفات الحفظ',
      summary: 'حزمة ملفات حفظ عربية لألعاب PS2',
      description: '## عن هذه الحزمة\n\nحزمة ملفات حفظ عربية لألعاب PS2 المختلفة.\n\n## الميزات\n\n- ملفات حفظ كاملة\n- ترجمة في ملفات الحفظ',
      changelog: '## v1.0.0\n- الإصدار الأول',
      compatibility: 'متوافق مع PS2 OPL',
      version: '1.0.0',
      fileSize: 'MB 6',
      fileFormat: 'zip',
      tags: ['Saves', 'Arabic', 'PS2'],
      series: 'PS2 Saves',
      translationTeam: 'مترجم مستقل',
      translationType: 'unofficial',
      isFeatured: false,
      isTrending: false,
      releaseDaysAgo: 4,
      downloads: 680,
      endorsements: 92,
      views: 2400,
      gameSlug: 'shadow-of-the-colossus-ps2',
      files: [
        {
          title: 'حزمة ملفات الحفظ PS2',
          description: 'ملفات حفظ متعددة',
          alert: 'مطلوب PS2 مع OPL',
          version: '1.0.0',
          fileSize: 'MB 6',
          fileFormat: 'zip',
          links: [
            { url: 'https://www.mediafire.com/file/ps2-saves-arabic.zip', label: 'MediaFire' },
          ],
        },
      ],
    },
  ],

  PS1: [
    {
      name: 'تعريب Final Fantasy VII',
      arabicTitle: 'تعريب فاينل فانتسي 7',
      summary: 'تعريب كامل لـ Final Fantasy VII على PS1',
      description: '## عن هذا التعريب\n\nتعريب كامل للعبة Final Fantasy VII على PS1.\n\n## الميزات\n\n- تعريب القوائم\n- دعم RTL',
      changelog: '## v1.1.0\n- إصلاحات\n\n## v1.0.0\n- الإصدار الأول',
      compatibility: 'متوافق مع PS1 + ePSXe',
      version: '1.1.0',
      fileSize: 'MB 15',
      fileFormat: 'zip',
      tags: ['UI', 'Arabic', 'Final Fantasy', 'PS1'],
      series: 'Final Fantasy',
      translationTeam: 'فريق Arab4Games',
      translationType: 'unofficial',
      isFeatured: true,
      isTrending: false,
      releaseDaysAgo: 19,
      downloads: 4200,
      endorsements: 560,
      views: 16000,
      gameSlug: 'final-fantasy-7-ps1',
      files: [
        {
          title: 'تعريب Final Fantasy VII',
          description: 'الملف الرئيسي',
          alert: 'مطلوب PS1 أو محاكي ePSXe',
          version: '1.1.0',
          fileSize: 'MB 15',
          fileFormat: 'zip',
          links: [
            { url: 'https://www.mediafire.com/file/ff7-arabic-v1.1.0.zip', label: 'MediaFire' },
          ],
        },
      ],
    },
    {
      name: 'تعريب Metal Gear Solid',
      arabicTitle: 'تعريب ميتال جير سوليد',
      summary: 'تعريب واجهة Metal Gear Solid على PS1',
      description: '## عن هذا التعريب\n\nتعريب واجهة Metal Gear Solid على PS1.\n\n## الميزات\n\n- تعريب القوائم\n- دعم RTL',
      changelog: '## v1.0.0\n- الإصدار الأول',
      compatibility: 'متوافق مع PS1 + ePSXe',
      version: '1.0.0',
      fileSize: 'MB 12',
      fileFormat: 'zip',
      tags: ['UI', 'Arabic', 'Metal Gear', 'PS1'],
      series: 'Metal Gear',
      translationTeam: 'مترجم مستقل',
      translationType: 'unofficial',
      isFeatured: false,
      isTrending: false,
      releaseDaysAgo: 26,
      downloads: 2100,
      endorsements: 280,
      views: 7800,
      gameSlug: 'metal-gear-solid-ps1',
      files: [
        {
          title: 'تعريب Metal Gear Solid',
          description: 'الملف الرئيسي',
          alert: 'مطلوب PS1 أو محاكي ePSXe',
          version: '1.0.0',
          fileSize: 'MB 12',
          fileFormat: 'zip',
          links: [
            { url: 'https://www.mediafire.com/file/mgs-arabic-v1.0.0.zip', label: 'MediaFire' },
          ],
        },
      ],
    },
    {
      name: 'تعريب Final Fantasy VII - النسخة الكاملة',
      arabicTitle: 'تعريب النسخة الكاملة',
      summary: 'تعريب النسخة الكاملة من FF7 مع كل المحتوى',
      description: '## عن هذا التعريب\n\nتعريب النسخة الكاملة من Final Fantasy VII مع كل المحتوى.\n\n## الميزات\n\n- تعريب كامل\n- دعم المحتوى الإضافي',
      changelog: '## v1.0.0\n- الإصدار الأول',
      compatibility: 'يتطلب التعريب الرئيسي v1.1.0',
      version: '1.0.0',
      fileSize: 'MB 18',
      fileFormat: 'zip',
      tags: ['Complete', 'Arabic', 'Final Fantasy', 'PS1'],
      series: 'Final Fantasy',
      translationTeam: 'فريق Arab4Games',
      translationType: 'unofficial',
      isFeatured: false,
      isTrending: false,
      releaseDaysAgo: 7,
      downloads: 1650,
      endorsements: 215,
      views: 6100,
      gameSlug: 'final-fantasy-7-ps1',
      files: [
        {
          title: 'تعريب FF7 النسخة الكاملة',
          description: 'محتوى إضافي',
          alert: 'يتطلب التعريب الرئيسي v1.1.0',
          version: '1.0.0',
          fileSize: 'MB 18',
          fileFormat: 'zip',
          links: [
            { url: 'https://www.mediafire.com/file/ff7-complete-arabic.zip', label: 'MediaFire' },
          ],
        },
      ],
    },
    {
      name: 'تعريب Metal Gear Solid - VR Missions',
      arabicTitle: 'تعريب مهمات VR',
      summary: 'تعريب محتوى VR Missions لـ Metal Gear Solid',
      description: '## عن هذا التعريب\n\nتعريب محتوى VR Missions الإضافي لـ Metal Gear Solid.\n\n## الميزات\n\n- تعريف المهام الإضافية\n- ترجمة المهام',
      changelog: '## v1.0.0\n- الإصدار الأول',
      compatibility: 'يتطلب التعريب الرئيسي v1.0.0',
      version: '1.0.0',
      fileSize: 'MB 8',
      fileFormat: 'zip',
      tags: ['DLC', 'Arabic', 'Metal Gear', 'PS1'],
      series: 'Metal Gear',
      translationTeam: 'مترجم مستقل',
      translationType: 'unofficial',
      isFeatured: false,
      isTrending: false,
      releaseDaysAgo: 13,
      downloads: 720,
      endorsements: 95,
      views: 2800,
      gameSlug: 'metal-gear-solid-ps1',
      files: [
        {
          title: 'تعريب VR Missions',
          description: 'DLC',
          alert: 'يتطلب التعريب الرئيسي v1.0.0',
          version: '1.0.0',
          fileSize: 'MB 8',
          fileFormat: 'zip',
          links: [
            { url: 'https://www.mediafire.com/file/mgs-vr-arabic.zip', label: 'MediaFire' },
          ],
        },
      ],
    },
    {
      name: 'حزمة تعريب PS1 - ملفات حفظ',
      arabicTitle: 'حزمة ملفات الحفظ',
      summary: 'حزمة ملفات حفظ عربية لألعاب PS1',
      description: '## عن هذه الحزمة\n\nحزمة ملفات حفظ عربية لألعاب PS1 المختلفة.\n\n## الميزات\n\n- ملفات حفظ كاملة\n- ترجمة في ملفات الحفظ',
      changelog: '## v1.0.0\n- الإصدار الأول',
      compatibility: 'متوافق مع PS1 + ePSXe',
      version: '1.0.0',
      fileSize: 'MB 4',
      fileFormat: 'zip',
      tags: ['Saves', 'Arabic', 'PS1'],
      series: 'PS1 Saves',
      translationTeam: 'مترجم مستقل',
      translationType: 'unofficial',
      isFeatured: false,
      isTrending: false,
      releaseDaysAgo: 3,
      downloads: 540,
      endorsements: 72,
      views: 1900,
      gameSlug: 'final-fantasy-7-ps1',
      files: [
        {
          title: 'حزمة ملفات الحفظ PS1',
          description: 'ملفات حفظ متعددة',
          alert: 'مطلوب PS1 أو محاكي',
          version: '1.0.0',
          fileSize: 'MB 4',
          fileFormat: 'zip',
          links: [
            { url: 'https://www.mediafire.com/file/ps1-saves-arabic.zip', label: 'MediaFire' },
          ],
        },
      ],
    },
  ],
}

// ===== بيانات ثابتة للفريق والتواصل والفيديوهات والتبويبات والتعليقات =====
const TEAM_MEMBERS = [
  { name: 'مomen Hani', avatarUrl: 'https://i.pravatar.cc/150?img=68', role: 'قائد الفريق', contribution: 'إدارة المشروع والمراجعة النهائية' },
  { name: 'أحمد خليل', avatarUrl: 'https://i.pravatar.cc/150?img=12', role: 'مترجم رئيسي', contribution: 'ترجمة النصوص الأساسية والحوار' },
  { name: 'سارة محمد', avatarUrl: 'https://i.pravatar.cc/150?img=23', role: 'مترجم', contribution: 'ترجمة القوائم والوصف' },
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
  {
    name: 'فيديوهات شرح التركيب',
    videos: [
      { title: 'شرح التركيب خطوة بخطوة', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', thumbnail: 'https://images.unsplash.com/photo-1518709594023-6eab9bab7b23?w=400&h=225&fit=crop', duration: '12:45', views: 15420, channel: 'Games Arabic' },
      { title: 'كيفية تفعيل العربية', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', thumbnail: 'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=400&h=225&fit=crop', duration: '5:12', views: 23150, channel: 'Games Arabic' },
    ],
  },
  {
    name: 'فيديوهات ترويجية',
    videos: [
      { title: 'معاينة التعريب الرسمي', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', thumbnail: 'https://images.unsplash.com/photo-1551103782-8ab07afd45c1?w=400&h=225&fit=crop', duration: '2:15', views: 45820, channel: 'Games Arabic Official' },
    ],
  },
]

const CUSTOM_TABS = [
  {
    name: 'أسئلة شائعة',
    slug: 'faq',
    content: '## أسئلة شائعة\n\n**هل التعريب متوافق مع نسختي؟**\nنعم، التعريب متوافق مع كل النسخ المذكورة في قسم التوافق.\n\n**هل يحتاج التعريب لكسر حماية؟**\nيعتمد على المنصة — راجع قسم التوافق للتفاصيل.\n\n**كيف أبلّغ عن خطأ؟**\nاستخدم تبويب التعليقات أو راسلنا عبر روابط التواصل.',
  },
  {
    name: 'الاعتمادات',
    slug: 'credits',
    content: '## الاعتمادات\n\nشكر خاص لكل من ساهم في هذا التعريب:\n\n- فريق الترجمة\n- المراجعين اللغويين\n- المبرمجين\n- المجتمع العربي للألعاب\n\nهذا التعريب مُقدّم مجاناً لجميع اللاعبين العرب.',
  },
]

const COMMENTS_DATA = [
  { guestName: 'أحمد_جيمر', guestAvatar: 'https://i.pravatar.cc/100?img=12', text: 'التعريب ممتاز جداً، اشتغل معايا بدون أي مشاكل. الترجمة دقيقة ومفيش أخطاء. شكراً لفريق التعريب!', likes: 87, dislikes: 2, isPinned: true, replies: [{ guestName: 'مomen Hani', guestAvatar: 'https://i.pravatar.cc/100?img=68', text: 'شكراً على كلامك الطيب! ده بيحفّزنا نكمّل شغلنا.', likes: 24, dislikes: 0 }] },
  { guestName: 'خالد_سنايبر', guestAvatar: 'https://i.pravatar.cc/100?img=33', text: 'التثبيت سهل جداً. بس لاحظت إن بعض النصوص في القائمة مش مترجمة. هل ده هيتصلح؟', likes: 45, dislikes: 3, isEdited: true, replies: [] },
  { guestName: 'سارة_بلايز', guestAvatar: 'https://i.pravatar.cc/100?img=23', text: 'تعريب احترافي بمعنى الكلمة. الخط واضح والترتيب صحيح. تستاهلون كل خير', likes: 32, dislikes: 0, replies: [] },
]

// ===== خريطة أسماء السلاسل =====
const SERIES_MAP: Record<string, string> = {
  'The Witcher 3: Wild Hunt': 'The Witcher',
  'Skyrim Special Edition': 'The Elder Scrolls',
  'Cyberpunk 2077': 'Cyberpunk',
  'The Legend of Zelda: Breath of the Wild': 'The Legend of Zelda',
  'Super Mario Odyssey': 'Super Mario',
  'Animal Crossing: New Horizons': 'Animal Crossing',
  'God of War': 'God of War',
  'God of War II': 'God of War',
  "Marvel's Spider-Man": 'Spider-Man',
  'Bloodborne': 'Souls',
  'The Last of Us': 'The Last of Us',
  'Red Dead Redemption': 'Red Dead',
  'Shadow of the Colossus': 'Team Ico',
  'Final Fantasy VII': 'Final Fantasy',
  'Metal Gear Solid': 'Metal Gear',
}

async function main() {
  console.log('Cleaning database...')
  await db.modComment.deleteMany()
  await db.modCustomTab.deleteMany()
  await db.modContactLink.deleteMany()
  await db.modTeamMember.deleteMany()
  await db.modVideo.deleteMany()
  await db.modVideoGroup.deleteMany()
  await db.modFileLink.deleteMany()
  await db.modFile.deleteMany()
  await db.endorsement.deleteMany()
  await db.mod.deleteMany()
  await db.category.deleteMany()
  await db.game.deleteMany()
  await db.user.deleteMany()

  console.log('Creating owner account...')
  const ownerPasswordHash = await bcrypt.hash('GA@dm!n2026#S3cure', 10)
  const owner = await db.user.create({
    data: {
      username: 'GADMIx',
      email: 'owner@games-arabic.com',
      password: ownerPasswordHash,
      avatarUrl: 'https://i.pravatar.cc/300?img=68',
      bannerUrl: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=2560&h=1440&fit=crop',
      bio: 'مالك و مؤسس منصة ألعاب بالعربي — أكبر منصة لتعريب وأرشفة الألعاب في العالم العربي.',
      role: 'owner',
      joinedAt: new Date(Date.now() - 1800 * 86400000),
    },
  })

  console.log('Creating staff users...')
  const adminHash = await bcrypt.hash('GA@dm!n2026#Mod3r', 10)
  const modHash = await bcrypt.hash('GA@dm!n2026#Mod3r', 10)
  const staffUsers = [
    { username: 'GAAdminHesham', email: 'admin@games-arabic.com', password: adminHash, avatarUrl: 'https://i.pravatar.cc/300?img=11', bio: 'مدير عام المنصة.', role: 'admin' },
    { username: 'GAModKarim', email: 'mod@games-arabic.com', password: modHash, avatarUrl: 'https://i.pravatar.cc/300?img=33', bio: 'مشرف المنصة.', role: 'moderator' },
  ]
  for (const a of staffUsers) {
    await db.user.create({ data: { ...a, joinedAt: new Date(Date.now() - 365 * 86400000) } })
  }

  console.log('Creating games...')
  const games: Record<string, any> = {}
  for (const g of GAMES) {
    const game = await db.game.create({
      data: {
        slug: g.slug,
        name: g.name,
        tagline: g.tagline,
        description: g.description,
        bannerUrl: g.bannerUrl,
        thumbnailUrl: g.thumbnailUrl,
        category: g.category,
        platform: g.platform,
        releaseYear: g.releaseYear,
        featured: g.featured,
      },
    })
    for (const cat of g.categories) {
      await db.category.create({ data: { name: cat, slug: slugify(cat), gameId: game.id } })
    }
    games[g.slug] = game
  }

  console.log('Creating mods (5 per platform)...')
  let modCount = 0
  let modSeq = 0

  for (const [platform, mods] of Object.entries(PLATFORM_MODS)) {
    console.log(`  ${platform}: ${mods.length} mods`)
    for (const m of mods) {
      modSeq++
      const game = games[m.gameSlug]
      if (!game) {
        console.log(`    ⚠️ Game not found: ${m.gameSlug}`)
        continue
      }
      const categories = await db.category.findMany({ where: { gameId: game.id } })
      const category = categories[0]
      const releaseDate = new Date(Date.now() - m.releaseDaysAgo * 86400000)
      const slug = `${slugify(m.name)}-${m.gameSlug}-${modSeq}`.slice(0, 100)

      const mod = await db.mod.create({
        data: {
          slug,
          name: m.name,
          summary: m.summary,
          description: m.description,
          changelog: m.changelog,
          arabicTitle: m.arabicTitle,
          compatibility: m.compatibility,
          authorId: owner.id,
          gameId: game.id,
          categoryId: category?.id || null,
          thumbnailUrl: game.thumbnailUrl,
          imageUrl: game.bannerUrl,
          galleryUrls: [game.thumbnailUrl, game.bannerUrl].join(','),
          version: m.version,
          fileSize: m.fileSize,
          fileFormat: m.fileFormat,
          downloads: m.downloads,
          endorsements: m.endorsements,
          views: m.views,
          comments: COMMENTS_DATA.length + COMMENTS_DATA.reduce((s, c) => s + (c.replies?.length || 0), 0),
          rating: 4.5,
          ratingCount: Math.floor(m.endorsements * 0.3),
          tags: m.tags.join(','),
          series: m.series,
          translationTeam: m.translationTeam,
          translationType: m.translationType,
          isFeatured: m.isFeatured,
          isTrending: m.isTrending,
          isLatest: true,
          releaseDate,
        },
      })

      // ملفات التحميل
      for (let i = 0; i < m.files.length; i++) {
        const f = m.files[i]
        await db.modFile.create({
          data: {
            modId: mod.id,
            title: f.title,
            description: f.description,
            alert: f.alert,
            version: f.version,
            releaseDate,
            fileSize: f.fileSize,
            fileFormat: f.fileFormat,
            order: i,
            links: {
              create: f.links.map((l, j) => ({ url: l.url, label: l.label, order: j })),
            },
          },
        })
      }

      // أعضاء الفريق
      for (let i = 0; i < TEAM_MEMBERS.length; i++) {
        const tm = TEAM_MEMBERS[i]
        await db.modTeamMember.create({
          data: {
            modId: mod.id,
            name: tm.name,
            avatarUrl: tm.avatarUrl,
            role: tm.role,
            contribution: tm.contribution,
            order: i,
          },
        })
      }

      // روابط التواصل
      for (let i = 0; i < CONTACT_LINKS.length; i++) {
        const c = CONTACT_LINKS[i]
        await db.modContactLink.create({
          data: {
            modId: mod.id,
            type: c.type,
            label: c.label,
            url: c.url,
            order: i,
          },
        })
      }

      // أقسام الفيديوهات + الفيديوهات
      for (let i = 0; i < VIDEO_GROUPS.length; i++) {
        const g = VIDEO_GROUPS[i]
        const group = await db.modVideoGroup.create({
          data: { modId: mod.id, name: g.name, order: i },
        })
        for (let j = 0; j < g.videos.length; j++) {
          const v = g.videos[j]
          await db.modVideo.create({
            data: {
              groupId: group.id,
              title: v.title,
              url: v.url,
              thumbnail: v.thumbnail,
              duration: v.duration,
              views: v.views,
              channel: v.channel,
              order: j,
            },
          })
        }
      }

      // التبويبات المخصصة
      for (let i = 0; i < CUSTOM_TABS.length; i++) {
        const t = CUSTOM_TABS[i]
        await db.modCustomTab.create({
          data: {
            modId: mod.id,
            name: t.name,
            slug: t.slug,
            content: t.content,
            order: i,
            visible: true,
          },
        })
      }

      // التعليقات + الردود
      for (const c of COMMENTS_DATA) {
        const comment = await db.modComment.create({
          data: {
            modId: mod.id,
            guestName: c.guestName,
            guestAvatar: c.guestAvatar,
            text: c.text,
            likes: c.likes,
            dislikes: c.dislikes,
            isPinned: c.isPinned || false,
            isEdited: c.isEdited || false,
          },
        })
        for (const r of (c.replies || [])) {
          await db.modComment.create({
            data: {
              modId: mod.id,
              parentId: comment.id,
              guestName: r.guestName,
              guestAvatar: r.guestAvatar,
              text: r.text,
              likes: r.likes,
              dislikes: r.dislikes,
            },
          })
        }
      }

      modCount++
    }
  }

  // تحديث الـ aggregate counts على الألعاب
  console.log('Updating game aggregates...')
  for (const game of Object.values(games)) {
    const agg = await db.mod.aggregate({
      where: { gameId: game.id },
      _sum: { downloads: true, endorsements: true },
      _count: true,
    })
    await db.game.update({
      where: { id: game.id },
      data: {
        modCount: agg._count,
        totalDownloads: agg._sum.downloads || 0,
        totalEndorsements: agg._sum.endorsements || 0,
      },
    })
  }

  console.log(`\n✅ Seeded successfully!`)
  console.log(`  - 3 users (owner + admin + moderator)`)
  console.log(`  - ${Object.keys(games).length} games`)
  console.log(`  - ${modCount} mods (5 per platform × 6 platforms = 30)`)
  console.log(`  - Each mod has: files, team, contacts, videos, custom tabs, comments`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
