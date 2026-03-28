import { useState, useRef, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import type { Field, FieldValuesBucket, FieldValuesResponse } from '@/types/api'
import ExploreFieldModal from './ExploreFieldModal'

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
  loadedLogsCount: number
  onInclude: (fieldName: string, value: string) => void
  onExclude: (fieldName: string, value: string) => void
  onPin: (fieldName: string) => void
  onUnpin: (fieldName: string) => void
  onGetLocalTopValues: (fieldName: string) => FieldValuesBucket[]
  onFetchTopValues: (fieldName: string) => Promise<FieldValuesResponse>
}

// ─── Types ────────────────────────────────────────────────────────────────────

type ActivePicker = { name: string; operator: 'IS' | 'IS NOT' } | null

// ─── TopValues panel (portal overlay) ────────────────────────────────────────

interface TopValuesPanelProps {
  dark: boolean
  buckets: FieldValuesBucket[]
  totalDocCount: number
  fieldName: string
  loadedLogsCount: number
  anchorRef: React.RefObject<HTMLDivElement | null>
  onClose: () => void
  onInclude: (fieldName: string, value: string) => void
  onExclude: (fieldName: string, value: string) => void
  onExplore: () => void
}

function TopValuesPanel({
  dark, buckets, totalDocCount, fieldName, loadedLogsCount,
  anchorRef, onClose, onInclude, onExclude, onExplore,
}: TopValuesPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const [style, setStyle] = useState<React.CSSProperties>({
    position: 'fixed', top: 0, left: -9999, zIndex: 1000,
  })

  useEffect(() => {
    if (!anchorRef.current) return
    const rect = anchorRef.current.getBoundingClientRect()
    const panelWidth = 320
    const maxHeight = 400
    const vpH = window.innerHeight
    let top = rect.top
    if (top + maxHeight > vpH - 8) top = Math.max(8, vpH - maxHeight - 8)
    setStyle({ position: 'fixed', top, left: rect.right + 4, width: panelWidth, maxHeight, zIndex: 1000 })
  }, [anchorRef])

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (
        panelRef.current && !panelRef.current.contains(e.target as Node) &&
        anchorRef.current && !anchorRef.current.contains(e.target as Node)
      ) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose, anchorRef])

  const borderCls = dark ? 'border-slate-700' : 'border-gray-200'
  const bgCls     = dark ? 'bg-slate-800'     : 'bg-white'
  const headCls   = dark ? 'text-slate-400 border-slate-700' : 'text-gray-500 border-gray-100'
  const valCls    = dark ? 'text-slate-300'   : 'text-gray-700'
  const pctCls    = dark ? 'text-slate-500'   : 'text-gray-400'
  const noticeCls = dark ? 'text-amber-400/80 border-slate-700 bg-slate-900/60' : 'text-amber-600/80 border-gray-100 bg-amber-50/40'
  const barClr    = dark ? 'rgba(59,130,246,0.18)' : 'rgba(59,130,246,0.12)'

  const maxCount = buckets.length > 0 ? Math.max(...buckets.map(b => b.docCount), 1) : 1

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

      {/* Buckets */}
      <div className="overflow-y-auto flex-1">
        {buckets.length === 0
          ? <p className={`text-xs px-3 py-2 ${pctCls}`}>Нет данных в загруженных записях</p>
          : (() => {
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
                        <div
                          className="absolute left-0 top-0 bottom-0"
                          style={{ width: barW + '%', backgroundColor: barClr }}
                        />
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
        }
      </div>

      {/* Footer: disclaimer + Explore button */}
      <div className={`flex-shrink-0 border-t ${borderCls}`}>
        {loadedLogsCount > 0 && (
          <div className={`px-3 py-1.5 text-xs border-b flex items-center gap-1.5 ${noticeCls}`}>
            <svg className="w-3 h-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
            Данные из ~{loadedLogsCount.toLocaleString('ru-RU')} записей
          </div>
        )}
        <button
          onClick={onExplore}
          className={`w-full flex items-center justify-center gap-1.5 py-2 text-xs font-medium transition-colors cursor-pointer ${
            dark
              ? 'bg-blue-600 hover:bg-blue-500 text-white'
              : 'bg-blue-600 hover:bg-blue-700 text-white'
          }`}
        >
          <IconSearch cls="w-3.5 h-3.5" />
          Исследовать
          <svg className="w-3 h-3 ml-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>,
    document.body,
  )
}

// ─── FieldItem ────────────────────────────────────────────────────────────────

interface FieldItemProps {
  field: Field
  freq: number
  pinned: boolean
  dark: boolean
  active: ActivePicker
  loadedLogsCount: number
  onActivate: (name: string, op: 'IS' | 'IS NOT') => void
  onClose: () => void
  onInclude: (name: string, value: string) => void
  onExclude: (name: string, value: string) => void
  onPin: (name: string) => void
  onUnpin: (name: string) => void
  onGetLocalTopValues: (fieldName: string) => FieldValuesBucket[]
  onFetchTopValues: (fieldName: string) => Promise<FieldValuesResponse>
}

function FieldItem({
  field, freq, pinned, dark, active, loadedLogsCount,
  onActivate, onClose, onInclude, onExclude, onPin, onUnpin,
  onGetLocalTopValues, onFetchTopValues,
}: FieldItemProps) {
  const name     = field.name ?? ''
  const isActive = active?.name === name
  const pct      = Math.round(freq * 100)

  const [inputVal, setInputVal] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const rowRef   = useRef<HTMLDivElement>(null)

  // Local top-values panel
  const [tvOpen,    setTvOpen]    = useState(false)
  const [tvBuckets, setTvBuckets] = useState<FieldValuesBucket[]>([])
  const [tvTotal,   setTvTotal]   = useState(0)

  // Full explore modal
  const [exploreOpen,    setExploreOpen]    = useState(false)
  const [exploreLoading, setExploreLoading] = useState(false)
  const [exploreError,   setExploreError]   = useState<string | null>(null)
  const [exploreBuckets, setExploreBuckets] = useState<FieldValuesBucket[]>([])
  const [exploreTotal,   setExploreTotal]   = useState(0)

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

  function handleMagnifier() {
    if (tvOpen) {
      setTvOpen(false)
      return
    }
    if (isActive) onClose()
    // Compute top values from already loaded logs — synchronous, no backend call
    const buckets = onGetLocalTopValues(name)
    setTvBuckets(buckets)
    setTvTotal(loadedLogsCount)
    setTvOpen(true)
  }

  function handleActivate(n: string, op: 'IS' | 'IS NOT') {
    setTvOpen(false)
    onActivate(n, op)
  }

  async function handleExplore() {
    setExploreBuckets([])
    setExploreTotal(0)
    setExploreError(null)
    setExploreLoading(true)
    setExploreOpen(true)
    try {
      const res = await onFetchTopValues(name)
      setExploreBuckets(res.buckets ?? [])
      setExploreTotal(res.buckets?.reduce((s, b) => s + b.docCount, 0) ?? 0)
    } catch (e) {
      setExploreError(e instanceof Error ? e.message : 'Ошибка загрузки')
    } finally {
      setExploreLoading(false)
    }
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
        {freq > 0 && (
          <div
            className={`absolute left-0 top-0 bottom-0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none ${dark ? 'bg-blue-900/30' : 'bg-blue-50'}`}
            style={{ width: `${pct}%` }}
          />
        )}

        <span
          className={`flex-1 min-w-0 text-xs truncate relative z-10 ${dark ? 'text-slate-300' : 'text-gray-700'}`}
          title={field.description ?? name}
        >
          {name}
        </span>

        {freq > 0 && (
          <span className={`text-xs tabular-nums opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 relative z-10 ${dark ? 'text-slate-500' : 'text-gray-400'}`}>
            {pct}%
          </span>
        )}

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
            title="Топ значений (из загруженных записей)"
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

      {/* Local top-values panel */}
      {tvOpen && (
        <TopValuesPanel
          dark={dark}
          buckets={tvBuckets}
          totalDocCount={tvTotal}
          fieldName={name}
          loadedLogsCount={loadedLogsCount}
          anchorRef={rowRef}
          onClose={() => setTvOpen(false)}
          onInclude={onInclude}
          onExclude={onExclude}
          onExplore={handleExplore}
        />
      )}

      {/* Full explore modal */}
      {exploreOpen && (
        <ExploreFieldModal
          dark={dark}
          fieldName={name}
          loading={exploreLoading}
          error={exploreError}
          buckets={exploreBuckets}
          totalDocCount={exploreTotal}
          onClose={() => setExploreOpen(false)}
          onInclude={onInclude}
          onExclude={onExclude}
        />
      )}

      {/* Value picker (IS / IS NOT) */}
      {isActive && (
        <div className={`mx-3 mb-2 rounded-lg border overflow-hidden ${dark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'}`}>
          <div className={`px-2 py-1 text-xs border-b ${dark ? 'text-slate-400 border-slate-700' : 'text-gray-500 border-gray-100'}`}>
            {active?.operator === 'IS' ? 'Включить' : 'Исключить'}: <span className="font-medium">{name}</span>
          </div>

          {field.options && field.options.length > 0 ? (
            <div className="p-2 flex flex-wrap gap-1">
              {field.options.map(opt => (
                <button key={opt} onClick={() => submitValue(opt)} className={chipCls(false)}>
                  {opt}
                </button>
              ))}
            </div>
          ) : (
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
  dark, fields, fieldFrequency, pinnedFields, isLoading, loadedLogsCount,
  onInclude, onExclude, onPin, onUnpin, onGetLocalTopValues, onFetchTopValues,
}: Props) {
  const [activePicker, setActivePicker] = useState<ActivePicker>(null)

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
      <div className={`flex items-center justify-between px-3 py-2 border-b ${borderCls} flex-shrink-0`}>
        <span className={`text-xs font-semibold uppercase tracking-wide ${titleCls}`}>Поля</span>
        {isLoading && (
          <svg className={`w-3 h-3 animate-spin ${dark ? 'text-slate-500' : 'text-gray-400'}`}
            viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
          </svg>
        )}
      </div>

      {sorted.length > 0 && (
        <div className={`px-3 py-1 text-xs border-b ${borderCls} ${dark ? 'text-slate-600' : 'text-gray-400'}`}>
          {sorted.length} {sorted.length === 1 ? 'поле' : sorted.length < 5 ? 'поля' : 'полей'}
        </div>
      )}

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
            loadedLogsCount={loadedLogsCount}
            onActivate={(name, op) => setActivePicker({ name, operator: op })}
            onClose={() => setActivePicker(null)}
            onInclude={onInclude}
            onExclude={onExclude}
            onPin={onPin}
            onUnpin={onUnpin}
            onGetLocalTopValues={onGetLocalTopValues}
            onFetchTopValues={onFetchTopValues}
          />
        ))}
      </div>
    </aside>
  )
}
