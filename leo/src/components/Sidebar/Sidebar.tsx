import { useState, useRef, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import type { Field, FieldValuesBucket, FieldValuesResponse } from '@/types/api'

// ─── Icons ────────────────────────────────────────────────────────────────────

function IconPin({ cls }: { cls: string }) {
  return (
    <svg className={cls} viewBox="0 0 24 24" fill="currentColor">
      <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z" />
    </svg>
  )
}

function IconPlus({ cls }: { cls: string }) {
  return (
    <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
    </svg>
  )
}

function IconMinus({ cls }: { cls: string }) {
  return (
    <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 12h16" />
    </svg>
  )
}

function IconSearch({ cls }: { cls: string }) {
  return (
    <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <circle cx="11" cy="11" r="7" />
      <path strokeLinecap="round" d="M21 21l-4.35-4.35" />
    </svg>
  )
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  dark: boolean
  fields: Field[]
  fieldFrequency: Record<string, number>   // fieldName → 0..1
  pinnedFields: string[]
  isLoading: boolean
  onInclude: (fieldName: string, value: string) => void
  onExclude: (fieldName: string, value: string) => void
  onPin: (fieldName: string) => void
  onUnpin: (fieldName: string) => void
  onFetchTopValues: (fieldName: string) => Promise<FieldValuesResponse>
}

// ─── Types ────────────────────────────────────────────────────────────────────

type ActivePicker = { name: string; operator: 'IS' | 'IS NOT' } | null

// ─── TopValues panel (portal overlay) ────────────────────────────────────────

interface TopValuesPanelProps {
  dark: boolean
  loading: boolean
  error: string | null
  buckets: FieldValuesBucket[] | null
  totalDocCount: number
  fieldName: string
  anchorRef: React.RefObject<HTMLDivElement>
  onClose: () => void
  onInclude: (fieldName: string, value: string) => void
  onExclude: (fieldName: string, value: string) => void
}

function TopValuesPanel({
  dark, loading, error, buckets, totalDocCount, fieldName,
  anchorRef, onClose, onInclude, onExclude,
}: TopValuesPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const [style, setStyle] = useState<React.CSSProperties>({
    position: 'fixed',
    top: 0,
    left: -9999,
    zIndex: 1000,
  })

  // Calculate position relative to anchor element
  useEffect(() => {
    if (!anchorRef.current) return
    const rect = anchorRef.current.getBoundingClientRect()
    const panelWidth = 320
    const maxHeight = 400
    const vpH = window.innerHeight

    let top = rect.top
    if (top + maxHeight > vpH - 8) {
      top = Math.max(8, vpH - maxHeight - 8)
    }

    setStyle({
      position: 'fixed',
      top,
      left: rect.right + 4,
      width: panelWidth,
      maxHeight,
      zIndex: 1000,
    })
  }, [anchorRef])

  // Close on click outside panel and anchor
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (
        panelRef.current && !panelRef.current.contains(e.target as Node) &&
        anchorRef.current && !anchorRef.current.contains(e.target as Node)
      ) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose, anchorRef])

  const borderCls = dark ? 'border-slate-700' : 'border-gray-200'
  const bgCls     = dark ? 'bg-slate-800'     : 'bg-white'
  const headCls   = dark ? 'text-slate-400 border-slate-700' : 'text-gray-500 border-gray-100'
  const valCls    = dark ? 'text-slate-300'   : 'text-gray-700'
  const pctCls    = dark ? 'text-slate-500'   : 'text-gray-400'
  const barClr    = dark ? 'rgba(59,130,246,0.18)' : 'rgba(59,130,246,0.12)'

  return createPortal(
    <div
      ref={panelRef}
      style={style}
      className={`rounded-lg border shadow-xl overflow-hidden flex flex-col ${bgCls} ${borderCls}`}
    >
      {/* Header */}
      <div className={`flex items-center justify-between px-3 py-1.5 border-b text-xs flex-shrink-0 ${headCls}`}>
        <span className="truncate pr-2">
          Топ: <span className="font-medium">{fieldName}</span>
        </span>
        <button
          onClick={onClose}
          className={`flex-shrink-0 p-0.5 rounded transition-colors cursor-pointer ${
            dark ? 'hover:bg-slate-700 text-slate-500 hover:text-slate-300' : 'hover:bg-gray-100 text-gray-400 hover:text-gray-600'
          }`}
          title="Закрыть"
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Body */}
      <div className="overflow-y-auto">
        {/* Loading */}
        {loading && (
          <div className="flex justify-center py-4">
            <svg className={`w-4 h-4 animate-spin ${dark ? 'text-slate-500' : 'text-gray-400'}`} viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <p className="text-xs text-red-500 px-3 py-2">{error}</p>
        )}

        {/* Buckets */}
        {!loading && !error && buckets && (
          buckets.length === 0
            ? <p className={`text-xs px-3 py-2 ${pctCls}`}>Нет данных</p>
            : (() => {
                const maxCount = Math.max(...buckets.map(b => b.docCount), 1)
                return (
                  <div className="py-1">
                    {buckets.map(bucket => {
                      const barW = (bucket.docCount / maxCount) * 100
                      const pct  = totalDocCount > 0 ? Math.round(bucket.docCount / totalDocCount * 100) : 0
                      return (
                        <div
                          key={bucket.value}
                          className={`relative px-3 py-1.5 ${dark ? 'hover:bg-slate-700/50' : 'hover:bg-gray-50'}`}
                        >
                          {/* Bar background */}
                          <div
                            className="absolute left-0 top-0 bottom-0"
                            style={{ width: barW + '%', backgroundColor: barClr }}
                          />
                          {/* Content */}
                          <div className="relative flex items-start gap-2">
                            <span className={`flex-1 min-w-0 text-xs break-all leading-normal ${valCls}`}>
                              {bucket.value || <em className={pctCls}>(пусто)</em>}
                            </span>
                            <div className="flex items-center gap-1 flex-shrink-0 pt-0.5">
                              <span className={`text-xs tabular-nums w-8 text-right ${pctCls}`}>{pct}%</span>
                              <button
                                onClick={() => onInclude(fieldName, bucket.value)}
                                className={`p-0.5 rounded transition-colors cursor-pointer ${
                                  dark
                                    ? 'text-slate-500 hover:text-emerald-400 hover:bg-emerald-500/20'
                                    : 'text-gray-400 hover:text-emerald-600 hover:bg-emerald-50'
                                }`}
                                title={`Включить: ${bucket.value}`}
                              >
                                <IconPlus cls="w-3 h-3" />
                              </button>
                              <button
                                onClick={() => onExclude(fieldName, bucket.value)}
                                className={`p-0.5 rounded transition-colors cursor-pointer ${
                                  dark
                                    ? 'text-slate-500 hover:text-red-400 hover:bg-red-500/20'
                                    : 'text-gray-400 hover:text-red-500 hover:bg-red-50'
                                }`}
                                title={`Исключить: ${bucket.value}`}
                              >
                                <IconMinus cls="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )
              })()
        )}
      </div>
    </div>,
    document.body,
  )
}

// ─── FieldItem ────────────────────────────────────────────────────────────────

interface FieldItemProps {
  field: Field
  freq: number   // 0..1
  pinned: boolean
  dark: boolean
  active: ActivePicker
  onActivate: (name: string, op: 'IS' | 'IS NOT') => void
  onClose: () => void
  onInclude: (name: string, value: string) => void
  onExclude: (name: string, value: string) => void
  onPin: (name: string) => void
  onUnpin: (name: string) => void
  onFetchTopValues: (fieldName: string) => Promise<FieldValuesResponse>
}

function FieldItem({
  field, freq, pinned, dark, active,
  onActivate, onClose, onInclude, onExclude, onPin, onUnpin, onFetchTopValues,
}: FieldItemProps) {
  const name = field.name ?? ''
  const isActive = active?.name === name
  const pct = Math.round(freq * 100)

  const [inputVal, setInputVal] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const rowRef   = useRef<HTMLDivElement>(null)

  // Top values state
  const [tvOpen,    setTvOpen]    = useState(false)
  const [tvLoading, setTvLoading] = useState(false)
  const [tvError,   setTvError]   = useState<string | null>(null)
  const [tvBuckets, setTvBuckets] = useState<FieldValuesBucket[] | null>(null)
  const [tvTotal,   setTvTotal]   = useState(0)

  useEffect(() => {
    if (isActive) {
      setInputVal('')
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [isActive])

  function submitValue(val: string) {
    if (!val.trim()) return
    if (active?.operator === 'IS') onInclude(name, val.trim())
    else onExclude(name, val.trim())
    onClose()
  }

  async function handleMagnifier() {
    if (tvOpen) {
      setTvOpen(false)
      return
    }
    // Close the IS/IS NOT picker if it's open
    if (isActive) onClose()
    setTvOpen(true)
    setTvLoading(true)
    setTvError(null)
    setTvBuckets(null)
    try {
      const res = await onFetchTopValues(name)
      setTvBuckets(res.buckets)
      setTvTotal(res.totalDocCount)
    } catch {
      setTvError('Не удалось загрузить данные')
    } finally {
      setTvLoading(false)
    }
  }

  function handleActivate(n: string, op: 'IS' | 'IS NOT') {
    setTvOpen(false)  // close top values if open
    onActivate(n, op)
  }

  const rowBg  = dark ? 'hover:bg-slate-800' : 'hover:bg-gray-50'
  const btnCls = (color: string) =>
    `p-0.5 rounded cursor-pointer transition-colors ${dark ? `text-slate-600 hover:${color} hover:bg-slate-700` : `text-gray-400 hover:${color} hover:bg-gray-100`}`
  const chipCls = (selected: boolean) =>
    `px-2 py-0.5 rounded text-xs cursor-pointer transition-colors select-none ${
      selected
        ? 'bg-blue-600 text-white'
        : dark ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
    }`

  return (
    <div ref={rowRef} className={`group ${rowBg} transition-colors`}>
      {/* Field row */}
      <div className="relative flex items-center gap-1 px-3 py-1.5 cursor-default">
        {/* Frequency bar background */}
        {freq > 0 && (
          <div
            className={`absolute left-0 top-0 bottom-0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none ${dark ? 'bg-blue-900/30' : 'bg-blue-50'}`}
            style={{ width: `${pct}%` }}
          />
        )}

        {/* Field name */}
        <span
          className={`flex-1 min-w-0 text-xs truncate relative z-10 ${dark ? 'text-slate-300' : 'text-gray-700'}`}
          title={field.description ?? name}
        >
          {name}
        </span>

        {/* Frequency % — visible on hover */}
        {freq > 0 && (
          <span className={`text-xs tabular-nums opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 relative z-10 ${dark ? 'text-slate-500' : 'text-gray-400'}`}>
            {pct}%
          </span>
        )}

        {/* Action buttons — visible on hover */}
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 relative z-10">
          <button
            onClick={() => isActive && active?.operator === 'IS' ? onClose() : handleActivate(name, 'IS')}
            className={btnCls('text-emerald-500')}
            title="Добавить фильтр (включить)"
          >
            <IconPlus cls="w-3 h-3" />
          </button>
          <button
            onClick={() => isActive && active?.operator === 'IS NOT' ? onClose() : handleActivate(name, 'IS NOT')}
            className={btnCls('text-red-500')}
            title="Добавить фильтр (исключить)"
          >
            <IconMinus cls="w-3 h-3" />
          </button>
          <button
            onClick={handleMagnifier}
            className={`p-0.5 rounded cursor-pointer transition-colors ${
              tvOpen
                ? 'text-blue-500'
                : dark ? 'text-slate-600 hover:text-blue-400 hover:bg-slate-700' : 'text-gray-400 hover:text-blue-500 hover:bg-gray-100'
            }`}
            title="Топ значений поля"
          >
            <IconSearch cls="w-3 h-3" />
          </button>
          <button
            onClick={() => pinned ? onUnpin(name) : onPin(name)}
            className={`p-0.5 rounded cursor-pointer transition-colors ${
              pinned
                ? 'text-blue-500'
                : dark ? 'text-slate-600 hover:text-blue-400 hover:bg-slate-700' : 'text-gray-400 hover:text-blue-500 hover:bg-gray-100'
            }`}
            title={pinned ? 'Открепить колонку' : 'Закрепить как колонку'}
          >
            <IconPin cls="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Top values panel — portal overlay */}
      {tvOpen && (
        <TopValuesPanel
          dark={dark}
          loading={tvLoading}
          error={tvError}
          buckets={tvBuckets}
          totalDocCount={tvTotal}
          fieldName={name}
          anchorRef={rowRef}
          onClose={() => setTvOpen(false)}
          onInclude={onInclude}
          onExclude={onExclude}
        />
      )}

      {/* Value picker — shown when active (IS / IS NOT filter) */}
      {isActive && (
        <div className={`mx-3 mb-2 rounded-lg border overflow-hidden ${dark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'}`}>
          {/* Header */}
          <div className={`px-2 py-1 text-xs border-b ${dark ? 'text-slate-400 border-slate-700' : 'text-gray-500 border-gray-100'}`}>
            {active?.operator === 'IS' ? 'Включить' : 'Исключить'}: <span className="font-medium">{name}</span>
          </div>

          {/* Options list */}
          {field.options && field.options.length > 0 ? (
            <div className="p-2 flex flex-wrap gap-1">
              {field.options.map(opt => (
                <button
                  key={opt}
                  onClick={() => submitValue(opt)}
                  className={chipCls(false)}
                >
                  {opt}
                </button>
              ))}
            </div>
          ) : (
            /* Free-text input */
            <div className="p-2 flex gap-1">
              <input
                ref={inputRef}
                type={field.controlType === 'datetime' ? 'datetime-local' : 'text'}
                value={inputVal}
                onChange={e => setInputVal(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') submitValue(inputVal)
                  if (e.key === 'Escape') onClose()
                }}
                placeholder="Значение..."
                className={`flex-1 min-w-0 text-xs px-2 py-1 rounded border outline-none ${
                  dark
                    ? 'bg-slate-900 border-slate-600 text-white placeholder-slate-600 focus:border-blue-500'
                    : 'bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-400 focus:border-blue-400'
                }`}
              />
              <button
                onClick={() => submitValue(inputVal)}
                disabled={!inputVal.trim()}
                className="px-2 py-1 rounded text-xs font-medium bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
              >
                ОК
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

export default function Sidebar({
  dark, fields, fieldFrequency, pinnedFields, isLoading,
  onInclude, onExclude, onPin, onUnpin, onFetchTopValues,
}: Props) {
  const [activePicker, setActivePicker] = useState<ActivePicker>(null)

  // Sort: pinned first, then by frequency desc, then alphabetically
  const sorted = useMemo(() => {
    return [...fields].sort((a, b) => {
      const an = a.name ?? '', bn = b.name ?? ''
      const ap = pinnedFields.includes(an) ? 1 : 0
      const bp = pinnedFields.includes(bn) ? 1 : 0
      if (ap !== bp) return bp - ap
      const af = fieldFrequency[an] ?? 0
      const bf = fieldFrequency[bn] ?? 0
      if (af !== bf) return bf - af
      return an.localeCompare(bn)
    })
  }, [fields, fieldFrequency, pinnedFields])

  // Close picker when clicking outside
  const containerRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!activePicker) return
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setActivePicker(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [activePicker])

  const borderCls = dark ? 'border-slate-700' : 'border-gray-200'
  const bgCls     = dark ? 'bg-slate-900'     : 'bg-white'
  const titleCls  = dark ? 'text-slate-400'   : 'text-gray-500'

  return (
    <aside
      ref={containerRef}
      className={`flex flex-col flex-shrink-0 w-52 border-r ${bgCls} ${borderCls} overflow-hidden`}
    >
      {/* Header */}
      <div className={`flex items-center justify-between px-3 py-2 border-b ${borderCls} flex-shrink-0`}>
        <span className={`text-xs font-semibold uppercase tracking-wide ${titleCls}`}>
          Поля
        </span>
        {isLoading && (
          <svg className={`w-3 h-3 animate-spin ${dark ? 'text-slate-500' : 'text-gray-400'}`}
            viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10"
              stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor"
              d="M4 12a8 8 0 018-8v8z" />
          </svg>
        )}
      </div>

      {/* Field count badge */}
      {sorted.length > 0 && (
        <div className={`px-3 py-1 text-xs border-b ${borderCls} ${dark ? 'text-slate-600' : 'text-gray-400'}`}>
          {sorted.length} {sorted.length === 1 ? 'поле' : sorted.length < 5 ? 'поля' : 'полей'}
        </div>
      )}

      {/* Fields list */}
      <div className="flex-1 overflow-y-auto">
        {sorted.length === 0 && !isLoading && (
          <p className={`px-3 py-4 text-xs text-center ${dark ? 'text-slate-600' : 'text-gray-400'}`}>
            Нет доступных полей
          </p>
        )}

        {sorted.map(field => (
          <FieldItem
            key={field.name}
            field={field}
            freq={fieldFrequency[field.name ?? ''] ?? 0}
            pinned={pinnedFields.includes(field.name ?? '')}
            dark={dark}
            active={activePicker}
            onActivate={(name, op) => setActivePicker({ name, operator: op })}
            onClose={() => setActivePicker(null)}
            onInclude={onInclude}
            onExclude={onExclude}
            onPin={onPin}
            onUnpin={onUnpin}
            onFetchTopValues={onFetchTopValues}
          />
        ))}
      </div>
    </aside>
  )
}
