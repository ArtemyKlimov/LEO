import { apiFetch } from './client'
import type { AppConfig, UserConfig } from '@/types/config'
import type {
  LogQueryPageableRequest,
  OpenSearchAttributes,
  OpenSearchResponse,
  FormData as FieldsFormData,
  FieldValuesRequest,
  FieldValuesResponse,
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
): Promise<Record<string, unknown>[]> {
  return apiFetch<Record<string, unknown>[]>('/api/v1/user/data', user, config)
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
  return apiFetch<FieldValuesResponse>('/api/v1/elasticsearch/field-values', user, config, {
    method: 'POST',
    body: request,
  })
}

// ─── Project codes ────────────────────────────────────────────────────────────

// TODO: раскомментировать когда бэк реализует /api/v1/elasticsearch/projectCodes
// interface ProjectCodesResponse { projectCodes: string[] }
// export async function fetchProjectCodes(
//   user: UserConfig,
//   config: AppConfig,
// ): Promise<string[]> {
//   const res = await apiFetch<ProjectCodesResponse>('/api/v1/elasticsearch/projectCodes', user, config)
//   return res.projectCodes ?? []
// }

/** Временный stub: фиксированный список проектов до реализации эндпоинта на бэке */
export async function fetchProjectCodes(
  _user: UserConfig,
  _config: AppConfig,
): Promise<string[]> {
  return ['TSLG', 'AUQR', 'CPRO']
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
  }
}
