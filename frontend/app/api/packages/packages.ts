import { tenantFetch } from '@/lib/tenant-fetch'
const API_BASE_URL =
  process.env.INTERNAL_API_BASE_URL ||
  "http://localhost:4000"

export async function getPublicPackages() {
  try {
    const res = await tenantFetch(`${API_BASE_URL}/makeover-packages`, {
      next: { revalidate: 300 },
    })

    if (!res.ok) {
      console.error(`Failed to fetch packages: ${res.status} ${res.statusText}`)
      return []
    }

    const text = await res.text()
    const data = text ? JSON.parse(text) : []
    return Array.isArray(data) ? data : data?.data || []
  } catch (error) {
    console.error("Error fetching packages:", error)
    return []
  }
}
