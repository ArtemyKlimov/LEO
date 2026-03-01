import { useState, useCallback, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '@/store/AppContext'
import { clearToken } from '@/auth/jwtService'
import { fetchLogs, buildLogRequest, getFilterFields } from '@/api/endpoints'
import { ApiError } from '@/api/client'
import TopBar, { PRESET_LABELS } from '@/components/TopBar/TopBar'
import Histogram from '@/components/Histogram/Histogram'
import Sidebar from '@/components/Sidebar/Sidebar'
import LogTable from '@/components/LogTable/LogTable'
import FilterBar from '@/components/FilterBar/FilterBar'
import type { DateHistogramInterval, HistogramBucket, Field, OpenSearchFilter } from '@/types/api'

export default function LogViewerPage() {
  const {
    currentUser, config, theme, totalCount,
    timeRange, luceneQuery, logs, filters, histogramBuckets, pinnedFields,
    cursor,
    logout, setTheme, setTimeRange, setLuceneQuery,
    setLogData, appendLogs, setLoading, setError, isLoading,
    addFilter, removeFilter, clearFilters, pinField, unpinField,
  } = useApp()
  const navigate = useNavigate()

  const dark = theme === 'dark'
  const [activePresetMinutes, setActivePresetMinutes] = useState<number | null>(15)
  const [histogramInterval, setHistogramInterval] = useState<DateHistogramInterval>('auto')
  const [isLoadingMore, setIsLoadingMore] = useState(false)

  // ─── UI fields (sidebar) ─────────────────────────────────────────────────────

  // Поля из API (с метаданными: options, controlType)
  const [apiFields, setApiFields] = useState<Field[]>([])
  const [fieldsLoading, setFieldsLoading] = useState(false)

  useEffect(() => {
    if (!currentUser || !config) return
    setFieldsLoading(true)
    getFilterFields(currentUser, config)
      .then(data => setApiFields(data.fields ?? []))
      .catch(() => {/* endpoint недоступен — используем fallback из логов */})
      .finally(() => setFieldsLoading(false))
  }, [currentUser, config])

  // Частота полей: доля логов, в которых поле присутствует и не пустое
  const fieldFrequency = useMemo<Record<string, number>>(() => {
    if (!logs.length) return {}
    const counts: Record<string, number> = {}
    for (const log of logs) {
      for (const key of Object.keys(log)) {
        if (log[key] != null && log[key] !== '') {
          counts[key] = (counts[key] ?? 0) + 1
        }
      }
    }
    const total = logs.length
    return Object.fromEntries(Object.entries(counts).map(([k, v]) => [k, v / total]))
  }, [logs])

  // Итоговый список полей: API-поля обогащены метаданными + поля из логов как fallback
  // Поля служебного характера (_id, @timestamp, levelInt) скрываем
  const HIDDEN_FIELDS = new Set(['_id', '@timestamp', 'levelInt'])

  const uiFields = useMemo<Field[]>(() => {
    const apiByName = new Map(apiFields.map(f => [f.name, f]))

    // Поля из загруженных логов, отсортированные по частоте
    const logFieldNames = Object.keys(fieldFrequency)
      .filter(k => !HIDDEN_FIELDS.has(k))
      .sort((a, b) => (fieldFrequency[b] ?? 0) - (fieldFrequency[a] ?? 0))

    // Объединяем: сначала берём поля из логов (с частотой),
    // обогащаем метаданными из API если есть
    const merged = logFieldNames.map(name => apiByName.get(name) ?? { name })

    // Добавляем API-поля, которых нет в логах (редкие поля)
    for (const f of apiFields) {
      if (f.name && !HIDDEN_FIELDS.has(f.name) && !logFieldNames.includes(f.name)) {
        merged.push(f)
      }
    }

    return merged
  }, [apiFields, fieldFrequency])

  // ─── Core fetch ─────────────────────────────────────────────────────────────

  const doFetch = useCallback(async (
    from: Date,
    to: Date,
    query: string,
    histInterval: DateHistogramInterval = histogramInterval,
    filtersOverride?: OpenSearchFilter[],
  ) => {
    if (!currentUser || !config) return
    setLoading(true)
    setError(null)
    try {
      const activeFilters = filtersOverride ?? filters
      const luceneFilter = query.trim()
        ? [{ attributeName: 'text', filterOperator: 'IS' as const, attributeValue: [query.trim()] }]
        : []
      const req = buildLogRequest(
        from, to,
        {
          filters: [...activeFilters, ...luceneFilter],
          pageAttributes: { dateHistogramInterval: histInterval },
        },
        config.logging.maxLogsPerPage,
      )
      setLogData(await fetchLogs(req, currentUser, config))
    } catch (err) {
      setError(err instanceof ApiError ? `Ошибка API ${err.status}: ${err.message}` : String(err))
    } finally {
      setLoading(false)
    }
  }, [currentUser, config, filters, histogramInterval, setLoading, setError, setLogData])

  // ─── Load more (cursor pagination) ──────────────────────────────────────────

  const doFetchMore = useCallback(async () => {
    if (!currentUser || !config || !timeRange || !cursor || isLoadingMore) return
    setIsLoadingMore(true)
    try {
      const luceneFilter = luceneQuery.trim()
        ? [{ attributeName: 'text', filterOperator: 'IS' as const, attributeValue: [luceneQuery.trim()] }]
        : []
      const req = buildLogRequest(
        timeRange.from, timeRange.to,
        {
          filters: [...filters, ...luceneFilter],
          pageAttributes: { dateHistogramInterval: histogramInterval, cursors: cursor },
        },
        config.logging.maxLogsPerPage,
      )
      appendLogs(await fetchLogs(req, currentUser, config))
    } catch {
      // не прерываем UX из-за ошибки подгрузки
    } finally {
      setIsLoadingMore(false)
    }
  }, [currentUser, config, timeRange, cursor, isLoadingMore, luceneQuery, filters, histogramInterval, appendLogs])

  // ─── TopBar handlers ─────────────────────────────────────────────────────────

  function handlePreset(minutes: number) {
    const to   = new Date()
    const from = new Date(to.getTime() - minutes * 60_000)
    setActivePresetMinutes(minutes)
    setTimeRange({ from, to, label: PRESET_LABELS[minutes] })
    doFetch(from, to, luceneQuery)
  }

  function handleCustomRange(from: Date, to: Date) {
    setActivePresetMinutes(null)
    setTimeRange({ from, to })
    doFetch(from, to, luceneQuery)
  }

  function handleLuceneSearch() {
    if (!timeRange) return
    doFetch(timeRange.from, timeRange.to, luceneQuery)
  }

  function handleLogout() {
    if (currentUser) clearToken(currentUser.userId)
    logout()
    navigate('/')
  }

  function handleExport(format: 'txt' | 'csv') {
    if (!logs.length) return
    let content: string
    let filename: string
    let mime: string

    if (format === 'txt') {
      content = logs
        .map(log => `[${log.localTime ?? ''}] [${log.level}] [${log.appName ?? ''}] ${log.text ?? ''}`)
        .join('\n')
      filename = `leo-logs-${Date.now()}.txt`
      mime = 'text/plain'
    } else {
      const keys = Array.from(new Set(logs.flatMap(l => Object.keys(l))))
      const esc = (v: unknown) => {
        const s = v == null ? '' : String(v)
        return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s
      }
      content = [keys.join(','), ...logs.map(l => keys.map(k => esc(l[k])).join(','))].join('\n')
      filename = `leo-logs-${Date.now()}.csv`
      mime = 'text/csv'
    }

    const url = URL.createObjectURL(new Blob([content], { type: mime }))
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  // ─── Histogram handlers ──────────────────────────────────────────────────────

  function handleIntervalChange(newInterval: DateHistogramInterval) {
    setHistogramInterval(newInterval)
    if (!timeRange) return
    doFetch(timeRange.from, timeRange.to, luceneQuery, newInterval)
  }

  function handleBucketClick(bucket: HistogramBucket, bucketDurationMs: number) {
    const from = new Date(bucket.key)
    const to   = new Date(bucket.key + bucketDurationMs)
    setActivePresetMinutes(null)
    setTimeRange({ from, to })
    doFetch(from, to, luceneQuery)
  }

  function handleRangeSelect(from: Date, to: Date) {
    setActivePresetMinutes(null)
    setTimeRange({ from, to })
    doFetch(from, to, luceneQuery)
  }

  // ─── Sidebar handlers ────────────────────────────────────────────────────────

  function handleInclude(fieldName: string, value: string) {
    const filter: OpenSearchFilter = {
      attributeName: fieldName,
      filterOperator: 'IS',
      attributeValue: [value],
    }
    const isDuplicate = filters.some(
      f => f.attributeName === filter.attributeName &&
           f.filterOperator === filter.filterOperator &&
           JSON.stringify(f.attributeValue) === JSON.stringify(filter.attributeValue),
    )
    if (isDuplicate) return
    const newFilters = [...filters, filter]
    addFilter(filter)
    if (timeRange) doFetch(timeRange.from, timeRange.to, luceneQuery, histogramInterval, newFilters)
  }

  function handleExclude(fieldName: string, value: string) {
    const filter: OpenSearchFilter = {
      attributeName: fieldName,
      filterOperator: 'IS NOT',
      attributeValue: [value],
    }
    const isDuplicate = filters.some(
      f => f.attributeName === filter.attributeName &&
           f.filterOperator === filter.filterOperator &&
           JSON.stringify(f.attributeValue) === JSON.stringify(filter.attributeValue),
    )
    if (isDuplicate) return
    const newFilters = [...filters, filter]
    addFilter(filter)
    if (timeRange) doFetch(timeRange.from, timeRange.to, luceneQuery, histogramInterval, newFilters)
  }

  function handleRemoveFilter(index: number) {
    const newFilters = filters.filter((_, i) => i !== index)
    removeFilter(index)
    if (timeRange) doFetch(timeRange.from, timeRange.to, luceneQuery, histogramInterval, newFilters)
  }

  function handleClearFilters() {
    clearFilters()
    if (timeRange) doFetch(timeRange.from, timeRange.to, luceneQuery, histogramInterval, [])
  }

  if (!currentUser) return null

  return (
    <div
      className={[
        'h-screen flex flex-col overflow-hidden',
        dark ? 'bg-slate-900 text-white' : 'bg-gray-50 text-gray-900',
      ].join(' ')}
    >
      <TopBar
        dark={dark}
        user={currentUser}
        totalCount={totalCount}
        timeRange={timeRange}
        luceneQuery={luceneQuery}
        isLoading={isLoading}
        activePresetMinutes={activePresetMinutes}
        onPreset={handlePreset}
        onCustomRange={handleCustomRange}
        onLuceneChange={setLuceneQuery}
        onLuceneSearch={handleLuceneSearch}
        onExport={handleExport}
        onThemeToggle={() => setTheme(dark ? 'light' : 'dark')}
        onLogout={handleLogout}
      />

      <Histogram
        dark={dark}
        buckets={histogramBuckets}
        totalCount={totalCount}
        interval={histogramInterval}
        onIntervalChange={handleIntervalChange}
        onBucketClick={handleBucketClick}
        onRangeSelect={handleRangeSelect}
      />

      <FilterBar
        dark={dark}
        filters={filters}
        onRemove={handleRemoveFilter}
        onClearAll={handleClearFilters}
      />

      {/* Content: Sidebar + main */}
      <div className="flex flex-1 overflow-hidden min-h-0">
        <Sidebar
          dark={dark}
          fields={uiFields}
          fieldFrequency={fieldFrequency}
          pinnedFields={pinnedFields}
          isLoading={fieldsLoading}
          onInclude={handleInclude}
          onExclude={handleExclude}
          onPin={pinField}
          onUnpin={unpinField}
        />

        {/* Log table */}
        <main className="flex-1 flex flex-col overflow-hidden min-h-0">
          <LogTable
            dark={dark}
            logs={logs}
            pinnedFields={pinnedFields}
            hasMore={cursor !== null}
            isLoadingMore={isLoadingMore}
            onLoadMore={doFetchMore}
            onInclude={handleInclude}
            onExclude={handleExclude}
            onPin={pinField}
            onUnpin={unpinField}
          />
        </main>
      </div>
    </div>
  )
}
