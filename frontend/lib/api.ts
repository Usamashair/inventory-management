export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') ||
  'https://rexapack-backend.rankmybails.com'

export const AUTH_TOKEN_KEY = 'rexapack_portal_token'
export const API_URL_STORAGE_KEY = 'rexapack_portal_api_url'

export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null
  return window.localStorage.getItem(AUTH_TOKEN_KEY)
}

export function storeAuthToken(token: string) {
  window.localStorage.setItem(AUTH_TOKEN_KEY, token)
  window.localStorage.setItem(API_URL_STORAGE_KEY, API_BASE_URL)
}

export function clearAuthToken() {
  window.localStorage.removeItem(AUTH_TOKEN_KEY)
}

/** If API base URL changed (e.g. prod → local), drop stale tokens. */
export function invalidateSessionIfApiChanged(): boolean {
  if (typeof window === 'undefined') return false
  const previous = window.localStorage.getItem(API_URL_STORAGE_KEY)
  if (previous && previous !== API_BASE_URL) {
    window.localStorage.removeItem(AUTH_TOKEN_KEY)
    window.localStorage.removeItem(API_URL_STORAGE_KEY)
    return true
  }
  return false
}

function redirectToLogin() {
  if (typeof window === 'undefined') return
  if (window.location.pathname === '/') return
  window.location.assign('/')
}

type ApiOptions = {
  method?: string
  body?: unknown
  auth?: boolean
  formData?: boolean
}

export class ApiError extends Error {
  status: number
  details?: unknown

  constructor(message: string, status: number, details?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.details = details
  }
}

export async function apiRequest<T = unknown>(
  path: string,
  options: ApiOptions = {},
): Promise<T> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
  }

  if (!options.formData) {
    headers['Content-Type'] = 'application/json'
  }

  if (options.auth !== false) {
    invalidateSessionIfApiChanged()
    const token = getAuthToken()
    if (!token) {
      redirectToLogin()
      throw new ApiError('Unauthenticated.', 401)
    }
    headers.Authorization = `Bearer ${token}`
  }

  let body: BodyInit | undefined
  if (options.body !== undefined) {
    body = options.formData
      ? (options.body as FormData)
      : JSON.stringify(options.body)
  }

  const response = await fetch(`${API_BASE_URL}/api${path}`, {
    method: options.method || 'GET',
    headers,
    body,
  })

  let payload: any = null
  const text = await response.text()
  if (text) {
    try {
      payload = JSON.parse(text)
    } catch {
      payload = text
    }
  }

  if (!response.ok) {
    const message =
      payload?.message ||
      payload?.errors?.email?.[0] ||
      (typeof payload === 'string' ? payload : 'Request failed.')

    if (response.status === 401 && options.auth !== false) {
      window.localStorage.removeItem(AUTH_TOKEN_KEY)
      window.localStorage.removeItem('rexapack_portal_user')
      window.localStorage.removeItem('rexapack_portal_last_activity')
      window.localStorage.removeItem(API_URL_STORAGE_KEY)
      redirectToLogin()
    }

    throw new ApiError(message, response.status, payload)
  }

  return payload as T
}
