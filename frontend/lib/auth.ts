import {
  apiRequest,
  clearAuthToken,
  getAuthToken,
  invalidateSessionIfApiChanged,
  storeAuthToken,
  API_BASE_URL,
  API_URL_STORAGE_KEY,
} from '@/lib/api'

export type UserRole = 'admin' | 'staff' | 'customer'

export interface PortalUser {
  id?: number
  email: string
  name: string
  role: UserRole
  address?: string | null
  city?: string | null
  postCode?: string | null
  phone?: string | null
}

/** Admin and staff share the same elevated permissions. */
export function isStaffOrAdmin(user?: PortalUser | null): boolean {
  return user?.role === 'admin' || user?.role === 'staff'
}

/** Strict admin-only checks (e.g. Staff management page). */
export function isAdmin(user?: PortalUser | null): boolean {
  return user?.role === 'admin'
}

/** Display label for the signed-in user's role. */
export function roleLabel(user?: PortalUser | null): string {
  switch (user?.role) {
    case 'admin':
      return 'Administrator'
    case 'staff':
      return 'Staff'
    case 'customer':
      return 'Customer'
    default:
      return 'Account'
  }
}

/** Short initials for avatar badges. */
export function roleInitials(user?: PortalUser | null): string {
  switch (user?.role) {
    case 'admin':
      return 'AD'
    case 'staff':
      return 'ST'
    default:
      return 'CU'
  }
}

export const AUTH_STORAGE_KEY = 'rexapack_portal_user'
export const AUTH_ACTIVITY_KEY = 'rexapack_portal_last_activity'
export const AUTH_VALIDATED_AT_KEY = 'rexapack_portal_validated_at'
export const IDLE_TIMEOUT_MS = 60 * 60 * 1000 // 1 hour
const SESSION_VALIDATE_CACHE_MS = 2 * 60 * 1000 // 2 minutes

export function getStoredUser(): PortalUser | null {
  if (typeof window === 'undefined') return null

  const storedUser = window.localStorage.getItem(AUTH_STORAGE_KEY)
  if (!storedUser) return null

  try {
    return JSON.parse(storedUser) as PortalUser
  } catch {
    window.localStorage.removeItem(AUTH_STORAGE_KEY)
    return null
  }
}

export function storeUser(user: PortalUser) {
  window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user))
}

export async function updateProfile(body: {
  name?: string
  email?: string
  address?: string | null
  city?: string | null
  postCode?: string | null
  phone?: string | null
  currentPassword?: string
  password?: string
  password_confirmation?: string
}): Promise<PortalUser> {
  const response = await apiRequest<{ user: PortalUser; message?: string }>('/me', {
    method: 'PUT',
    body,
  })
  if (response.user) {
    storeUser(response.user)
  }
  return response.user
}

export function clearStoredUser() {
  window.localStorage.removeItem(AUTH_STORAGE_KEY)
  window.localStorage.removeItem(AUTH_ACTIVITY_KEY)
  window.localStorage.removeItem(AUTH_VALIDATED_AT_KEY)
  window.localStorage.removeItem(API_URL_STORAGE_KEY)
  clearAuthToken()
}

export function touchActivity() {
  if (typeof window === 'undefined') return
  if (!getAuthToken() || !getStoredUser()) return
  window.localStorage.setItem(AUTH_ACTIVITY_KEY, String(Date.now()))
}

export function getLastActivity(): number | null {
  if (typeof window === 'undefined') return null
  const raw = window.localStorage.getItem(AUTH_ACTIVITY_KEY)
  if (!raw) return null
  const value = Number(raw)
  return Number.isFinite(value) ? value : null
}

export function isIdleExpired(): boolean {
  const lastActivity = getLastActivity()
  if (!lastActivity) return false
  return Date.now() - lastActivity > IDLE_TIMEOUT_MS
}

/** Requires token + user, and activity within the last hour. */
export function isAuthenticated(): boolean {
  if (typeof window === 'undefined') return false

  if (invalidateSessionIfApiChanged()) {
    clearStoredUser()
    return false
  }

  const token = getAuthToken()
  const user = getStoredUser()
  if (!token || !user?.email || !user?.role) return false

  if (isIdleExpired()) {
    clearStoredUser()
    return false
  }

  return true
}

/** Confirm the bearer token is still valid against the current API. */
export async function validateSession(): Promise<boolean> {
  if (!isAuthenticated()) return false

  const lastValidatedRaw = window.localStorage.getItem(AUTH_VALIDATED_AT_KEY)
  const lastValidated = Number(lastValidatedRaw || '0')
  if (Number.isFinite(lastValidated) && Date.now() - lastValidated < SESSION_VALIDATE_CACHE_MS) {
    touchActivity()
    return true
  }

  try {
    const response = await apiRequest<{ user: PortalUser }>('/me')
    if (response.user) {
      storeUser(response.user)
      touchActivity()
      window.localStorage.setItem(AUTH_VALIDATED_AT_KEY, String(Date.now()))
      return true
    }
    clearStoredUser()
    return false
  } catch {
    clearStoredUser()
    return false
  }
}

export async function login(email: string, password: string): Promise<PortalUser> {
  const response = await apiRequest<{
    token: string
    user: PortalUser
  }>('/login', {
    method: 'POST',
    body: { email, password },
    auth: false,
  })

  if (!response.token || !response.user) {
    throw new Error('Login failed: missing token or user from API.')
  }

  storeAuthToken(response.token)
  storeUser(response.user)
  window.localStorage.setItem(AUTH_ACTIVITY_KEY, String(Date.now()))
  window.localStorage.setItem(AUTH_VALIDATED_AT_KEY, String(Date.now()))
  window.localStorage.setItem(API_URL_STORAGE_KEY, API_BASE_URL)

  return response.user
}

export async function logout(): Promise<void> {
  try {
    await apiRequest('/logout', { method: 'POST' })
  } catch {
    // Clear local session even if API logout fails.
  } finally {
    clearStoredUser()
  }
}
