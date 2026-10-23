import { db } from '@/lib/db'

type SnapshotClient = Pick<typeof db, 'mod' | 'modComment'>
type SnapshotWriteClient = Pick<typeof db, 'report' | 'mod' | 'modComment'>

/** Minimal report reference needed to snapshot the moderated target. */
export interface SnapshotReportRef {
  targetModId?: string | null
  targetCommentId?: string | null
}

export interface ModTargetSnapshotData {
  id: string
  name: string
  slug: string
  headline: string
  authorId: string
  gameId: string
  downloads: number
  endorsements: number
  createdAt: string
  thumbnailUrl: string
}

export interface CommentTargetSnapshotData {
  id: string
  text: string
  userId: string | null
  modId: string
  createdAt: string
}

/**
 * JSON-serializable record of the moderated content, stored on Report.snapshot
 * before content_deleted removes the target. `createdAt` is normalized to an
 * ISO string because Prisma's Json column only accepts JSON values.
 */
export type ReportTargetSnapshot =
  | { type: 'mod'; data: ModTargetSnapshotData; deletedAt: string }
  | { type: 'comment'; data: CommentTargetSnapshotData; deletedAt: string }
  | { type: 'unknown'; data: null; deletedAt: string }

/**
 * Fetch and snapshot the report target BEFORE it is deleted.
 * Missing targets are handled defensively (type "unknown") so the caller can
 * still resolve the report without throwing P2025.
 */
export async function snapshotReportsForTarget(
  target: { modId: string } | { commentId: string },
  client: SnapshotWriteClient = db,
): Promise<number> {
  const where = 'modId' in target ? { targetModId: target.modId } : { targetCommentId: target.commentId }
  const reports = await client.report.findMany({
    where,
    select: { id: true, snapshot: true },
  })
  const missing = reports.filter((report) => report.snapshot == null)
  if (missing.length === 0) return 0

  const snapshot = await snapshotReportTarget(
    'modId' in target ? { targetModId: target.modId } : { targetCommentId: target.commentId },
    client,
  )
  await client.report.updateMany({
    where: { id: { in: missing.map((report) => report.id) } },
    data: { snapshot: snapshot as never },
  })
  return missing.length
}

export async function snapshotReportTarget(
  report: SnapshotReportRef,
  client: SnapshotClient = db,
): Promise<ReportTargetSnapshot> {
  const deletedAt = new Date().toISOString()

  if (report.targetModId) {
    const mod = await client.mod.findUnique({
      where: { id: report.targetModId },
      select: {
        id: true,
        name: true,
        slug: true,
        headline: true,
        authorId: true,
        gameId: true,
        downloads: true,
        endorsements: true,
        createdAt: true,
        thumbnailUrl: true,
      },
    })
    if (mod) {
      return {
        type: 'mod',
        data: { ...mod, createdAt: mod.createdAt.toISOString() },
        deletedAt,
      }
    }
    return { type: 'unknown', data: null, deletedAt }
  }

  if (report.targetCommentId) {
    const comment = await client.modComment.findUnique({
      where: { id: report.targetCommentId },
      select: {
        id: true,
        text: true,
        userId: true,
        modId: true,
        createdAt: true,
      },
    })
    if (comment) {
      return {
        type: 'comment',
        data: { ...comment, createdAt: comment.createdAt.toISOString() },
        deletedAt,
      }
    }
    return { type: 'unknown', data: null, deletedAt }
  }

  return { type: 'unknown', data: null, deletedAt }
}
