import { useState, useRef, useEffect } from 'react'
import type { LogEntry } from '@/types/api'

// ─── Constants ────────────────────────────────────────────────────────────────

const HIDDEN_FIELDS = new Set(['_id', '@timestamp', 'levelInt'])

function getLevelColor(level: string): string {
  const colors: Record<string, string> = {
    TRACE:    '#9CA3AF',
    DEBUG:    '#60A5FA',
    INFO:     '#34D399',
    WARN:     '#FBBF24',
    ERROR:    '#F87171',
    CRITICAL: '#F97316',
    FATAL:    '#7C3AED',
  }
  return colors[level] ?? '#9CA3AF'
}

function formatTime(iso: string | undefined): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toISOString().replace('T', ' ').slice(0, 23)
  } catch {
    return iso
  }
}

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return ''
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function IconChevron({ cls, open }: { cls: string; open: boolean }) {
  return (
    <svg
      className={`${cls} transition-transform duration-150 ${open ? 'rotate-90' : ''}`}
      viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
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

function IconPin({ cls }: { cls: string }) {
  return (
    <svg className={cls} viewBox="0 0 24 24" fill="currentColor">
      <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z" />
    </svg>
  )
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  dark: boolean
  logs: LogEntry[]
  pinnedFields: string[]
  hasMore: boolean
  isLoadingMore: boolean
  onLoadMore: () => void
  onInclude: (fieldName: string, value: string) => void
  onExclude: (fieldName: string, value: string) => void
  onPin: (fieldName: string) => void
  onUnpin: (fieldName: string) => void
}

// ─── Expanded row ─────────────────────────────────────────────────────────────

interface ExpandedRowProps {
  log: LogEntry
  dark: boolean
  pinnedFields: string[]
  onInclude: (name: string, value: string) => void
  onExclude: (name: string, value: string) => void
  onPin: (name: string) => void
  onUnpin: (name: string) => void
}

function ExpandedRow({ log, dark, pinnedFields, onInclude, onExclude, onPin, onUnpin }: ExpandedRowProps) {
  const entries = Object.entries(log)
    .filter(([k]) => !HIDDEN_FIELDS.has(k))
    .sort(([a], [b]) => a.localeCompare(b))

  const borderCls  = dark ? 'border-slate-700'  : 'border-gray-100'
  const bgCls      = dark ? 'bg-slate-950'       : 'bg-gray-50'
  const keyClsCls  = dark ? 'text-slate-500'     : 'text-gray-400'
  const valCls     = dark ? 'text-slate-200'     : 'text-gray-800'

  function btnCls(hoverColor: string) {
    return `p-0.5 rounded cursor-pointer transition-colors ${
      dark
        ? `text-slate-700 hover:${hoverColor} hover:bg-slate-700`
        : `text-gray-300 hover:${hoverColor} hover:bg-gray-200`
    }`
  }

  return (
    <div className={`px-4 py-3 border-t ${borderCls} ${bgCls}`}>
      {entries.map(([key, rawVal]) => {
        const val = formatValue(rawVal)
        const pinned = pinnedFields.includes(key)
        return (
          <div key={key} className="group flex items-start gap-2 py-0.5 min-h-[1.25rem]">
            {/* Key + Action buttons side by side */}
            <div className="flex items-center gap-0.5 flex-shrink-0 w-52">
              <span
                className={`text-xs font-mono truncate leading-5 ${keyClsCls}`}
                title={key}
              >
                {key}
              </span>
              {/* Action buttons — visible on row hover */}
              <div className="flex items-center gap-0.5 ml-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => val && onInclude(key, val)}
                  disabled={!val}
                  className={btnCls('text-emerald-500')}
                  title="Добавить фильтр (включить)"
                >
                  <IconPlus cls="w-3 h-3" />
                </button>
                <button
                  onClick={() => val && onExclude(key, val)}
                  disabled={!val}
                  className={btnCls('text-red-500')}
                  title="Добавить фильтр (исключить)"
                >
                  <IconMinus cls="w-3 h-3" />
                </button>
                <button
                  onClick={() => pinned ? onUnpin(key) : onPin(key)}
                  className={`p-0.5 rounded cursor-pointer transition-colors ${
                    pinned
                      ? 'text-blue-500'
                      : dark
                      ? 'text-slate-700 hover:text-blue-400 hover:bg-slate-700'
                      : 'text-gray-300 hover:text-blue-500 hover:bg-gray-200'
                  }`}
                  title={pinned ? 'Открепить колонку' : 'Закрепить как колонку'}
                >
                  <IconPin cls="w-3 h-3" />
                </button>
              </div>
            </div>

            {/* Value */}
            <span className={`text-xs font-mono flex-1 break-all leading-5 ${valCls}`}>
              {val || <span className={dark ? 'text-slate-700' : 'text-gray-300'}>—</span>}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ─── Log row ──────────────────────────────────────────────────────────────────

interface LogRowProps {
  log: LogEntry
  dark: boolean
  pinnedFields: string[]
  onInclude: (name: string, value: string) => void
  onExclude: (name: string, value: string) => void
  onPin: (name: string) => void
  onUnpin: (name: string) => void
}

function LogRow({ log, dark, pinnedFields, onInclude, onExclude, onPin, onUnpin }: LogRowProps) {
  const [expanded, setExpanded] = useState(false)

  const levelColor = getLevelColor(log.level)
  // 33 in hex = 51 decimal = 20% opacity
  const levelBg = levelColor + '33'

  const rowBg = dark
    ? expanded ? 'bg-slate-800' : 'hover:bg-slate-800/60'
    : expanded ? 'bg-blue-50/40' : 'hover:bg-gray-50'

  const borderCls = dark ? 'border-slate-800' : 'border-gray-100'
  const timeCls   = dark ? 'text-slate-400'   : 'text-gray-500'
  const appCls    = dark ? 'text-slate-300'   : 'text-gray-700'
  const textCls   = dark ? 'text-slate-500'   : 'text-gray-500'

  return (
    <div className={`border-b ${borderCls}`}>
      {/* Main collapsed row */}
      <div
        className={`flex items-center px-3 py-1.5 cursor-pointer gap-2 transition-colors ${rowBg}`}
        onClick={() => setExpanded(e => !e)}
      >
        {/* Expand chevron */}
        <IconChevron
          cls={`w-3 h-3 flex-shrink-0 ${dark ? 'text-slate-600' : 'text-gray-400'}`}
          open={expanded}
        />

        {/* Level color bar */}
        <div
          className="w-0.5 self-stretch rounded-full flex-shrink-0"
          style={{ backgroundColor: levelColor }}
        />

        {/* Time */}
        <span className={`text-xs font-mono w-48 flex-shrink-0 ${timeCls}`}>
          {formatTime(log.localTime)}
        </span>

        {/* Level badge */}
        <span
          className="text-xs font-bold w-16 flex-shrink-0 text-center px-1.5 py-0.5 rounded"
          style={{ color: levelColor, backgroundColor: levelBg }}
        >
          {log.level}
        </span>

        {/* AppName */}
        <span
          className={`text-xs w-36 flex-shrink-0 truncate ${appCls}`}
          title={log.appName}
        >
          {log.appName ?? '—'}
        </span>

        {/* Pinned fields */}
        {pinnedFields.map(field => (
          <span
            key={field}
            className={`text-xs w-28 flex-shrink-0 truncate ${appCls}`}
            title={formatValue(log[field])}
          >
            {formatValue(log[field]) || '—'}
          </span>
        ))}

        {/* Message — fills remaining space */}
        <span
          className={`text-xs flex-1 min-w-0 truncate ${textCls}`}
          title={log.text}
        >
          {log.text ?? ''}
        </span>
      </div>

      {/* Expanded content */}
      {expanded && (
        <ExpandedRow
          log={log}
          dark={dark}
          pinnedFields={pinnedFields}
          onInclude={onInclude}
          onExclude={onExclude}
          onPin={onPin}
          onUnpin={onUnpin}
        />
      )}
    </div>
  )
}

// ─── LogTable ─────────────────────────────────────────────────────────────────

export default function LogTable({
  dark, logs, pinnedFields,
  hasMore, isLoadingMore, onLoadMore,
  onInclude, onExclude, onPin, onUnpin,
}: Props) {
  const sentinelRef = useRef<HTMLDivElement>(null)

  // Infinite scroll via IntersectionObserver
  useEffect(() => {
    const el = sentinelRef.current
    if (!el || !hasMore) return

    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && !isLoadingMore) onLoadMore()
      },
      { threshold: 0.1 },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [hasMore, isLoadingMore, onLoadMore])

  const borderCls  = dark ? 'border-slate-700' : 'border-gray-200'
  const headerBg   = dark ? 'bg-slate-800'     : 'bg-gray-100'
  const headerText = dark ? 'text-slate-500'   : 'text-gray-500'

  if (!logs.length) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className={`text-sm ${dark ? 'text-slate-600' : 'text-gray-400'}`}>
          Нет данных для отображения
        </p>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden min-h-0">
      {/* Sticky header */}
      <div className={`flex items-center gap-2 px-3 py-1.5 border-b ${borderCls} ${headerBg} flex-shrink-0`}>
        <div className="w-3 flex-shrink-0" />  {/* chevron space */}
        <div className="w-0.5 flex-shrink-0" /> {/* level bar space */}
        <span className={`text-xs font-semibold uppercase tracking-wide w-48 flex-shrink-0 ${headerText}`}>
          Время
        </span>
        <span className={`text-xs font-semibold uppercase tracking-wide w-16 flex-shrink-0 text-center ${headerText}`}>
          Уровень
        </span>
        <span className={`text-xs font-semibold uppercase tracking-wide w-36 flex-shrink-0 ${headerText}`}>
          Приложение
        </span>
        {pinnedFields.map(field => (
          <span
            key={field}
            className={`text-xs font-semibold uppercase tracking-wide w-28 flex-shrink-0 truncate ${headerText}`}
            title={field}
          >
            {field}
          </span>
        ))}
        <span className={`text-xs font-semibold uppercase tracking-wide flex-1 ${headerText}`}>
          Сообщение
        </span>
      </div>

      {/* Scrollable rows */}
      <div className="flex-1 overflow-y-auto">
        {logs.map(log => (
          <LogRow
            key={log._id}
            log={log}
            dark={dark}
            pinnedFields={pinnedFields}
            onInclude={onInclude}
            onExclude={onExclude}
            onPin={onPin}
            onUnpin={onUnpin}
          />
        ))}

        {/* Infinite scroll sentinel / loading indicator */}
        {hasMore && (
          <div ref={sentinelRef} className="py-4 flex justify-center">
            {isLoadingMore && (
              <svg
                className={`w-5 h-5 animate-spin ${dark ? 'text-slate-500' : 'text-gray-400'}`}
                viewBox="0 0 24 24" fill="none"
              >
                <circle className="opacity-25" cx="12" cy="12" r="10"
                  stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
            )}
          </div>
        )}

        {!hasMore && logs.length > 0 && (
          <p className={`text-center py-3 text-xs ${dark ? 'text-slate-700' : 'text-gray-300'}`}>
            Все записи загружены ({logs.length})
          </p>
        )}
      </div>
    </div>
  )
}
