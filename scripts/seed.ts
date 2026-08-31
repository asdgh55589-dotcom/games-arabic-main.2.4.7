// Seed script — بيانات تجريبية شاملة
// 31 مستخدم + 5 فرق + 5 سلاسل + 150 تعريب (25 لكل منصة × 6 منصات)
import { db } from '../src/lib/db'
import bcrypt from 'bcryptjs'

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
const pick = <T,>(arr: T[], i: number) => arr[i % arr.length]

const GAMES: Array<{
  slug: string; name: string; tagline: string; description: string
  bannerUrl: string; thumbnailUrl: string; category: string; platform: string
  releaseYear: number; featured: boolean; categories: string[]
}> = [
  // PC (7 games)
  { slug: 'the-witcher-3-pc', name: 'The Witcher 3: Wild Hunt', tagline: 'لعبة تقمص أدوار عالم مفتوح ملحمية', description: 'The Witcher 3 هي لعبة تقمص أدوار عالم مفتوح تدور أحداثها في عالم خيالي مليء بالخيارات.', bannerUrl: 'https://images.unsplash.com/photo-1593305841991-05c297ba4575?w=1600&q=80', thumbnailUrl: 'https://images.unsplash.com/photo-1593305841991-05c297ba4575?w=600&q=80', category: 'RPG', platform: 'PC', releaseYear: 2015, featured: true, categories: ['UI', 'Gameplay', 'Graphics', 'Quests'] },
  { slug: 'skyrim-se-pc', name: 'Skyrim Special Edition', tagline: 'ملحمة تقمص أدوار عالم مفتوح', description: 'Skyrim Special Edition تعيد إحياء الملحمة الخيالية.', bannerUrl: 'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=1600&q=80', thumbnailUrl: 'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=600&q=80', category: 'RPG', platform: 'PC', releaseYear: 2016, featured: true, categories: ['UI', 'Gameplay', 'Graphics'] },
  { slug: 'cyberpunk-2077-pc', name: 'Cyberpunk 2077', tagline: 'رعب العصابات في مدينة المستقبل', description: 'Cyberpunk 2077 هي لعبة تقمص أدوار عالم مفتوح في مستقبل مدينة الليل.', bannerUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af2176?w=1600&q=80', thumbnailUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af2176?w=600&q=80', category: 'RPG', platform: 'PC', releaseYear: 2020, featured: true, categories: ['UI', 'Gameplay', 'Graphics'] },
  { slug: 'gta-v-pc', name: 'Grand Theft Auto V', tagline: 'عالم مفتوح مليء بالجريمة', description: 'GTA V تأخذك إلى مدينة لوس سانتو.', bannerUrl: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=1600&q=80', thumbnailUrl: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=600&q=80', category: 'Action', platform: 'PC', releaseYear: 2015, featured: false, categories: ['UI', 'Gameplay'] },
  { slug: 'elden-ring-pc', name: 'Elden Ring', tagline: 'ملحمة عالم مفتوح من فروم', description: 'Elden Ring هي لعبة عالم مفتوح من صنع هيدتاكا ميازاكي.', bannerUrl: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=1600&q=80', thumbnailUrl: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=600&q=80', category: 'RPG', platform: 'PC', releaseYear: 2022, featured: true, categories: ['UI', 'Gameplay', 'Graphics'] },
  { slug: 'baldurs-gate-3-pc', name: "Baldur's Gate 3", tagline: 'مغامرة RPG كلاسيكية محدثة', description: "Baldur's Gate 3 هي لعبة RPG استراتيجية.", bannerUrl: 'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=1600&q=80', thumbnailUrl: 'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=600&q=80', category: 'RPG', platform: 'PC', releaseYear: 2023, featured: false, categories: ['UI', 'Gameplay'] },
  { slug: 'red-dead-2-pc', name: 'Red Dead Redemption 2', tagline: 'ملحمة الغرب الأمريكي', description: 'Red Dead Redemption 2 في عصر الغرب الأمريكي.', bannerUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af2176?w=1600&q=80', thumbnailUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af2176?w=600&q=80', category: 'Action', platform: 'PC', releaseYear: 2019, featured: true, categories: ['UI', 'Gameplay', 'Graphics'] },
  // NS (7 games)
  { slug: 'zelda-botw-ns', name: 'Zelda: Breath of the Wild', tagline: 'مغامرة مفتوحة في عالم هيرول', description: 'استكشف عالم هيرول الشاسع.', bannerUrl: 'https://images.unsplash.com/photo-1551103782-8ab07afd45c1?w=1600&q=80', thumbnailUrl: 'https://images.unsplash.com/photo-1551103782-8ab07afd45c1?w=600&q=80', category: 'Adventure', platform: 'NS', releaseYear: 2017, featured: true, categories: ['Saves', 'Gameplay', 'Graphics'] },
  { slug: 'zelda-totk-ns', name: 'Zelda: Tears of the Kingdom', tagline: 'مغامرة جديدة في عالم هيرول', description: 'Zelda: Tears of the Kingdom مغامرة جديدة.', bannerUrl: 'https://images.unsplash.com/photo-1551103782-8ab07afd45c1?w=1600&q=80', thumbnailUrl: 'https://images.unsplash.com/photo-1551103782-8ab07afd45c1?w=600&q=80', category: 'Adventure', platform: 'NS', releaseYear: 2023, featured: true, categories: ['Saves', 'Gameplay'] },
  { slug: 'mario-odyssey-ns', name: 'Super Mario Odyssey', tagline: 'مغامرة ماريو حول العالم', description: 'انضم لماريو في رحلة حول العالم.', bannerUrl: 'https://images.unsplash.com/photo-1493238792000-8113da705763?w=1600&q=80', thumbnailUrl: 'https://images.unsplash.com/photo-1493238792000-8113da705763?w=600&q=80', category: 'Adventure', platform: 'NS', releaseYear: 2017, featured: false, categories: ['Saves', 'Gameplay'] },
  { slug: 'animal-crossing-ns', name: 'Animal Crossing: New Horizons', tagline: 'ابن جزيرتك الخاصة', description: 'ابن جزيرتك من الصفر.', bannerUrl: 'https://images.unsplash.com/photo-1518709594023-6eab9bab7b23?w=1600&q=80', thumbnailUrl: 'https://images.unsplash.com/photo-1518709594023-6eab9bab7b23?w=600&q=80', category: 'Simulation', platform: 'NS', releaseYear: 2020, featured: true, categories: ['Saves', 'UI'] },
  { slug: 'pokemon-sv-ns', name: 'Pokemon Scarlet/Violet', tagline: 'مغامرة بوكيمون جديدة', description: 'Pokemon Scarlet و Violet مغامرة بوكيモン مفتوحة.', bannerUrl: 'https://images.unsplash.com/photo-1518709594023-6eab9bab7b23?w=1600&q=80', thumbnailUrl: 'https://images.unsplash.com/photo-1518709594023-6eab9bab7b23?w=600&q=80', category: 'RPG', platform: 'NS', releaseYear: 2022, featured: false, categories: ['Saves', 'UI'] },
  { slug: 'mario-kart-8-ns', name: 'Mario Kart 8 Deluxe', tagline: 'سباق ماريو المميز', description: 'Mario Kart 8 Deluxe هي أفضل لعبة سباق.', bannerUrl: 'https://images.unsplash.com/photo-1493238792000-8113da705763?w=1600&q=80', thumbnailUrl: 'https://images.unsplash.com/photo-1493238792000-8113da705763?w=600&q=80', category: 'Racing', platform: 'NS', releaseYear: 2017, featured: false, categories: ['UI'] },
  { slug: 'splatoon-3-ns', name: 'Splatoon 3', tagline: 'حرب الحبر الملونة', description: 'Splatoon 3 حرب حبر ملونة.', bannerUrl: 'https://images.unsplash.com/photo-1551103782-8ab07afd45c1?w=1600&q=80', thumbnailUrl: 'https://images.unsplash.com/photo-1551103782-8ab07afd45c1?w=600&q=80', category: 'Shooter', platform: 'NS', releaseYear: 2022, featured: false, categories: ['UI', 'Gameplay'] },
  // PS4 (7 games)
  { slug: 'god-of-war-ps4', name: 'God of War', tagline: 'كراتوس في عالم الإسكندنافيين', description: 'كراتوس يعيش في عالم الإسكندنافيين.', bannerUrl: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=1600&q=80', thumbnailUrl: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=600&q=80', category: 'Action', platform: 'PS4', releaseYear: 2018, featured: true, categories: ['UI', 'Gameplay', 'Graphics'] },
  { slug: 'gow-ragnarok-ps4', name: 'God of War Ragnarok', tagline: 'نهاية العالم الإسكندنافي', description: 'God of War Ragnarok تكمل ملحمة كراتوس.', bannerUrl: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=1600&q=80', thumbnailUrl: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=600&q=80', category: 'Action', platform: 'PS4', releaseYear: 2022, featured: true, categories: ['UI', 'Gameplay'] },
  { slug: 'spider-man-ps4', name: "Marvel's Spider-Man", tagline: 'مغامرة الرجل العنكبوت', description: "Spider-Man أكشن عالم مفتوح بطابع مارفل.", bannerUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af2176?w=1600&q=80', thumbnailUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af2176?w=600&q=80', category: 'Action', platform: 'PS4', releaseYear: 2018, featured: true, categories: ['UI', 'Gameplay', 'Graphics'] },
  { slug: 'spider-man-mm-ps4', name: "Spider-Man: Miles Morales", tagline: 'رجل العنكبوت الجديد', description: "Miles Morales مغامرة جديدة.", bannerUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af2176?w=1600&q=80', thumbnailUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af2176?w=600&q=80', category: 'Action', platform: 'PS4', releaseYear: 2020, featured: false, categories: ['UI', 'Gameplay'] },
  { slug: 'tlou2-ps4', name: 'The Last of Us Part II', tagline: 'رحلة البقاء', description: 'The Last of Us Part II متابعة للقصة.', bannerUrl: 'https://images.unsplash.com/photo-1593305841991-05c297ba4575?w=1600&q=80', thumbnailUrl: 'https://images.unsplash.com/photo-1593305841991-05c297ba4575?w=600&q=80', category: 'Action', platform: 'PS4', releaseYear: 2020, featured: true, categories: ['UI', 'Gameplay', 'Graphics'] },
  { slug: 'bloodborne-ps4', name: 'Bloodborne', tagline: 'رعب صادم في عالم يارنهم', description: 'Bloodborne أكشن رعب من فروم.', bannerUrl: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=1600&q=80', thumbnailUrl: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=600&q=80', category: 'Action', platform: 'PS4', releaseYear: 2015, featured: false, categories: ['UI', 'Gameplay'] },
  { slug: 'horizon-fw-ps4', name: 'Horizon Forbidden West', tagline: 'استكشاف الغرب المحظور', description: 'Horizon Forbidden West أويلاي في مغامرة جديدة.', bannerUrl: 'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=1600&q=80', thumbnailUrl: 'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=600&q=80', category: 'RPG', platform: 'PS4', releaseYear: 2022, featured: false, categories: ['UI', 'Gameplay', 'Graphics'] },
  // PS3 (5 games)
  { slug: 'tlou-ps3', name: 'The Last of Us', tagline: 'رحلة البقاء', description: 'The Last of Us أكشن مغامرات.', bannerUrl: 'https://images.unsplash.com/photo-1593305841991-05c297ba4575?w=1600&q=80', thumbnailUrl: 'https://images.unsplash.com/photo-1593305841991-05c297ba4575?w=600&q=80', category: 'Action', platform: 'PS3', releaseYear: 2013, featured: true, categories: ['UI', 'Gameplay'] },
  { slug: 'uncharted-3-ps3', name: 'Uncharted 3', tagline: 'ناثان دريك بين الأキング', description: 'Uncharted 3 مغامرة ناثان دريك.', bannerUrl: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=1600&q=80', thumbnailUrl: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=600&q=80', category: 'Action', platform: 'PS3', releaseYear: 2011, featured: false, categories: ['UI', 'Gameplay'] },
  { slug: 'gta-v-ps3', name: 'Grand Theft Auto V', tagline: 'عالم الجريمة المفتوح', description: 'GTA V على PS3.', bannerUrl: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=1600&q=80', thumbnailUrl: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=600&q=80', category: 'Action', platform: 'PS3', releaseYear: 2013, featured: false, categories: ['UI'] },
  { slug: 'dark-souls-ps3', name: 'Dark Souls', tagline: 'تحدي الأكشن', description: 'Dark Souls أكشن صعبة من فروم.', bannerUrl: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=1600&q=80', thumbnailUrl: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=600&q=80', category: 'RPG', platform: 'PS3', releaseYear: 2011, featured: true, categories: ['UI', 'Gameplay'] },
  { slug: 'mgs4-ps3', name: 'Metal Gear Solid 4', tagline: 'نهاية سوليد سنيك', description: 'MGS4 النهاية الملحمية لسوليد سنيك.', bannerUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af2176?w=1600&q=80', thumbnailUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af2176?w=600&q=80', category: 'Action', platform: 'PS3', releaseYear: 2008, featured: false, categories: ['UI', 'Gameplay'] },
  // PS2 (5 games)
  { slug: 'gta-sa-ps2', name: 'GTA: San Andreas', tagline: 'عالم الجريمة في كاليفورنيا', description: 'GTA San Andreas على PS2.', bannerUrl: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=1600&q=80', thumbnailUrl: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=600&q=80', category: 'Action', platform: 'PS2', releaseYear: 2004, featured: true, categories: ['UI', 'Gameplay'] },
  { slug: 'sotc-ps2', name: 'Shadow of the Colossus', tagline: 'محاربة العمالقة', description: 'Shadow of the Colossus تحفة فنية على PS2.', bannerUrl: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=1600&q=80', thumbnailUrl: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=600&q=80', category: 'Action', platform: 'PS2', releaseYear: 2005, featured: true, categories: ['UI', 'Gameplay'] },
  { slug: 'ffx-ps2', name: 'Final Fantasy X', tagline: 'رحلة في عالم سبايرا', description: 'Final Fantasy X من أفضل ألعاب RPG.', bannerUrl: 'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=1600&q=80', thumbnailUrl: 'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=600&q=80', category: 'RPG', platform: 'PS2', releaseYear: 2001, featured: false, categories: ['UI', 'Gameplay'] },
  { slug: 'mgs3-ps2', name: 'Metal Gear Solid 3', tagline: 'أصل القصة', description: 'MGS3 عالم التجسس في حرب البرد.', bannerUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af2176?w=1600&q=80', thumbnailUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af2176?w=600&q=80', category: 'Action', platform: 'PS2', releaseYear: 2004, featured: false, categories: ['UI', 'Gameplay'] },
  { slug: 'gow2-ps2', name: 'God of War II', tagline: 'كراتوس يتحدى الآلهة', description: 'God of War II تكمل ملحمة كراتوس.', bannerUrl: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=1600&q=80', thumbnailUrl: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=600&q=80', category: 'Action', platform: 'PS2', releaseYear: 2007, featured: true, categories: ['UI', 'Gameplay'] },
  // PS1 (5 games)
  { slug: 'ff7-ps1', name: 'Final Fantasy VII', tagline: 'ملحمة كلاسيكية خالدة', description: 'Final Fantasy VII تحفة RPG خالدة.', bannerUrl: 'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=1600&q=80', thumbnailUrl: 'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=600&q=80', category: 'RPG', platform: 'PS1', releaseYear: 1997, featured: true, categories: ['UI', 'Gameplay'] },
  { slug: 'mgs-ps1', name: 'Metal Gear Solid', tagline: 'أسطورة التجسس', description: 'Metal Gear Solid أعادت تعريف ألعاب التجسس.', bannerUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af2176?w=1600&q=80', thumbnailUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af2176?w=600&q=80', category: 'Action', platform: 'PS1', releaseYear: 1998, featured: true, categories: ['UI', 'Gameplay'] },
  { slug: 'crash-ps1', name: 'Crash Bandicoot', tagline: 'مغامرة النمر الحاقد', description: 'Crash Bandicoot لعبة منصات كلاسيكية.', bannerUrl: 'https://images.unsplash.com/photo-1493238792000-8113da705763?w=1600&q=80', thumbnailUrl: 'https://images.unsplash.com/photo-1493238792000-8113da705763?w=600&q=80', category: 'Platformer', platform: 'PS1', releaseYear: 1996, featured: false, categories: ['UI'] },
  { slug: 're2-ps1', name: 'Resident Evil 2', tagline: 'رعب البقاء', description: 'Resident Evil 2 تحفة رعب.', bannerUrl: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=1600&q=80', thumbnailUrl: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=600&q=80', category: 'Horror', platform: 'PS1', releaseYear: 1998, featured: false, categories: ['UI', 'Gameplay'] },
  { slug: 'tekken3-ps1', name: 'Tekken 3', tagline: 'أفضل لعبة قتال', description: 'Tekken 3 من أفضل ألعاب القتال.', bannerUrl: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=1600&q=80', thumbnailUrl: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=600&q=80', category: 'Fighting', platform: 'PS1', releaseYear: 1998, featured: false, categories: ['UI'] },
]

// بيانات المستخدمين
const USERS_DATA = {
  managers: [
    { username: 'ManagerKhaled', email: 'khaled@games-arabic.com', bio: 'مدير عام العمليات.', avatarUrl: 'https://i.pravatar.cc/300?img=11', tier: 5 },
    { username: 'ManagerFatima', email: 'fatima@games-arabic.com', bio: 'مديرة المحتوى.', avatarUrl: 'https://i.pravatar.cc/300?img=5', tier: 5 },
    { username: 'ManagerOmar', email: 'omar@games-arabic.com', bio: 'مدير التقني.', avatarUrl: 'https://i.pravatar.cc/300?img=14', tier: 5 },
    { username: 'ManagerLina', email: 'lina@games-arabic.com', bio: 'مديرة المجتمع.', avatarUrl: 'https://i.pravatar.cc/300?img=9', tier: 5 },
    { username: 'ManagerYusuf', email: 'yusuf@games-arabic.com', bio: 'مدير الشراكات.', avatarUrl: 'https://i.pravatar.cc/300?img=16', tier: 5 },
  ],
  admins: [
    { username: 'AdminHesham', email: 'hesham@games-arabic.com', bio: 'مدير تقني.', avatarUrl: 'https://i.pravatar.cc/300?img=12', tier: 4 },
    { username: 'AdminNour', email: 'nour@games-arabic.com', bio: 'مشرف المحتوى.', avatarUrl: 'https://i.pravatar.cc/300?img=20', tier: 4 },
    { username: 'AdminTarek', email: 'tarek@games-arabic.com', bio: 'مدير الأمان.', avatarUrl: 'https://i.pravatar.cc/300?img=18', tier: 4 },
    { username: 'AdminSalma', email: 'salma@games-arabic.com', bio: 'مديرة الدعم الفني.', avatarUrl: 'https://i.pravatar.cc/300?img=25', tier: 4 },
    { username: 'AdminRami', email: 'rami@games-arabic.com', bio: 'مدير قواعد البيانات.', avatarUrl: 'https://i.pravatar.cc/300?img=22', tier: 4 },
  ],
  moderators: [
    { username: 'ModKarim', email: 'karim@games-arabic.com', bio: 'مشرف التعليقات.', avatarUrl: 'https://i.pravatar.cc/300?img=33', tier: 3 },
    { username: 'ModDina', email: 'dina@games-arabic.com', bio: 'مشرفة الألعاب.', avatarUrl: 'https://i.pravatar.cc/300?img=26', tier: 3 },
    { username: 'ModSami', email: 'sami@games-arabic.com', bio: 'مشرف الفرق.', avatarUrl: 'https://i.pravatar.cc/300?img=30', tier: 3 },
    { username: 'ModHana', email: 'hana@games-arabic.com', bio: 'مشرفة التقارير.', avatarUrl: 'https://i.pravatar.cc/300?img=28', tier: 3 },
    { username: 'ModZaid', email: 'zaid@games-arabic.com', bio: 'مشرف الإشعارات.', avatarUrl: 'https://i.pravatar.cc/300?img=35', tier: 3 },
  ],
  arabizers: [
    { username: 'ArabAmr', email: 'amr@arab4games.com', bio: 'مترجم أول.', avatarUrl: 'https://i.pravatar.cc/300?img=41', tier: 2, specialRoles: 'official_translator' },
    { username: 'ArabMona', email: 'mona@arab4games.com', bio: 'مترجمة RPG.', avatarUrl: 'https://i.pravatar.cc/300?img=44', tier: 2, specialRoles: 'official_translator' },
    { username: 'ArabHassan', email: 'hassan@arab4games.com', bio: 'مترجم أكشن.', avatarUrl: 'https://i.pravatar.cc/300?img=47', tier: 2, specialRoles: 'official_translator' },
    { username: 'ArabLayla', email: 'layla@arab4games.com', bio: 'مترجمة مغامرات.', avatarUrl: 'https://i.pravatar.cc/300?img=50', tier: 2, specialRoles: 'official_translator' },
    { username: 'ArabFadi', email: 'fadi@arab4games.com', bio: 'مترجم محاكيات.', avatarUrl: 'https://i.pravatar.cc/300?img=53', tier: 2, specialRoles: 'official_translator' },
  ],
  members: [
    { username: 'AhmedGamer', email: 'ahmed@email.com', bio: 'لاعب محترف.', avatarUrl: 'https://i.pravatar.cc/300?img=60' },
    { username: 'SaraPlay', email: 'sara@email.com', bio: 'لاعبة مغامرات.', avatarUrl: 'https://i.pravatar.cc/300?img=65' },
    { username: 'MohamedTech', email: 'mohamed@email.com', bio: 'مبرمج ومحب للألعاب.', avatarUrl: 'https://i.pravatar.cc/300?img=68' },
    { username: 'NadaGamers', email: 'nada@email.com', bio: 'لاعبة تتبع التعريبات.', avatarUrl: 'https://i.pravatar.cc/300?img=70' },
    { username: 'AliPro', email: 'ali@email.com', bio: 'لاعب RPG.', avatarUrl: 'https://i.pravatar.cc/300?img=73' },
    { username: 'RimaPlay', email: 'rima@email.com', bio: 'لاعبة سلاسل.', avatarUrl: 'https://i.pravatar.cc/300?img=75' },
    { username: 'HusseinGG', email: 'hussein@email.com', bio: 'لاعب يتبع الفرق.', avatarUrl: 'https://i.pravatar.cc/300?img=77' },
    { username: 'YasminFan', email: 'yasmin@email.com', bio: 'لاعبة تعريب كامل.', avatarUrl: 'https://i.pravatar.cc/300?img=79' },
    { username: 'KhaledNoob', email: 'khaled2@email.com', bio: 'مبتدئ في المجتمع.', avatarUrl: 'https://i.pravatar.cc/300?img=81' },
    { username: 'FatimaDev', email: 'fatima2@email.com', bio: 'مطوّرة تساعد في التعريبات.', avatarUrl: 'https://i.pravatar.cc/300?img=83' },
  ],
}

// بيانات الفرق
const TEAMS_DATA = [
  { slug: 'arab4games', name: 'فريق Arab4Games', description: 'أكبر فريق تعريب عربي — متخصص في RPG والمغامرات.', logoUrl: 'https://i.pravatar.cc/300?img=68', bannerUrl: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=2560&h=1440&fit=crop', websiteUrl: 'https://arab4games.com', discordUrl: 'https://discord.gg/arab4games', telegramUrl: 'https://t.me/arab4games', isOfficial: true, isFeatured: true },
  { slug: 'games-arabia', name: 'فريق GamesArabia', description: 'فريق متخصص في تعريب واجهات الألعاب.', logoUrl: 'https://i.pravatar.cc/300?img=33', bannerUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af2176?w=2560&h=1440&fit=crop', websiteUrl: 'https://gamesarabia.com', discordUrl: 'https://discord.gg/gamesarabia', telegramUrl: 'https://t.me/gamesarabia', isOfficial: true, isFeatured: true },
  { slug: 'taarab-masr', name: 'فريق تعريب مصر', description: 'فريق مصري متخصص في ألعاب المنصات.', logoUrl: 'https://i.pravatar.cc/300?img=12', bannerUrl: 'https://images.unsplash.com/photo-1593305841991-05c297ba4575?w=2560&h=1440&fit=crop', websiteUrl: '', discordUrl: 'https://discord.gg/taarabmasr', telegramUrl: 'https://t.me/taarabmasr', isOfficial: false, isFeatured: true },
  { slug: 'hacker-team', name: 'فريق Hacker Team', description: 'فريق تقني لفك تشفير وتعديل ملفات الألعاب.', logoUrl: 'https://i.pravatar.cc/300?img=15', bannerUrl: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=2560&h=1440&fit=crop', websiteUrl: '', discordUrl: 'https://discord.gg/hackerteam', telegramUrl: 'https://t.me/hackerteam', isOfficial: false, isFeatured: false },
  { slug: 'nintendo-arabic', name: 'فريق Nintendo Arabic', description: 'فريق متخصص في تعريب ألعاب Switch.', logoUrl: 'https://i.pravatar.cc/300?img=23', bannerUrl: 'https://images.unsplash.com/photo-1551103782-8ab07afd45c1?w=2560&h=1440&fit=crop', websiteUrl: '', discordUrl: 'https://discord.gg/nintendotabic', telegramUrl: 'https://t.me/nintendotabic', isOfficial: false, isFeatured: true },
]

// بيانات السلاسل
const SERIES_DATA = [
  { slug: 'the-witcher', name: 'The Witcher', description: 'سلسلة RPG مبنية على روايات أندريه سركوفسكي.', bannerUrl: 'https://images.unsplash.com/photo-1593305841991-05c297ba4575?w=1600&q=80', logoUrl: 'https://images.unsplash.com/photo-1593305841991-05c297ba4575?w=400&q=80', color: '#c92a2a', isFeatured: true, isOfficial: false },
  { slug: 'god-of-war', name: 'God of War', description: 'سلسلة أكشن بطابع ميثولوجي.', bannerUrl: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=1600&q=80', logoUrl: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=400&q=80', color: '#d63031', isFeatured: true, isOfficial: false },
  { slug: 'the-elder-scrolls', name: 'The Elder Scrolls', description: 'سلسلة RPG عالم مفتوح من Bethesda.', bannerUrl: 'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=1600&q=80', logoUrl: 'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=400&q=80', color: '#2d3436', isFeatured: true, isOfficial: false },
  { slug: 'zelda', name: 'The Legend of Zelda', description: 'سلسلة مغامرات كلاسيكية من Nintendo.', bannerUrl: 'https://images.unsplash.com/photo-1551103782-8ab07afd45c1?w=1600&q=80', logoUrl: 'https://images.unsplash.com/photo-1551103782-8ab07afd45c1?w=400&q=80', color: '#00b894', isFeatured: true, isOfficial: false },
  { slug: 'final-fantasy', name: 'Final Fantasy', description: 'سلسلة RPG أسطورية من Square Enix.', bannerUrl: 'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=1600&q=80', logoUrl: 'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=400&q=80', color: '#6c5ce7', isFeatured: true, isOfficial: false },
]

// خريطة السلاسل لكل لعبة
const SERIES_MAP: Record<string, string> = {
  'The Witcher 3: Wild Hunt': 'the-witcher', 'Skyrim Special Edition': 'the-elder-scrolls',
  'Zelda: Breath of the Wild': 'zelda', 'Zelda: Tears of the Kingdom': 'zelda',
  'God of War': 'god-of-war', 'God of War Ragnarok': 'god-of-war',
  'God of War II': 'god-of-war', 'Final Fantasy X': 'final-fantasy',
  'Final Fantasy VII': 'final-fantasy',
}

// بيانات ثابتة
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
  { name: 'أسئلة شائعة', slug: 'faq', content: '## أسئلة شائعة\n\n**هل التعريب متوافق مع نسختي؟**\nنعم، التعريب متوافق مع كل النسخ المذكورة في قسم التوافق.\n\n**هل يحتاج التعريب لكسر حماية؟**\nيعتمد على المنصة — راجع قسم التوافق.\n\n**كيف أبلّغ عن خطأ؟**\nاستخدم تبويب التعليقات أو راسلنا عبر التواصل.' },
  { name: 'الاعتمادات', slug: 'credits', content: '## الاعتمادات\n\nشكر خاص لكل من ساهم:\n\n- فريق الترجمة\n- المراجعين اللغويين\n- المبرمجين\n- المجتمع العربي للألعاب' },
]

const COMMENTS_DATA = [
  { guestName: 'أحمد_جيمر', guestAvatar: 'https://i.pravatar.cc/100?img=12', text: 'التعريب ممتاز جداً، اشتغل معايا بدون أي مشاكل. الترجمة دقيقة.', likes: 87, dislikes: 2, isPinned: true, replies: [{ guestName: 'مomen Hani', guestAvatar: 'https://i.pravatar.cc/100?img=68', text: 'شكراً على كلامك الطيب!', likes: 24, dislikes: 0 }] },
  { guestName: 'خالد_سنايبر', guestAvatar: 'https://i.pravatar.cc/100?img=33', text: 'التثبيت سهل جداً. بس لاحظت بعض النصوص مش مترجمة.', likes: 45, dislikes: 3, isEdited: true, replies: [] },
  { guestName: 'سارة_بلايز', guestAvatar: 'https://i.pravatar.cc/100?img=23', text: 'تعريب احترافي بمعنى الكلمة. تستاهلون كل خير.', likes: 32, dislikes: 0, replies: [] },
]

// وصف generates
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

// دوال مساعدة
function genModName(scope: string, gameName: string, idx: number): string {
  const prefixes = ['تعريب', 'ترجمة', 'حزمة', 'حزمة تعريب']
  return `${pick(prefixes, idx)} ${scope} — ${gameName}`
}
function genArabicTitle(scope: string, idx: number): string {
  const titles = ['التعريب الكامل', 'الترجمة الكاملة', 'القوائم', 'المحتوى الإضافي', 'الإعدادات', 'ملفات الحفظ', 'النسخة المحسّنة', 'التجربة الكاملة', 'ملفات الترجمة', 'حزمة الخطوط', 'عناصر الواجهة', 'المهام', 'الأسماء', 'الخرائط', 'الصوت', 'شاشة البداية', 'الحوارات', 'النسخة الخفيفة', 'التحديث', 'الألقاب', 'الإحصائيات', 'النسخة التجريبية', 'الأدوات', 'المعالجات', 'الدليل']
  return pick(titles, idx)
}
function genSummary(scope: string, gameName: string): string {
  return `تعريب ${scope} للعبة ${gameName} مع دعم كامل للعربية`
}
function genDesc(gameName: string, scope: string, platform: string): string {
  return `## عن هذا التعريب\n\n تعريب ${scope} للعبة ${gameName} على ${platform}.\n\n## الميزات\n\n- تعريب ${scope} كامل\n- دعم RTL\n- خطوط عربية واضحة\n\n## التثبيت\n\n1. حمل التعريب\n2. استخرج في مجلد اللعبة\n3. اختر العربية\n4. استمتع!`
}
function genCompat(platform: string): string {
  const map: Record<string, string> = { PC: 'PC', NS: 'Switch (يتطلب CFW)', PS4: 'PS4 بـ CFW', PS3: 'PS3 بـ CFW', PS2: 'PS2 عبر OPL', PS1: 'PS1 أو محاكي' }
  return `متوافق مع ${map[platform] || platform}`
}
function genChangelog(v: string): string {
  return `## v${v} (الإصدار الحالي)\n- إصلاح أخطاء إملائية\n- تحسين الترجمات\n\n## v1.0.0\n- الإصدار الأول\n`
}

async function main() {
  console.log('🧹 Cleaning database...')
  const tables = ['modComment', 'modCustomTab', 'modContactLink', 'modTeamMember', 'modVideo', 'modVideoGroup', 'modFileLink', 'modFile', 'endorsement', 'mod', 'category', 'game', 'teamFollow', 'teamMembership', 'teamContactLink', 'teamCustomTab', 'team', 'series', 'user']
  for (const t of tables) await (db as any)[t].deleteMany()

  console.log('👤 Creating 31 users...')
  const pw = await bcrypt.hash('Test@2026#Seed', 10)
  const owner = await db.user.create({ data: { username: 'GADMIx', email: 'owner@games-arabic.com', password: pw, avatarUrl: 'https://i.pravatar.cc/300?img=68', bannerUrl: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=2560&h=1440&fit=crop', bio: 'مالك ومؤسس المنصة.', role: 'owner', tier: 5, joinedAt: new Date(Date.now() - 1800 * 86400000) } })
  const allUsers = [owner]
  const createUser = async (u: any, role: string, tier: number, daysAgo: number, specialRoles?: string) => {
    const user = await db.user.create({ data: { ...u, password: pw, role, tier, specialRoles: specialRoles || '', joinedAt: new Date(Date.now() - daysAgo * 86400000) } })
    allUsers.push(user)
    return user
  }
  for (let i = 0; i < USERS_DATA.managers.length; i++) await createUser(USERS_DATA.managers[i], 'manager', 5, 900)
  for (let i = 0; i < USERS_DATA.admins.length; i++) await createUser(USERS_DATA.admins[i], 'admin', 4, 700)
  for (let i = 0; i < USERS_DATA.moderators.length; i++) await createUser(USERS_DATA.moderators[i], 'moderator', 3, 500)
  for (let i = 0; i < USERS_DATA.arabizers.length; i++) await createUser(USERS_DATA.arabizers[i], 'publisher', 2, 400, 'official_translator')
  for (let i = 0; i < USERS_DATA.members.length; i++) await createUser(USERS_DATA.members[i], 'member', 0, 200)
  console.log(`  ✅ ${allUsers.length} users`)

  console.log('👥 Creating 5 teams...')
  const createdTeams: any[] = []
  for (let i = 0; i < TEAMS_DATA.length; i++) {
    const td = TEAMS_DATA[i]
    const team = await db.team.create({ data: { slug: td.slug, name: td.name, description: td.description, logoUrl: td.logoUrl, bannerUrl: td.bannerUrl, websiteUrl: td.websiteUrl, discordUrl: td.discordUrl, telegramUrl: td.telegramUrl, isOfficial: td.isOfficial, isFeatured: td.isFeatured, ownerId: allUsers[i + 1]?.id || owner.id, order: i } })
    await db.teamMembership.create({ data: { teamId: team.id, userId: allUsers[i + 1]?.id || owner.id, name: allUsers[i + 1]?.username || 'GADMIx', role: 'leader' } })
    await db.teamMembership.create({ data: { teamId: team.id, userId: allUsers[(i + 6) % allUsers.length].id, name: allUsers[(i + 6) % allUsers.length].username, role: 'member' } })
    for (let j = 0; j < CONTACT_LINKS.length; j++) await db.teamContactLink.create({ data: { teamId: team.id, type: CONTACT_LINKS[j].type, label: CONTACT_LINKS[j].label, url: CONTACT_LINKS[j].url, order: j } })
    await db.teamCustomTab.create({ data: { teamId: team.id, title: 'عن الفريق', content: `## ${td.name}\n\n${td.description}`, order: 0, visible: true } })
    createdTeams.push(team)
  }
  console.log(`  ✅ ${createdTeams.length} teams`)

  console.log('📚 Creating 5 series...')
  const createdSeries: Record<string, any> = {}
  for (let i = 0; i < SERIES_DATA.length; i++) {
    const sd = SERIES_DATA[i]
    createdSeries[sd.slug] = await db.series.create({ data: { slug: sd.slug, name: sd.name, description: sd.description, bannerUrl: sd.bannerUrl, logoUrl: sd.logoUrl, color: sd.color, isFeatured: sd.isFeatured, isOfficial: sd.isOfficial, order: i } })
  }
  console.log(`  ✅ ${Object.keys(createdSeries).length} series`)

  console.log('🎮 Creating games...')
  const games: Record<string, any> = {}
  for (const g of GAMES) {
    const game = await db.game.create({ data: { slug: g.slug, name: g.name, tagline: g.tagline, description: g.description, bannerUrl: g.bannerUrl, thumbnailUrl: g.thumbnailUrl, category: g.category, platform: g.platform, releaseYear: g.releaseYear, featured: g.featured } })
    for (const cat of g.categories) await db.category.create({ data: { name: cat, slug: slugify(cat), gameId: game.id } })
    games[g.slug] = game
  }
  console.log(`  ✅ ${Object.keys(games).length} games`)

  console.log('📦 Creating 150 mods (25 per platform)...')
  let modCount = 0
  const platforms = ['PC', 'NS', 'PS4', 'PS3', 'PS2', 'PS1']
  for (const platform of platforms) {
    const platformGames = GAMES.filter(g => g.platform === platform)
    console.log(`  ${platform}: ${platformGames.length} games, 25 mods`)
    for (let i = 0; i < 25; i++) {
      const ms = MOD_SCOPES[i]
      const gameRaw = platformGames[i % platformGames.length]
      if (!gameRaw) continue
      const game = games[gameRaw.slug]
      if (!game) continue
      const gameName = gameRaw.name
      const modName = genModName(ms.scope, gameName, i)
      const slug = slugify(`${modName}-${gameRaw.slug}-${modCount + 1}`).slice(0, 100)
      const releaseDate = new Date(Date.now() - ms.days * 86400000)
      const categories = await db.category.findMany({ where: { gameId: game.id } })
      const category = categories[0]
      const seriesSlug = SERIES_MAP[gameName] || ''
      const series = createdSeries[seriesSlug] || null
      const team = createdTeams[i % createdTeams.length]
      const authorIdx = (i % 5) + 1

      const mod = await db.mod.create({
        data: {
          slug, name: modName, summary: genSummary(ms.scope, gameName), description: genDesc(gameName, ms.scope, platform),
          changelog: genChangelog(ms.ver), arabicTitle: genArabicTitle(ms.scope, i), compatibility: genCompat(platform),
          author: { connect: { id: allUsers[authorIdx]?.id || owner.id } },
          game: { connect: { id: game.id } },
          ...(category ? { category: { connect: { id: category.id } } } : {}),
          thumbnailUrl: game.thumbnailUrl, imageUrl: game.bannerUrl, galleryUrls: `${game.thumbnailUrl},${game.bannerUrl}`,
          version: ms.ver, fileSize: ms.size, fileFormat: ms.fmt, downloads: ms.dl, endorsements: ms.end,
          views: ms.views, comments: COMMENTS_DATA.length, rating: 4.0 + (i % 10) * 0.05, ratingCount: Math.floor(ms.end * 0.3),
          tags: `${ms.tagSuffix},Arabic,${platform}`, series: series?.name || '',
          ...(series ? { seriesRelation: { connect: { id: series.id } } } : {}),
          teamRelation: { connect: { id: team.id } }, translationTeam: team.name, translationType: i % 5 === 0 ? 'official' : 'unofficial',
          isFeatured: i % 4 === 0, isTrending: i % 3 === 0, isLatest: true, releaseDate, workflowStatus: 'PUBLISHED',
        },
      })

      // ملفات التحميل
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
        await db.modFileLink.create({ data: { fileId: f.id, url: `https://www.mediafire.com/file/${slugify(modName)}-${fi}.zip`, label: fi === 0 ? 'MediaFire' : 'Google Drive', order: 0 } })
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

      // فيديوهات
      for (let gi = 0; gi < VIDEO_GROUPS.length; gi++) {
        const g = VIDEO_GROUPS[gi]
        const group = await db.modVideoGroup.create({ data: { modId: mod.id, name: g.name, order: gi } })
        for (let vi = 0; vi < g.videos.length; vi++) {
          const v = g.videos[vi]
          await db.modVideo.create({ data: { groupId: group.id, title: v.title, url: v.url, thumbnail: v.thumbnail, duration: v.duration, views: v.views, channel: v.channel, order: vi } })
        }
      }

      // تبويبات مخصصة
      for (let ti = 0; ti < CUSTOM_TABS.length; ti++) {
        const t = CUSTOM_TABS[ti]
        await db.modCustomTab.create({ data: { modId: mod.id, name: t.name, slug: t.slug, content: t.content, order: ti, visible: true } })
      }

      // تعليقات
      for (const c of COMMENTS_DATA) {
        const comment = await db.modComment.create({ data: { modId: mod.id, guestName: c.guestName, guestAvatar: c.guestAvatar, text: c.text, likes: c.likes, dislikes: c.dislikes, isPinned: c.isPinned || false, isEdited: c.isEdited || false } })
        for (const r of c.replies || []) {
          await db.modComment.create({ data: { modId: mod.id, parentId: comment.id, guestName: r.guestName, guestAvatar: r.guestAvatar, text: r.text, likes: r.likes, dislikes: r.dislikes } })
        }
      }
      modCount++
    }
  }

  // تحديث aggregates
  console.log('📊 Updating aggregates...')
  for (const game of Object.values(games)) {
    const agg = await db.mod.aggregate({ where: { gameId: game.id }, _sum: { downloads: true, endorsements: true }, _count: true })
    await db.game.update({ where: { id: game.id }, data: { modCount: agg._count, totalDownloads: agg._sum.downloads || 0, totalEndorsements: agg._sum.endorsements || 0 } })
  }
  for (const series of Object.values(createdSeries)) {
    const agg = await db.mod.aggregate({ where: { seriesId: series.id }, _sum: { downloads: true, endorsements: true }, _count: true })
    await db.series.update({ where: { id: series.id }, data: { modCount: agg._count, totalDownloads: agg._sum.downloads || 0, totalEndorsements: agg._sum.endorsements || 0 } })
  }
  for (const team of createdTeams) {
    const count = await db.mod.count({ where: { teamId: team.id } })
    await db.team.update({ where: { id: team.id }, data: { modCount: count } })
  }

  console.log(`\n✅ Seeded successfully!`)
  console.log(`  - ${allUsers.length} users (1 owner + 5 managers + 5 admins + 5 moderators + 5 arabizers + 10 members)`)
  console.log(`  - ${createdTeams.length} teams`)
  console.log(`  - ${Object.keys(createdSeries).length} series`)
  console.log(`  - ${Object.keys(games).length} games`)
  console.log(`  - ${modCount} mods (25 per platform × 6 platforms)`)
  console.log(`  - Each mod: files, team, contacts, videos, tabs, comments`)
}

main().catch((e) => { console.error(e); process.exit(1) }).finally(async () => { await db.$disconnect() })
