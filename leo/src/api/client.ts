import { getToken, refreshToken } from '@/auth/jwtService'
import type { AppConfig, UserConfig } from '@/types/config'

// ─── Error type ───────────────────────────────────────────────────────────────

export class ApiError extends Error {
  readonly status: number
  readonly body?: unknown

  constructor(status: number, message: string, body?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.body = body
  }
}

// ─── Request options ──────────────────────────────────────────────────────────

interface FetchOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  body?: unknown
  timeoutMs?: number
  /** External AbortSignal — позволяет отменить запрос извне (например, из useEffect cleanup) */
  signal?: AbortSignal
  /** Skip 401-retry (used internally to avoid infinite loop) */
  skipRefresh?: boolean
}

const DEFAULT_TIMEOUT_MS = 30_000

// ─── Core fetch ───────────────────────────────────────────────────────────────

export async function apiFetch<T>(
  path: string,
  user: UserConfig,
  config: AppConfig,
  options: FetchOptions = {},
): Promise<T> {
  const { method = 'GET', body, timeoutMs = DEFAULT_TIMEOUT_MS, signal: externalSignal, skipRefresh = false } = options

  const token = await getToken(user, config)

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  // Propagate external cancellation into the internal controller
  if (externalSignal) {
    if (externalSignal.aborted) {
      clearTimeout(timer)
      throw new ApiError(0, 'Aborted')
    }
    externalSignal.addEventListener('abort', () => controller.abort(), { once: true })
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    // Content-Type только для запросов с телом — иначе Spring отвергает GET/DELETE
    ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
  }

  let response: Response
  try {
    response = await fetch(path, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    })
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new ApiError(0, `Request timed out after ${timeoutMs}ms`)
    }
    throw new ApiError(0, err instanceof Error ? err.message : 'Network error')
  } finally {
    clearTimeout(timer)
  }

  // 401: try refreshing the token once
  if (response.status === 401 && !skipRefresh) {
    const newToken = await refreshToken(user, config)
    if (newToken !== token) {
      return apiFetch<T>(path, user, config, { ...options, skipRefresh: true })
    }
  }

  if (!response.ok) {
    let errorBody: unknown
    try {
      errorBody = await response.json()
    } catch {
      errorBody = await response.text().catch(() => undefined)
    }
    throw new ApiError(response.status, `HTTP ${response.status} ${response.statusText}`, errorBody)
  }

  // 204 No Content
  if (response.status === 204) return undefined as T

  // snowLogId exceeds Number.MAX_SAFE_INTEGER and gets silently rounded by JSON.parse.
  // Pre-process the raw text to convert it to a string before parsing.
  // Some backend responses are malformed JSON: missing commas between array elements
  // (e.g. `"foo"\n"bar"`) or trailing commas before `]`/`}`.
  const text = await response.text()
  const safe = text
    .replace(/"snowLogId"\s*:\s*(\d+)/g, '"snowLogId": "$1"')
    .replace(/"[ \t]*\r?\n[ \t]*"/g, '",\n"')
    .replace(/,(\s*[}\]])/g, '$1')
  return JSON.parse(safe) as T
}

// ─── Binary fetch (for zip/blob responses) ────────────────────────────────────

export async function apiFetchBlob(
  path: string,
  user: UserConfig,
  config: AppConfig,
  options: FetchOptions = {},
): Promise<Blob> {
  const { method = 'GET', body, timeoutMs = DEFAULT_TIMEOUT_MS, signal: externalSignal, skipRefresh = false } = options

  const token = await getToken(user, config)

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  if (externalSignal) {
    if (externalSignal.aborted) {
      clearTimeout(timer)
      throw new ApiError(0, 'Aborted')
    }
    externalSignal.addEventListener('abort', () => controller.abort(), { once: true })
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
  }

  let response: Response
  try {
    response = await fetch(path, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    })
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new ApiError(0, `Request timed out after ${timeoutMs}ms`)
    }
    throw new ApiError(0, err instanceof Error ? err.message : 'Network error')
  } finally {
    clearTimeout(timer)
  }

  if (response.status === 401 && !skipRefresh) {
    const newToken = await refreshToken(user, config)
    if (newToken !== token) {
      return apiFetchBlob(path, user, config, { ...options, skipRefresh: true })
    }
  }

  if (!response.ok) {
    let errorBody: unknown
    try {
      errorBody = await response.json()
    } catch {
      errorBody = await response.text().catch(() => undefined)
    }
    throw new ApiError(response.status, `HTTP ${response.status} ${response.statusText}`, errorBody)
  }

  return response.blob()
}
