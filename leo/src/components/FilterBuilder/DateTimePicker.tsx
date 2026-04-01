import { useRef } from 'react'
import { formatDisplayDate, normalizeInputValue } from '@/utils/datetime'

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  /** Значение в формате YYYY-MM-DDTHH:mm:ss (datetime-local) */
  value: string
  onChange: (value: string) => void
  dark: boolean
  placeholder?: string
}

// ─── DateTimePicker ───────────────────────────────────────────────────────────

export default function DateTimePicker({
  value,
  onChange,
  dark,
  placeholder = 'Выберите дату и время',
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null)

  function openPicker() {
    // showPicker() поддерживается в Chrome 99+, Firefox 101+, Safari 16+
    try { inputRef.current?.showPicker() } catch { inputRef.current?.focus() }
  }

  const triggerCls = [
    'flex items-center gap-2 text-xs rounded px-2 py-1 border outline-none',
    'focus:ring-1 w-full cursor-pointer select-none min-h-[28px]',
    dark
      ? 'bg-slate-700 border-slate-600 focus:ring-blue-500'
      : 'bg-white border-gray-300 focus:ring-blue-400',
    value
      ? dark ? 'text-slate-200' : 'text-gray-800'
      : dark ? 'text-slate-500' : 'text-gray-400',
  ].join(' ')

  return (
    <div className="relative w-full">
      {/* Styled trigger — визуальное представление picker'а */}
      <div
        className={triggerCls}
        onClick={openPicker}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') openPicker() }}
        role="button"
        tabIndex={0}
        aria-label="Выбрать дату и время"
      >
        {/* Иконка календаря */}
        <svg
          className="w-3.5 h-3.5 flex-shrink-0 opacity-60"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
        >
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>

        {/* Значение или placeholder */}
        <span className="flex-1 truncate">
          {value ? formatDisplayDate(value) : placeholder}
        </span>

        {/* Кнопка очистки */}
        {value && (
          <button
            type="button"
            onMouseDown={e => { e.stopPropagation(); onChange('') }}
            className="opacity-50 hover:opacity-100 cursor-pointer leading-none flex-shrink-0 text-sm"
            title="Очистить"
            aria-label="Очистить дату"
          >
            ×
          </button>
        )}
      </div>

      {/* Нативный input — скрыт, открывается программно через showPicker() */}
      <input
        ref={inputRef}
        type="datetime-local"
        step="1"
        value={value}
        onChange={e => onChange(normalizeInputValue(e.target.value))}
        className="absolute inset-0 opacity-0 pointer-events-none w-full h-full"
        tabIndex={-1}
        aria-hidden="true"
      />
    </div>
  )
}
