import { SignJWT, decodeJwt, importPKCS8 } from 'jose'
import type { AppConfig, UserConfig, JwtConfig } from '@/types/config'

// ─── Cache key helpers ────────────────────────────────────────────────────────

const CACHE_PREFIX = 'leo_jwt_'

function cacheKey(userId: string): string {
  return `${CACHE_PREFIX}${userId}`
}

// ─── Token cache (localStorage) ───────────────────────────────────────────────

function saveToken(userId: string, token: string): void {
  try {
    localStorage.setItem(cacheKey(userId), token)
  } catch {
    // localStorage unavailable — ignore
  }
}

function loadToken(userId: string): string | null {
  try {
    return localStorage.getItem(cacheKey(userId))
  } catch {
    return null
  }
}

function removeToken(userId: string): void {
  try {
    localStorage.removeItem(cacheKey(userId))
  } catch {
    // ignore
  }
}

// ─── Token validity ───────────────────────────────────────────────────────────

export function isTokenExpired(token: string): boolean {
  try {
    const payload = decodeJwt(token)
    if (payload.exp === undefined) return false
    // add 10-second buffer
    return payload.exp * 1000 < Date.now() + 10_000
  } catch {
    return true
  }
}

// ─── Signing key factory ──────────────────────────────────────────────────────

async function buildSigningKey(jwtCfg: JwtConfig): Promise<{ key: unknown; alg: string }> {
  const { algorithm, secret } = jwtCfg

  // EC / RSA asymmetric algorithms — need a PEM private key
  if (/^(ES|RS|PS)\d+$/.test(algorithm)) {
    if (secret.includes('-----BEGIN')) {
      try {
        const key = await importPKCS8(secret, algorithm)
        return { key, alg: algorithm }
      } catch {
        // fall through to HMAC fallback
      }
    }
    // Secret is not a PEM key — fall back to HS256
    const fallbackAlg = 'HS256'
    const key = new TextEncoder().encode(secret)
    return { key, alg: fallbackAlg }
  }

  // HMAC algorithms (HS256 / HS384 / HS512)
  const key = new TextEncoder().encode(secret)
  return { key, alg: algorithm }
}

// ─── Field template substitution ─────────────────────────────────────────────

function resolveFieldValue(template: string, user: UserConfig): string {
  return template
    .replace('${userId}', user.userId)
    .replace('${channel}', user.channel ?? '')
}

// ─── Token generation ─────────────────────────────────────────────────────────

async function generateToken(user: UserConfig, config: AppConfig): Promise<string> {
  const jwtCfg = config.auth.jwt
  const { key, alg } = await buildSigningKey(jwtCfg)

  // Build payload from config fields
  const payload: Record<string, string> = {}
  for (const field of jwtCfg.fields) {
    payload[field.name] = resolveFieldValue(field.value, user)
  }

  const now = Math.floor(Date.now() / 1000)

  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg, typ: 'JWT' })
    .setIssuedAt(now)
    .setExpirationTime(now + jwtCfg.expiration)
    .sign(key as Parameters<SignJWT['sign']>[0])

  return token
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns a valid JWT for the given user.
 * - If user.jwt is set in config and not expired → use it.
 * - Otherwise check localStorage cache; regenerate if missing or expired.
 */
export async function getToken(user: UserConfig, config: AppConfig): Promise<string> {
  // 1. Preset JWT in config (e.g. IBuser)
  if (user.jwt) {
    if (!isTokenExpired(user.jwt)) return user.jwt
    // Preset token expired — can't regenerate without the private key;
    // return it anyway and let the backend reject if needed
    return user.jwt
  }

  // 2. Try cached token
  const cached = loadToken(user.userId)
  if (cached && !isTokenExpired(cached)) return cached

  // 3. Generate fresh token
  const token = await generateToken(user, config)
  saveToken(user.userId, token)
  return token
}

/**
 * Forces token regeneration for a user (e.g. after 401 response).
 */
export async function refreshToken(user: UserConfig, config: AppConfig): Promise<string> {
  if (user.jwt) return user.jwt // can't refresh preset tokens
  removeToken(user.userId)
  return getToken(user, config)
}

/**
 * Clears cached token for a user (on logout).
 */
export function clearToken(userId: string): void {
  removeToken(userId)
}
