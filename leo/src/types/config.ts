// ─── Config YAML types ───────────────────────────────────────────────────────

export interface ServerBackendConfig {
  protocol: 'http' | 'https'
  host: string
  port: number
}

export interface ServerConfig {
  port: number
  protocol: 'http' | 'https'
  backend: ServerBackendConfig
}

export interface JwtFieldConfig {
  name: string
  value: string
}

export interface JwtConfig {
  algorithm: string
  secret: string
  expiration: number
  fields: JwtFieldConfig[]
}

export interface AuthConfig {
  jwt: JwtConfig
}

export interface UserConfig {
  userId: string
  role?: string
  channel?: string
  jwt?: string
  displayName?: string
}

export interface LoggingConfig {
  maxLogsPerPage: number
  histogramBuckets: number
}

export interface UiConfig {
  theme: 'light' | 'dark'
  timeFormat: string
  refreshInterval: number
}

export interface AppConfig {
  server: ServerConfig
  auth: AuthConfig
  users: UserConfig[]
  logging: LoggingConfig
  ui: UiConfig
}
