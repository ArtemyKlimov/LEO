import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import type { AppConfig, UserConfig } from '@/types/config'
import type { OpenSearchFilter, LogEntry, HistogramBucket, Cursor, OpenSearchResponse } from '@/types/api'
import type { DataSource } from '@/components/TopBar/DataSourceToggle'

// ─── Types ───────────────────────────────────────────────────────────────────

export type Theme = 'light' | 'dark'
export type { DataSource }

export interface TimeRange {
  from: Date
  to: Date
  label?: string
}

export interface AppState {
  config: AppConfig | null
  currentUser: UserConfig | null
  theme: Theme
  dataSource: DataSource
  timeRange: TimeRange | null
  filters: OpenSearchFilter[]
  luceneQuery: string
  pinnedFields: string[]
  isLoading: boolean
  error: string | null
  // Log data
  logs: LogEntry[]
  histogramBuckets: HistogramBucket[]
  totalCount: number
  cursor: Record<string, Cursor> | null
}

export interface AppActions {
  setConfig: (config: AppConfig) => void
  setCurrentUser: (user: UserConfig | null) => void
  setTheme: (theme: Theme) => void
  setDataSource: (source: DataSource) => void
  setTimeRange: (range: TimeRange) => void
  addFilter: (filter: OpenSearchFilter) => void
  removeFilter: (index: number) => void
  clearFilters: () => void
  setLuceneQuery: (query: string) => void
  pinField: (field: string) => void
  unpinField: (field: string) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  logout: () => void
  // Log data
  setLogData: (response: OpenSearchResponse) => void
  appendLogs: (response: OpenSearchResponse) => void
  resetLogData: () => void
}

type AppContextValue = AppState & AppActions

// ─── Context ─────────────────────────────────────────────────────────────────

const AppContext = createContext<AppContextValue | null>(null)

// ─── Provider ────────────────────────────────────────────────────────────────

export function AppProvider({ children }: { children: ReactNode }) {
  const [config, setConfigState] = useState<AppConfig | null>(null)
  const [currentUser, setCurrentUserState] = useState<UserConfig | null>(null)
  const [theme, setThemeState] = useState<Theme>('light')
  const [dataSource, setDataSourceState] = useState<DataSource>('opensearch')
  const [timeRange, setTimeRangeState] = useState<TimeRange | null>(null)
  const [filters, setFilters] = useState<OpenSearchFilter[]>([])
  const [luceneQuery, setLuceneQueryState] = useState('')
  const DEFAULT_PINNED = ['level', 'appName', 'text']
  const [pinnedFields, setPinnedFields] = useState<string[]>(DEFAULT_PINNED)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setErrorState] = useState<string | null>(null)
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [histogramBuckets, setHistogramBuckets] = useState<HistogramBucket[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [cursor, setCursor] = useState<Record<string, Cursor> | null>(null)

  const setConfig = useCallback((cfg: AppConfig) => {
    setConfigState(cfg)
    setThemeState(cfg.ui.theme)
  }, [])

  const setCurrentUser = useCallback((user: UserConfig | null) => {
    setCurrentUserState(user)
  }, [])

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t)
  }, [])

  const setDataSource = useCallback((source: DataSource) => {
    setDataSourceState(source)
  }, [])

  const setTimeRange = useCallback((range: TimeRange) => {
    setTimeRangeState(range)
  }, [])

  const addFilter = useCallback((filter: OpenSearchFilter) => {
    setFilters((prev) => {
      const exists = prev.some(
        (f) =>
          f.attributeName === filter.attributeName &&
          f.filterOperator === filter.filterOperator &&
          JSON.stringify(f.attributeValue) === JSON.stringify(filter.attributeValue),
      )
      return exists ? prev : [...prev, filter]
    })
  }, [])

  const removeFilter = useCallback((index: number) => {
    setFilters((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const clearFilters = useCallback(() => setFilters([]), [])

  const setLuceneQuery = useCallback((q: string) => setLuceneQueryState(q), [])

  const pinField = useCallback((field: string) => {
    setPinnedFields((prev) => (prev.includes(field) ? prev : [...prev, field]))
  }, [])

  const unpinField = useCallback((field: string) => {
    setPinnedFields((prev) => prev.filter((f) => f !== field))
  }, [])

  const setLoading = useCallback((loading: boolean) => setIsLoading(loading), [])

  const setError = useCallback((err: string | null) => setErrorState(err), [])

  const setLogData = useCallback((response: OpenSearchResponse) => {
    setLogs(response.payload ?? [])
    setHistogramBuckets(response.dateHistogram?.buckets ?? [])
    setTotalCount(Number(response.summary?.totalCount ?? 0))
    setCursor(response.cursor ?? null)
  }, [])

  const appendLogs = useCallback((response: OpenSearchResponse) => {
    const incoming = response.payload ?? []
    setLogs((prev) => {
      const existingIds = new Set(prev.map(l => l._id))
      const newLogs = incoming.filter(l => !existingIds.has(l._id))
      return newLogs.length > 0 ? [...prev, ...newLogs] : prev
    })
    // Stop pagination when backend returns empty page
    setCursor(incoming.length > 0 ? (response.cursor ?? null) : null)
  }, [])

  const resetLogData = useCallback(() => {
    setLogs([])
    setHistogramBuckets([])
    setTotalCount(0)
    setCursor(null)
  }, [])

  const logout = useCallback(() => {
    setCurrentUserState(null)
    setFilters([])
    setLuceneQueryState('')
    setPinnedFields(['level', 'appName', 'text'])
    setTimeRangeState(null)
    setErrorState(null)
    setLogs([])
    setHistogramBuckets([])
    setTotalCount(0)
    setCursor(null)
  }, [])

  const value: AppContextValue = {
    config,
    currentUser,
    theme,
    dataSource,
    timeRange,
    filters,
    luceneQuery,
    pinnedFields,
    isLoading,
    error,
    logs,
    histogramBuckets,
    totalCount,
    cursor,
    setConfig,
    setCurrentUser,
    setTheme,
    setDataSource,
    setTimeRange,
    addFilter,
    removeFilter,
    clearFilters,
    setLuceneQuery,
    pinField,
    unpinField,
    setLoading,
    setError,
    logout,
    setLogData,
    appendLogs,
    resetLogData,
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
