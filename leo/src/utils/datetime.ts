/**
 * Converts a datetime-local input value (YYYY-MM-DDTHH:mm:ss) to display format DD.MM.YYYY HH:mm:ss
 */
export function formatDisplayDate(value: string): string {
  if (!value) return ''
  const [datePart, timePart] = value.split('T')
  if (!datePart) return value
  const [year, month, day] = datePart.split('-')
  return `${day ?? ''}.${month ?? ''}.${year ?? ''} ${timePart ?? ''}`
}

/**
 * Trims value to YYYY-MM-DDTHH:mm:ss (strips milliseconds / timezone if present)
 */
export function normalizeInputValue(value: string): string {
  return value.slice(0, 19)
}
