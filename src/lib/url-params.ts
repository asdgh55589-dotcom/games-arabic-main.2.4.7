/** فكّ ترميز segment من الرابط بأمان — يرجّع الخام لو الترميز بايظ (decodeURIComponent يرمي على % غير سالم) */
export function decodePathParam(value: string): string {
  if (!value) return value
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}
