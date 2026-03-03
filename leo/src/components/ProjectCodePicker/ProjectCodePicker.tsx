import { useState, useRef, useEffect } from 'react'

interface Props {
  dark: boolean
  available: string[]
  selected: string[]
  onChange: (codes: string[]) => void
}

function collapsedLabel(selected: string[]): string {
  if (selected.length === 0) return 'projectCode: —'
  if (selected.length === 1) return `projectCode: ${selected[0]}`
  if (selected.length === 2) return `projectCode: ${selected[0]}, ${selected[1]}`
  return `projectCode: ${selected[0]}, ${selected[1]} ...`
}

export default function ProjectCodePicker({ dark, available, selected, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onMouse(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onMouse)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onMouse)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  function toggle(code: string) {
    // не даём снять последнюю галочку
    if (selected.includes(code) && selected.length === 1) return
    const next = selected.includes(code)
      ? selected.filter(c => c !== code)
      : [...selected, code]
    onChange(next)
  }

  const btnCls = [
    'flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium transition-colors cursor-pointer select-none flex-shrink-0',
    dark
      ? 'text-slate-300 hover:text-white hover:bg-slate-700'
      : 'text-gray-700 hover:text-gray-900 hover:bg-gray-100',
  ].join(' ')

  return (
    <div className="relative flex-shrink-0" ref={ref}>
      <button
        className={btnCls}
        onClick={() => available.length > 0 && setOpen(o => !o)}
        title="Фильтр по projectCode"
      >
        {collapsedLabel(selected)}
        <svg
          className={['w-3 h-3 transition-transform', open ? 'rotate-180' : ''].join(' ')}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && available.length > 0 && (
        <div className={[
          'absolute right-0 top-full mt-1 min-w-[8rem] rounded-lg shadow-xl border z-50 overflow-hidden py-1',
          dark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200',
        ].join(' ')}>
          {available.map(code => {
            const isChecked = selected.includes(code)
            const isDisabled = isChecked && selected.length === 1
            return (
              <label
                key={code}
                className={[
                  'flex items-center gap-2 px-3 py-1.5 text-xs select-none transition-colors',
                  isDisabled
                    ? dark ? 'text-slate-500 cursor-not-allowed' : 'text-gray-400 cursor-not-allowed'
                    : dark ? 'text-slate-300 hover:bg-slate-700 cursor-pointer' : 'text-gray-700 hover:bg-gray-50 cursor-pointer',
                ].join(' ')}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  disabled={isDisabled}
                  onChange={() => toggle(code)}
                  className="w-3.5 h-3.5 accent-blue-500"
                />
                {code}
              </label>
            )
          })}
        </div>
      )}
    </div>
  )
}
