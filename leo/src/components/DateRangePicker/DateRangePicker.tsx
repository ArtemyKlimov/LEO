import { useState } from 'react'

// ─── Pure date helpers ────────────────────────────────────────────────────────

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

function isAfterDay(a: Date, b: Date): boolean {
  const ad = new Date(a.getFullYear(), a.getMonth(), a.getDate())
  const bd = new Date(b.getFullYear(), b.getMonth(), b.getDate())
  return ad > bd
}

function isBeforeDay(a: Date, b: Date): boolean {
  const ad = new Date(a.getFullYear(), a.getMonth(), a.getDate())
  const bd = new Date(b.getFullYear(), b.getMonth(), b.getDate())
  return ad < bd
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0)
}

/** Возвращает массив Date|null для сетки месяца (Пн…Вс, с padding-null в начале) */
function getMonthDays(year: number, month: number): (Date | null)[] {
  const firstDay = new Date(year, month, 1)
  const lastDay  = new Date(year, month + 1, 0)

  let firstDow = firstDay.getDay() - 1 // Mon=0
  if (firstDow < 0) firstDow = 6

  const days: (Date | null)[] = []
  for (let i = 0; i < firstDow; i++) days.push(null)
  for (let d = 1; d <= lastDay.getDate(); d++) {
    days.push(new Date(year, month, d))
  }
  while (days.length % 7 !== 0) days.push(null)
  return days
}

const MONTH_RU = [
  'Январь','Февраль','Март','Апрель','Май','Июнь',
  'Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь',
]
const DAY_RU = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс']

// ─── TimeInput ────────────────────────────────────────────────────────────────

interface TimeVal { h: string; m: string; s: string }

interface TimeInputProps {
  dark: boolean
  value: TimeVal
  onChange: (v: TimeVal) => void
  label: string
  onStartOfDay?: () => void
  onEndOfDay?: () => void
  onNow?: () => void
}

function TimeInput({ dark, value, onChange, label, onStartOfDay, onEndOfDay, onNow }: TimeInputProps) {
  const inputCls = [
    'w-10 h-8 text-center font-mono text-xs rounded border outline-none transition-colors',
    dark
      ? 'bg-slate-900 border-slate-600 text-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 hover:border-slate-500'
      : 'bg-gray-50 border-gray-300 text-gray-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 hover:border-gray-400',
  ].join(' ')

  const btnCls = [
    'text-xs px-2 h-6 rounded border cursor-pointer transition-colors whitespace-nowrap',
    dark
      ? 'text-slate-400 hover:text-slate-200 bg-slate-900 hover:bg-slate-700 border-slate-600'
      : 'text-gray-500 hover:text-gray-700 bg-white hover:bg-gray-100 border-gray-300',
  ].join(' ')

  const sep = <span className={`font-mono ${dark ? 'text-slate-500' : 'text-gray-400'} mx-0.5 select-none`}>:</span>

  function handleKey(field: 'h' | 'm' | 's', e: React.KeyboardEvent<HTMLInputElement>) {
    const max = field === 'h' ? 23 : 59
    const cur = parseInt(value[field]) || 0
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      onChange({ ...value, [field]: String(Math.min(max, cur + 1)).padStart(2, '0') })
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      onChange({ ...value, [field]: String(Math.max(0, cur - 1)).padStart(2, '0') })
    }
  }

  function handleChange(field: 'h' | 'm' | 's', raw: string) {
    onChange({ ...value, [field]: raw.replace(/\D/g, '').slice(0, 2) })
  }

  function handleBlur(field: 'h' | 'm' | 's') {
    const max = field === 'h' ? 23 : 59
    const v = Math.min(max, Math.max(0, parseInt(value[field]) || 0))
    onChange({ ...value, [field]: String(v).padStart(2, '0') })
  }

  return (
    <div className="flex flex-col gap-2">
      <span className={`text-xs font-medium ${dark ? 'text-slate-400' : 'text-gray-500'}`}>{label}</span>
      <div className="flex items-center">
        {(['h','m','s'] as const).map((field, i) => (
          <span key={field} className="flex items-center">
            {i > 0 && sep}
            <input
              type="text"
              inputMode="numeric"
              value={value[field]}
              maxLength={2}
              onChange={e => handleChange(field, e.target.value)}
              onKeyDown={e => handleKey(field, e)}
              onBlur={() => handleBlur(field)}
              className={inputCls}
            />
          </span>
        ))}
      </div>
      <div className="flex items-center gap-1.5 flex-wrap">
        {onStartOfDay && <button onClick={onStartOfDay} className={btnCls}>Начало дня</button>}
        {onEndOfDay   && <button onClick={onEndOfDay}   className={btnCls}>Конец дня</button>}
        {onNow        && <button onClick={onNow}        className={btnCls}>Сейчас</button>}
      </div>
    </div>
  )
}

// ─── CalendarGrid ─────────────────────────────────────────────────────────────

interface CalendarGridProps {
  dark: boolean
  year: number
  month: number
  fromDate: Date | null
  toDate: Date | null
  hoverDate: Date | null
  activeField: 'from' | 'to'
  onDayClick: (d: Date) => void
  onDayHover: (d: Date | null) => void
}

function CalendarGrid({
  dark, year, month,
  fromDate, toDate, hoverDate, activeField,
  onDayClick, onDayHover,
}: CalendarGridProps) {
  const days  = getMonthDays(year, month)
  const today = startOfDay(new Date())

  function getDayCls(day: Date): string {
    const isFrom    = !!fromDate && isSameDay(day, fromDate)
    const isTo      = !!toDate   && isSameDay(day, toDate)
    const isToday   = isSameDay(day, today)

    const effectiveTo = activeField === 'to' && hoverDate ? hoverDate : toDate
    const inRange     = !!fromDate && !!effectiveTo && isAfterDay(day, fromDate) && isBeforeDay(day, effectiveTo)
    const isPreview   = activeField === 'to' && !toDate && !!hoverDate && !!fromDate
                      && isAfterDay(day, fromDate) && isBeforeDay(day, hoverDate)

    const base = 'w-8 h-8 flex items-center justify-center text-xs cursor-pointer select-none transition-colors'

    if (isFrom && isTo)
      return `${base} bg-blue-600 text-white rounded-full z-10`
    if (isFrom)
      return `${base} bg-blue-600 text-white rounded-l-full z-10`
    if (isTo)
      return `${base} bg-blue-600 text-white rounded-r-full z-10`
    if (inRange)
      return `${base} ${isPreview
        ? dark ? 'bg-blue-900/25 text-slate-300' : 'bg-blue-50 text-gray-700'
        : dark ? 'bg-blue-900/50 text-slate-200' : 'bg-blue-100 text-gray-800'}`

    const hoverBg = dark
      ? 'hover:bg-slate-700 hover:text-white'
      : 'hover:bg-gray-100 hover:text-gray-900'

    if (isToday)
      return `${base} rounded-full ring-1 ring-inset ${dark ? 'ring-blue-500 text-blue-400' : 'ring-blue-400 text-blue-600'} ${hoverBg}`

    return `${base} rounded-full ${dark ? 'text-slate-300' : 'text-gray-700'} ${hoverBg}`
  }

  const weeks = Array.from({ length: days.length / 7 }, (_, i) => days.slice(i * 7, i * 7 + 7))

  return (
    <div>
      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 mb-1">
        {DAY_RU.map(d => (
          <div key={d} className={`w-8 h-6 flex items-center justify-center text-xs font-medium ${dark ? 'text-slate-500' : 'text-gray-400'}`}>
            {d}
          </div>
        ))}
      </div>
      {/* Weeks */}
      {weeks.map((week, wi) => (
        <div key={wi} className="grid grid-cols-7">
          {week.map((day, di) =>
            day ? (
              <div
                key={di}
                className={getDayCls(day)}
                onClick={() => onDayClick(day)}
                onMouseEnter={() => onDayHover(day)}
                onMouseLeave={() => onDayHover(null)}
              >
                {day.getDate()}
              </div>
            ) : (
              <div key={di} className="w-8 h-8" />
            )
          )}
        </div>
      ))}
    </div>
  )
}

// ─── DateRangePicker ──────────────────────────────────────────────────────────

export interface DateRangePickerProps {
  dark: boolean
  initialFrom?: Date
  initialTo?: Date
  onApply: (from: Date, to: Date) => void
  onClose: () => void
}

export default function DateRangePicker({
  dark, initialFrom, initialTo, onApply, onClose,
}: DateRangePickerProps) {
  const now = new Date()

  const [viewYear,  setViewYear]  = useState(initialFrom?.getFullYear() ?? now.getFullYear())
  const [viewMonth, setViewMonth] = useState(initialFrom?.getMonth()    ?? now.getMonth())

  const [fromDate, setFromDate] = useState<Date | null>(initialFrom ? startOfDay(initialFrom) : null)
  const [toDate,   setToDate]   = useState<Date | null>(initialTo   ? startOfDay(initialTo)   : null)
  const [activeField, setActiveField] = useState<'from' | 'to'>('from')
  const [hoverDate,   setHoverDate]   = useState<Date | null>(null)

  const toNum = (d: Date | undefined, fn: (d: Date) => number, def: string) =>
    d ? String(fn(d)).padStart(2, '0') : def

  const [fromTime, setFromTime] = useState<TimeVal>({
    h: toNum(initialFrom, d => d.getHours(), '00'),
    m: toNum(initialFrom, d => d.getMinutes(), '00'),
    s: toNum(initialFrom, d => d.getSeconds(), '00'),
  })
  const [toTime, setToTime] = useState<TimeVal>({
    h: toNum(initialTo, d => d.getHours(), '23'),
    m: toNum(initialTo, d => d.getMinutes(), '59'),
    s: toNum(initialTo, d => d.getSeconds(), '59'),
  })

  // Right month is always viewMonth + 1
  const rightMonth = viewMonth === 11 ? 0  : viewMonth + 1
  const rightYear  = viewMonth === 11 ? viewYear + 1 : viewYear

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) }
    else setViewMonth(m => m - 1)
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) }
    else setViewMonth(m => m + 1)
  }

  function handleDayClick(day: Date) {
    if (activeField === 'from') {
      setFromDate(day)
      if (!toDate || !isAfterDay(toDate, day)) setToDate(null)
      setActiveField('to')
    } else {
      if (fromDate && isBeforeDay(day, fromDate)) {
        // Clicked before from — swap
        setToDate(fromDate)
        setFromDate(day)
      } else {
        setToDate(day)
        setActiveField('from')
      }
    }
  }

  function buildDate(d: Date, t: TimeVal): Date {
    return new Date(
      d.getFullYear(), d.getMonth(), d.getDate(),
      parseInt(t.h) || 0,
      parseInt(t.m) || 0,
      parseInt(t.s) || 0,
    )
  }

  const canApply = !!(
    fromDate && toDate &&
    buildDate(fromDate, fromTime) < buildDate(toDate, toTime)
  )

  function handleApply() {
    if (!fromDate || !toDate) return
    const from = buildDate(fromDate, fromTime)
    const to   = buildDate(toDate, toTime)
    if (from >= to) return
    onApply(from, to)
  }

  function formatFieldDisplay(d: Date | null, t: TimeVal): string {
    if (!d) return '— не выбрано —'
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}  ${t.h.padStart(2,'0')}:${t.m.padStart(2,'0')}:${t.s.padStart(2,'0')}`
  }

  function setQuickRange(fromD: Date, toD: Date, fromT: TimeVal, toT: TimeVal) {
    setFromDate(fromD); setToDate(toD)
    setFromTime(fromT); setToTime(toT)
  }

  // ── Derived styles ────────────────────────────────────────────────────────

  const popupBg   = dark ? 'bg-slate-900 border-slate-700'   : 'bg-white border-gray-200'
  const headerBg  = dark ? 'bg-slate-800 border-slate-700'   : 'bg-gray-50 border-gray-100'
  const div       = dark ? 'border-slate-700' : 'border-gray-200'
  const footerBg  = dark ? 'bg-slate-800/60'  : 'bg-gray-50/80'

  const navBtn = [
    'w-7 h-7 flex items-center justify-center rounded cursor-pointer transition-colors text-base leading-none',
    dark ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-700' : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100',
  ].join(' ')

  const monthTitle = `text-sm font-medium ${dark ? 'text-slate-200' : 'text-gray-800'}`

  const fieldBox = (active: boolean) => [
    'flex-1 px-3 py-2 rounded-lg border cursor-pointer transition-all',
    active
      ? dark
        ? 'border-blue-500 ring-1 ring-blue-500/30 bg-slate-800'
        : 'border-blue-500 ring-1 ring-blue-500/20 bg-white'
      : dark
        ? 'border-slate-600 bg-slate-800 hover:border-slate-500'
        : 'border-gray-300 bg-gray-50 hover:border-gray-400',
  ].join(' ')

  const quickBtn = [
    'text-xs px-2.5 py-1 rounded border cursor-pointer transition-colors',
    dark
      ? 'text-slate-400 hover:text-slate-200 bg-slate-900 hover:bg-slate-700 border-slate-600'
      : 'text-gray-500 hover:text-gray-800 bg-white hover:bg-gray-50 border-gray-300',
  ].join(' ')

  return (
    <div
      className={`rounded-xl shadow-2xl border overflow-hidden ${popupBg}`}
      style={{ width: '560px' }}
    >
      {/* ── Header ── */}
      <div className={`flex items-center justify-between px-4 py-2.5 border-b ${headerBg}`}>
        <span className={`text-xs font-semibold ${dark ? 'text-slate-300' : 'text-gray-600'}`}>
          Произвольный диапазон
        </span>
        <button onClick={onClose} className={navBtn} title="Закрыть">✕</button>
      </div>

      {/* ── Field indicators: С / По ── */}
      <div className="flex gap-3 px-4 py-3">
        <div className={fieldBox(activeField === 'from')} onClick={() => setActiveField('from')}>
          <div className={`text-xs font-medium mb-0.5 ${dark ? 'text-slate-400' : 'text-gray-500'}`}>С</div>
          <div className={`font-mono text-xs ${fromDate ? (dark ? 'text-slate-200' : 'text-gray-800') : (dark ? 'text-slate-500' : 'text-gray-400')}`}>
            {formatFieldDisplay(fromDate, fromTime)}
          </div>
        </div>
        <div className={fieldBox(activeField === 'to')} onClick={() => setActiveField('to')}>
          <div className={`text-xs font-medium mb-0.5 ${dark ? 'text-slate-400' : 'text-gray-500'}`}>По</div>
          <div className={`font-mono text-xs ${toDate ? (dark ? 'text-slate-200' : 'text-gray-800') : (dark ? 'text-slate-500' : 'text-gray-400')}`}>
            {formatFieldDisplay(toDate, toTime)}
          </div>
        </div>
      </div>

      {/* ── Two-month calendars ── */}
      <div className={`flex border-t ${div}`}>
        {/* Left month */}
        <div className="flex-1 px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <button onClick={prevMonth} className={navBtn}>‹</button>
            <span className={monthTitle}>{MONTH_RU[viewMonth]} {viewYear}</span>
            <div className="w-7" />
          </div>
          <CalendarGrid
            dark={dark} year={viewYear} month={viewMonth}
            fromDate={fromDate} toDate={toDate}
            hoverDate={hoverDate} activeField={activeField}
            onDayClick={handleDayClick} onDayHover={setHoverDate}
          />
        </div>

        <div className={`w-px ${dark ? 'bg-slate-700' : 'bg-gray-200'}`} />

        {/* Right month */}
        <div className="flex-1 px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <div className="w-7" />
            <span className={monthTitle}>{MONTH_RU[rightMonth]} {rightYear}</span>
            <button onClick={nextMonth} className={navBtn}>›</button>
          </div>
          <CalendarGrid
            dark={dark} year={rightYear} month={rightMonth}
            fromDate={fromDate} toDate={toDate}
            hoverDate={hoverDate} activeField={activeField}
            onDayClick={handleDayClick} onDayHover={setHoverDate}
          />
        </div>
      </div>

      {/* ── Time inputs ── */}
      <div className={`flex border-t ${div}`}>
        <div className="flex-1 px-4 py-3">
          <TimeInput
            dark={dark} value={fromTime} onChange={setFromTime} label="Время «С»"
            onStartOfDay={() => setFromTime({ h:'00', m:'00', s:'00' })}
            onNow={() => {
              const n = new Date()
              setFromTime({ h: String(n.getHours()).padStart(2,'0'), m: String(n.getMinutes()).padStart(2,'0'), s: String(n.getSeconds()).padStart(2,'0') })
            }}
          />
        </div>
        <div className={`w-px ${dark ? 'bg-slate-700' : 'bg-gray-200'}`} />
        <div className="flex-1 px-4 py-3">
          <TimeInput
            dark={dark} value={toTime} onChange={setToTime} label="Время «По»"
            onEndOfDay={() => setToTime({ h:'23', m:'59', s:'59' })}
            onNow={() => {
              const n = new Date()
              setToTime({ h: String(n.getHours()).padStart(2,'0'), m: String(n.getMinutes()).padStart(2,'0'), s: String(n.getSeconds()).padStart(2,'0') })
            }}
          />
        </div>
      </div>

      {/* ── Quick presets ── */}
      <div className={`flex items-center gap-2 px-4 py-2.5 border-t ${div} ${footerBg}`}>
        <span className={`text-xs ${dark ? 'text-slate-500' : 'text-gray-400'}`}>Быстро:</span>
        <button
          onClick={() => {
            const d = startOfDay(new Date())
            setQuickRange(d, d, { h:'00',m:'00',s:'00' }, { h:'23',m:'59',s:'59' })
          }}
          className={quickBtn}
        >Сегодня</button>
        <button
          onClick={() => {
            const d = startOfDay(new Date())
            d.setDate(d.getDate() - 1)
            setQuickRange(d, d, { h:'00',m:'00',s:'00' }, { h:'23',m:'59',s:'59' })
          }}
          className={quickBtn}
        >Вчера</button>
        <button
          onClick={() => {
            const n = new Date()
            const d = startOfDay(n)
            const hh = String(n.getHours()).padStart(2,'0')
            setQuickRange(d, d, { h:hh, m:'00', s:'00' }, { h:hh, m:'59', s:'59' })
          }}
          className={quickBtn}
        >Этот час</button>
      </div>

      {/* ── Footer ── */}
      <div className={`flex items-center justify-end gap-2 px-4 py-3 border-t ${div}`}>
        <button
          onClick={onClose}
          className={[
            'px-4 h-8 rounded-lg text-xs font-medium transition-colors cursor-pointer',
            dark ? 'text-slate-400 hover:text-white hover:bg-slate-700' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100',
          ].join(' ')}
        >
          Отмена
        </button>
        <button
          onClick={handleApply}
          disabled={!canApply}
          className="px-4 h-8 rounded-lg text-xs font-semibold bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
        >
          Применить →
        </button>
      </div>
    </div>
  )
}
