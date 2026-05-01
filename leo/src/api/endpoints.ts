import { apiFetch } from './client'
import type { AppConfig, UserConfig } from '@/types/config'
import type {
  LogQueryPageableRequest,
  LogQueryFilters,
  ClickHouseResponse,
  ClickHouseAggregationResponse,
  DateHistogramInterval,
  OpenSearchFilter,
  Cursor,
  FormData as FieldsFormData,
  FieldValuesResponse,
  UserData,
  NewSavedSearchRequest,
  EditSavedSearchRequest,
  SavedSearchGetResult,
  SavedSearchCreateResult,
  SavedSearchEditResult,
  SavedSearchesTagsGetResult,
  HistogramBucket,
  Bucket,
} from '@/types/api'

// ─── Logs ─────────────────────────────────────────────────────────────────────

/**
 * POST /api/v2/query
 * Основной запрос логов с пагинацией и фильтрами.
 */
export async function fetchLogs(
  request: LogQueryPageableRequest,
  user: UserConfig,
  config: AppConfig,
): Promise<ClickHouseResponse> {
  return apiFetch<ClickHouseResponse>('/api/v2/query', user, config, {
    method: 'POST',
    body: request,
  })
}

// ─── Histogram ────────────────────────────────────────────────────────────────

/**
 * timestampMs has second-level precision and is sometimes in microseconds when
 * the backend sends a 1ms interval. Prefer parsing the ISO timestamp string.
 */
function bucketKey(b: Bucket): number {
  if (b.timestamp) {
    const ms = new Date(b.timestamp).getTime()
    if (!isNaN(ms)) return ms
  }
  return b.timestampMs ?? 0
}

/**
 * Трансформирует плоский массив Bucket (swagger v14) в HistogramBucket[].
 * Каждый входной Bucket — одна комбинация (timestampMs × groupField-значение).
 * На выходе — один HistogramBucket на временной слот с опциональным массивом parts.
 */
function flatBucketsToHistogram(
  buckets: Bucket[],
  groupField: string | null,
): HistogramBucket[] {
  const map = new Map<number, HistogramBucket>()
  for (const b of buckets) {
    const ts = bucketKey(b)
    const count = (b.metrics?.['count'] as number) ?? 0
    const existing = map.get(ts)
    if (existing) {
      existing.docCount += count
      if (groupField && b.groups && existing.parts) {
        existing.parts.push({ value: String(b.groups[groupField] ?? ''), docCount: count })
      }
    } else {
      map.set(ts, {
        docCount: count,
        key: ts,
        keyAsString: b.timestamp ?? new Date(ts).toISOString(),
        parts: groupField && b.groups
          ? [{ value: String(b.groups[groupField] ?? ''), docCount: count }]
          : undefined,
      })
    }
  }
  return Array.from(map.values()).sort((a, b) => a.key - b.key)
}

/**
 * POST /api/v2/aggregation (aggregationType: time-histogram)
 * Получение данных гистограммы отдельным запросом.
 * @param breakdown - поле для разбивки (level/appName), null = без разбивки
 */
export async function fetchHistogram(
  filters: LogQueryFilters,
  histogramInterval: DateHistogramInterval,
  breakdown: string | null,
  user: UserConfig,
  config: AppConfig,
): Promise<HistogramBucket[]> {
  const response = await apiFetch<ClickHouseAggregationResponse>('/api/v2/aggregation', user, config, {
    method: 'POST',
    body: {
      aggregationType: 'time-histogram',
      aggregationAttributes: {
        timeInterval: histogramInterval,
        withEmptyBuckets: true,
        ...(breakdown && { groupBy: { field: breakdown, size: config.logging.topNLimit } }),
      },
      filters,
    },
  })
  return flatBucketsToHistogram(response.buckets ?? [], breakdown)
}

// ─── Top values (sidebar + filter builder) ────────────────────────────────────

/**
 * POST /api/v2/aggregation (aggregationType: top-n)
 * Топ-N значений поля — используется в Sidebar и FilterBuilder.
 */
export async function fetchTopValues(
  fieldName: string,
  limit: number,
  filters: LogQueryFilters,
  user: UserConfig,
  config: AppConfig,
  searchText?: string,
): Promise<FieldValuesResponse> {
  const effectiveFilters: LogQueryFilters = searchText
    ? {
        ...filters,
        fieldFilters: [
          ...(filters.fieldFilters ?? []),
          { attributeName: fieldName, filterOperator: 'CONTAINS', attributeValue: [searchText] },
        ],
      }
    : filters
  const response = await apiFetch<ClickHouseAggregationResponse>('/api/v2/aggregation', user, config, {
    method: 'POST',
    body: {
      aggregationType: 'top-n',
      aggregationAttributes: { groupBy: { field: fieldName, size: limit } },
      filters: effectiveFilters,
    },
  })
  const buckets = response.buckets ?? []
  return {
    fieldName,
    totalDocCount: buckets.reduce((sum, b) => sum + ((b.metrics?.['count'] as number) ?? 0), 0),
    buckets: buckets.map(b => ({
      value: String(b.groups?.[fieldName] ?? ''),
      docCount: (b.metrics?.['count'] as number) ?? 0,
    })),
  }
}

// ─── User data ────────────────────────────────────────────────────────────────

/**
 * GET /api/v2/user/data
 * Роли и разрешения текущего пользователя.
 */
export async function getUserData(
  user: UserConfig,
  config: AppConfig,
): Promise<UserData> {
  return apiFetch<UserData>('/api/v2/user/data', user, config)
}

// ─── UI fields ────────────────────────────────────────────────────────────────

/**
 * GET /api/v2/ui/fields
 * Список полей для боковой панели фильтров.
 */
export async function getFilterFields(
  user: UserConfig,
  config: AppConfig,
  projectCodes: string[],
  signal?: AbortSignal,
): Promise<FieldsFormData> {
  const params = projectCodes.length > 0
    ? '?' + projectCodes.map(c => `projectCode=${encodeURIComponent(c)}`).join('&')
    : ''
  return apiFetch<FieldsFormData>(`/api/v2/ui/fields${params}`, user, config, { signal })
}

// ─── Project codes ────────────────────────────────────────────────────────────

/**
 * Возвращает список доступных projectCode для текущего пользователя.
 * Источник: GET /api/v2/user/data → поле infoSystemCodes[].
 */
export async function fetchProjectCodes(
  user: UserConfig,
  config: AppConfig,
): Promise<string[]> {
  const data = await getUserData(user, config)
  return data.infoSystemCodes ?? []
}

// ─── Saved Searches ───────────────────────────────────────────────────────────

/**
 * GET /api/v2/saved-searches
 * Список сохранённых поисков, видимых текущему пользователю.
 */
export async function fetchSavedSearches(
  user: UserConfig,
  config: AppConfig,
  params: { needFilters: boolean; name?: string; tags?: string[] },
  signal?: AbortSignal,
): Promise<SavedSearchGetResult> {
  const query = new URLSearchParams()
  query.set('needFilters', String(params.needFilters))
  if (params.name) query.set('name', params.name)
  if (params.tags?.length) params.tags.forEach(t => query.append('tags', t))
  return apiFetch<SavedSearchGetResult>(`/api/v2/saved-searches?${query}`, user, config, { signal })
}

/**
 * GET /api/v2/saved-searches/{id}
 * Получить полные данные одного сохранённого поиска (включая filters).
 */
export async function fetchSavedSearchById(
  id: string,
  version: number,
  user: UserConfig,
  config: AppConfig,
): Promise<SavedSearchItemGetResult> {
  return apiFetch<SavedSearchItemGetResult>(`/api/v2/saved-searches/${id}?version=${version}`, user, config)
}

/**
 * POST /api/v2/saved-searches
 * Создать новый сохранённый поиск.
 */
export async function createSavedSearch(
  request: NewSavedSearchRequest,
  user: UserConfig,
  config: AppConfig,
): Promise<SavedSearchCreateResult> {
  return apiFetch<SavedSearchCreateResult>('/api/v2/saved-searches', user, config, {
    method: 'POST', body: request,
  })
}

/**
 * PUT /api/v2/saved-searches/{id}?version={version}
 * Обновить существующий сохранённый поиск.
 */
export async function updateSavedSearch(
  id: string,
  version: number,
  request: EditSavedSearchRequest,
  user: UserConfig,
  config: AppConfig,
): Promise<SavedSearchEditResult> {
  return apiFetch<SavedSearchEditResult>(
    `/api/v2/saved-searches/${id}?version=${version}`,
    user, config,
    { method: 'PUT', body: request },
  )
}

/**
 * DELETE /api/v2/saved-searches/{id}?version={version}
 * Удалить сохранённый поиск.
 */
export async function deleteSavedSearch(
  id: string,
  version: number,
  user: UserConfig,
  config: AppConfig,
): Promise<void> {
  await apiFetch<void>(`/api/v2/saved-searches/${id}?version=${version}`, user, config, {
    method: 'DELETE',
  })
}

/**
 * GET /api/v2/saved-searches/tags
 * Все теги сохранённых поисков.
 */
export async function getSavedSearchTags(
  user: UserConfig,
  config: AppConfig,
  signal?: AbortSignal,
): Promise<SavedSearchesTagsGetResult> {
  return apiFetch<SavedSearchesTagsGetResult>('/api/v2/saved-searches/tags', user, config, { signal })
}

// ─── Request builder helpers ──────────────────────────────────────────────────

/**
 * Строит LogQueryPageableRequest для заданного временного диапазона.
 * sort.fieldName всегда localTime, sort.order по умолчанию desc.
 */
export function buildLogRequest(
  from: Date,
  to: Date,
  overrides: {
    fieldFilters?: OpenSearchFilter[]
    luceneQuery?: string
    cursors?: Record<string, Cursor>
    order?: 'asc' | 'desc'
  } = {},
  maxLogs = 100,
): LogQueryPageableRequest {
  const fieldFilters = overrides.fieldFilters?.length ? overrides.fieldFilters : undefined
  const luceneQuery  = overrides.luceneQuery?.trim() || undefined

  return {
    sort: {
      order: overrides.order ?? 'desc',
      fieldName: 'localTime',
    },
    filters: {
      mainTimeFilter: {
        startTime: from.toISOString(),
        endTime:   to.toISOString(),
      },
      ...(luceneQuery  && { luceneQuery }),
      ...(fieldFilters && { fieldFilters }),
    },
    pageAttributes: {
      limit: maxLogs,
      ...(overrides.cursors && { cursors: overrides.cursors }),
    },
  }
}
