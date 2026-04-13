import { useState, useRef, useEffect, useCallback } from 'react'
import type { LogEntry } from '@/types/api'

// ─── Constants ────────────────────────────────────────────────────────────────

const HIDDEN_FIELDS = new Set(['_id', '@timestamp', 'levelInt'])
// Special fields that have fixed rendering order and style when pinned
const SPECIAL_FIELDS = new Set(['level', 'appName', 'text'])

const MIN_COL_WIDTH = 48

const DEFAULT_COL_WIDTHS: Record<string, number> = {
  time:    192, // w-48
  level:    64, // w-16
  appName: 144, // w-36
  // custom pinned fields default to 112 (w-28), see getColWidth()
}

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
    const d = new Date(iso)
    if (isNaN(d.getTime())) return iso
    // Format in browser's local timezone using local-time getters
    const pad = (n: number, len = 2) => String(n).padStart(len, '0')
    return (
      `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
      `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`
    )
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

function IconX({ cls }: { cls: string }) {
  return (
    <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  )
}

// ─── ResizeHandle ─────────────────────────────────────────────────────────────

function ResizeHandle({ onResize, dark }: { onResize: (delta: number) => void; dark: boolean }) {
  const startXRef = useRef<number>(0)

  function handleMouseDown(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    startXRef.current = e.clientX

    function onMouseMove(ev: MouseEvent) {
      const delta = ev.clientX - startXRef.current
      startXRef.current = ev.clientX
      onResize(delta)
    }

    function onMouseUp() {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }

  return (
    <div
      onMouseDown={handleMouseDown}
      className={[
        'absolute right-0 top-0 bottom-0 w-1 cursor-col-resize z-10',
        'opacity-0 hover:opacity-100 transition-opacity',
        dark ? 'hover:bg-blue-500' : 'hover:bg-blue-400',
      ].join(' ')}
    />
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

// ─── JSON syntax highlighting ─────────────────────────────────────────────────

function JsonValue({ raw }: { raw: string }) {
  const t = raw.trimEnd().replace(/,$/, '')  // убираем запятую для определения типа
  if (t.startsWith('"'))         return <span className="text-emerald-400">{raw}</span>
  if (t === 'true' || t === 'false') return <span className="text-orange-400">{raw}</span>
  if (t === 'null')              return <span className="text-slate-500">{raw}</span>
  if (/^-?\d/.test(t))          return <span className="text-violet-400">{raw}</span>
  return <span className="text-slate-300">{raw}</span>
}

function JsonLine({ line }: { line: string }) {
  // Строка вида: <indent>"key": value[,]
  const m = line.match(/^(\s*)("(?:[^"\\]|\\.)*")(\s*:\s*)(.*?)(,?)$/)
  if (m) {
    const [, indent, key, colon, value, comma] = m
    return (
      <div>
        <span>{indent}</span>
        <span className="text-sky-400">{key}</span>
        <span className="text-slate-500">{colon}</span>
        <JsonValue raw={value + comma} />
      </div>
    )
  }
  // { } , или просто текст
  return <div className="text-slate-400">{line}</div>
}

function JsonView({ entries }: { entries: [string, unknown][] }) {
  const json = JSON.stringify(Object.fromEntries(entries), null, 2)
  const lines = json.split('\n')
  return (
    <pre className="font-mono text-xs leading-5 overflow-auto max-h-96 m-3 p-3 rounded-md bg-slate-950 border border-slate-700 whitespace-pre">
      {lines.map((line, i) => <JsonLine key={i} line={line} />)}
    </pre>
  )
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
  const [view, setView] = useState<'fields' | 'json'>('fields')
  const [copied, setCopied] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const entries = Object.entries(log)
    .filter(([k]) => !HIDDEN_FIELDS.has(k))
    .sort(([a], [b]) => a.localeCompare(b))

  const borderCls = dark ? 'border-slate-700' : 'border-gray-100'
  const bgCls     = dark ? 'bg-slate-950'     : 'bg-gray-50'
  const keyClsCls = dark ? 'text-slate-500'   : 'text-gray-400'
  const valCls    = dark ? 'text-slate-200'   : 'text-gray-800'

  function fieldBtnCls(hoverColor: string) {
    return `p-0.5 rounded cursor-pointer transition-colors ${
      dark
        ? `text-slate-700 hover:${hoverColor} hover:bg-slate-700`
        : `text-gray-300 hover:${hoverColor} hover:bg-gray-200`
    }`
  }

  function handleCopyJson() {
    navigator.clipboard.writeText(JSON.stringify(Object.fromEntries(entries), null, 2)).then(() => {
      setCopied(true)
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => setCopied(false), 2000)
    })
  }

  // Кнопка toggle
  function tabCls(active: boolean) {
    return [
      'px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer select-none',
      active
        ? dark ? 'bg-slate-600 text-white' : 'bg-gray-200 text-gray-900'
        : dark ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-700' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100',
    ].join(' ')
  }

  return (
    <div className={`border-t ${borderCls} ${bgCls}`}>

      {/* Шапка: заголовок | toggle | copy */}
      <div className={`flex items-center gap-3 px-4 py-1.5 border-b ${borderCls}`}>
        <span className={`text-xs font-medium flex-shrink-0 ${dark ? 'text-slate-500' : 'text-gray-400'}`}>
          Детали записи
        </span>

        {/* Toggle ≡ Поля / { } JSON */}
        <div className={[
          'flex rounded overflow-hidden flex-shrink-0',
          dark ? 'ring-1 ring-slate-600' : 'ring-1 ring-gray-300',
        ].join(' ')}>
          <button className={tabCls(view === 'fields')} onClick={() => setView('fields')}>
            ≡ Поля
          </button>
          <button className={tabCls(view === 'json')} onClick={() => setView('json')}>
            {'{ } JSON'}
          </button>
        </div>

        <div className="flex-1" />

        {/* Copy JSON */}
        <button
          onClick={handleCopyJson}
          className={[
            'flex items-center gap-1 text-xs px-2 h-6 rounded transition-colors cursor-pointer select-none border',
            copied
              ? 'text-emerald-500 border-emerald-600/50'
              : dark
                ? 'text-slate-400 border-slate-600 hover:text-slate-200 hover:bg-slate-700'
                : 'text-gray-500 border-gray-300 hover:text-gray-800 hover:bg-gray-100',
          ].join(' ')}
          title="Скопировать лог как JSON"
        >
          {copied ? (
            <>
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Copied
            </>
          ) : (
            <>
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Copy JSON
            </>
          )}
        </button>
      </div>

      {/* Тело: поля или JSON */}
      {view === 'fields' ? (
        <div className="px-4 py-3">
          {entries.map(([key, rawVal]) => {
            const val = formatValue(rawVal)
            const pinned = pinnedFields.includes(key)
            return (
              <div key={key} className="group flex items-start gap-2 py-0.5 min-h-[1.25rem]">
                <div className="flex items-center gap-0.5 flex-shrink-0 w-52">
                  <span className={`text-xs font-mono truncate leading-5 ${keyClsCls}`} title={key}>
                    {key}
                  </span>
                  <div className="flex items-center gap-0.5 ml-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => val && onInclude(key, val)}
                      disabled={!val}
                      className={fieldBtnCls('text-emerald-500')}
                      title="Добавить фильтр (включить)"
                    >
                      <IconPlus cls="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => val && onExclude(key, val)}
                      disabled={!val}
                      className={fieldBtnCls('text-red-500')}
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
                <span className={`text-xs font-mono flex-1 break-all leading-5 ${valCls}`}>
                  {val || <span className={dark ? 'text-slate-700' : 'text-gray-300'}>—</span>}
                </span>
              </div>
            )
          })}
        </div>
      ) : (
        <JsonView entries={entries} />
      )}
    </div>
  )
}

// ─── Log row ──────────────────────────────────────────────────────────────────

interface LogRowProps {
  log: LogEntry
  dark: boolean
  pinnedFields: string[]
  colWidths: Record<string, number>
  onInclude: (name: string, value: string) => void
  onExclude: (name: string, value: string) => void
  onPin: (name: string) => void
  onUnpin: (name: string) => void
}

function getColWidth(colWidths: Record<string, number>, col: string): number {
  return colWidths[col] ?? 112
}

function LogRow({ log, dark, pinnedFields, colWidths, onInclude, onExclude, onPin, onUnpin }: LogRowProps) {
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

  const hasLevel     = pinnedFields.includes('level')
  const hasAppName   = pinnedFields.includes('appName')
  const hasText      = pinnedFields.includes('text')
  const customPinned = pinnedFields.filter(f => !SPECIAL_FIELDS.has(f))

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

        {/* Level color bar — always visible as UX indicator */}
        <div
          className="w-0.5 self-stretch rounded-full flex-shrink-0"
          style={{ backgroundColor: levelColor }}
        />

        {/* Time — always fixed */}
        <span
          className={`text-xs font-mono flex-shrink-0 overflow-hidden ${timeCls}`}
          style={{ width: getColWidth(colWidths, 'time') + 'px' }}
        >
          {formatTime(log.localTime)}
        </span>

        {/* Level badge — shown only if pinned */}
        {hasLevel && (
          <span
            className="text-xs font-bold flex-shrink-0 text-center px-1.5 py-0.5 rounded overflow-hidden"
            style={{ width: getColWidth(colWidths, 'level') + 'px', color: levelColor, backgroundColor: levelBg }}
          >
            {log.level}
          </span>
        )}

        {/* AppName — shown only if pinned */}
        {hasAppName && (
          <span
            className={`text-xs flex-shrink-0 truncate ${appCls}`}
            style={{ width: getColWidth(colWidths, 'appName') + 'px' }}
            title={log.appName}
          >
            {log.appName ?? '—'}
          </span>
        )}

        {/* Custom pinned fields (non-special) */}
        {customPinned.map(field => (
          <span
            key={field}
            className={`text-xs flex-shrink-0 truncate ${appCls}`}
            style={{ width: getColWidth(colWidths, field) + 'px' }}
            title={formatValue(log[field])}
          >
            {formatValue(log[field]) || '—'}
          </span>
        ))}

        {/* Message — shown only if pinned, fills remaining space */}
        {hasText && (
          <span
            className={`text-xs flex-1 min-w-0 truncate ${textCls}`}
            title={log.text}
          >
            {log.text ?? ''}
          </span>
        )}
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
  const [colWidths, setColWidths] = useState<Record<string, number>>(DEFAULT_COL_WIDTHS)

  // Refs keep the latest values without triggering observer recreation
  const isLoadingMoreRef = useRef(isLoadingMore)
  isLoadingMoreRef.current = isLoadingMore
  const onLoadMoreRef = useRef(onLoadMore)
  onLoadMoreRef.current = onLoadMore

  const resizeCol = useCallback((col: string, delta: number) => {
    setColWidths(prev => ({
      ...prev,
      [col]: Math.max(MIN_COL_WIDTH, (prev[col] ?? 112) + delta),
    }))
  }, [])

  // Infinite scroll via IntersectionObserver.
  // Only depends on hasMore — callback and loading state are read via refs
  // to prevent the observer from being recreated (and firing again) on every
  // successful page load.
  useEffect(() => {
    const el = sentinelRef.current
    if (!el || !hasMore) return

    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && !isLoadingMoreRef.current) onLoadMoreRef.current()
      },
      { threshold: 0.1 },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [hasMore])

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

  const hasLevel     = pinnedFields.includes('level')
  const hasAppName   = pinnedFields.includes('appName')
  const hasText      = pinnedFields.includes('text')
  const customPinned = pinnedFields.filter(f => !SPECIAL_FIELDS.has(f))

  return (
    <div className="flex-1 flex flex-col overflow-hidden min-h-0">
      {/* Sticky header */}
      <div className={`flex items-center gap-2 px-3 py-1.5 border-b ${borderCls} ${headerBg} flex-shrink-0 select-none`}>
        <div className="w-3 flex-shrink-0" />  {/* chevron space */}
        <div className="w-0.5 flex-shrink-0" /> {/* level bar space */}

        {/* Time header */}
        <div
          className="relative flex-shrink-0"
          style={{ width: getColWidth(colWidths, 'time') + 'px' }}
        >
          <span className={`text-xs font-semibold uppercase tracking-wide ${headerText}`}>
            Время
          </span>
          <ResizeHandle onResize={d => resizeCol('time', d)} dark={dark} />
        </div>

        {/* Level header */}
        {hasLevel && (
          <div
            className="group relative flex-shrink-0"
            style={{ width: getColWidth(colWidths, 'level') + 'px' }}
          >
            <span className={`text-xs font-semibold uppercase tracking-wide block pr-5 ${headerText}`}>
              Уровень
            </span>
            <button
              onClick={e => { e.stopPropagation(); onUnpin('level') }}
              className={[
                'absolute right-2 top-1/2 -translate-y-1/2',
                'w-4 h-4 flex items-center justify-center rounded',
                'opacity-0 group-hover:opacity-100 transition-all duration-100 cursor-pointer',
                dark ? 'text-slate-600 hover:text-slate-200 hover:bg-slate-700'
                     : 'text-gray-400 hover:text-gray-700 hover:bg-gray-200',
              ].join(' ')}
              title="Убрать колонку"
            >
              <IconX cls="w-2.5 h-2.5" />
            </button>
            <ResizeHandle onResize={d => resizeCol('level', d)} dark={dark} />
          </div>
        )}

        {/* AppName header */}
        {hasAppName && (
          <div
            className="group relative flex-shrink-0"
            style={{ width: getColWidth(colWidths, 'appName') + 'px' }}
          >
            <span className={`text-xs font-semibold uppercase tracking-wide block pr-5 ${headerText}`}>
              Приложение
            </span>
            <button
              onClick={e => { e.stopPropagation(); onUnpin('appName') }}
              className={[
                'absolute right-2 top-1/2 -translate-y-1/2',
                'w-4 h-4 flex items-center justify-center rounded',
                'opacity-0 group-hover:opacity-100 transition-all duration-100 cursor-pointer',
                dark ? 'text-slate-600 hover:text-slate-200 hover:bg-slate-700'
                     : 'text-gray-400 hover:text-gray-700 hover:bg-gray-200',
              ].join(' ')}
              title="Убрать колонку"
            >
              <IconX cls="w-2.5 h-2.5" />
            </button>
            <ResizeHandle onResize={d => resizeCol('appName', d)} dark={dark} />
          </div>
        )}

        {/* Custom pinned field headers */}
        {customPinned.map(field => (
          <div
            key={field}
            className="group relative flex-shrink-0"
            style={{ width: getColWidth(colWidths, field) + 'px' }}
          >
            <span
              className={`text-xs font-semibold uppercase tracking-wide truncate block pr-5 ${headerText}`}
              title={field}
            >
              {field}
            </span>
            <button
              onClick={e => { e.stopPropagation(); onUnpin(field) }}
              className={[
                'absolute right-2 top-1/2 -translate-y-1/2',
                'w-4 h-4 flex items-center justify-center rounded',
                'opacity-0 group-hover:opacity-100 transition-all duration-100 cursor-pointer',
                dark ? 'text-slate-600 hover:text-slate-200 hover:bg-slate-700'
                     : 'text-gray-400 hover:text-gray-700 hover:bg-gray-200',
              ].join(' ')}
              title="Убрать колонку"
            >
              <IconX cls="w-2.5 h-2.5" />
            </button>
            <ResizeHandle onResize={d => resizeCol(field, d)} dark={dark} />
          </div>
        ))}

        {/* Message header — flex-1, no resize handle needed */}
        {hasText && (
          <div className="group relative flex-1 min-w-0">
            <span className={`text-xs font-semibold uppercase tracking-wide block pr-5 ${headerText}`}>
              Сообщение
            </span>
            <button
              onClick={e => { e.stopPropagation(); onUnpin('text') }}
              className={[
                'absolute right-2 top-1/2 -translate-y-1/2',
                'w-4 h-4 flex items-center justify-center rounded',
                'opacity-0 group-hover:opacity-100 transition-all duration-100 cursor-pointer',
                dark ? 'text-slate-600 hover:text-slate-200 hover:bg-slate-700'
                     : 'text-gray-400 hover:text-gray-700 hover:bg-gray-200',
              ].join(' ')}
              title="Убрать колонку"
            >
              <IconX cls="w-2.5 h-2.5" />
            </button>
          </div>
        )}
      </div>

      {/* Scrollable rows */}
      <div className="flex-1 overflow-y-auto">
        {logs.map(log => (
          <LogRow
            key={log._id}
            log={log}
            dark={dark}
            pinnedFields={pinnedFields}
            colWidths={colWidths}
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
