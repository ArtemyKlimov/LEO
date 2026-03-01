import { useMemo, useCallback } from 'react'
import ReactECharts from 'echarts-for-react'
import type { HistogramBucket, DateHistogramInterval } from '@/types/api'

// ─── Interval selector config ─────────────────────────────────────────────────

const INTERVALS: { label: string; value: DateHistogramInterval }[] = [
  { label: 'авто',  value: 'auto' },
  { label: '1мс',   value: 'millisecond' },
  { label: '1с',    value: 'second' },
  { label: '1м',    value: 'minute' },
  { label: '1ч',    value: 'hour' },
  { label: '1д',    value: 'day' },
]

// ─── Formatters ───────────────────────────────────────────────────────────────

function fmtXLabel(isoStr: string, spanMs: number): string {
  const d = new Date(isoStr)
  if (spanMs <= 3_600_000) {
    return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }
  if (spanMs <= 86_400_000) {
    return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
  }
  return d.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function fmtYLabel(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000)     return `${(v / 1_000).toFixed(0)}k`
  return String(v)
}

function fmtTooltipDate(isoStr: string): string {
  return new Date(isoStr).toLocaleString('ru-RU', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  dark: boolean
  buckets: HistogramBucket[]
  totalCount: number
  interval: DateHistogramInterval
  onIntervalChange: (v: DateHistogramInterval) => void
  onBucketClick: (bucket: HistogramBucket, bucketDurationMs: number) => void
  onRangeSelect: (from: Date, to: Date) => void
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function Histogram({
  dark, buckets, totalCount, interval,
  onIntervalChange, onBucketClick, onRangeSelect,
}: Props) {

  // Вычисляем длительность одного бакета из разницы между соседними
  const bucketDurationMs = buckets.length >= 2
    ? buckets[1].key - buckets[0].key
    : 60_000

  const spanMs = buckets.length >= 2
    ? buckets[buckets.length - 1].key - buckets[0].key
    : 0

  // ── Палитра по теме ─────────────────────────────────────────────────────────

  const c = {
    bar:      '#3B82F6',
    barHover: '#60A5FA',
    axis:     dark ? '#334155' : '#D1D5DB',
    label:    dark ? '#64748B' : '#9CA3AF',
    grid:     dark ? '#1E293B' : '#F9FAFB',
    ttBg:     dark ? '#1E293B' : '#FFFFFF',
    ttBorder: dark ? '#334155' : '#E5E7EB',
    ttText:   dark ? '#F1F5F9' : '#111827',
    ttMuted:  dark ? '#64748B' : '#9CA3AF',
  }

  // ── ECharts option ──────────────────────────────────────────────────────────

  const option = useMemo(() => ({
    animation: false,
    backgroundColor: 'transparent',
    grid: { left: 50, right: 40, top: 8, bottom: 34 },

    xAxis: {
      type: 'category',
      data: buckets.map(b => b.keyAsString),
      axisLine:  { lineStyle: { color: c.axis } },
      axisTick:  { show: false },
      splitLine: { show: false },
      axisLabel: {
        color:    c.label,
        fontSize: 10,
        interval: Math.max(0, Math.floor(buckets.length / 8) - 1),
        formatter: (v: string) => fmtXLabel(v, spanMs),
      },
    },

    yAxis: {
      type: 'value',
      axisLine:  { show: false },
      axisTick:  { show: false },
      axisLabel: { color: c.label, fontSize: 10, formatter: fmtYLabel },
      splitLine: { lineStyle: { color: c.axis, type: 'dashed', opacity: 0.6 } },
    },

    series: [{
      type: 'bar',
      data: buckets.map(b => b.docCount),
      itemStyle: { color: c.bar, borderRadius: [2, 2, 0, 0] },
      emphasis:  { itemStyle: { color: c.barHover } },
      barMaxWidth: 40,
      barCategoryGap: '15%',
    }],

    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'shadow',
        shadowStyle: { color: dark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)' },
      },
      backgroundColor: c.ttBg,
      borderColor:     c.ttBorder,
      borderWidth: 1,
      padding: [6, 10],
      textStyle: { color: c.ttText, fontSize: 12 },
      formatter: (params: Array<{ name: string; value: number }>) => {
        const p = params[0]
        return [
          `<div style="font-size:10px;color:${c.ttMuted};margin-bottom:2px">${fmtTooltipDate(p.name)}</div>`,
          `<div style="font-size:13px;font-weight:600;color:${c.ttText}">${p.value.toLocaleString('ru-RU')} записей</div>`,
        ].join('')
      },
    },

    // Brush — выделение диапазона
    brush: {
      xAxisIndex: 0,
      brushStyle: {
        borderWidth: 1,
        color:       'rgba(59,130,246,0.15)',
        borderColor: '#3B82F6',
      },
    },

    toolbox: {
      show:     true,
      right:    4,
      top:      2,
      itemSize: 13,
      feature: {
        brush: {
          type: ['lineX', 'clear'],
          title: { lineX: 'Выбрать диапазон', clear: 'Сбросить' },
        },
      },
      iconStyle: { borderColor: c.label, borderWidth: 1.5 },
      emphasis: { iconStyle: { borderColor: c.bar } },
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [buckets, dark])

  // ── Event handlers ──────────────────────────────────────────────────────────

  const onEvents = useCallback(() => ({
    click: (params: { componentType: string; dataIndex: number }) => {
      if (params.componentType === 'series' && buckets[params.dataIndex]) {
        onBucketClick(buckets[params.dataIndex], bucketDurationMs)
      }
    },

    // ECharts fires 'brushEnd' after user releases mouse
    brushEnd: (params: { areas: Array<{ coordRange: [number, number] }> }) => {
      if (!params.areas.length || buckets.length < 2) return
      const [start, end] = params.areas[0].coordRange
      const startIdx = Math.max(0, Math.floor(start))
      const endIdx   = Math.min(buckets.length - 1, Math.ceil(end))
      if (startIdx > endIdx) return

      const from = new Date(buckets[startIdx].key)
      const endKey = endIdx < buckets.length - 1
        ? buckets[endIdx + 1].key
        : buckets[endIdx].key + bucketDurationMs
      onRangeSelect(from, new Date(endKey))
    },
  }), [buckets, bucketDurationMs, onBucketClick, onRangeSelect])

  // ── Styles ──────────────────────────────────────────────────────────────────

  const intervalBtnCls = (active: boolean) => [
    'px-2 py-0.5 rounded text-xs transition-colors cursor-pointer select-none',
    active
      ? 'bg-blue-600 text-white'
      : dark
        ? 'text-slate-500 hover:text-slate-200 hover:bg-slate-700'
        : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100',
  ].join(' ')

  const containerCls = [
    'border-b flex-shrink-0',
    dark ? 'bg-slate-900 border-slate-700' : 'bg-white border-gray-200',
  ].join(' ')

  const toolbarCls = [
    'flex items-center gap-3 px-4 py-1.5 border-b',
    dark ? 'border-slate-800' : 'border-gray-100',
  ].join(' ')

  const footerCls = [
    'flex items-center justify-end gap-1 px-4 py-1 text-xs border-t',
    dark ? 'border-slate-800 text-slate-600' : 'border-gray-100 text-gray-400',
  ].join(' ')

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className={containerCls}>
      {/* Toolbar: interval selector */}
      <div className={toolbarCls}>
        <span className={['text-xs', dark ? 'text-slate-500' : 'text-gray-400'].join(' ')}>
          Интервал:
        </span>
        <div className="flex items-center gap-0.5">
          {INTERVALS.map(({ label, value }) => (
            <button
              key={value}
              onClick={() => onIntervalChange(value)}
              className={intervalBtnCls(interval === value)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      {buckets.length > 0 ? (
        <ReactECharts
          option={option}
          onEvents={onEvents()}
          style={{ height: 160, width: '100%' }}
          notMerge
        />
      ) : (
        <div
          className={['flex items-center justify-center', dark ? 'text-slate-700' : 'text-gray-300'].join(' ')}
          style={{ height: 160 }}
        >
          <span className="text-sm">Нет данных гистограммы</span>
        </div>
      )}

      {/* Footer: total count */}
      <div className={footerCls}>
        <span>Всего:</span>
        <span className={['font-medium tabular-nums', dark ? 'text-slate-300' : 'text-gray-700'].join(' ')}>
          {totalCount.toLocaleString('ru-RU')}
        </span>
        <span>записей</span>
      </div>
    </div>
  )
}
