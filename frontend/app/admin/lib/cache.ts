/** Normalize list API payloads to an array. */
export function asList<T = any>(data: unknown): T[] {
  if (Array.isArray(data)) return data
  if (data && typeof data === 'object') {
    const body = data as Record<string, unknown>
    if (Array.isArray(body.data)) return body.data as T[]
    if (Array.isArray(body.items)) return body.items as T[]
    if (Array.isArray(body.results)) return body.results as T[]
  }
  return []
}

// Cache key constants — must match the id passed to each api.get() call
export const CACHE = {
  DASHBOARD: 'dashboard',
  APPOINTMENTS: 'appointments',
  CLIENTS: 'clients',
  EMPLOYEES: 'employees',
  EMPLOYEES_BASIC: 'employees-basic',
  EMPLOYEES_STYLISTS: 'employees-stylists',
  SERVICES: 'services',
  SERVICES_ACTIVE: 'services-active',
  INVENTORY: 'inventory',
  BILLING: 'billing',
  REPORTS: 'reports',
  STAFF_REPORTS: 'staff-reports',
  USER_MANAGEMENT: 'user-management',
  BUSINESS_INFO: 'business-info',
  INVOICE_SETTING: 'invoice-setting',
  APPOINTMENT_SETTING: 'appointment-setting',
  PAYROLL: 'payroll',
  PACKAGES: 'packages',
  LEAVE_REQUEST: 'leave-request',
  FINANCE: 'finance',
} as const

/** Mark one or more resources as stale so the next GET bypasses cache */
export function markStale(...keys: string[]) {
  if (typeof window === 'undefined') return
  try {
    const raw = localStorage.getItem('aci-stale-keys')
    const stale = new Set<string>(raw ? JSON.parse(raw) : [])
    keys.forEach(k => {
      stale.add(k)
      // Also clear concrete axios-cache entries (including filter-suffixed ids)
      clearCacheByPrefix(k)
    })
    localStorage.setItem('aci-stale-keys', JSON.stringify(Array.from(stale)))
  } catch { }
}

/**
 * Immediately remove the axios-cache-interceptor localStorage entries that start with a prefix.
 */
export function clearCacheByPrefix(prefix: string) {
  if (typeof window === 'undefined') return
  try {
    const keysToRemove: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && (key.startsWith(`aci:${prefix}`) || key === `aci:${prefix}`)) {
        keysToRemove.push(key)
      }
    }
    keysToRemove.forEach(k => localStorage.removeItem(k))
  } catch { }
}

/**
 * Immediately remove the axios-cache-interceptor localStorage entry for one or
 * more keys.  Call this when you need the cache gone NOW rather than waiting
 * for the next fetch to consume a stale flag.
 */
export function removeFromCache(...keys: string[]) {
  if (typeof window === 'undefined') return
  keys.forEach((k) => {
    try {
      localStorage.removeItem(`aci:${k}`)
    } catch { }
  })
}

/**
 * Consume the stale flag for a key.
 * Returns true after markStale. Keeps the flag briefly so parallel GETs
 * (overview + trend + ledger) all bypass cache, then clears on the next tick.
 */
export function consumeStale(key: string): boolean {
  if (typeof window === 'undefined') return false
  try {
    const raw = localStorage.getItem('aci-stale-keys')
    if (!raw) return false
    const staleList = JSON.parse(raw) as string[]
    const stale = new Set<string>(staleList)

    if (stale.has(key)) {
      // Defer clearing so concurrent finance/invoice fetches all see override=true
      queueMicrotask(() => {
        try {
          const latestRaw = localStorage.getItem('aci-stale-keys')
          if (!latestRaw) return
          const latest = new Set<string>(JSON.parse(latestRaw) as string[])
          if (!latest.has(key)) return
          latest.delete(key)
          localStorage.setItem('aci-stale-keys', JSON.stringify(Array.from(latest)))
        } catch { /* ignore */ }
      })
      return true
    }
  } catch { }
  return false
}
