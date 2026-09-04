/**
 * lib/export/csv.ts — تصدير البيانات بصيغة CSV
 *
 * يدعم النصوص العربية (UTF-8 BOM) و pst objects المتداخلة.
 */

export interface CsvColumn<T = any> {
  key: string
  header: string
  formatter?: (value: any, row: T) => string
}

/**
 * تحويل بيانات إلى CSV مع دعم العربية
 */
export function toCsv<T extends Record<string, any>>(data: T[], columns: CsvColumn<T>[]): string {
  const BOM = '\uFEFF' // UTF-8 BOM for Arabic support

  const headers = columns.map((c) => escapeCsvField(c.header)).join(',')

  const rows = data.map((row) =>
    columns
      .map((col) => {
        const value = getNestedValue(row, col.key)
        const formatted = col.formatter ? col.formatter(value, row) : formatValue(value)
        return escapeCsvField(formatted)
      })
      .join(','),
  )

  return BOM + headers + '\n' + rows.join('\n')
}

/**
 * تحويل إلى CSV وإرجاع كـ Buffer
 */
export function toCsvBuffer<T extends Record<string, any>>(
  data: T[],
  columns: CsvColumn<T>[],
): Buffer {
  return Buffer.from(toCsv(data, columns), 'utf-8')
}

/**
 * تسطيح الكائنات المتداخلة
 */
export function flattenObject(obj: Record<string, any>, prefix = ''): Record<string, any> {
  const result: Record<string, any> = {}
  for (const [key, value] of Object.entries(obj)) {
    const newKey = prefix ? `${prefix}.${key}` : key
    if (value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
      Object.assign(result, flattenObject(value, newKey))
    } else {
      result[newKey] = value
    }
  }
  return result
}

/**
 * توليد أعمدة تلقائياً من البيانات
 */
export function autoColumns<T extends Record<string, any>>(data: T[]): CsvColumn<T>[] {
  if (data.length === 0) return []
  const flat = flattenObject(data[0])
  return Object.keys(flat).map((key) => ({
    key,
    header: key,
  }))
}

// ===== Helpers =====

function escapeCsvField(value: string): string {
  if (value == null) return ''
  const str = String(value)
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

function formatValue(value: any): string {
  if (value == null) return ''
  if (value instanceof Date) return value.toLocaleDateString('ar-SA')
  if (typeof value === 'boolean') return value ? 'نعم' : 'لا'
  return String(value)
}

function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((curr, key) => curr?.[key], obj)
}
