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

// ─── Aggregation request types (swagger v14) ──────────────────────────────────

export interface GroupBy {
  field: string
  size?: number
}

export interface LogStatRequest {
  timeInterval?: DateHistogramInterval
  withEmptyBuckets?: boolean
  groupBy?: GroupBy
}

export interface ClickHouseAggregationRequest {
  aggregationType: 'time-histogram' | 'top-n'
  aggregationAttributes?: LogStatRequest
  filters: LogQueryFilters
}

// ─── Aggregation response types (swagger v14) ─────────────────────────────────

export interface MetaData {
  interval?: string
  groupFields?: string[]
  topField?: string
  limit?: number
}

export interface Bucket {
  timestampMs?: number
  timestamp?: string
  groups?: Record<string, unknown>
  metrics?: Record<string, unknown>
}

export interface ClickHouseAggregationResponse {
  aggregationType?: 'time-histogram' | 'top-n'
  metadata?: MetaData
  buckets?: Bucket[]
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

export interface ClickHouseFilter {
  filterOperator: FilterOperator
  attributeName: string
  attributeValue: string[]
}

export interface SavedSearchFiltersV2 {
  luceneQuery?: string
  mainTimeFilter?: { startTime?: string; endTime?: string }
  fieldFilters?: ClickHouseFilter[]
}

export interface SavedSearchLayout {
  visibilityFields?: string[]
  timeRangePeriod?: string
}

export interface SavedSearchItemGetResult {
  id: string
  version: number
  author?: string
  name: string
  description?: string
  tags: string[]
  isPublic: boolean
  needProjectCode: boolean
  apply: boolean
  share: boolean
  delete: boolean
  filters?: SavedSearchFiltersV2
  layout?: SavedSearchLayout
}

export interface SavedSearchGetResult {
  savedSearchItems: SavedSearchItemGetResult[]
}

export interface NewSavedSearchRequest {
  name: string
  description?: string
  tags?: string[]
  isPublic: boolean
  needProjectCode: boolean
  filters?: SavedSearchFiltersV2
  layout?: SavedSearchLayout
}

export interface EditSavedSearchRequest {
  name: string
  description?: string
  tags?: string[]
  needProjectCode: boolean
  filters?: SavedSearchFiltersV2
  layout?: SavedSearchLayout
}

export interface SavedSearchCreateResult {
  id: string
  version: number
}

export interface SavedSearchEditResult {
  version: number
}

export interface SavedSearchesTagsGetResult {
  tags: string[]
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
