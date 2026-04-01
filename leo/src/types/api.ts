// ─── Log levels ─────────────────────────────────────────────────────────────

export type LogLevel = 'TRACE' | 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL' | 'FATAL'

// ─── Log entry ───────────────────────────────────────────────────────────────

export interface LogEntry {
  _id: string
  eventId?: string
  level: LogLevel
  levelInt?: number
  appName?: string
  text?: string
  localTime?: string
  '@timestamp'?: number
  projectCode?: string
  appType?: string
  envType?: string
  namespace?: string
  podName?: string
  tslgServerVersion?: string
  tslgClientVersion?: string
  tec?: Record<string, string>
  threadName?: string
  callerClass?: string
  callerMethod?: string
  callerLine?: number
  loggerName?: string
  agrType?: string
  risCode?: string
  encProvider?: string
  tslgOtherFields?: string
  [key: string]: unknown
}

// ─── User data ───────────────────────────────────────────────────────────────

export interface UserData {
  roles: string[]
  infoSystemCodes: string[]
}

// ─── Cursor ──────────────────────────────────────────────────────────────────

export interface Cursor {
  id: unknown
  score: unknown
  sortingFieldValue?: unknown
}

// ─── Request ─────────────────────────────────────────────────────────────────

export type DateHistogramInterval =
  | 'auto'
  | 'millisecond'
  | 'second'
  | 'minute'
  | 'hour'
  | 'day'
  | 'week'
  | 'month'

export type FilterOperator =
  | 'IS'
  | 'IS NOT'
  | 'IS ONE OF'
  | 'IS NOT ONE OF'
  | 'EXIST'
  | 'DOES NOT EXIST'
  | 'CONTAINS'
  | 'NOT CONTAINS'
  | '>'
  | '<'
  | '>='
  | '<='
  | '=='

export interface OpenSearchFilter {
  attributeName: string
  filterOperator?: FilterOperator
  attributeValue?: string[]
}

export interface LogQueryRequest {
  startTime: string
  endTime: string
}

// ─── v2 Request types ────────────────────────────────────────────────────────

export interface SortAttributes {
  order: 'asc' | 'desc'
  fieldName: string
}

export interface LogQueryFilters {
  luceneQuery?: string
  mainTimeFilter: LogQueryRequest
  fieldFilters?: OpenSearchFilter[]
}

export interface ClickHousePageAttributes {
  limit: number
  cursors?: Record<string, Cursor>
}

export interface LogQueryPageableRequest {
  sort: SortAttributes
  filters: LogQueryFilters
  pageAttributes: ClickHousePageAttributes
}

// ─── v2 Response types ────────────────────────────────────────────────────────

export interface AggregatedItems {
  value: string
  docCount: number
}

export interface HistogramBucket {
  docCount: number
  key: number
  keyAsString: string
  parts?: AggregatedItems[]
}

export interface ClickHouseResponse {
  payload?: LogEntry[]
  cursor?: Record<string, Cursor>
}

export interface ClickHouseAggregationRequest {
  aggregationType: 'histogram' | 'top-n'
  aggregationAttributes?: {
    fieldName?: string
    limit?: number
    dateHistogramInterval?: DateHistogramInterval
  }
  filters: LogQueryFilters
}

export interface ClickHouseAggregationResponse {
  aggregationResult?: {
    interval?: string
    buckets?: HistogramBucket[]
  }
}

// ─── UI Fields ───────────────────────────────────────────────────────────────

export type FieldControlType = 'select' | 'datetime' | 'text' | 'longText' | 'id' | 'hidden' | 'int'

export interface Field {
  name?: string
  controlType?: FieldControlType
  description?: string
  required?: boolean
  options?: string[]
  inputWidth?: number
}

export interface FormData {
  fields?: Field[]
  props?: Record<string, Field[]>
}

// ─── Saved Searches ───────────────────────────────────────────────────────────

export interface SavedSearchFilter {
  attributeName: string
  attributeValue: string[]
  filterOperator?: FilterOperator
  attributeVisibility?: boolean
}

export interface NewSavedSearchRequest {
  name: string
  onlyMy?: boolean
  queryAttributes?: { startTime?: string; endTime?: string }
  filters: SavedSearchFilter[]
}

export interface SavedSearchItemGetResult {
  id: string
  name: string
  version: number
  seqNo: number
  primaryTerm: number
  author?: string
  onlyMy: boolean
  apply: boolean
  share: boolean
  delete: boolean
  storageType: string
  filters: SavedSearchFilter[]
}

export interface SavedSearchGetResult {
  savedSearchItems: SavedSearchItemGetResult[]
}

export interface SavedSearchCreateResult {
  id: string
  version: number
  seqNo: number
  primaryTerm: number
}

// ─── Field top values (used internally by Sidebar / FilterBuilder) ────────────

export interface FieldValuesBucket {
  value: string
  docCount: number
}

export interface FieldValuesResponse {
  fieldName: string
  totalDocCount: number
  buckets: FieldValuesBucket[]
}
