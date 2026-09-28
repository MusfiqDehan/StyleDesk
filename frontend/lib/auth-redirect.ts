import { canAccessPath, type User } from '@/app/admin/lib/auth-utils'

const ROLE_HOME: Record<string, string> = {
  superadmin: '/platform-ui/admin',
  admin: '/admin',
  storeManager: '/admin/manager',
  staff: '/admin/staff',
  stylist: '/admin/stylist',
  custom: '/admin',
}

const AUTH_PAGES = ['/login', '/register', '/forgot-password', '/reset-password', '/admin/login']

export function roleHomePath(role?: string | null): string {
  if (!role) return '/'
  if (role === 'customer') return '/customer-dashboard'
  return ROLE_HOME[role] ?? '/admin'
}

/** Only same-origin absolute paths are honoured, so `next` cannot become an open redirect. */
export function safeNextPath(next?: string | null): string | null {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return null
  const pathname = next.split(/[?#]/)[0]
  if (AUTH_PAGES.some((page) => pathname === page || pathname.startsWith(`${page}/`))) return null
  return next
}

export function postLoginPath(role?: string | null, next?: string | null): string {
  const home = roleHomePath(role)
  const target = safeNextPath(next)
  if (!target) return home
  const isWorkspaceUser = home === '/admin' || home.startsWith('/admin/')
  const isWorkspacePath = target === '/admin' || target.startsWith('/admin/')
  return isWorkspaceUser === isWorkspacePath ? target : home
}

/** Select a landing page using live bootstrap permissions and package entitlements. */
export function permittedLoginPath(user: User, next?: string | null): string {
  if (user.role === 'superadmin') return safeNextPath(next) ?? '/platform-ui/admin'
  if (user.role === 'customer') return postLoginPath('customer', next)
  if (!user.operational) return user.role === 'admin' ? '/billing' : '/admin'
  const target = safeNextPath(next)
  if (target && (target === '/admin' || target.startsWith('/admin/')) && canAccessPath(user, target)) return target
  const preferred = roleHomePath(user.role)
  if (canAccessPath(user, preferred)) return preferred
  const first = user.catalog?.find(entry => entry.path?.startsWith('/admin') && canAccessPath(user, entry.path))
  return first?.path ?? '/admin/update-password'
}

export function loginPathFor(next?: string | null, workspace = false): string {
  const params = new URLSearchParams()
  // Workspace intent is carried by the return path; it never grants access.
  void workspace
  const target = safeNextPath(next)
  if (target) params.set('next', target)
  const query = params.toString()
  return query ? `/login?${query}` : '/login'
}

/** Clears both the JS-readable token and the API's httpOnly cookie (same site under /api). */
export async function signOut(redirectTo = '/'): Promise<void> {
  const apiBase = ('/api/backend').replace(/\/$/, '')
  try {
    await fetch(`${apiBase}/auth/logout`, { method: 'POST', credentials: 'include' })
  } catch { /* offline — local state is still cleared below */ }
  try { localStorage.removeItem('accessToken') } catch { }
  try { localStorage.removeItem('userPhone') } catch { }
  document.cookie = 'accessToken=; path=/; max-age=0; samesite=strict'
  window.location.href = redirectTo
}
