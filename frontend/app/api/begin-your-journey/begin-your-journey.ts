import { tenantFetch } from '@/lib/tenant-fetch'
const API_BASE_URL =
  process.env.INTERNAL_API_BASE_URL ||
  "http://localhost:4000"

export async function getBeginYourJourneyImage(): Promise<string | null> {
  try {
    const res = await tenantFetch(`${API_BASE_URL}/begin-your-journey`, {
      next: { revalidate: 300 },
    })
    if (!res.ok) return null
    const data = await res.json()
    return typeof data?.imageUrl === "string" ? data.imageUrl : null
  } catch {
    return null
  }
}
