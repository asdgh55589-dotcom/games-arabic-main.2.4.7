import { db } from '../src/lib/db'

async function main() {
  const cols = await db.$queryRaw<Array<{ column_name: string; data_type: string; is_nullable: string }>>`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'Mod'
    ORDER BY ordinal_position
  `
  console.log('Mod columns:')
  for (const c of cols) {
    console.log(`  ${c.column_name} (${c.data_type})`)
  }
  const count = await db.mod.count()
  console.log('mod count:', count)
  if (count > 0) {
    const first = await db.mod.findFirst()
    console.log('first mod keys:', Object.keys(first || {}))
    console.log('has series?', (first as any)?.series !== undefined)
    console.log('has translationType?', (first as any)?.translationType !== undefined)
  }
}

main().catch(console.error).finally(() => db.$disconnect())
