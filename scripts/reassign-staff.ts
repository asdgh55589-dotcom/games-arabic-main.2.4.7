import { db } from '@/lib/db'
import { hashPassword } from '@/lib/auth'
import { hashSecurityKey, generateSecurityKey } from '@/lib/security-key'

async function main() {
  const staff = [
    {
      username: 'GAAdminHesham',
      email: 'admin@games-arabic.com',
      password: 'NewAdmin#2026!Pass',
      role: 'admin',
      keyExpiryDays: 90,
    },
    {
      username: 'GAModKarim',
      email: 'mod@games-arabic.com',
      password: 'NewMod#2026!Pass',
      role: 'moderator',
      keyExpiryDays: 90,
    },
  ]

  for (const s of staff) {
    const securityKey = generateSecurityKey(16)
    const hashedPass = await hashPassword(s.password)
    const hashedKey = await hashSecurityKey(securityKey)

    const existing = await db.user.findUnique({ where: { username: s.username } })
    if (!existing) {
      console.log(`❌ ${s.username} غير موجود — تخطي`)
      continue
    }

    await db.user.update({
      where: { username: s.username },
      data: {
        email: s.email,
        password: hashedPass,
        securityKey: hashedKey,
        securityKeyExpiresAt: new Date(Date.now() + s.keyExpiryDays * 86400000),
        securityKeyChangedAt: new Date(),
        role: s.role,
      },
    })

    // حاول إنشاء/تحديث Supabase Auth
    try {
      const { createSupabaseAuthUser } = await import('@/lib/auth')
      await createSupabaseAuthUser(s.email, s.password, s.username).catch(() => null)
    } catch {}

    console.log(`✅ ${s.username}:`)
    console.log(`   البريد: ${s.email}`)
    console.log(`   كلمة المرور: ${s.password}`)
    console.log(`   مفتاح الأمان: ${securityKey}`)
    console.log(`   الدور: ${s.role}`)
    console.log(`   الانتهاء: ${s.keyExpiryDays} يوم`)
    console.log('')
  }

  await db.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
