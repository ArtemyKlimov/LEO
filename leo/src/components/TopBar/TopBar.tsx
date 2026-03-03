import { useState, useRef, useEffect } from 'react'
import type { UserConfig } from '@/types/config'
import type { TimeRange } from '@/store/AppContext'
import DateRangePicker from '@/components/DateRangePicker/DateRangePicker'
import DataSourceToggle, { type DataSource } from './DataSourceToggle'
import ProjectCodePicker from '@/components/ProjectCodePicker/ProjectCodePicker'

// ─── Presets ──────────────────────────────────────────────────────────────────

export const TIME_PRESETS = [
  { label: '15m', minutes: 15 },
  { label: '30m', minutes: 30 },
  { label: '1h',  minutes: 60 },
  { label: '6h',  minutes: 360 },
  { label: '12h', minutes: 720 },
  { label: '24h', minutes: 1440 },
  { label: '7d',  minutes: 10_080 },
] as const

export const PRESET_LABELS: Record<number, string> = {
  15:    'Последние 15 минут',
  30:    'Последние 30 минут',
  60:    'Последний час',
  360:   'Последние 6 часов',
  720:   'Последние 12 часов',
  1440:  'Последние 24 часа',
  10080: 'Последние 7 дней',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatRange(range: TimeRange): string {
  if (range.label) return range.label
  const fmt = (d: Date) =>
    d.toLocaleString('ru-RU', {
      day: '2-digit', month: '2-digit',
      hour: '2-digit', minute: '2-digit',
    })
  return `${fmt(range.from)} — ${fmt(range.to)}`
}

// ─── SVG Icons ────────────────────────────────────────────────────────────────

function IconSearch({ cls }: { cls: string }) {
  return (
    <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
    </svg>
  )
}

function IconClose({ cls }: { cls: string }) {
  return (
    <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  )
}

function IconChevron({ cls }: { cls: string }) {
  return (
    <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  )
}

function IconDownload({ cls }: { cls: string }) {
  return (
    <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
  )
}

function IconSun({ cls }: { cls: string }) {
  return (
    <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M12 7a5 5 0 1 0 0 10A5 5 0 0 0 12 7z" />
    </svg>
  )
}

function IconMoon({ cls }: { cls: string }) {
  return (
    <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M20.354 15.354A9 9 0 0 1 8.646 3.646 9.003 9.003 0 0 0 12 21a9.003 9.003 0 0 0 8.354-5.646z" />
    </svg>
  )
}

function IconCalendar({ cls }: { cls: string }) {
  return (
    <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <rect x="3" y="4" width="18" height="18" rx="2" strokeLinecap="round" strokeLinejoin="round" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  )
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  dark: boolean
  user: UserConfig
  timeRange: TimeRange | null
  luceneQuery: string
  isLoading: boolean
  activePresetMinutes: number | null
  dataSource: DataSource
  availableProjectCodes: string[]
  selectedProjectCodes: string[]
  onPreset: (minutes: number) => void
  onLuceneChange: (q: string) => void
  onLuceneSearch: () => void
  onCustomRange: (from: Date, to: Date) => void
  onExport: (format: 'txt' | 'csv') => void
  onThemeToggle: () => void
  onLogout: () => void
  onDataSourceChange: (source: DataSource) => void
  onProjectCodesChange: (codes: string[]) => void
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function TopBar({
  dark,
  user,
  timeRange,
  luceneQuery,
  isLoading,
  activePresetMinutes,
  dataSource,
  availableProjectCodes,
  selectedProjectCodes,
  onPreset,
  onCustomRange,
  onLuceneChange,
  onLuceneSearch,
  onExport,
  onThemeToggle,
  onLogout,
  onDataSourceChange,
  onProjectCodesChange,
}: Props) {
  const [exportOpen, setExportOpen] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const exportRef = useRef<HTMLDivElement>(null)
  const pickerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!exportOpen) return
    function handler(e: MouseEvent) {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) {
        setExportOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [exportOpen])

  useEffect(() => {
    if (!pickerOpen) return
    function onMouse(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerOpen(false)
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setPickerOpen(false)
    }
    document.addEventListener('mousedown', onMouse)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onMouse)
      document.removeEventListener('keydown', onKey)
    }
  }, [pickerOpen])

  function openPicker() {
    setPickerOpen(true)
  }

  // ── Derived styles ───────────────────────────────────────────────────────────

  // Строка 1 — основная навигация
  const row1Bg = dark
    ? 'bg-slate-950 border-slate-700'
    : 'bg-white border-gray-200'

  // Строка 2 — action bar, заметно отличается от строки 1
  const row2Bg = dark
    ? 'bg-slate-800/90 border-slate-700'
    : 'bg-gray-50 border-gray-200'

  // Кнопка пресета
  const presetCls = (active: boolean) =>
    [
      'px-2.5 py-1 rounded text-xs font-medium transition-colors cursor-pointer select-none',
      'disabled:opacity-40 disabled:cursor-not-allowed',
      active
        ? 'bg-blue-600 text-white shadow-sm'
        : dark
          ? 'text-slate-400 hover:text-white hover:bg-slate-700'
          : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100',
    ].join(' ')

  // Кнопка-иконка (тема)
  const iconBtnCls = [
    'p-1.5 rounded transition-colors cursor-pointer',
    dark
      ? 'text-slate-400 hover:text-white hover:bg-slate-700'
      : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100',
  ].join(' ')

  // Маленькая текстовая кнопка
  const textBtnCls = [
    'px-2.5 py-1 rounded text-xs font-medium transition-colors cursor-pointer select-none',
    dark
      ? 'text-slate-400 hover:text-white hover:bg-slate-700'
      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100',
  ].join(' ')

  // Кнопка "Найти" — акцентная
  const searchBtnCls = [
    'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold',
    'transition-colors cursor-pointer select-none flex-shrink-0',
    'bg-blue-600 text-white hover:bg-blue-500 active:bg-blue-700',
    'disabled:opacity-50 disabled:cursor-not-allowed',
  ].join(' ')

  // Кнопка "Экспорт"
  const exportBtnCls = [
    'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium',
    'transition-colors cursor-pointer select-none flex-shrink-0',
    dark
      ? 'text-slate-300 bg-slate-700 hover:bg-slate-600 border border-slate-600'
      : 'text-gray-700 bg-white hover:bg-gray-50 border border-gray-300',
  ].join(' ')

  // Дропдаун экспорта
  const dropdownCls = [
    'absolute right-0 top-full mt-1 w-36 rounded-lg shadow-xl border z-50 overflow-hidden py-1',
    dark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200',
  ].join(' ')

  const dropdownItemCls = [
    'flex items-center gap-2 w-full text-left px-3 py-2 text-xs transition-colors cursor-pointer',
    dark ? 'text-slate-300 hover:bg-slate-700' : 'text-gray-700 hover:bg-gray-50',
  ].join(' ')

  // Разделитель
  const divider = (
    <span className={['w-px h-4 flex-shrink-0', dark ? 'bg-slate-700' : 'bg-gray-200'].join(' ')} />
  )

  // ── Row 1: Main navigation ───────────────────────────────────────────────────

  return (
    <header className="flex flex-col flex-shrink-0">

      {/* ── Строка 1: логотип, пресеты, диапазон, счётчик, тема, пользователь ── */}
      <div className={['flex items-center gap-2 px-4 h-10 border-b', row1Bg].join(' ')}>

        {/* Logo */}
        <span className="font-black text-blue-500 text-sm tracking-tight flex-shrink-0 mr-1">
          LEO
        </span>

        {divider}

        {/* Time presets + custom range picker */}
        <div className="relative flex items-center gap-0.5 flex-shrink-0" ref={pickerRef}>
          {TIME_PRESETS.map(({ label, minutes }) => (
            <button
              key={label}
              onClick={() => onPreset(minutes)}
              disabled={isLoading}
              className={presetCls(activePresetMinutes === minutes)}
            >
              {label}
            </button>
          ))}

          {/* Кнопка кастомного диапазона */}
          <button
            onClick={openPicker}
            disabled={isLoading}
            className={[
              'p-1 rounded transition-colors cursor-pointer disabled:opacity-40 ml-0.5',
              pickerOpen || activePresetMinutes === null
                ? dark
                  ? 'text-blue-400 bg-blue-500/20 ring-1 ring-blue-500/50'
                  : 'text-blue-600 bg-blue-50 ring-1 ring-blue-300'
                : dark
                  ? 'text-slate-400 hover:text-white hover:bg-slate-700'
                  : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100',
            ].join(' ')}
            title="Задать произвольный диапазон"
          >
            <IconCalendar cls="w-3.5 h-3.5" />
          </button>

          {/* Попап пикера — полноценный двухмесячный датапикер */}
          {pickerOpen && (
            <div className="absolute top-full left-0 mt-2 z-50">
              <DateRangePicker
                dark={dark}
                initialFrom={timeRange?.from}
                initialTo={timeRange?.to}
                onApply={(from, to) => {
                  onCustomRange(from, to)
                  setPickerOpen(false)
                }}
                onClose={() => setPickerOpen(false)}
              />
            </div>
          )}
        </div>

        {/* Active time range label */}
        {timeRange && (
          <>
            {divider}
            <span className={[
              'text-xs flex-shrink-0 tabular-nums',
              dark ? 'text-slate-400' : 'text-gray-500',
            ].join(' ')}>
              {formatRange(timeRange)}
            </span>
          </>
        )}

        {/* Spacer — раздвигает левую и правую группы */}
        <div className="flex-1" />

        {/* Project code picker */}
        {availableProjectCodes.length > 0 && (
          <>
            <ProjectCodePicker
              dark={dark}
              available={availableProjectCodes}
              selected={selectedProjectCodes}
              onChange={onProjectCodesChange}
            />
            {divider}
          </>
        )}

        {divider}

        {/* Data source toggle: OpenSearch / ClickHouse */}
        <DataSourceToggle
          value={dataSource}
          onChange={onDataSourceChange}
          dark={dark}
          disabled={isLoading}
        />

        {divider}

        {/* Theme toggle */}
        <button
          onClick={onThemeToggle}
          className={iconBtnCls}
          title={dark ? 'Светлая тема' : 'Тёмная тема'}
        >
          {dark
            ? <IconSun cls="w-4 h-4" />
            : <IconMoon cls="w-4 h-4" />
          }
        </button>

        {divider}

        {/* User ID */}
        <span className={[
          'text-xs font-medium flex-shrink-0 max-w-[120px] truncate',
          dark ? 'text-slate-300' : 'text-gray-700',
        ].join(' ')}
          title={user.userId}
        >
          {user.userId}
        </span>

        {/* Logout */}
        <button onClick={onLogout} className={textBtnCls}>
          Выйти
        </button>
      </div>

      {/* ── Строка 2: поиск + экспорт ────────────────────────────────────────── */}
      <div className={['flex items-center gap-2 px-4 h-11 border-b', row2Bg].join(' ')}>

        {/* Lucene search field — занимает всё свободное место */}
        <div className={[
          'flex items-center gap-2 flex-1 min-w-0 px-3 py-1.5 rounded-lg border transition-colors',
          dark
            ? 'bg-slate-900 border-slate-600 focus-within:border-blue-500'
            : 'bg-white border-gray-300 focus-within:border-blue-400',
        ].join(' ')}>
          <IconSearch cls={['w-3.5 h-3.5 flex-shrink-0', dark ? 'text-slate-500' : 'text-gray-400'].join(' ')} />
          <input
            type="text"
            value={luceneQuery}
            onChange={e => onLuceneChange(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && onLuceneSearch()}
            placeholder="Lucene query... (например: level:ERROR AND appName:auth-service)"
            className={[
              'flex-1 min-w-0 text-xs bg-transparent outline-none',
              dark
                ? 'text-white placeholder-slate-600'
                : 'text-gray-900 placeholder-gray-400',
            ].join(' ')}
          />
          {luceneQuery && (
            <button
              onClick={() => { onLuceneChange(''); onLuceneSearch() }}
              className={[
                'flex-shrink-0 cursor-pointer transition-colors',
                dark ? 'text-slate-500 hover:text-slate-300' : 'text-gray-400 hover:text-gray-600',
              ].join(' ')}
              title="Очистить"
            >
              <IconClose cls="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Search button */}
        <button
          onClick={onLuceneSearch}
          disabled={isLoading}
          className={searchBtnCls}
        >
          <IconSearch cls="w-3.5 h-3.5" />
          Найти
        </button>

        {/* Export dropdown */}
        <div className="relative flex-shrink-0" ref={exportRef}>
          <button
            onClick={() => setExportOpen(o => !o)}
            className={exportBtnCls}
          >
            <IconDownload cls="w-3.5 h-3.5" />
            Экспорт
            <IconChevron cls={['w-3 h-3 transition-transform', exportOpen ? 'rotate-180' : ''].join(' ')} />
          </button>

          {exportOpen && (
            <div className={dropdownCls}>
              {(['txt', 'csv'] as const).map(fmt => (
                <button
                  key={fmt}
                  onClick={() => { onExport(fmt); setExportOpen(false) }}
                  className={dropdownItemCls}
                >
                  <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24"
                    stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round"
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Скачать .{fmt}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
