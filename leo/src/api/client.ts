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
  const { method = 'GET', body, timeoutMs = DEFAULT_TIMEOUT_MS, skipRefresh = false } = options

  const token = await getToken(user, config)

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

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

  return response.json() as Promise<T>
}
