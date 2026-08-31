// Seed script — بيانات كاملة لمنصة ألعاب بالعربي
// 9 منصات (PC, NS, PS4, PS3, PS2, PS1, PS5, X360, ANDROID) × 25 تعريب = 225 تعريب
// كل تعريب فيه: ملفات تحميل، فريق تعريب، روابط تواصل، فيديوهات، تبويبات مخصصة، تعليقات
import { db } from '../src/lib/db'
import bcrypt from 'bcryptjs'

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

// ===== كل الألعاب عبر المنصات التسع =====
const GAMES = [
  // ===== PC =====
  { slug: 'the-witcher-3-pc', name: 'The Witcher 3: Wild Hunt', tagline: 'لعبة تقمص أدوار عالم مفتوح ملحمية', description: 'The Witcher 3: Wild Hunt هي لعبة تقمص أدوار عالم مفتوح تدور أحداثها في عالم خيالي مليء بالخيارات ذات المعنى والعواقب المؤثرة. خوض مغامرة جرالت من ريفيا وهو يبحث عن طفل النبوءة.', bannerUrl: 'https://images.unsplash.com/photo-1593305841991-05c297ba4575?w=1600&q=80', thumbnailUrl: 'https://images.unsplash.com/photo-1593305841991-05c297ba4575?w=600&q=80', category: 'RPG', platform: 'PC', releaseYear: 2015, featured: true, categories: ['UI', 'Gameplay', 'Graphics', 'Quests'] },
  { slug: 'skyrim-special-edition-pc', name: 'Skyrim Special Edition', tagline: 'لعبة تقمص أدوار عالم مفتوح ملحمية', description: 'Skyrim Special Edition تعيد إحياء الملحمة الخيالية بتفاصيل مذهلة. تشمل النسخة الخاصة اللعبة والإضافات مع ميزات جديدة كلياً.', bannerUrl: 'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=1600&q=80', thumbnailUrl: 'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=600&q=80', category: 'RPG', platform: 'PC', releaseYear: 2016, featured: true, categories: ['UI', 'Gameplay', 'Graphics', 'Quests'] },
  { slug: 'cyberpunk-2077-pc', name: 'Cyberpunk 2077', tagline: 'لعبة تقمص أدوار وأكشن عالم مفتوح', description: 'Cyberpunk 2077 هي لعبة تقمص أدوار وأكشن عالم مفتوح تدور أحداثها في مستقبل مدينة الليل المظلم.', bannerUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af2176?w=1600&q=80', thumbnailUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af2176?w=600&q=80', category: 'RPG', platform: 'PC', releaseYear: 2020, featured: true, categories: ['UI', 'Gameplay', 'Graphics'] },

  // ===== NS (Nintendo Switch) =====
  { slug: 'zelda-breath-of-the-wild-ns', name: 'The Legend of Zelda: Breath of the Wild', tagline: 'مغامرة مفتوحة في عالم هيرول', description: 'استكشف عالم هيرول الشاسع في هذه المغامرة المفتوحة. تسلق أي جبل، اسبح في أي بحيرة، واكتشف أسرار العالم القديم.', bannerUrl: 'https://images.unsplash.com/photo-1551103782-8ab07afd45c1?w=1600&q=80', thumbnailUrl: 'https://images.unsplash.com/photo-1551103782-8ab07afd45c1?w=600&q=80', category: 'Adventure', platform: 'NS', releaseYear: 2017, featured: true, categories: ['Saves', 'Gameplay', 'Graphics'] },
  { slug: 'super-mario-odyssey-ns', name: 'Super Mario Odyssey', tagline: 'مغامرة ماريو حول العالم', description: 'انضم لماريو في رحلة حول العالم لإنقاذ الأميرة بيتش من باوزر. استخدم قبعة كابي للامتلاك والتحكم في الأعداء.', bannerUrl: 'https://images.unsplash.com/photo-1493238792000-8113da705763?w=1600&q=80', thumbnailUrl: 'https://images.unsplash.com/photo-1493238792000-8113da705763?w=600&q=80', category: 'Adventure', platform: 'NS', releaseYear: 2017, featured: false, categories: ['Saves', 'Gameplay'] },
  { slug: 'animal-crossing-ns', name: 'Animal Crossing: New Horizons', tagline: 'ابن جزيرتك الخاصة', description: 'ابن جزيرتك من الصفر، استكشف، اجمع، وكون صداقات مع سكان الجزيرة.', bannerUrl: 'https://images.unsplash.com/photo-1518709594023-6eab9bab7b23?w=1600&q=80', thumbnailUrl: 'https://images.unsplash.com/photo-1518709594023-6eab9bab7b23?w=600&q=80', category: 'Simulation', platform: 'NS', releaseYear: 2020, featured: true, categories: ['Saves', 'UI'] },

  // ===== PS4 =====
  { slug: 'god-of-war-ps4', name: 'God of War', tagline: 'كراتوس يعود في مغامرة نوردية', description: 'كراتوس يعيش الآن في عالم الإسكندنافيين — عالم قاسٍ وبارد يسكنه الآلهة والوحوش الأسطورية.', bannerUrl: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=1600&q=80', thumbnailUrl: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=600&q=80', category: 'Action', platform: 'PS4', releaseYear: 2018, featured: true, categories: ['Saves', 'Gameplay'] },
  { slug: 'spider-man-ps4', name: "Marvel's Spider-Man", tagline: 'كما العنكبوت تماماً', description: 'انطلق في مغامرة أكشن عالم مفتوح مع الرجل العنكبوت وهو يواجه أبشع الأعداء في مدينة نيويورك.', bannerUrl: 'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=1600&q=80', thumbnailUrl: 'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=600&q=80', category: 'Action', platform: 'PS4', releaseYear: 2018, featured: true, categories: ['Saves', 'Gameplay'] },
  { slug: 'bloodborne-ps4', name: 'Bloodborne', tagline: 'رعب أكشن من FromSoftware', description: 'استكشف مدينة يارنام الغامضة المليئة بالوحوش والأسرار في هذه اللعبة الأكشن RPG.', bannerUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af2176?w=1600&q=80', thumbnailUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af2176?w=600&q=80', category: 'RPG', platform: 'PS4', releaseYear: 2015, featured: false, categories: ['Saves', 'Gameplay'] },

  // ===== PS3 =====
  { slug: 'last-of-us-ps3', name: 'The Last of Us', tagline: 'بقاء في عالم ما بعد الكارثة', description: 'جويل وإيلي يخوضان رحلة عبر الولايات المتحدة بعد تفشي فطر يحوّل البشر إلى وحوش.', bannerUrl: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=1600&q=80', thumbnailUrl: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=600&q=80', category: 'Action', platform: 'PS3', releaseYear: 2013, featured: true, categories: ['Saves', 'Gameplay'] },
  { slug: 'red-dead-redemption-ps3', name: 'Red Dead Redemption', tagline: 'الغرب الأمريكي القديم', description: 'عيش حياة الخارج عن القانون جون مارستون وهو يحاول العودة لعائلته في الغرب الأمريكي المتلاشي.', bannerUrl: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=1600&q=80', thumbnailUrl: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=600&q=80', category: 'Action', platform: 'PS3', releaseYear: 2010, featured: false, categories: ['Saves', 'Gameplay'] },

  // ===== PS2 =====
  { slug: 'shadow-of-the-colossus-ps2', name: 'Shadow of the Colossus', tagline: 'مغامرة فنية ملحمية', description: 'اقتحم عالماً شاسعاً وواجه ستة عشر عملاقاً في سعي محموم لإنقاذ فتاة.', bannerUrl: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=1600&q=80', thumbnailUrl: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=600&q=80', category: 'Adventure', platform: 'PS2', releaseYear: 2005, featured: true, categories: ['Saves', 'Gameplay'] },
  { slug: 'god-of-war-2-ps2', name: 'God of War II', tagline: 'غضب كراتوس يستمر', description: 'بعد خيانة زيوس، يعود كراتوس للانتقام في الجزء الثاني من ملحمة God of War.', bannerUrl: 'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=1600&q=80', thumbnailUrl: 'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=600&q=80', category: 'Action', platform: 'PS2', releaseYear: 2007, featured: false, categories: ['Saves', 'Gameplay'] },

  // ===== PS1 =====
  { slug: 'final-fantasy-7-ps1', name: 'Final Fantasy VII', tagline: 'اللعبة التي عرّفت الـ RPG للعالم', description: 'كلود سترايف ينضم لفريق أفالانش لوقف شركة شينرا من استنزاف كوكب الأرض.', bannerUrl: 'https://images.unsplash.com/photo-1531219432768-9f540ce0ec55?w=1600&q=80', thumbnailUrl: 'https://images.unsplash.com/photo-1531219432768-9f540ce0ec55?w=600&q=80', category: 'RPG', platform: 'PS1', releaseYear: 1997, featured: true, categories: ['Saves', 'Gameplay'] },
  { slug: 'metal-gear-solid-ps1', name: 'Metal Gear Solid', tagline: 'تجسس تكتيكي من كوجيما', description: 'سنيك يتسلل لجزيرة نوعية لوقف إطلاق ميتال غير ركس. لعبة تجسس تكتيكية مع قصة عميقة.', bannerUrl: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=1600&q=80', thumbnailUrl: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=600&q=80', category: 'Action', platform: 'PS1', releaseYear: 1998, featured: false, categories: ['Saves', 'Gameplay'] },

  // ===== PS5 =====
  { slug: 'astrobot-ps5', name: 'Astro Bot', tagline: 'مغامرة روبوتية ممتعة', description: 'Astro Bot هي لعبة منصات ممتعة على PS5.', bannerUrl: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=1600&q=80', thumbnailUrl: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=600&q=80', category: 'Platformer', platform: 'PS5', releaseYear: 2024, featured: true, categories: ['UI', 'Gameplay'] },
  { slug: 'ff7-rebirth-ps5', name: 'Final Fantasy VII Rebirth', tagline: 'ملحمة فاينل فانتسي تستمر', description: 'FF7 Rebirth هي الجزء الثاني من trilogy إعادة التصنيع.', bannerUrl: 'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=1600&q=80', thumbnailUrl: 'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=600&q=80', category: 'RPG', platform: 'PS5', releaseYear: 2024, featured: true, categories: ['UI', 'Gameplay', 'Graphics'] },
  { slug: 'gow-ragnarok-ps5', name: 'God of War Ragnarok', tagline: 'نهاية العالم الإسكندنافي', description: 'God of War Ragnarok تكمل ملحمة كراتوس واتريس.', bannerUrl: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=1600&q=80', thumbnailUrl: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=600&q=80', category: 'Action', platform: 'PS5', releaseYear: 2022, featured: true, categories: ['UI', 'Gameplay', 'Graphics'] },
  { slug: 'horizon-ps5', name: 'Horizon Forbidden West', tagline: 'استكشاف الغرب المحظور', description: 'Horizon Forbidden West على PS5 بجودة أعلى.', bannerUrl: 'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=1600&q=80', thumbnailUrl: 'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=600&q=80', category: 'RPG', platform: 'PS5', releaseYear: 2022, featured: false, categories: ['UI', 'Gameplay'] },
  { slug: 'spider-man-2-ps5', name: "Marvel's Spider-Man 2", tagline: 'الرجل العنكبوت يعود', description: 'Spider-Man 2 تجمع بين بيتر ومالز في مغامرة جديدة.', bannerUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af2176?w=1600&q=80', thumbnailUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af2176?w=600&q=80', category: 'Action', platform: 'PS5', releaseYear: 2023, featured: true, categories: ['UI', 'Gameplay', 'Graphics'] },
  { slug: 'tlou3-ps5', name: 'The Last of Us Part III', tagline: 'نهاية قصة البقاء', description: 'The Last of Us Part III تكمل قصة إيلي.', bannerUrl: 'https://images.unsplash.com/photo-1593305841991-05c297ba4575?w=1600&q=80', thumbnailUrl: 'https://images.unsplash.com/photo-1593305841991-05c297ba4575?w=600&q=80', category: 'Action', platform: 'PS5', releaseYear: 2025, featured: true, categories: ['UI', 'Gameplay'] },
  { slug: 'gran-turismo-7-ps5', name: 'Gran Turismo 7', tagline: 'أفضل محاكاة سباق', description: 'Gran Turismo 7 هي أفضل محاكاة سباق على PS5.', bannerUrl: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=1600&q=80', thumbnailUrl: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=600&q=80', category: 'Racing', platform: 'PS5', releaseYear: 2022, featured: false, categories: ['UI', 'Gameplay'] },

  // ===== X360 (Xbox 360) =====
  { slug: 'halo-3-x360', name: 'Halo 3', tagline: 'نهاية ملحمة ماستر تشييف', description: 'Halo 3 تكمل ملحمة ماستر تشييف في معركة الخلاص.', bannerUrl: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=1600&q=80', thumbnailUrl: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=600&q=80', category: 'FPS', platform: 'X360', releaseYear: 2007, featured: true, categories: ['UI', 'Gameplay'] },
  { slug: 'gears-x360', name: 'Gears of War', tagline: 'حرب تكتيكية عنيفة', description: 'Gears of War هي لعبة أكشن تكتيكية شهيرة على X360.', bannerUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af2176?w=1600&q=80', thumbnailUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af2176?w=600&q=80', category: 'Action', platform: 'X360', releaseYear: 2006, featured: true, categories: ['UI', 'Gameplay'] },
  { slug: 'fable-x360', name: 'Fable II', tagline: 'عالم خيالي مفتوح', description: 'Fable II هي لعبة RPG عالم مفتوح على X360.', bannerUrl: 'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=1600&q=80', thumbnailUrl: 'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=600&q=80', category: 'RPG', platform: 'X360', releaseYear: 2008, featured: false, categories: ['UI', 'Gameplay'] },
  { slug: 'mass-effect-x360', name: 'Mass Effect', tagline: 'ملحمة فضائية RPG', description: 'Mass Effect هي لعبة RPG فضائية أسطورية.', bannerUrl: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=1600&q=80', thumbnailUrl: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=600&q=80', category: 'RPG', platform: 'X360', releaseYear: 2007, featured: true, categories: ['UI', 'Gameplay'] },
  { slug: 'skyrim-x360', name: 'Skyrim', tagline: 'ملحمة تقمص أدوار عالم مفتوح', description: 'Skyrim على X360 — عالم تامري الضخم.', bannerUrl: 'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=1600&q=80', thumbnailUrl: 'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=600&q=80', category: 'RPG', platform: 'X360', releaseYear: 2011, featured: false, categories: ['UI', 'Gameplay'] },

  // ===== ANDROID =====
  { slug: 'genshin-android', name: 'Genshin Impact', tagline: 'مغامرة عالم مفتوح خيالية', description: 'Genshin Impact هي لعبة RPG عالم مفتوح مجانية.', bannerUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af2176?w=1600&q=80', thumbnailUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af2176?w=600&q=80', category: 'RPG', platform: 'ANDROID', releaseYear: 2020, featured: true, categories: ['UI', 'Gameplay'] },
  { slug: 'pubg-android', name: 'PUBG Mobile', tagline: 'باتل رويال مobail', description: 'PUBG Mobile هي لعبة باتل رويال الشهيرة.', bannerUrl: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=1600&q=80', thumbnailUrl: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=600&q=80', category: 'Shooter', platform: 'ANDROID', releaseYear: 2018, featured: true, categories: ['UI', 'Gameplay'] },
  { slug: 'cod-mobile-android', name: 'Call of Duty Mobile', tagline: 'الحرب على الهاتف', description: 'Call of Duty Mobile تجربة COD كاملة على الهاتف.', bannerUrl: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=1600&q=80', thumbnailUrl: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=600&q=80', category: 'FPS', platform: 'ANDROID', releaseYear: 2019, featured: true, categories: ['UI', 'Gameplay'] },
  { slug: 'minecraft-android', name: 'Minecraft', tagline: 'عالم البناء لا نهائي الإمكانيات', description: 'Minecraft على Android — ابن عالمك الخاص.', bannerUrl: 'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=1600&q=80', thumbnailUrl: 'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=600&q=80', category: 'Sandbox', platform: 'ANDROID', releaseYear: 2011, featured: true, categories: ['UI', 'Gameplay'] },
  { slug: 'stardew-android', name: 'Stardew Valley', tagline: 'حياة المزرعة الهادئة', description: 'Stardew Valley على Android — استمتع بحياة المزرعة.', bannerUrl: 'https://images.unsplash.com/photo-1518709594023-6eab9bab7b23?w=1600&q=80', thumbnailUrl: 'https://images.unsplash.com/photo-1518709594023-6eab9bab7b23?w=600&q=80', category: 'Simulation', platform: 'ANDROID', releaseYear: 2019, featured: false, categories: ['UI', 'Gameplay'] },
]

// ===== مواضيع التعريب (25 لكل منصة) =====
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

// ===== بيانات ثابتة للفريق والتواصل والفيديوهات والتبويبات والتعليقات =====
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
  { name: 'أسئلة شائعة', slug: 'faq', content: '## أسئلة شائعة\n\n**هل التعريب متوافق مع نسختي؟**\nنعم، التعريب متوافق مع كل النسخ المذكورة في قسم التوافق.\n\n**كيف أبلّغ عن خطأ؟**\nاستخدم تبويب التعليقات أو راسلنا عبر روابط التواصل.' },
  { name: 'الاعتمادات', slug: 'credits', content: '## الاعتمادات\n\nشكر خاص لكل من ساهم في هذا التعريب:\n\n- فريق الترجمة\n- المراجعين اللغويين\n- المبرمجين\n- المجتمع العربي للألعاب\n\nهذا التعريب مُقدّم مجاناً لجميع اللاعبين العرب.' },
]

const COMMENTS_DATA = [
  { guestName: 'أحمد_جيمر', guestAvatar: 'https://i.pravatar.cc/100?img=12', text: 'التعريب ممتاز جداً، اشتغل معايا بدون أي مشاكل. الترجمة دقيقة ومفيش أخطاء. شكراً لفريق التعريب!', likes: 87, dislikes: 2, isPinned: true, replies: [{ guestName: 'مomen Hani', guestAvatar: 'https://i.pravatar.cc/100?img=68', text: 'شكراً على كلامك الطيب! ده بيحفّزنا نكمّل شغلنا.', likes: 24, dislikes: 0 }] },
  { guestName: 'خالد_سنايبر', guestAvatar: 'https://i.pravatar.cc/100?img=33', text: 'التثبيت سهل جداً. بس لاحظت إن بعض النصوص في القائمة مش مترجمة. هل ده هيتصلح؟', likes: 45, dislikes: 3, isEdited: true, replies: [] },
  { guestName: 'سارة_بلايز', guestAvatar: 'https://i.pravatar.cc/100?img=23', text: 'تعريب احترافي بمعنى الكلمة. الخط واضح والترتيب صحيح. تستاهلون كل خير', likes: 32, dislikes: 0, replies: [] },
]

// ===== الفرق والسلاسل الثابتة =====
const TEAMS = [
  { name: 'فريق Arab4Games', slug: 'arab4games', description: 'فريق تعريب متخصص من مصر منذ 2010.', }
  , { name: 'فريق بالعربي', slug: 'belarabi', description: 'فريق تعريب من السعودية.' }
  , { name: 'فريق Astral', slug: 'astral', description: 'فريق تعريب من المغرب.' }
  , { name: 'فريق Hawary', slug: 'hawary', description: 'فريق تعريب من مصر.' }
  , { name: 'فريق Falcon', slug: 'falcon', description: 'فريق تعريب من العراق.' }
]

const SERIES = [
  { name: 'The Witcher', slug: 'the-witcher', description: 'سلسلة The Witcher' }
  , { name: 'God of War', slug: 'god-of-war', description: 'سلسلة God of War' }
  , { name: 'The Elder Scrolls', slug: 'the-elder-scrolls', description: 'سلسلة The Elder Scrolls' }
  , { name: 'The Legend of Zelda', slug: 'the-legend-of-zelda', description: 'سلسلة Zelda' }
  , { name: 'Final Fantasy', slug: 'final-fantasy', description: 'سلسلة Final Fantasy' }
]

function genDesc(gameName: string, scope: string, platform: string): string {
  return `## عن هذا التعريب\n\nتعريب ${scope} للعبة ${gameName} على ${platform}.\n\n## الميزات\n\n- تعريب ${scope} كامل\n- دعم RTL\n- خطوط عربية واضحة\n\n## التثبيت\n\n1. حمل التعريب\n2. استخرج في مجلد اللعبة\n3. اختر العربية\n4. استمتع!`
}
function genCompat(platform: string): string {
  const map: Record<string, string> = { PC: 'PC', NS: 'Nintendo Switch', PS4: 'PlayStation 4', PS3: 'PlayStation 3', PS2: 'PlayStation 2', PS1: 'PlayStation 1', PS5: 'PlayStation 5', X360: 'Xbox 360', ANDROID: 'Android' }
  return `متوافق مع ${map[platform] || platform}`
}
function genChangelog(v: string): string {
  return `## v${v} (الإصدار الحالي)\n- إصلاح أخطاء إملائية\n- تحسين الترجمات\n\n## v1.0.0\n- الإصدار الأول\n`
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
  await db.team.deleteMany()
  await db.series.deleteMany()
  await db.section.deleteMany()
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
    { username: 'GAAdminHesham', email: 'admin@games-arabic.com', role: 'admin', avatarUrl: 'https://i.pravatar.cc/300?img=11', bio: 'مدير عام المنصة.' },
    { username: 'GAModKarim', email: 'mod@games-arabic.com', role: 'moderator', avatarUrl: 'https://i.pravatar.cc/300?img=33', bio: 'مشرف المنصة.' },
  ]
  const staff: any[] = []
  for (const a of staffUsers) {
    const u = await db.user.create({ data: { ...a, password: a.role === 'admin' ? adminHash : modHash, joinedAt: new Date(Date.now() - 365 * 86400000) } })
    staff.push(u)
  }
  const authorPool = [...staff, owner]

  console.log('Creating teams & series...')
  const teams = []
  for (const t of TEAMS) {
    const team = await db.team.create({ data: { name: t.name, slug: t.slug, description: t.description, ownerId: owner.id } })
    teams.push(team)
  }
  const series = []
  for (const s of SERIES) {
    const ser = await db.series.create({ data: { name: s.name, slug: s.slug, description: s.description } })
    series.push(ser)
  }

  console.log('Creating sections...')
  const sections = [
    { key: 'PC', name: 'PC ARABIC', nameEn: 'PC Arabic', icon: 'Monitor', color: '#6366f1', order: 1 },
    { key: 'PS5', name: 'PS5 ARABIC', nameEn: 'PS5 Arabic', icon: 'Gamepad', color: '#3b82f6', order: 2 },
    { key: 'PS4', name: 'PS4 ARABIC', nameEn: 'PS4 Arabic', icon: 'Gamepad', color: '#8b5cf6', order: 3 },
    { key: 'PS3', name: 'PS3 ARABIC', nameEn: 'PS3 Arabic', icon: 'Gamepad', color: '#84cc16', order: 4 },
    { key: 'PS2', name: 'PS2 ARABIC', nameEn: 'PS2 Arabic', icon: 'Gamepad', color: '#f59e0b', order: 5 },
    { key: 'PS1', name: 'PS1 ARABIC', nameEn: 'PS1 Arabic', icon: 'Gamepad', color: '#ef4444', order: 6 },
    { key: 'NS', name: 'NS ARABIC', nameEn: 'NS Arabic', icon: 'Gamepad', color: '#22c55e', order: 7 },
    { key: 'X360', name: 'XBOX 360 ARABIC', nameEn: 'Xbox 360 Arabic', icon: 'Gamepad', color: '#0ea5e9', order: 8 },
    { key: 'ANDROID', name: 'ANDROID ARABIC', nameEn: 'Android Arabic', icon: 'Smartphone', color: '#a3e635', order: 9 },
  ]
  const sectionMap: Record<string, any> = {}
  for (const s of sections) {
    const sec = await db.section.create({ data: { ...s, slug: s.key.toLowerCase() } })
    sectionMap[s.key] = sec
  }

  console.log('Creating games...')
  const games: Record<string, any> = {}
  const gamesByPlatform: Record<string, any[]> = {}
  for (const g of GAMES) {
    const game = await db.game.create({
      data: { slug: g.slug, name: g.name, tagline: g.tagline, description: g.description, bannerUrl: g.bannerUrl, thumbnailUrl: g.thumbnailUrl, category: g.category, platform: g.platform, releaseYear: g.releaseYear, featured: g.featured },
    })
    for (const cat of g.categories) await db.category.create({ data: { name: cat, slug: slugify(cat), gameId: game.id } })
    games[g.slug] = game
    if (!gamesByPlatform[g.platform]) gamesByPlatform[g.platform] = []
    gamesByPlatform[g.platform].push(game)
  }

  console.log('Creating mods (25 per platform)...')
  let modCount = 0
  const platforms = Object.keys(gamesByPlatform)

  for (const platform of platforms) {
    const platformGames = gamesByPlatform[platform]
    console.log(`  ${platform}: ${MOD_SCOPES.length} mods`)
    const section = sectionMap[platform] || null

    for (let i = 0; i < MOD_SCOPES.length; i++) {
      const ms = MOD_SCOPES[i]
      const gameRaw = platformGames[i % platformGames.length]
      const game = games[gameRaw.slug]
      const gameName = gameRaw.name

      const prefixes = ['تعريب', 'ترجمة', 'حزمة', 'حزمة تعريب']
      const modName = `${prefixes[i % prefixes.length]} ${ms.scope} — ${gameName}`
      const slug = `${slugify(modName)}-${gameRaw.slug}-${modCount + 1}`.slice(0, 100)
      const releaseDate = new Date(Date.now() - ms.days * 86400000)
      const categories = await db.category.findMany({ where: { gameId: game.id } })
      const category = categories[0]
      const team = teams[i % teams.length]
      const author = authorPool[i % authorPool.length]

      const mod = await db.mod.create({
        data: {
          slug,
          name: modName,
          summary: `تعريب ${ms.scope} للعبة ${gameName} مع دعم كامل للعربية`,
          description: genDesc(gameName, ms.scope, platform),
          changelog: genChangelog(ms.ver),
          arabicTitle: ms.scope,
          compatibility: genCompat(platform),
          author: { connect: { id: author.id } },
          game: { connect: { id: game.id } },
          ...(category ? { category: { connect: { id: category.id } } } : {}),
          ...(section ? { sectionRelation: { connect: { id: section.id } } } : {}),
          thumbnailUrl: game.thumbnailUrl,
          imageUrl: game.bannerUrl,
          galleryUrls: [game.thumbnailUrl, game.bannerUrl].join(','),
          version: ms.ver,
          fileSize: ms.size,
          fileFormat: ms.fmt,
          downloads: ms.dl,
          endorsements: ms.end,
          views: ms.views,
          comments: COMMENTS_DATA.length + COMMENTS_DATA.reduce((s, c) => s + (c.replies?.length || 0), 0),
          rating: 4.0 + (i % 10) * 0.05,
          ratingCount: Math.floor(ms.end * 0.3),
          tags: `${ms.tagSuffix},Arabic,${platform}`,
          series: '',
          translationTeam: team.name,
          translationType: i % 5 === 0 ? 'official' : 'unofficial',
          teamRelation: { connect: { id: team.id } },
          isFeatured: i % 4 === 0,
          isTrending: i % 3 === 0,
          isLatest: true,
          releaseDate,
          workflowStatus: 'PUBLISHED',
        },
      })

      // ملفات التحميل
      const fileCount = i % 3 === 0 ? 2 : 1
      for (let fi = 0; fi < fileCount; fi++) {
        const f = await db.modFile.create({
          data: {
            modId: mod.id,
            title: fi === 0 ? `الملف الرئيسي - ${ms.scope}` : `ملف تصحيحي - ${ms.scope}`,
            description: fi === 0 ? 'الملف الأساسي للتعريب' : 'ملف تصحيحي',
            alert: fi === 0 ? 'تأكد من عمل نسخة احتياطية' : 'يتطلب الملف الرئيسي',
            version: ms.ver,
            releaseDate,
            fileSize: ms.size,
            fileFormat: ms.fmt,
            order: fi,
            links: { create: [{ url: `https://www.mediafire.com/file/${slug}-${fi}.zip`, label: fi === 0 ? 'MediaFire' : 'Google Drive', order: 0 }] },
          },
        })
      }

      // أعضاء الفريق
      for (let ti = 0; ti < TEAM_MEMBERS.length; ti++) {
        const tm = TEAM_MEMBERS[ti]
        await db.modTeamMember.create({ data: { modId: mod.id, name: tm.name, avatarUrl: tm.avatarUrl, role: tm.role, contribution: tm.contribution, order: ti } })
      }

      // روابط التواصل
      for (let ci = 0; ci < CONTACT_LINKS.length; ci++) {
        const c = CONTACT_LINKS[ci]
        await db.modContactLink.create({ data: { modId: mod.id, type: c.type, label: c.label, url: c.url, order: ci } })
      }

      // أقسام الفيديوهات + الفيديوهات
      for (let gi = 0; gi < VIDEO_GROUPS.length; gi++) {
        const g = VIDEO_GROUPS[gi]
        const group = await db.modVideoGroup.create({ data: { modId: mod.id, name: g.name, order: gi } })
        for (let vi = 0; vi < g.videos.length; vi++) {
          const v = g.videos[vi]
          await db.modVideo.create({ data: { groupId: group.id, title: v.title, url: v.url, thumbnail: v.thumbnail, duration: v.duration, views: v.views, channel: v.channel, order: vi } })
        }
      }

      // التبويبات المخصصة
      for (let ti = 0; ti < CUSTOM_TABS.length; ti++) {
        const t = CUSTOM_TABS[ti]
        await db.modCustomTab.create({ data: { modId: mod.id, name: t.name, slug: t.slug, content: t.content, order: ti, visible: true } })
      }

      // التعليقات + الردود
      for (const c of COMMENTS_DATA) {
        const comment = await db.modComment.create({
          data: { modId: mod.id, guestName: c.guestName, guestAvatar: c.guestAvatar, text: c.text, likes: c.likes, dislikes: c.dislikes, isPinned: c.isPinned || false, isEdited: c.isEdited || false },
        })
        for (const r of (c.replies || [])) {
          await db.modComment.create({ data: { modId: mod.id, parentId: comment.id, guestName: r.guestName, guestAvatar: r.guestAvatar, text: r.text, likes: r.likes, dislikes: r.dislikes } })
        }
      }

      modCount++
    }
  }

  // تحديث الـ aggregate counts على الألعاب
  console.log('Updating game aggregates...')
  for (const game of Object.values(games)) {
    const agg = await db.mod.aggregate({ where: { gameId: game.id }, _sum: { downloads: true, endorsements: true }, _count: true })
    await db.game.update({ where: { id: game.id }, data: { modCount: agg._count, totalDownloads: agg._sum.downloads || 0, totalEndorsements: agg._sum.endorsements || 0 } })
  }
  for (const team of teams) {
    const count = await db.mod.count({ where: { teamId: team.id } })
    await db.team.update({ where: { id: team.id }, data: { modCount: count } })
  }

  const sectionsCount = await db.section.count()
  console.log(`\n✅ Seeded successfully!`)
  console.log(`  - 3 users (owner + admin + moderator)`)
  console.log(`  - ${Object.keys(games).length} games`)
  console.log(`  - ${modCount} mods (25 per platform × 9 platforms)`)
  console.log(`  - ${sectionsCount} sections`)
  console.log(`  - ${teams.length} teams, ${series.length} series`)
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
