import yaml from 'js-yaml'
import type { AppConfig } from '@/types/config'

let cachedConfig: AppConfig | null = null

export async function loadConfig(): Promise<AppConfig> {
  if (cachedConfig) return cachedConfig

  const response = await fetch('/config.yaml')
  if (!response.ok) {
    throw new Error(`Failed to load config.yaml: ${response.status} ${response.statusText}`)
  }

  const text = await response.text()
  const parsed = yaml.load(text) as AppConfig

  cachedConfig = parsed
  return parsed
}

export function getBackendUrl(config: AppConfig): string {
  const { protocol, host, port } = config.server.backend
  return `${protocol}://${host}:${port}`
}
