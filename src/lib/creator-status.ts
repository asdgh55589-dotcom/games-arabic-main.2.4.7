/** Applicant review SLA: staff owe a decision within 48h of submission. */
export const REVIEW_SLA_HOURS = 48

export function isReviewSlaBreached(
  createdAt: string | Date,
  now: Date = new Date(),
): boolean {
  const created = createdAt instanceof Date ? createdAt : new Date(createdAt)
  if (Number.isNaN(created.getTime())) return false
  return now.getTime() - created.getTime() > REVIEW_SLA_HOURS * 3600 * 1000
}
