import { apiFetch } from './client'
import type { AppConfig, UserConfig } from '@/types/config'
import type {
  LogQueryPageableRequest,
  OpenSearchAttributes,
  OpenSearchResponse,
  FormData as FieldsFormData,
  FieldValuesRequest,
  FieldValuesResponse,
  QuickFilterStatRequest,
  UserData,
  NewSavedSearchRequest,
  SavedSearchGetResult,
  SavedSearchCreateResult,
} from '@/types/api'

// ─── Logs ─────────────────────────────────────────────────────────────────────

/**
 * POST /api/v1/elasticsearch/query
 * Основной запрос логов с пагинацией и фильтрами.
 */
export async function fetchLogs(
  request: LogQueryPageableRequest,
  user: UserConfig,
  config: AppConfig,
): Promise<OpenSearchResponse> {
  return apiFetch<OpenSearchResponse>('/api/v1/elasticsearch/query', user, config, {
    method: 'POST',
    body: request,
  })
}

// ─── User data ────────────────────────────────────────────────────────────────

/**
 * GET /api/v1/user/data
 * Роли и разрешения текущего пользователя.
 */
export async function getUserData(
  user: UserConfig,
  config: AppConfig,
): Promise<UserData> {
  return apiFetch<UserData>('/api/v1/user/data', user, config)
}

// ─── UI fields ────────────────────────────────────────────────────────────────

/**
 * GET /api/v1/ui/fields
 * Список полей для боковой панели фильтров.
 */
export async function getFilterFields(
  user: UserConfig,
  config: AppConfig,
): Promise<FieldsFormData> {
  return apiFetch<FieldsFormData>('/api/v1/ui/fields', user, config)
}

// ─── Field top values ─────────────────────────────────────────────────────────

/**
 * POST /api/v1/elasticsearch/field-values
 * Агрегация топ-N значений поля (для виджета в боковой панели).
 */
export async function fetchFieldTopValues(
  request: FieldValuesRequest,
  user: UserConfig,
  config: AppConfig,
): Promise<FieldValuesResponse> {
  const { filters, ...rest } = request
  const body: FieldValuesRequest = filters?.length ? { ...rest, filters } : rest
  return apiFetch<FieldValuesResponse>('/api/v1/elasticsearch/field-values', user, config, {
    method: 'POST',
    body,
  })
}

// ─── Quick filter stat ────────────────────────────────────────────────────────

/**
 * POST /api/v1/elasticsearch/quick-filter-stat
 * Топ-N значений поля для подсказок в FilterBuilder.
 */
export async function fetchQuickFilterStat(
  request: QuickFilterStatRequest,
  user: UserConfig,
  config: AppConfig,
): Promise<FieldValuesResponse> {
  return apiFetch<FieldValuesResponse>('/api/v1/elasticsearch/quick-filter-stat', user, config, {
    method: 'POST',
    body: request,
  })
}

// ─── Project codes ────────────────────────────────────────────────────────────

/**
 * Возвращает список доступных projectCode для текущего пользователя.
 * Источник: GET /api/v1/user/data → поле infoSystemCodes[].
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
 * GET /api/v1/hot/saved-searches
 * Список сохранённых поисков, видимых текущему пользователю.
 */
export async function fetchSavedSearches(
  user: UserConfig,
  config: AppConfig,
): Promise<SavedSearchGetResult> {
  return apiFetch<SavedSearchGetResult>('/api/v1/hot/saved-searches', user, config)
}

/**
 * POST /api/v1/hot/saved-searches
 * Создать новый сохранённый поиск.
 */
export async function createSavedSearch(
  request: NewSavedSearchRequest,
  user: UserConfig,
  config: AppConfig,
): Promise<SavedSearchCreateResult> {
  return apiFetch<SavedSearchCreateResult>('/api/v1/hot/saved-searches', user, config, {
    method: 'POST', body: request,
  })
}

/**
 * DELETE /api/v1/hot/saved-searches
 * Удалить по массиву ID.
 */
export async function deleteSavedSearch(
  ids: string[],
  user: UserConfig,
  config: AppConfig,
): Promise<void> {
  await apiFetch<void>('/api/v1/hot/saved-searches', user, config, {
    method: 'DELETE', body: ids,
  })
}

// ─── Request builder helpers ──────────────────────────────────────────────────

/**
 * Строит базовый LogQueryPageableRequest для заданного временного диапазона.
 */
export function buildLogRequest(
  from: Date,
  to: Date,
  overrides: {
    filters?: LogQueryPageableRequest['filters']
    pageAttributes?: Partial<OpenSearchAttributes>
    isCHRequest?: boolean
    statAttributes?: { fieldName: string; limit: number }
    needPayload?: boolean
  } = {},
  maxLogs = 100,
): LogQueryPageableRequest {
  return {
    queryAttributes: {
      startTime: from.toISOString(),
      endTime: to.toISOString(),
    },
    pageAttributes: {
      limit: maxLogs,
      order: { fieldCode: 'localTime', sorting: 'desc' },
      dateHistogramInterval: 'auto',
      ...overrides.pageAttributes,
    },
    filters: overrides.filters ?? [],
    isCHRequest: overrides.isCHRequest ?? false,
    ...(overrides.statAttributes && { statAttributes: overrides.statAttributes }),
    ...(overrides.needPayload !== undefined && { needPayload: overrides.needPayload }),
  }
}
