import type { OpenSearchFilter } from '@/types/api'

// ─── Helpers ─────────────────────────────────────────────────────────────────

const OPERATOR_LABEL: Record<string, string> = {
  'IS':             '=',
  'IS NOT':         '≠',
  'IS ONE OF':      '∈',
  'IS NOT ONE OF':  '∉',
  'EXIST':          '∃',
  'DOES NOT EXIST': '∄',
}

function filterLabel(f: OpenSearchFilter): string {
  const op = OPERATOR_LABEL[f.filterOperator ?? 'IS'] ?? f.filterOperator ?? '='
  const val = f.attributeValue?.join(', ') ?? ''
  if (!val) return `${f.attributeName} ${op}`
  return `${f.attributeName} ${op} ${val}`
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  dark: boolean
  filters: OpenSearchFilter[]
  onRemove: (index: number) => void
  onClearAll: () => void
}

// ─── FilterBar ────────────────────────────────────────────────────────────────

export default function FilterBar({ dark, filters, onRemove, onClearAll }: Props) {
  if (!filters.length) return null

  const wrapCls = dark
    ? 'bg-slate-800/60 border-slate-700'
    : 'bg-blue-50/70 border-gray-200'

  function chipCls(op: string | undefined) {
    const isExclude = op === 'IS NOT' || op === 'IS NOT ONE OF' || op === 'DOES NOT EXIST'
    if (isExclude) {
      return dark
        ? 'bg-red-900/40 text-red-300 border-red-800'
        : 'bg-red-50 text-red-700 border-red-200'
    }
    return dark
      ? 'bg-blue-900/40 text-blue-300 border-blue-800'
      : 'bg-blue-50 text-blue-700 border-blue-200'
  }

  function removeBtnCls(op: string | undefined) {
    const isExclude = op === 'IS NOT' || op === 'IS NOT ONE OF' || op === 'DOES NOT EXIST'
    if (isExclude) {
      return dark
        ? 'text-red-500 hover:text-red-300 hover:bg-red-800/50'
        : 'text-red-400 hover:text-red-600 hover:bg-red-100'
    }
    return dark
      ? 'text-blue-500 hover:text-blue-300 hover:bg-blue-800/50'
      : 'text-blue-400 hover:text-blue-600 hover:bg-blue-100'
  }

  const clearBtnCls = dark
    ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-700'
    : 'text-gray-400 hover:text-gray-600 hover:bg-gray-200'

  return (
    <div
      className={`flex items-center gap-2 px-3 py-1.5 border-b flex-wrap flex-shrink-0 ${wrapCls}`}
    >
      {/* Label */}
      <span className={`text-xs font-semibold flex-shrink-0 ${dark ? 'text-slate-500' : 'text-gray-400'}`}>
        Фильтры:
      </span>

      {/* Filter chips */}
      {filters.map((f, i) => (
        <span
          key={i}
          className={`inline-flex items-center gap-1 text-xs font-mono px-2 py-0.5 rounded border ${chipCls(f.filterOperator)}`}
        >
          <span>{filterLabel(f)}</span>
          <button
            onClick={() => onRemove(i)}
            className={`ml-0.5 rounded p-0.5 transition-colors cursor-pointer ${removeBtnCls(f.filterOperator)}`}
            title="Удалить фильтр"
          >
            <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </span>
      ))}

      {/* Clear all */}
      {filters.length > 1 && (
        <button
          onClick={onClearAll}
          className={`text-xs px-2 py-0.5 rounded transition-colors cursor-pointer flex-shrink-0 ${clearBtnCls}`}
          title="Удалить все фильтры"
        >
          Очистить всё
        </button>
      )}
    </div>
  )
}
