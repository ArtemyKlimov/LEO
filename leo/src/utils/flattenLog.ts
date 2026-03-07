import type { LogEntry } from '@/types/api'

/**
 * Разворачивает один уровень вложенных объектов в записи лога.
 *
 * Правила:
 * - Пустые вложенные объекты ({}) — пропускаются полностью.
 * - Непустые вложенные объекты — их ключи поднимаются на верхний уровень (без префикса родителя).
 * - Скалярные значения и массивы — остаются без изменений.
 */
export function flattenLog(log: Record<string, unknown>): LogEntry {
  const result: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(log)) {
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      const children = Object.entries(value as Record<string, unknown>)
      if (children.length === 0) continue // пустой объект — пропускаем
      for (const [childKey, childValue] of children) {
        result[childKey] = childValue
      }
    } else {
      result[key] = value
    }
  }

  return result as LogEntry
}
