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

export interface OpenSearchOrder {
  fieldCode: string
  sorting: 'asc' | 'desc'
}

export interface OpenSearchAttributes {
  limit: number
  cursors?: Record<string, Cursor>
  order?: OpenSearchOrder
  dateHistogramInterval?: DateHistogramInterval
}

export interface LogQueryPageableRequest {
  queryAttributes: LogQueryRequest
  pageAttributes: OpenSearchAttributes
  filters?: OpenSearchFilter[]
  isCHRequest?: boolean
  statAttributes?: { fieldName: string; limit: number }
  needPayload?: boolean
}

// ─── Response ────────────────────────────────────────────────────────────────

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

export interface DateHistogram {
  interval?: string
  buckets?: HistogramBucket[]
}

export interface OpenSearchResponse {
  payload?: LogEntry[]
  cursor?: Record<string, Cursor>
  summary?: Record<string, string>
  dateHistogram?: DateHistogram
}

// ─── UI Fields ───────────────────────────────────────────────────────────────

export type FieldControlType = 'select' | 'datetime' | 'text' | 'longText' | 'id' | 'hidden' | 'int'

export interface QuickFilterStatRequest {
  queryAttributes: LogQueryRequest
  statAttributes: { fieldName: string; limit: number }
  filters?: OpenSearchFilter[]
  isCHRequest?: boolean
}

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

// ─── Field top values ────────────────────────────────────────────────────────

export interface FieldValuesRequest {
  queryAttributes: LogQueryRequest
  filters?: OpenSearchFilter[]
  fieldName: string
  limit?: number
  isCHRequest?: boolean
}

export interface FieldValuesBucket {
  value: string
  docCount: number
}

export interface FieldValuesResponse {
  fieldName: string
  totalDocCount: number
  buckets: FieldValuesBucket[]
}
