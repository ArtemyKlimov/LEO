import { useState, useCallback, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '@/store/AppContext'
import { clearToken } from '@/auth/jwtService'
import { fetchLogs, buildLogRequest, getFilterFields, fetchFieldTopValues } from '@/api/endpoints'
import { ApiError } from '@/api/client'
import TopBar, { PRESET_LABELS } from '@/components/TopBar/TopBar'
import Histogram from '@/components/Histogram/Histogram'
import Sidebar from '@/components/Sidebar/Sidebar'
import LogTable from '@/components/LogTable/LogTable'
import FilterBar from '@/components/FilterBar/FilterBar'
import FilterBuilder from '@/components/FilterBuilder/FilterBuilder'
import type { DateHistogramInterval, HistogramBucket, Field, OpenSearchFilter, FieldValuesResponse } from '@/types/api'

export default function LogViewerPage() {
  const {
    currentUser, config, theme,
    timeRange, luceneQuery, logs, filters, histogramBuckets, pinnedFields,
    cursor, dataSource, totalCount,
    availableProjectCodes, selectedProjectCodes, setSelectedProjectCodes,
    logout, setTheme, setTimeRange, setLuceneQuery, setDataSource,
    setLogData, appendLogs, setLoading, setError, isLoading,
    addFilter, removeFilter, clearFilters, pinField, unpinField,
  } = useApp()
  const navigate = useNavigate()

  const dark = theme === 'dark'

  // Нужен выбор projectCode: кодов > 5 и ни один не выбран
  const needsProjectSelection = availableProjectCodes.length > 5 && selectedProjectCodes.length === 0

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
    isCHOverride?: boolean,
    projectCodesOverride?: string[],
  ) => {
    if (!currentUser || !config) return
    setLoading(true)
    setError(null)
    try {
      const activeFilters = filtersOverride ?? filters
      const isCH = isCHOverride ?? (dataSource === 'clickhouse')
      const luceneFilter = query.trim()
        ? [{ attributeName: 'text', filterOperator: 'IS' as const, attributeValue: [query.trim()] }]
        : []
      const activeCodes = projectCodesOverride ?? selectedProjectCodes
      const projectCodeFilter: OpenSearchFilter[] =
        activeCodes.length > 0
          ? [{ attributeName: 'projectCode', filterOperator: 'IS ONE OF' as const, attributeValue: activeCodes }]
          : []
      const req = buildLogRequest(
        from, to,
        {
          filters: [...activeFilters, ...luceneFilter, ...projectCodeFilter],
          pageAttributes: { dateHistogramInterval: histInterval },
          isCHRequest: isCH,
        },
        config.logging.maxLogsPerPage,
      )
      setLogData(await fetchLogs(req, currentUser, config))
    } catch (err) {
      setError(err instanceof ApiError ? `Ошибка API ${err.status}: ${err.message}` : String(err))
    } finally {
      setLoading(false)
    }
  }, [currentUser, config, filters, histogramInterval, dataSource, selectedProjectCodes, setLoading, setError, setLogData])

  // ─── Load more (cursor pagination) ──────────────────────────────────────────

  const doFetchMore = useCallback(async () => {
    if (!currentUser || !config || !timeRange || !cursor || isLoadingMore) return
    setIsLoadingMore(true)
    try {
      const luceneFilter = luceneQuery.trim()
        ? [{ attributeName: 'text', filterOperator: 'IS' as const, attributeValue: [luceneQuery.trim()] }]
        : []
      const projectCodeFilter: OpenSearchFilter[] =
        selectedProjectCodes.length > 0
          ? [{ attributeName: 'projectCode', filterOperator: 'IS ONE OF' as const, attributeValue: selectedProjectCodes }]
          : []
      const req = buildLogRequest(
        timeRange.from, timeRange.to,
        {
          filters: [...filters, ...luceneFilter, ...projectCodeFilter],
          pageAttributes: { dateHistogramInterval: histogramInterval, cursors: cursor },
          isCHRequest: dataSource === 'clickhouse',
        },
        config.logging.maxLogsPerPage,
      )
      appendLogs(await fetchLogs(req, currentUser, config))
    } catch {
      // не прерываем UX из-за ошибки подгрузки
    } finally {
      setIsLoadingMore(false)
    }
  }, [currentUser, config, timeRange, cursor, isLoadingMore, luceneQuery, filters, histogramInterval, dataSource, selectedProjectCodes, appendLogs])

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

  function handleDataSourceChange(source: typeof dataSource) {
    setDataSource(source)
    if (timeRange) doFetch(timeRange.from, timeRange.to, luceneQuery, histogramInterval, undefined, source === 'clickhouse')
  }

  function handleProjectCodesChange(codes: string[]) {
    setSelectedProjectCodes(codes)
    if (codes.length > 0 && timeRange) {
      doFetch(timeRange.from, timeRange.to, luceneQuery, histogramInterval, undefined, undefined, codes)
    }
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

  async function handleFetchTopValues(fieldName: string): Promise<FieldValuesResponse> {
    if (!currentUser || !config || !timeRange) throw new Error('Not ready')
    const luceneFilter = luceneQuery.trim()
      ? [{ attributeName: 'text', filterOperator: 'IS' as const, attributeValue: [luceneQuery.trim()] }]
      : []
    return fetchFieldTopValues(
      {
        queryAttributes: {
          startTime: timeRange.from.toISOString(),
          endTime:   timeRange.to.toISOString(),
        },
        filters: [...filters, ...luceneFilter],
        fieldName,
        limit: 5,
        isCHRequest: dataSource === 'clickhouse',
      },
      currentUser,
      config,
    )
  }

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
        timeRange={timeRange}
        luceneQuery={luceneQuery}
        isLoading={isLoading}
        activePresetMinutes={activePresetMinutes}
        dataSource={dataSource}
        availableProjectCodes={availableProjectCodes}
        selectedProjectCodes={selectedProjectCodes}
        highlightProjectCodes={needsProjectSelection}
        onPreset={handlePreset}
        onCustomRange={handleCustomRange}
        onLuceneChange={setLuceneQuery}
        onLuceneSearch={handleLuceneSearch}
        onExport={handleExport}
        onThemeToggle={() => setTheme(dark ? 'light' : 'dark')}
        onLogout={handleLogout}
        onDataSourceChange={handleDataSourceChange}
        onProjectCodesChange={handleProjectCodesChange}
      />

      {needsProjectSelection ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3">
          <svg
            className={['w-10 h-10', dark ? 'text-slate-600' : 'text-gray-300'].join(' ')}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
          </svg>
          <p className={['text-sm', dark ? 'text-slate-400' : 'text-gray-500'].join(' ')}>
            Выберите projectCode в верхней панели для загрузки логов
          </p>
        </div>
      ) : (
        <>
      <Histogram
        dark={dark}
        buckets={histogramBuckets}
        totalCount={totalCount}
        interval={histogramInterval}
        onIntervalChange={handleIntervalChange}
        onBucketClick={handleBucketClick}
        onRangeSelect={handleRangeSelect}
      />

      <FilterBuilder
        dark={dark}
        fields={uiFields}
        onAdd={filter => {
          const newFilters = [...filters, filter]
          addFilter(filter)
          if (timeRange) doFetch(timeRange.from, timeRange.to, luceneQuery, histogramInterval, newFilters)
        }}
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
          onFetchTopValues={handleFetchTopValues}
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
        </>
      )}
    </div>
  )
}
