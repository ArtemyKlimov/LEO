export type DataSource = 'opensearch' | 'clickhouse'

interface Props {
  value: DataSource
  onChange: (source: DataSource) => void
  dark: boolean
  disabled?: boolean
}

const OPTIONS: { value: DataSource; label: string; title: string }[] = [
  { value: 'opensearch', label: 'OS', title: 'OpenSearch' },
  { value: 'clickhouse', label: 'CH', title: 'ClickHouse' },
]

export default function DataSourceToggle({ value, onChange, dark, disabled = false }: Props) {
  const groupCls = [
    'flex items-center flex-shrink-0 rounded overflow-hidden ring-1',
    dark ? 'ring-slate-700' : 'ring-gray-300',
  ].join(' ')

  function btnCls(active: boolean, isFirst: boolean) {
    return [
      'px-2 py-1 text-xs font-medium transition-colors cursor-pointer select-none',
      'disabled:opacity-40 disabled:cursor-not-allowed',
      isFirst
        ? dark ? 'border-r border-slate-700' : 'border-r border-gray-300'
        : '',
      active
        ? 'bg-blue-600 text-white'
        : dark
          ? 'bg-transparent text-slate-400 hover:text-white hover:bg-slate-700'
          : 'bg-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-100',
    ].join(' ')
  }

  return (
    <div className={groupCls} role="group" aria-label="Источник данных">
      {OPTIONS.map(({ value: v, label, title }, idx) => (
        <button
          key={v}
          onClick={() => onChange(v)}
          disabled={disabled}
          title={title}
          aria-pressed={value === v}
          className={btnCls(value === v, idx === 0)}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
