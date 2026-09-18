import { parseIaUrl } from '@/lib/ia'
import { slugify } from '@/lib/utils'

/**
 * Shared mod-relation writer (P3).
 * The creator POST/PATCH routes used to spread relation arrays
 * (files, videoGroups, …) straight into db.mod.create/update, which
 * Prisma rejects. This helper strips + persists them explicitly,
 * mirroring the admin bulk-write behavior (including IA provenance).
 *
 * Semantics per key: undefined → leave untouched; array (even empty)
 * → replace existing rows.
 */

interface FileLinkInput {
  url?: string
  label?: string
}
interface FileInput {
  title?: string
  description?: string
  alert?: string
  version?: string
  releaseDate?: string
  fileSize?: string
  fileFormat?: string
  order?: number
  links?: FileLinkInput[]
}
interface VideoInput {
  title?: string
  url?: string
  thumbnail?: string
  duration?: string
  description?: string
  views?: number
  likes?: number
  commentsCount?: number
  channel?: string
  publishedAt?: string
  order?: number
}
interface VideoGroupInput {
  name?: string
  order?: number
  videos?: VideoInput[]
}
interface MemberInput {
  name?: string
  avatarUrl?: string
  role?: string
  contribution?: string
  order?: number
}
interface ContactInput {
  type?: string
  label?: string
  url?: string
  order?: number
}
interface TabInput {
  name?: string
  slug?: string
  content?: string
  order?: number
  visible?: boolean
}

export interface ModRelationsInput {
  files?: FileInput[]
  videoGroups?: VideoGroupInput[]
  teamMembers?: MemberInput[]
  contactLinks?: ContactInput[]
  customTabs?: TabInput[]
  version?: string
  fileSize?: string
  fileFormat?: string
}

interface RelationTx {
  modFile: {
    deleteMany(args: unknown): Promise<unknown>
    create(args: { data: Record<string, unknown> }): Promise<{ id: string }>
  }
  modFileLink: { createMany(args: unknown): Promise<unknown> }
  modVideoGroup: {
    deleteMany(args: unknown): Promise<unknown>
    create(args: { data: Record<string, unknown> }): Promise<{ id: string }>
  }
  modVideo: { createMany(args: unknown): Promise<unknown> }
  modTeamMember: { deleteMany(args: unknown): Promise<unknown>; createMany(args: unknown): Promise<unknown> }
  modContactLink: { deleteMany(args: unknown): Promise<unknown>; createMany(args: unknown): Promise<unknown> }
  modCustomTab: { deleteMany(args: unknown): Promise<unknown>; createMany(args: unknown): Promise<unknown> }
}

export const MOD_RELATION_KEYS = [
  'files',
  'videoGroups',
  'teamMembers',
  'contactLinks',
  'customTabs',
] as const

/** Remove relation arrays from scalar mod data (prevents Prisma rejections). */
export function stripModRelations<T extends Record<string, unknown>>(data: T): Omit<T, (typeof MOD_RELATION_KEYS)[number]> {
  const clean = { ...data }
  for (const key of MOD_RELATION_KEYS) delete clean[key]
  return clean
}

export async function syncModRelations(
  tx: RelationTx,
  modId: string,
  body: ModRelationsInput,
  opts: { uploadedBy?: string } = {},
): Promise<void> {
  // ===== files + links (with IA provenance) =====
  if (Array.isArray(body.files)) {
    await tx.modFile.deleteMany({ where: { modId } })
    for (const [i, f] of body.files.filter((x) => x?.title).entries()) {
      const created = await tx.modFile.create({
        data: {
          modId,
          title: f.title as string,
          description: f.description || null,
          alert: f.alert || null,
          version: f.version || body.version || '1.0.0',
          releaseDate: f.releaseDate ? new Date(f.releaseDate) : new Date(),
          fileSize: f.fileSize || body.fileSize || 'MB 0',
          fileFormat: f.fileFormat || body.fileFormat || 'zip',
          order: f.order ?? i,
        },
      })
      const links = (Array.isArray(f.links) ? f.links : [])
        .filter((l) => l?.url)
        .map((l, j) => {
          const ia = parseIaUrl(l.url as string)
          return {
            fileId: created.id,
            url: l.url as string,
            label: l.label || null,
            order: j,
            provider: ia ? 'ia' : 'direct',
            storageKey: ia ? `${ia.identifier}/${ia.key}` : null,
            uploadedBy: ia ? (opts.uploadedBy ?? null) : null,
          }
        })
      if (links.length > 0) await tx.modFileLink.createMany({ data: links })
    }
  }

  // ===== video groups =====
  if (Array.isArray(body.videoGroups)) {
    await tx.modVideoGroup.deleteMany({ where: { modId } })
    for (const [i, g] of body.videoGroups.filter((x) => x?.name).entries()) {
      const group = await tx.modVideoGroup.create({
        data: { modId, name: g.name as string, order: g.order ?? i },
      })
      const videos = (Array.isArray(g.videos) ? g.videos : [])
        .filter((v) => v?.title && v?.url)
        .map((v, j) => ({
          groupId: group.id,
          title: v.title as string,
          url: v.url as string,
          thumbnail: v.thumbnail || null,
          duration: v.duration || null,
          description: v.description || null,
          views: v.views || 0,
          likes: v.likes || 0,
          commentsCount: v.commentsCount || 0,
          channel: v.channel || null,
          publishedAt: v.publishedAt ? new Date(v.publishedAt) : null,
          order: v.order ?? j,
        }))
      if (videos.length > 0) await tx.modVideo.createMany({ data: videos })
    }
  }

  // ===== team members =====
  if (Array.isArray(body.teamMembers)) {
    await tx.modTeamMember.deleteMany({ where: { modId } })
    const rows = body.teamMembers
      .filter((m) => m?.name)
      .map((m, i) => ({
        modId,
        name: m.name as string,
        avatarUrl: m.avatarUrl || null,
        role: m.role || 'مترجم',
        contribution: m.contribution || null,
        order: m.order ?? i,
      }))
    if (rows.length > 0) await tx.modTeamMember.createMany({ data: rows })
  }

  // ===== contact links =====
  if (Array.isArray(body.contactLinks)) {
    await tx.modContactLink.deleteMany({ where: { modId } })
    const rows = body.contactLinks
      .filter((c) => c?.url)
      .map((c, i) => ({
        modId,
        type: c.type || 'website',
        label: c.label || '',
        url: c.url as string,
        order: c.order ?? i,
      }))
    if (rows.length > 0) await tx.modContactLink.createMany({ data: rows })
  }

  // ===== custom tabs =====
  if (Array.isArray(body.customTabs)) {
    await tx.modCustomTab.deleteMany({ where: { modId } })
    const rows = body.customTabs
      .filter((t) => t?.name)
      .map((t, i) => ({
        modId,
        name: t.name as string,
        slug: t.slug || slugify(t.name as string),
        content: t.content || '',
        order: t.order ?? i,
        visible: t.visible !== false,
      }))
    if (rows.length > 0) await tx.modCustomTab.createMany({ data: rows })
  }
}
