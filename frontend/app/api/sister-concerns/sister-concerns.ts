import { tenantFetch } from '@/lib/tenant-fetch'
const API_BASE_URL = process.env.INTERNAL_API_BASE_URL || 'http://localhost:4000'

import type { SisterConcernsData } from '@/lib/sister-concerns'
export { SISTER_CONCERNS_DEFAULTS, resolveSisterConcernsContent } from '@/lib/sister-concerns'
export type { SisterConcernsData } from '@/lib/sister-concerns'
export async function getSisterConcerns(): Promise<SisterConcernsData | null> {
  try {
    const res = await tenantFetch(`${API_BASE_URL}/sister-concerns`, {
      next: { revalidate: 300 },
    })

    if (!res.ok) {
      console.error(`Failed to fetch sister concerns: ${res.status} ${res.statusText}`)
      return null
    }

    const text = await res.text()
    return text ? JSON.parse(text) : null
  } catch (error) {
    console.error('Error fetching sister concerns:', error)
    return null
  }
}
