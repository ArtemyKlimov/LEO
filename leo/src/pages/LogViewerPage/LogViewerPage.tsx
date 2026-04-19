import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '@/store/AppContext'
import { clearToken } from '@/auth/jwtService'
import {
  fetchLogs, fetchHistogram, fetchTopValues, buildLogRequest,
  getFilterFields, fetchSavedSearches, createSavedSearch, deleteSavedSearch,
} from '@/api/endpoints'
import { ApiError } from '@/api/client'
import { buildSavedSearchFilters } from '@/components/TopBar/SavedSearchesPanel'
import TopBar, { PRESET_LABELS } from '@/components/TopBar/TopBar'
import Histogram from '@/components/Histogram/Histogram'
import Sidebar from '@/components/Sidebar/Sidebar'
import LogTable from '@/components/LogTable/LogTable'
import FilterBar from '@/components/FilterBar/FilterBar'
import FilterBuilder from '@/components/FilterBuilder/FilterBuilder'
import type {
  DateHistogramInterval, HistogramBucket, Field, OpenSearchFilter,
  FieldValuesResponse, FieldValuesBucket, SavedSearchItemGetResult, LogQueryFilters,
} from '@/types/api'

export default function LogViewerPage() {
  const {
    currentUser, config, theme,
    timeRange, luceneQuery, logs, filters, histogramBuckets, pinnedFields,
    cursor, totalCount,
    availableProjectCodes, selectedProjectCodes, setSelectedProjectCodes,
    logout, setTheme, setTimeRange, setLuceneQuery,
    setLogData, appendLogs, updateHistogram, setLoading, setError, isLoading,
    addFilter, removeFilter, clearFilters, pinField, unpinField, setPinnedFields,
  } = useApp()
  const navigate = useNavigate()

  const dark = theme === 'dark'

  // Нужен выбор projectCode: кодов > 5 и ни один не выбран
  const needsProjectSelection = availableProjectCodes.length > 5 && selectedProjectCodes.length === 0

  const [savedSearches, setSavedSearches] = useState<SavedSearchItemGetResult[]>([])
  const [activeSearchName, setActiveSearchName] = useState<string | null>(null)

  const [activePresetMinutes, setActivePresetMinutes] = useState<number | null>(15)
  const [histogramInterval, setHistogramInterval] = useState<DateHistogramInterval>('auto')
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [activeBreakdown, setActiveBreakdown] = useState<'level' | 'appName' | null>(null)

  const initialFetchDone = useRef(false)

  // ─── UI fields (sidebar) ─────────────────────────────────────────────────────

  const [apiFields, setApiFields] = useState<Field[]>([])
  const [fieldsLoading, setFieldsLoading] = useState(false)

  useEffect(() => {
    if (!currentUser || !config) return
    // Ждём определения кодов: если кодов > 5 — нужен явный выбор пользователя
    if (availableProjectCodes.length > 5 && selectedProjectCodes.length === 0) return
    const ac = new AbortController()
    setFieldsLoading(true)
    getFilterFields(currentUser, config, selectedProjectCodes, ac.signal)
      .then(data => { if (!ac.signal.aborted) setApiFields(data.fields ?? []) })
      .catch(() => {/* endpoint недоступен — используем fallback из логов */})
      .finally(() => { if (!ac.signal.aborted) setFieldsLoading(false) })
    return () => ac.abort()
  }, [currentUser, config, selectedProjectCodes, availableProjectCodes])

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

  const HIDDEN_FIELDS = new Set(['_id', '@timestamp', 'levelInt'])

  const uiFields = useMemo<Field[]>(() => {
    const apiByName = new Map(apiFields.map(f => [f.name, f]))
    const logFieldNames = Object.keys(fieldFrequency)
      .filter(k => !HIDDEN_FIELDS.has(k))
      .sort((a, b) => (fieldFrequency[b] ?? 0) - (fieldFrequency[a] ?? 0))
    const merged = logFieldNames.map(name => apiByName.get(name) ?? { name })
    for (const f of apiFields) {
      if (f.name && !HIDDEN_FIELDS.has(f.name) && !logFieldNames.includes(f.name)) {
        merged.push(f)
      }
    }
    return merged
  }, [apiFields, fieldFrequency])

  // ─── Auto-fetch on mount ─────────────────────────────────────────────────────

  useEffect(() => {
    if (initialFetchDone.current || !currentUser || !config || needsProjectSelection) return
    initialFetchDone.current = true
    const to   = new Date()
    const from = new Date(to.getTime() - 15 * 60_000)
    setActivePresetMinutes(15)
    setTimeRange({ from, to, label: PRESET_LABELS[15] })
    doFetch(from, to, luceneQuery, 'auto')
  // doFetch стабилен через useCallback; luceneQuery на старте всегда пустой
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, config, needsProjectSelection])

  // ─── Core fetch ─────────────────────────────────────────────────────────────

  const buildQueryFilters = useCallback((
    from: Date,
    to: Date,
    query: string,
    fieldFilters: OpenSearchFilter[],
  ): LogQueryFilters => {
    return {
      mainTimeFilter: { startTime: from.toISOString(), endTime: to.toISOString() },
      ...(query.trim() && { luceneQuery: query.trim() }),
      ...(fieldFilters.length > 0 && { fieldFilters }),
    }
  }, [])

  const doFetch = useCallback(async (
    from: Date,
    to: Date,
    query: string,
    histInterval: DateHistogramInterval = histogramInterval,
    filtersOverride?: OpenSearchFilter[],
    projectCodesOverride?: string[],
  ) => {
    if (!currentUser || !config) return
    setLoading(true)
    setError(null)
    try {
      const activeFilters = filtersOverride ?? filters
      const activeCodes = projectCodesOverride ?? selectedProjectCodes
      const projectCodeFilter: OpenSearchFilter[] =
        activeCodes.length > 0
          ? [{ attributeName: 'projectCode', filterOperator: 'IS ONE OF' as const, attributeValue: activeCodes }]
          : []
      const allFieldFilters = [...activeFilters, ...projectCodeFilter]

      const logReq = buildLogRequest(from, to, {
        fieldFilters: allFieldFilters,
        luceneQuery: query,
      }, config.logging.maxLogsPerPage)

      const [logsResponse, histResponse] = await Promise.all([
        fetchLogs(logReq, currentUser, config),
        fetchHistogram(logReq.filters, histInterval, activeBreakdown, currentUser, config),
      ])
      setLogData(logsResponse)
      updateHistogram(histResponse)
    } catch (err) {
      setError(err instanceof ApiError ? `Ошибка API ${err.status}: ${err.message}` : String(err))
    } finally {
      setLoading(false)
    }
  }, [currentUser, config, filters, histogramInterval, selectedProjectCodes, activeBreakdown, setLoading, setError, setLogData, updateHistogram])

  // ─── Saved searches ──────────────────────────────────────────────────────────

  const loadSavedSearches = useCallback(async () => {
    if (!currentUser || !config) return
    try {
      const result = await fetchSavedSearches(currentUser, config)
      setSavedSearches(result.savedSearchItems ?? [])
    } catch { /* silent — endpoint may be unavailable */ }
  }, [currentUser, config])

  useEffect(() => {
    if (!currentUser || !config) return
    const ac = new AbortController()
    fetchSavedSearches(currentUser, config, ac.signal)
      .then(result => { if (!ac.signal.aborted) setSavedSearches(result.savedSearchItems ?? []) })
      .catch(() => {})
    return () => ac.abort()
  }, [currentUser, config])

  async function handleSaveSearch(name: string, onlyMy: boolean) {
    if (!currentUser || !config) return
    const apiFilters = buildSavedSearchFilters(filters, pinnedFields)
    await createSavedSearch({ name, onlyMy, filters: apiFilters }, currentUser, config)
    setActiveSearchName(name)
    await loadSavedSearches()
  }

  function handleLoadSearch(loadedFilters: OpenSearchFilter[], loadedPinnedFields: string[]) {
    clearFilters()
    loadedFilters.forEach(addFilter)
    setPinnedFields(loadedPinnedFields)
    if (timeRange) doFetch(timeRange.from, timeRange.to, luceneQuery, histogramInterval, loadedFilters)
  }

  async function handleDeleteSearch(id: string) {
    if (!currentUser || !config) return
    await deleteSavedSearch([id], currentUser, config)
    if (savedSearches.find(s => s.id === id)?.name === activeSearchName) {
      setActiveSearchName(null)
    }
    await loadSavedSearches()
  }

  // ─── Load more (cursor pagination) ──────────────────────────────────────────

  const doFetchMore = useCallback(async () => {
    if (!currentUser || !config || !timeRange || !cursor || isLoadingMore) return
    setIsLoadingMore(true)
    try {
      const projectCodeFilter: OpenSearchFilter[] =
        selectedProjectCodes.length > 0
          ? [{ attributeName: 'projectCode', filterOperator: 'IS ONE OF' as const, attributeValue: selectedProjectCodes }]
          : []
      const req = buildLogRequest(
        timeRange.from, timeRange.to,
        {
          fieldFilters: [...filters, ...projectCodeFilter],
          luceneQuery,
          cursors: cursor,
        },
        config.logging.maxLogsPerPage,
      )
      appendLogs(await fetchLogs(req, currentUser, config))
    } catch {
      // не прерываем UX из-за ошибки подгрузки
    } finally {
      setIsLoadingMore(false)
    }
  }, [currentUser, config, timeRange, cursor, isLoadingMore, luceneQuery, filters, selectedProjectCodes, appendLogs])

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

  function handleProjectCodesChange(codes: string[]) {
    setSelectedProjectCodes(codes)
    if (codes.length > 0 && timeRange) {
      doFetch(timeRange.from, timeRange.to, luceneQuery, histogramInterval, undefined, codes)
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

  async function handleIntervalChange(newInterval: DateHistogramInterval) {
    setHistogramInterval(newInterval)
    if (!timeRange || !currentUser || !config) return
    const projectCodeFilter: OpenSearchFilter[] =
      selectedProjectCodes.length > 0
        ? [{ attributeName: 'projectCode', filterOperator: 'IS ONE OF' as const, attributeValue: selectedProjectCodes }]
        : []
    const queryFilters = buildQueryFilters(timeRange.from, timeRange.to, luceneQuery, [...filters, ...projectCodeFilter])
    setLoading(true)
    setError(null)
    try {
      updateHistogram(await fetchHistogram(queryFilters, newInterval, activeBreakdown, currentUser, config))
    } catch (err) {
      setError(err instanceof ApiError ? `Ошибка API ${err.status}: ${err.message}` : String(err))
    } finally {
      setLoading(false)
    }
  }

  async function handleBreakdownChange(newField: 'level' | 'appName' | null) {
    setActiveBreakdown(newField)
    if (!timeRange || !currentUser || !config) return

    const projectCodeFilter: OpenSearchFilter[] =
      selectedProjectCodes.length > 0
        ? [{ attributeName: 'projectCode', filterOperator: 'IS ONE OF' as const, attributeValue: selectedProjectCodes }]
        : []
    const allFieldFilters = [...filters, ...projectCodeFilter]
    const queryFilters = buildQueryFilters(timeRange.from, timeRange.to, luceneQuery, allFieldFilters)

    setLoading(true)
    setError(null)
    try {
      updateHistogram(
        await fetchHistogram(queryFilters, histogramInterval, newField, currentUser, config),
      )
    } catch (err) {
      setError(err instanceof ApiError ? `Ошибка API ${err.status}: ${err.message}` : String(err))
    } finally {
      setLoading(false)
    }
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

  function handleGetLocalTopValues(fieldName: string): FieldValuesBucket[] {
    const counts: Record<string, number> = {}
    for (const log of logs) {
      const val = log[fieldName]
      if (val != null && val !== '') {
        const key = String(val)
        counts[key] = (counts[key] ?? 0) + 1
      }
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([value, docCount]) => ({ value, docCount }))
  }

  const handleFetchTopValues = useCallback(async (fieldName: string): Promise<FieldValuesResponse> => {
    if (!currentUser || !config || !timeRange) throw new Error('Not ready')
    const projectCodeFilter: OpenSearchFilter[] =
      selectedProjectCodes.length > 0
        ? [{ attributeName: 'projectCode', filterOperator: 'IS ONE OF' as const, attributeValue: selectedProjectCodes }]
        : []
    const queryFilters = buildQueryFilters(timeRange.from, timeRange.to, luceneQuery, [...filters, ...projectCodeFilter])
    return fetchTopValues(fieldName, config.logging.topNLimit ?? 10, queryFilters, currentUser, config)
  }, [currentUser, config, timeRange, luceneQuery, filters, selectedProjectCodes, buildQueryFilters])

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

  async function handleFetchFilterValues(fieldName: string): Promise<FieldValuesBucket[]> {
    if (!currentUser || !config || !timeRange) return []
    const projectCodeFilter: OpenSearchFilter[] =
      selectedProjectCodes.length > 0
        ? [{ attributeName: 'projectCode', filterOperator: 'IS ONE OF' as const, attributeValue: selectedProjectCodes }]
        : []
    const allFieldFilters = [...filters, ...projectCodeFilter]
    const queryFilters = buildQueryFilters(timeRange.from, timeRange.to, luceneQuery, allFieldFilters)
    try {
      const response = await fetchTopValues(fieldName, 50, queryFilters, currentUser, config)
      return response.buckets ?? []
    } catch {
      return []
    }
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
        availableProjectCodes={availableProjectCodes}
        selectedProjectCodes={selectedProjectCodes}
        highlightProjectCodes={needsProjectSelection}
        savedSearches={savedSearches}
        activeSearchName={activeSearchName}
        currentFilters={filters}
        currentPinnedFields={pinnedFields}
        onPreset={handlePreset}
        onCustomRange={handleCustomRange}
        onLuceneChange={setLuceneQuery}
        onLuceneSearch={handleLuceneSearch}
        onExport={handleExport}
        onThemeToggle={() => setTheme(dark ? 'light' : 'dark')}
        onLogout={handleLogout}
        onProjectCodesChange={handleProjectCodesChange}
        onSaveSearch={handleSaveSearch}
        onLoadSearch={handleLoadSearch}
        onDeleteSearch={handleDeleteSearch}
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
        breakdown={activeBreakdown}
        onIntervalChange={handleIntervalChange}
        onBreakdownChange={handleBreakdownChange}
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
        onFetchFieldValues={timeRange ? handleFetchFilterValues : undefined}
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
          loadedLogsCount={logs.length}
          onInclude={handleInclude}
          onExclude={handleExclude}
          onPin={pinField}
          onUnpin={unpinField}
          onGetLocalTopValues={handleGetLocalTopValues}
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
