import { tenantFetch } from '@/lib/tenant-fetch'
const API_BASE_URL = (
  process.env.INTERNAL_API_BASE_URL ||
  'http://localhost:4000'
).replace(/\/$/, '')

export type CatalogEntry = {
  id: string
  name: string
  description?: string
  updatedAt?: string
}

async function fetchList(endpoint: string): Promise<CatalogEntry[]> {
  try {
    const res = await tenantFetch(`${API_BASE_URL}${endpoint}`, {
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) return []
    const body = await res.json()
    const list: unknown[] = Array.isArray(body) ? body : body?.data || body?.items || []
    return list
      .map((raw) => {
        const item = raw as Record<string, unknown>
        const name = (item.name || item.title) as string | undefined
        return {
          id: String(item.id ?? ''),
          name: name?.trim() ?? '',
          description: typeof item.description === 'string' ? item.description : undefined,
          updatedAt: (item.updatedAt || item.updated_at) as string | undefined,
        }
      })
      .filter((item) => item.id && item.name)
  } catch {
    return []
  }
}

/** Public, indexable catalogue used by the sitemap. Empty on API failure. */
export async function getPublicCatalog() {
  const [services, packages, team] = await Promise.all([
    fetchList('/service/active'),
    fetchList('/makeover-packages'),
    fetchList('/employee/basic'),
  ])
  return { services, packages, team }
}
