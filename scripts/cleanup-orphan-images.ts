/**
 * Orphan image cleanup (P3).
 *
 * Finds provider objects with no DB reference:
 * - Supabase Storage (mods/teams/series/news/avatars/banners buckets)
 * - FreeImage uploads (UploadAsset rows, unlinked + unreferenced)
 * - Cloudinary stale refs (publicId without URL on User)
 * - IA files are REPORTED only — never auto-deleted (shared identifier).
 *
 * Usage:
 *   npx tsx scripts/cleanup-orphan-images.ts [--dry-run] [--delete]
 *     [--provider=supabase|freeimage|cloudinary|all] [--limit=N]
 *
 * Default is dry-run (report only). --delete performs deletions + audit.
 */
import { db } from '../src/lib/db'
import { createAdminClient } from '../src/lib/supabase/server'

const BUCKETS = ['mods', 'teams', 'series', 'news', 'avatars', 'banners']

interface Orphan {
  provider: 'supabase' | 'freeimage' | 'cloudinary'
  ref: string
  bytes?: number
}

function parseArgs() {
  const args = new Set(process.argv.slice(2))
  const get = (prefix: string): string | null => {
    for (const a of process.argv.slice(2)) {
      if (a.startsWith(prefix)) return a.slice(prefix.length)
    }
    return null
  }
  return {
    dryRun: !args.has('--delete'),
    provider: get('--provider=') || 'all',
    limit: Number(get('--limit=') || '0') || 0,
  }
}

async function collectReferencedUrls(): Promise<Set<string>> {
  const refs = new Set<string>()
  const add = (v: unknown) => {
    if (typeof v === 'string' && v.startsWith('https://')) refs.add(v)
  }
  const addCsv = (v: unknown) => {
    if (typeof v === 'string') v.split(',').forEach((s) => add(s.trim()))
  }
  const [mods, games, teams, series, news, users, members, assets] = await Promise.all([
    db.mod.findMany({ select: { thumbnailUrl: true, imageUrl: true, galleryUrls: true } }),
    db.game.findMany({ select: { bannerUrl: true, logoUrl: true, thumbnailUrl: true } }),
    db.team.findMany({ select: { logoUrl: true, bannerUrl: true } }),
    db.series.findMany({ select: { bannerUrl: true, logoUrl: true } }),
    db.news.findMany({ select: { imageUrl: true } }),
    db.user.findMany({ select: { avatarUrl: true, bannerUrl: true } }),
    db.modTeamMember.findMany({ select: { avatarUrl: true } }),
    db.uploadAsset.findMany({ select: { originalUrl: true, wrappedUrl: true } }),
  ])
  for (const m of mods) {
    add(m.thumbnailUrl)
    add(m.imageUrl)
    addCsv(m.galleryUrls)
  }
  for (const g of games) {
    add(g.bannerUrl)
    add(g.logoUrl)
    add(g.thumbnailUrl)
  }
  for (const t of teams) {
    add(t.logoUrl)
    add(t.bannerUrl)
  }
  for (const s of series) {
    add(s.bannerUrl)
    add(s.logoUrl)
  }
  for (const n of news) add(n.imageUrl)
  for (const u of users) {
    add(u.avatarUrl)
    add(u.bannerUrl)
  }
  for (const m of members) add(m.avatarUrl)
  for (const a of assets) {
    add(a.originalUrl)
    add(a.wrappedUrl)
  }
  return refs
}

async function findSupabaseOrphans(refs: Set<string>, limit: number): Promise<Orphan[]> {
  const supabase = createAdminClient()
  if (!supabase) {
    console.warn('[cleanup] Supabase admin client unavailable (missing service key) — skipping buckets')
    return []
  }
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '')
  const orphans: Orphan[] = []

  for (const bucket of BUCKETS) {
    // Top-level + one nested level (folders like banners/, thumbnails/).
    const queue: string[] = ['']
    while (queue.length > 0) {
      const prefix = queue.shift() as string
      const { data, error } = await supabase.storage.from(bucket).list(prefix || undefined, { limit: 1000 })
      if (error || !data) {
        console.warn(`[cleanup] list ${bucket}/${prefix} failed: ${error?.message}`)
        break
      }
      for (const entry of data) {
        if (!entry.name) continue
        if (!entry.id) {
          queue.push(prefix ? `${prefix}/${entry.name}` : entry.name)
          continue
        }
        const key = prefix ? `${prefix}/${entry.name}` : entry.name
        const publicUrl = `${base}/storage/v1/object/public/${bucket}/${key}`
        if (!refs.has(publicUrl)) {
          orphans.push({ provider: 'supabase', ref: `${bucket}/${key}`, bytes: entry.metadata?.size })
          if (limit > 0 && orphans.length >= limit) return orphans
        }
      }
    }
  }
  return orphans
}

async function findFreeImageOrphans(refs: Set<string>, limit: number): Promise<Orphan[]> {
  const rows = await db.uploadAsset.findMany({
    where: { provider: 'freeimage', modId: null },
    select: { id: true, originalUrl: true, storageKey: true, bytes: true },
    take: limit > 0 ? limit : 5000,
  })
  return rows
    .filter((r) => !refs.has(r.originalUrl))
    .map((r) => ({ provider: 'freeimage' as const, ref: r.id, bytes: Number(r.bytes) }))
}

async function findCloudinaryStaleRefs(): Promise<Orphan[]> {
  const users = await db.user.findMany({
    select: { id: true, avatarUrl: true, avatarPublicId: true, bannerUrl: true, bannerPublicId: true },
  })
  const orphans: Orphan[] = []
  for (const u of users) {
    if (u.avatarPublicId && !u.avatarUrl) orphans.push({ provider: 'cloudinary', ref: `${u.id}:avatar:${u.avatarPublicId}` })
    if (u.bannerPublicId && !u.bannerUrl) orphans.push({ provider: 'cloudinary', ref: `${u.id}:banner:${u.bannerPublicId}` })
  }
  return orphans
}

async function main() {
  const { dryRun, provider, limit } = parseArgs()
  console.log(`[cleanup] mode=${dryRun ? 'dry-run' : 'DELETE'} provider=${provider} limit=${limit || 'none'}`)

  const refs = await collectReferencedUrls()
  console.log(`[cleanup] referenced URLs in DB: ${refs.size}`)

  const orphans: Orphan[] = []
  if (provider === 'all' || provider === 'supabase') {
    orphans.push(...(await findSupabaseOrphans(refs, limit)))
  }
  if (provider === 'all' || provider === 'freeimage') {
    orphans.push(...(await findFreeImageOrphans(refs, limit)))
  }
  if (provider === 'all' || provider === 'cloudinary') {
    orphans.push(...(await findCloudinaryStaleRefs()))
  }

  // IA: report-only (never auto-delete the shared identifier).
  const iaUnlinked = await db.uploadAsset.count({ where: { provider: 'ia', modId: null } })

  console.log(`[cleanup] orphans found: ${orphans.length} (IA unlinked info-only: ${iaUnlinked})`)
  for (const o of orphans.slice(0, 50)) {
    console.log(`  - [${o.provider}] ${o.ref}${o.bytes ? ` (${o.bytes}B)` : ''}`)
  }
  if (orphans.length > 50) console.log(`  ... and ${orphans.length - 50} more`)

  if (dryRun) {
    console.log('[cleanup] dry-run — no changes. Re-run with --delete to remove.')
    return
  }

  let removed = 0
  const supabase = createAdminClient()
  for (const o of orphans) {
    try {
      if (o.provider === 'supabase') {
        if (!supabase) throw new Error('Supabase admin client unavailable')
        const [bucket, ...rest] = o.ref.split('/')
        const { error } = await supabase.storage.from(bucket).remove([rest.join('/')])
        if (error) throw new Error(error.message)
      } else if (o.provider === 'freeimage') {
        const row = await db.uploadAsset.findUnique({ where: { id: o.ref } })
        if (row?.storageKey) {
          await fetch(row.storageKey, { method: 'DELETE', signal: AbortSignal.timeout(10_000) }).catch(() => null)
        }
        await db.uploadAsset.delete({ where: { id: o.ref } }).catch(() => null)
      } else {
        // cloudinary stale ref: clear the dangling publicId only.
        const [userId, kind] = o.ref.split(':')
        await db.user.update({
          where: { id: userId },
          data: kind === 'avatar' ? { avatarPublicId: null } : { bannerPublicId: null },
        }).catch(() => null)
      }
      removed += 1
    } catch (err) {
      console.warn(`[cleanup] remove failed for ${o.ref}:`, err instanceof Error ? err.message : err)
    }
  }

  await db.auditLog
    .create({
      data: {
        username: 'system',
        action: 'delete',
        entity: 'image',
        details: JSON.stringify({ code: 'ORPHAN_CLEANUP', found: orphans.length, removed, provider }),
      },
    })
    .catch(() => null)

  console.log(`[cleanup] removed ${removed}/${orphans.length}`)
}

main()
  .catch((err) => {
    console.error('[cleanup] fatal:', err)
    process.exit(1)
  })
  .finally(() => db.$disconnect().catch(() => null))
