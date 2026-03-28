import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { FieldValuesBucket } from '@/types/api'

interface Props {
  dark: boolean
  fieldName: string
  loading: boolean
  error: string | null
  buckets: FieldValuesBucket[]
  totalDocCount: number
  onClose: () => void
  onInclude: (fieldName: string, value: string) => void
  onExclude: (fieldName: string, value: string) => void
}

const CHART_HEIGHT = 160  // px — высота области столбцов
const BAR_FIXED_W  = 40   // px — ширина столбца при >15 значений

function fmtCount(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M'
  if (n >= 1_000)     return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'k'
  return String(n)
}

export default function ExploreFieldModal({
  dark, fieldName, loading, error, buckets, totalDocCount,
  onClose, onInclude, onExclude,
}: Props) {
  const [activeIdx, setActiveIdx] = useState<number | null>(null)
  const listRefs = useRef<(HTMLDivElement | null)[]>([])

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  // Scroll active list item into view
  useEffect(() => {
    if (activeIdx == null) return
    listRefs.current[activeIdx]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [activeIdx])

  const maxCount   = buckets.length > 0 ? Math.max(...buckets.map(b => b.docCount)) : 1
  const manyValues = buckets.length > 15

  // ── Palette ──────────────────────────────────────────────────────────────────

  const COLORS = [
    '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
    '#06B6D4', '#F97316', '#EC4899', '#84CC16', '#6366F1',
  ]
  const barColor = (i: number, isActive: boolean) => {
    const base = COLORS[i % COLORS.length]
    return isActive ? base : base + (dark ? '99' : 'BB')
  }

  // ── Theme classes ─────────────────────────────────────────────────────────────

  const modalBg    = dark ? 'bg-slate-900 border-slate-700 shadow-black/60' : 'bg-white border-gray-200 shadow-gray-400/30'
  const headBorder = dark ? 'border-slate-700' : 'border-gray-200'
  const titleCls   = dark ? 'text-white'     : 'text-gray-900'
  const subCls     = dark ? 'text-slate-400' : 'text-gray-500'
  const closeCls   = dark
    ? 'text-slate-400 hover:text-white hover:bg-slate-700'
    : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100'
  const chartBg    = dark ? 'bg-slate-800/50'   : 'bg-gray-50'
  const axisLine   = dark ? 'border-slate-700'  : 'border-gray-200'
  const labelCls   = dark ? 'text-slate-500'    : 'text-gray-400'
  const skelCls    = dark ? 'bg-slate-800'      : 'bg-gray-100'
  const rowHover   = dark ? 'hover:bg-slate-800/60' : 'hover:bg-gray-50'
  const rowActive  = dark ? 'bg-slate-800'          : 'bg-blue-50/60'
  const valCls     = dark ? 'text-slate-200'    : 'text-gray-800'
  const metaCls    = dark ? 'text-slate-500'    : 'text-gray-400'
  const divider    = dark ? 'divide-slate-800'  : 'divide-gray-100'

  return createPortal(
    <div
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
      onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className={`w-[640px] max-h-[85vh] flex flex-col rounded-xl border shadow-2xl ${modalBg}`}>

        {/* ── Header ────────────────────────────────────────────────────── */}
        <div className={`flex items-start justify-between px-5 py-3.5 border-b flex-shrink-0 ${headBorder}`}>
          <div className="min-w-0 pr-3">
            <div className={`text-sm font-semibold truncate ${titleCls}`}>{fieldName}</div>
            <div className={`text-xs mt-0.5 flex flex-wrap gap-x-2 ${subCls}`}>
              <span>Топ значений по всему диапазону</span>
              {totalDocCount > 0 && (
                <span className="tabular-nums">· {totalDocCount.toLocaleString('ru-RU')} документов</span>
              )}
              {!loading && !error && buckets.length > 0 && (
                <span className="tabular-nums">· {buckets.length} значений</span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className={`flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-lg transition-colors cursor-pointer ${closeCls}`}
            title="Закрыть (Esc)"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* ── Loading skeleton ──────────────────────────────────────────── */}
        {loading && (
          <div className="flex-1 p-5 flex flex-col gap-4">
            <div className={`rounded-lg p-4 ${chartBg}`}>
              <div className="flex items-end gap-2 h-32">
                {[80, 55, 65, 40, 70, 30, 50].map((h, i) => (
                  <div key={i} className={`flex-1 rounded-t animate-pulse ${skelCls}`} style={{ height: h + '%' }} />
                ))}
              </div>
            </div>
            <div className="space-y-2">
              {[75, 55, 42].map((w, i) => (
                <div key={i} className={`h-8 rounded animate-pulse ${skelCls}`} style={{ width: w + '%' }} />
              ))}
            </div>
          </div>
        )}

        {/* ── Error ─────────────────────────────────────────────────────── */}
        {!loading && error && (
          <p className="text-xs text-red-500 px-5 py-4">{error}</p>
        )}

        {/* ── No data ───────────────────────────────────────────────────── */}
        {!loading && !error && buckets.length === 0 && (
          <p className={`text-xs px-5 py-4 ${subCls}`}>Нет данных</p>
        )}

        {/* ── Chart + List ──────────────────────────────────────────────── */}
        {!loading && !error && buckets.length > 0 && (
          <div className="flex-1 flex flex-col overflow-hidden min-h-0">

            {/* Bar chart */}
            <div className={`flex-shrink-0 px-4 pt-4 pb-2 border-b ${headBorder}`}>
              <div className={`rounded-lg px-3 pt-3 pb-0 border ${axisLine} ${chartBg} overflow-x-auto`}>
                <div
                  className="flex items-end gap-1"
                  style={{
                    height: CHART_HEIGHT + 'px',
                    minWidth: manyValues ? buckets.length * (BAR_FIXED_W + 4) + 'px' : undefined,
                  }}
                >
                  {buckets.map((bucket, i) => {
                    const isActive = activeIdx === i
                    const barH = Math.max(4, (bucket.docCount / maxCount) * (CHART_HEIGHT - 40))
                    const pct  = totalDocCount > 0 ? Math.round(bucket.docCount / totalDocCount * 100) : 0
                    const color = barColor(i, isActive)

                    return (
                      <button
                        key={bucket.value}
                        onClick={() => setActiveIdx(isActive ? null : i)}
                        title={`${bucket.value}: ${bucket.docCount.toLocaleString('ru-RU')} (${pct}%)`}
                        className="flex flex-col items-center justify-end cursor-pointer outline-none"
                        style={{
                          width: manyValues ? BAR_FIXED_W + 'px' : undefined,
                          flex: manyValues ? '0 0 auto' : '1 1 0',
                          height: '100%',
                        }}
                      >
                        {/* Count label above bar */}
                        <span
                          className="text-[10px] tabular-nums mb-0.5 leading-none transition-opacity"
                          style={{ color, opacity: isActive ? 1 : 0.75 }}
                        >
                          {fmtCount(bucket.docCount)}
                        </span>

                        {/* Bar */}
                        <div
                          className="w-full rounded-t transition-all duration-150"
                          style={{
                            height: barH + 'px',
                            backgroundColor: color,
                            opacity: isActive ? 1 : 0.75,
                          }}
                        />

                        {/* Value label below bar */}
                        <span
                          className={`block w-full text-center text-[10px] mt-1 truncate leading-tight transition-colors ${labelCls}`}
                          style={{ color: isActive ? color : undefined }}
                          title={bucket.value}
                        >
                          {bucket.value || '(пусто)'}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Value list */}
            <div className={`flex-1 overflow-y-auto divide-y ${divider}`}>
              {buckets.map((bucket, i) => {
                const isActive = activeIdx === i
                const pct      = totalDocCount > 0 ? Math.round(bucket.docCount / totalDocCount * 100) : 0
                const color    = COLORS[i % COLORS.length]

                return (
                  <div
                    key={bucket.value}
                    ref={el => { listRefs.current[i] = el }}
                    onClick={() => setActiveIdx(isActive ? null : i)}
                    className={`flex items-center gap-3 px-4 py-2 cursor-pointer transition-colors ${isActive ? rowActive : rowHover}`}
                  >
                    {/* Color dot */}
                    <span className="flex-shrink-0 w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />

                    {/* Value */}
                    <span className={`flex-1 min-w-0 text-xs truncate ${valCls}`} title={bucket.value}>
                      {bucket.value || <em className={metaCls}>(пусто)</em>}
                    </span>

                    {/* Count + % */}
                    <span className={`text-xs tabular-nums flex-shrink-0 ${metaCls}`}>
                      {bucket.docCount.toLocaleString('ru-RU')}
                    </span>
                    <span className={`text-xs tabular-nums w-8 text-right flex-shrink-0 font-medium ${dark ? 'text-slate-400' : 'text-gray-600'}`}>
                      {pct}%
                    </span>

                    {/* Action buttons */}
                    <div className="flex gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => onInclude(fieldName, bucket.value)}
                        title={`Включить: ${bucket.value}`}
                        className={`w-5 h-5 flex items-center justify-center rounded transition-colors cursor-pointer ${
                          dark
                            ? 'text-slate-500 hover:text-emerald-400 hover:bg-emerald-500/20'
                            : 'text-gray-400 hover:text-emerald-600 hover:bg-emerald-50'
                        }`}
                      >
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                        </svg>
                      </button>
                      <button
                        onClick={() => onExclude(fieldName, bucket.value)}
                        title={`Исключить: ${bucket.value}`}
                        className={`w-5 h-5 flex items-center justify-center rounded transition-colors cursor-pointer ${
                          dark
                            ? 'text-slate-500 hover:text-red-400 hover:bg-red-500/20'
                            : 'text-gray-400 hover:text-red-500 hover:bg-red-50'
                        }`}
                      >
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4 12h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>

          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
