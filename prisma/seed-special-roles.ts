import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const SPECIAL_ROLES = [
  { key: 'official_translator', name: 'مترجم رسمي', nameEn: 'Official Translator', icon: 'Languages', color: '#3b82f6', description: 'للمترجمين المعتمدين' },
  { key: 'reviewer', name: 'مراجع', nameEn: 'Reviewer', icon: 'Eye', color: '#22c55e', description: 'للمساهمين في مراجعة التعريبات' },
  { key: 'team', name: 'فريق العمل', nameEn: 'Team', icon: 'Users', color: '#a855f7', description: 'لأعضاء الإدارة' },
  { key: 'supporter', name: 'داعم', nameEn: 'Supporter', icon: 'Heart', color: '#eab308', description: 'للمساهمين ماليًا' },
  { key: 'vip', name: 'زائر VIP', nameEn: 'VIP', icon: 'Star', color: '#ec4899', description: 'لفترة محدودة' },
  { key: 'event_contributor', name: 'مساهم فعاليات', nameEn: 'Event Contributor', icon: 'Calendar', color: '#f97316', description: 'لفعاليات معينة' },
]

async function main() {
  for (const role of SPECIAL_ROLES) {
    await prisma.specialRole.upsert({
      where: { key: role.key },
      update: role,
      create: role
    })
    console.log(`Seeded special role: ${role.name}`)
  }
  console.log('Done seeding special roles')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
