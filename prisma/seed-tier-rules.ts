import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const TIER_RULES = [
  {
    tier: 1,
    name: 'مترجم',
    nameEn: 'Translator',
    requiredMods: 3,
    requiredDownloads: 100,
    requiredRating: 3.0,
    requiredQualityScore: 15,
    badge: 'Languages',
    badgeColor: '#3b82f6',
    features: JSON.stringify(['نشر تعريبات', 'تعديل تعريباته', 'شارة مترجم'])
  },
  {
    tier: 2,
    name: 'محترف',
    nameEn: 'Pro',
    requiredMods: 15,
    requiredDownloads: 1000,
    requiredRating: 3.5,
    requiredQualityScore: 30,
    badge: 'Award',
    badgeColor: '#eab308',
    features: JSON.stringify(['شارة محترف', 'لوحة تحكم متقدمة', 'احصائيات مفصلة'])
  },
  {
    tier: 3,
    name: 'خبير',
    nameEn: 'Expert',
    requiredMods: 50,
    requiredDownloads: 5000,
    requiredRating: 4.0,
    requiredQualityScore: 50,
    badge: 'Crown',
    badgeColor: '#a855f7',
    features: JSON.stringify(['شارة خبير', 'مراجعة تعريبات الآخرين', 'صفحة مميزة'])
  },
  {
    tier: 4,
    name: 'مشرف',
    nameEn: 'Moderator',
    requiredMods: 150,
    requiredDownloads: 20000,
    requiredRating: 4.5,
    requiredQualityScore: 75,
    badge: 'Shield',
    badgeColor: '#ef4444',
    features: JSON.stringify(['صلاحيات ادارة', 'حظر مستخدمين', 'مراجعة طلبات'])
  },
  {
    tier: 5,
    name: 'مدير',
    nameEn: 'Admin',
    requiredMods: 999999,
    requiredDownloads: 999999,
    requiredRating: 5.0,
    requiredQualityScore: 999,
    badge: 'Crown',
    badgeColor: '#f59e0b',
    features: JSON.stringify(['تعيين يدوي فقط'])
  }
]

async function main() {
  for (const rule of TIER_RULES) {
    await prisma.tierRule.upsert({
      where: { tier: rule.tier },
      update: rule,
      create: rule
    })
    console.log(`Seeded tier rule: ${rule.name} (tier ${rule.tier})`)
  }
  console.log('Done seeding tier rules')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
