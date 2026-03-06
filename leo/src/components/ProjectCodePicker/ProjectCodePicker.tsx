import { useState, useRef, useEffect } from 'react'

interface Props {
  dark: boolean
  available: string[]
  selected: string[]
  highlighted?: boolean
  onChange: (codes: string[]) => void
}

function collapsedLabel(selected: string[]): string {
  if (selected.length === 0) return 'projectCode: —'
  if (selected.length === 1) return `projectCode: ${selected[0]}`
  if (selected.length === 2) return `projectCode: ${selected[0]}, ${selected[1]}`
  return `projectCode: ${selected[0]}, ${selected[1]} ...`
}

export default function ProjectCodePicker({ dark, available, selected, highlighted, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  // Черновик выбора — применяется только по кнопке «Подтвердить»
  const [draft, setDraft] = useState<string[]>(selected)
  const ref = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  // Инициализируем черновик из selected при открытии
  function handleOpen() {
    if (available.length === 0) return
    setDraft(selected)
    setSearch('')
    setOpen(true)
  }

  function handleClose() {
    setOpen(false)
    setSearch('')
  }

  function handleConfirm() {
    onChange(draft)
    setOpen(false)
    setSearch('')
  }

  useEffect(() => {
    if (!open) return
    // Фокус на поиск после открытия
    setTimeout(() => searchRef.current?.focus(), 50)

    function onMouse(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) handleClose()
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') handleClose()
    }
    document.addEventListener('mousedown', onMouse)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onMouse)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  function toggle(code: string) {
    // в режиме highlighted разрешаем снять любую галочку (включая последнюю)
    if (!highlighted && draft.includes(code) && draft.length === 1) return
    setDraft(prev =>
      prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]
    )
  }

  const filtered = available.filter(c =>
    c.toLowerCase().includes(search.toLowerCase())
  )

  const btnCls = [
    'flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium transition-colors cursor-pointer select-none flex-shrink-0',
    highlighted
      ? 'bg-amber-500/20 text-amber-600 ring-1 ring-amber-500 animate-pulse'
      : dark
        ? 'text-slate-300 hover:text-white hover:bg-slate-700'
        : 'text-gray-700 hover:text-gray-900 hover:bg-gray-100',
  ].join(' ')

  return (
    <div className="relative flex-shrink-0" ref={ref}>
      <button
        className={btnCls}
        onClick={handleOpen}
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
          'absolute right-0 top-full mt-1 w-56 rounded-lg shadow-xl border z-50 flex flex-col overflow-hidden',
          dark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200',
        ].join(' ')}>

          {/* Поиск */}
          <div className={[
            'flex items-center gap-1.5 px-2.5 py-2 border-b',
            dark ? 'border-slate-700' : 'border-gray-100',
          ].join(' ')}>
            <svg className={['w-3 h-3 flex-shrink-0', dark ? 'text-slate-500' : 'text-gray-400'].join(' ')}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
            </svg>
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Поиск..."
              className={[
                'flex-1 min-w-0 text-xs bg-transparent outline-none',
                dark ? 'text-white placeholder-slate-500' : 'text-gray-900 placeholder-gray-400',
              ].join(' ')}
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className={['cursor-pointer', dark ? 'text-slate-500 hover:text-slate-300' : 'text-gray-400 hover:text-gray-600'].join(' ')}
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {/* Список */}
          <div className="overflow-y-auto max-h-48 py-1">
            {filtered.length === 0 ? (
              <p className={['px-3 py-2 text-xs', dark ? 'text-slate-500' : 'text-gray-400'].join(' ')}>
                Ничего не найдено
              </p>
            ) : filtered.map(code => {
              const isChecked = draft.includes(code)
              const isDisabled = !highlighted && isChecked && draft.length === 1
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

          {/* Подтвердить */}
          <div className={[
            'px-2.5 py-2 border-t',
            dark ? 'border-slate-700' : 'border-gray-100',
          ].join(' ')}>
            <button
              onClick={handleConfirm}
              className="w-full py-1.5 rounded-md text-xs font-semibold bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white transition-colors cursor-pointer"
            >
              Подтвердить
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
