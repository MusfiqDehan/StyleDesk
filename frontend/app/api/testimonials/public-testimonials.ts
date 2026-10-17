import { tenantFetch } from '@/lib/tenant-fetch'
const API_BASE_URL =
  process.env.INTERNAL_API_BASE_URL ||
  "http://localhost:4000"

export interface PublicTestimonial {
  description?: string
  name?: string
  position?: string
  imageUrl?: string
}

export async function getPublicTestimonials(): Promise<PublicTestimonial[]> {
  try {
    const res = await tenantFetch(`${API_BASE_URL}/testimonial`, {
      next: { revalidate: 300 },
    })
    if (!res.ok) return []
    const data = await res.json()
    return Array.isArray(data) ? data : []
  } catch {
    return []
  }
}
